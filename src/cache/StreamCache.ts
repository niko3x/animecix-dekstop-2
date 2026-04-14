import { EventEmitter } from 'node:events';
import { StorageService } from '../storage/StorageService';
import { CacheEvictor } from './CacheEvictor';
import { HlsMuxer, parseM3u8 } from './HlsMuxer';
import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// Known video CDN domains for transparent caching filter (T-03-17)
const VIDEO_CDN_DOMAINS = ['tau-video.xyz'];

/**
 * Check if a URL is a video segment from a known CDN domain.
 */
function isVideoSegmentUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    // Accept .ts HLS segments from any CDN domain
    if (parsed.pathname.endsWith('.ts')) {
      return VIDEO_CDN_DOMAINS.some((domain) => hostname.includes(domain));
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Download a file from a URL to a local path using native http/https.
 */
function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const file = fs.createWriteStream(destPath);

    client
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          fs.unlink(destPath, () => {});
          downloadFile(res.headers.location!, destPath).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200 && res.statusCode !== 206) {
          file.close();
          fs.unlink(destPath, () => {});
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
        file.on('error', (err) => {
          file.close();
          fs.unlink(destPath, () => {});
          reject(err);
        });
      })
      .on('error', (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
  });
}

/**
 * Fetch the text content of a URL.
 */
function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    client
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          fetchText(res.headers.location!).then(resolve).catch(reject);
          return;
        }
        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk.toString()));
        res.on('end', () => resolve(data));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

/**
 * StreamCache — implements TWO complementary caching paths per D-05:
 *
 * Path 1: TRANSPARENT auto-caching via session.webRequest.onCompleted
 *   - Intercepts completed video segment requests with NO player changes
 *   - Passive observation: player streams normally, StreamCache watches what URLs were fetched
 *   - Background re-fetch happens AFTER playback, not during (no bandwidth competition)
 *
 * Path 2: Explicit cache:episode IPC for user-initiated caching
 *   - Called directly with episode metadata
 *   - Downloads HLS or direct MP4 on demand
 *
 * Both paths respect the LRU size cap via CacheEvictor.
 */
export class StreamCache extends EventEmitter {
  private storage: StorageService;
  private evictor: CacheEvictor;
  private cacheDir: string;
  private isCaching: boolean = false;

  // --- Transparent auto-caching state (D-05) ---
  // Tracks video segment URLs per episode as they complete via session.webRequest.onCompleted
  private currentEpisodeId: string | null = null;
  private currentEpisodeSubs: { language: string; url: string }[] = [];
  private segmentUrls: Map<string, string[]> = new Map(); // episodeId -> segment URLs

  constructor(storage: StorageService, cacheDir: string) {
    super();
    this.storage = storage;
    this.cacheDir = cacheDir;
    this.evictor = new CacheEvictor(storage);
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  // ─── Path 1: Transparent auto-caching ─────────────────────────────────────

  /**
   * Register session.webRequest.onCompleted listener to transparently intercept
   * completed video segment requests. Call this once from main.ts after app is ready.
   *
   * The listener is PASSIVE — it only observes completed requests, never modifies them.
   * No player changes needed.
   */
  setupTransparentCaching(session: Electron.Session): void {
    session.webRequest.onCompleted({ urls: ['*://*/*'] }, (details) => {
      const { url, statusCode } = details;
      this.onSegmentCompleted(url, statusCode);
    });
  }

  /**
   * Called from main.ts when website sends episode video data.
   * Sets the current episode being watched so segment tracking knows which episode
   * the incoming segment URLs belong to.
   */
  setCurrentEpisode(episodeId: string, subs: { language: string; url: string }[]): void {
    this.currentEpisodeId = episodeId;
    this.currentEpisodeSubs = subs;
    // Initialize segment tracking list for this episode if not already present
    if (!this.segmentUrls.has(episodeId)) {
      this.segmentUrls.set(episodeId, []);
    }
  }

  /**
   * Called by the session.webRequest.onCompleted handler for each completed request.
   * Tracks video segment URLs in memory — no disk writes during playback.
   *
   * Security (T-03-17): Only tracks URLs from known CDN domains (.ts segments from tau-video.xyz).
   * Raw URLs are never logged or persisted beyond the in-memory segment tracking map.
   */
  onSegmentCompleted(url: string, statusCode: number): void {
    if (!this.currentEpisodeId) return;
    if (statusCode !== 200 && statusCode !== 206) return;
    if (!isVideoSegmentUrl(url)) return;

    const segments = this.segmentUrls.get(this.currentEpisodeId);
    if (segments && !segments.includes(url)) {
      segments.push(url);
    }
  }

  /**
   * Called when episode playback ends (e.g., new episode loaded, explicit IPC from renderer).
   * Triggers background download and muxing of tracked segments — fully transparent.
   * The player never knew about any of this.
   */
  finalizeEpisodeCache(episodeId: string): void {
    const segments = this.segmentUrls.get(episodeId);
    if (!segments || segments.length === 0) return;

    // Skip if already cached
    const existing = this.storage.getCacheEntry(episodeId);
    if (existing) return;

    // Fire-and-forget background cache task
    const subs = this.currentEpisodeId === episodeId ? this.currentEpisodeSubs : [];
    this._backgroundCacheFromSegments(episodeId, segments, subs).catch(() => {
      // Graceful degradation: if caching fails, episode simply won't be cached
    });
  }

  private async _backgroundCacheFromSegments(
    episodeId: string,
    segmentUrls: string[],
    subs: { language: string; url: string }[],
  ): Promise<void> {
    const episodeDir = path.join(this.cacheDir, episodeId);
    fs.mkdirSync(episodeDir, { recursive: true });

    const segmentDir = path.join(episodeDir, '_segments');
    fs.mkdirSync(segmentDir, { recursive: true });

    // Re-download all tracked segments
    const segmentPaths: string[] = [];
    for (let i = 0; i < segmentUrls.length; i++) {
      const segPath = path.join(segmentDir, `seg${i}.ts`);
      await downloadFile(segmentUrls[i], segPath);
      segmentPaths.push(segPath);
    }

    // Mux to MP4
    const mp4Path = path.join(episodeDir, 'video.mp4');
    await HlsMuxer.mux(segmentPaths, mp4Path);

    // Clean up temp segments
    for (const segPath of segmentPaths) {
      try {
        fs.unlinkSync(segPath);
      } catch {
        /* ignore */
      }
    }
    try {
      fs.rmdirSync(segmentDir);
    } catch {
      /* ignore */
    }

    // Download subtitles
    const subPathsArray: { language: string; path: string }[] = [];
    for (const sub of subs) {
      const subPath = path.join(episodeDir, sub.language + '.ass');
      try {
        await downloadFile(sub.url, subPath);
        subPathsArray.push({ language: sub.language, path: subPath });
      } catch {
        /* subtitle download failure is non-fatal */
      }
    }

    // Compute total size
    let sizeBytes = 0;
    try {
      sizeBytes += fs.statSync(mp4Path).size;
    } catch {
      /* ignore */
    }
    for (const sub of subPathsArray) {
      try {
        sizeBytes += fs.statSync(sub.path).size;
      } catch {
        /* ignore */
      }
    }

    // Evict if needed before adding
    this.evictor.evictIfNeeded();

    // Persist to storage
    this.storage.addCacheEntry({
      episodeId,
      mp4Path,
      subPaths: JSON.stringify(subPathsArray),
      sizeBytes,
    });

    // Clean up segment URL tracking (no longer needed)
    this.segmentUrls.delete(episodeId);

    this.emit('cached', episodeId);
  }

  // ─── Path 2: Explicit cache:episode IPC ───────────────────────────────────

  /**
   * Explicitly cache an episode for offline playback.
   * Called via cache:episode IPC from the renderer when user requests it,
   * or from main.ts after receiving video data.
   *
   * - Skips if already cached
   * - Evicts oldest entries first to stay within size cap
   * - Handles both HLS (.m3u8) and direct MP4 sources
   * - Downloads all subtitle tracks alongside video
   */
  async cacheEpisode(
    episodeId: string,
    videoUrl: string,
    isHls: boolean,
    subs: { language: string; url: string }[],
  ): Promise<void> {
    // Skip if already cached
    const existing = this.storage.getCacheEntry(episodeId);
    if (existing) return;

    // Evict oldest entries to make space before downloading
    this.evictor.evictIfNeeded();

    const episodeDir = path.join(this.cacheDir, episodeId);
    fs.mkdirSync(episodeDir, { recursive: true });

    let mp4Path: string;

    if (isHls) {
      // Download HLS playlist and segments, then mux to MP4
      const playlistContent = await fetchText(videoUrl);
      const segmentUrls = parseM3u8(playlistContent, videoUrl);

      const segmentDir = path.join(episodeDir, '_segments');
      fs.mkdirSync(segmentDir, { recursive: true });

      const segmentPaths: string[] = [];
      for (let i = 0; i < segmentUrls.length; i++) {
        const segPath = path.join(segmentDir, `seg${i}.ts`);
        await downloadFile(segmentUrls[i], segPath);
        segmentPaths.push(segPath);
      }

      mp4Path = path.join(episodeDir, 'video.mp4');
      await HlsMuxer.mux(segmentPaths, mp4Path);

      // Clean up temp .ts segment files
      for (const segPath of segmentPaths) {
        try {
          fs.unlinkSync(segPath);
        } catch {
          /* ignore */
        }
      }
      try {
        fs.rmdirSync(segmentDir);
      } catch {
        /* ignore */
      }
    } else {
      // Direct MP4 download
      mp4Path = path.join(episodeDir, 'video.mp4');
      await downloadFile(videoUrl, mp4Path);
    }

    // Download all subtitle files
    const subPathsArray: { language: string; path: string }[] = [];
    for (const sub of subs) {
      const subPath = path.join(episodeDir, sub.language + '.ass');
      try {
        await downloadFile(sub.url, subPath);
        subPathsArray.push({ language: sub.language, path: subPath });
      } catch {
        /* subtitle download failure is non-fatal */
      }
    }

    // Compute total size
    let sizeBytes = 0;
    try {
      sizeBytes += fs.statSync(mp4Path).size;
    } catch {
      /* ignore */
    }
    for (const sub of subPathsArray) {
      try {
        sizeBytes += fs.statSync(sub.path).size;
      } catch {
        /* ignore */
      }
    }

    // Persist to storage
    this.storage.addCacheEntry({
      episodeId,
      mp4Path,
      subPaths: JSON.stringify(subPathsArray),
      sizeBytes,
    });

    this.emit('cached', episodeId);
  }
}
