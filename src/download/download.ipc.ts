import { ipcMain, BrowserWindow, Notification } from 'electron';
import { DownloadQueue } from './DownloadQueue';
import { StreamCache } from '../cache/StreamCache';
import { StorageService } from '../storage/StorageService';
import { CacheEvictor } from '../cache/CacheEvictor';
import fs from 'node:fs';
import path from 'node:path';
import { downloadPoster } from '../library/library.ipc';

export function registerDownloadIpc(
  mainWindow: BrowserWindow,
  queue: DownloadQueue,
  cache: StreamCache,
  storage: StorageService,
  evictor: CacheEvictor,
  downloadsDir: string,
  cacheDir: string
): void {
  // --- Download control ---
  ipcMain.handle('download:start', async (_event, episodeId: string, url: string, title: string, subUrls: { language: string; url: string }[], metadata?: { animeTitle: string; seasonNumber?: string; episodeNumber?: string; translator?: string; posterUrl?: string; }) => {
    // Validate URL scheme — only https allowed per T-03-13
    if (!url.startsWith('https://')) {
      throw new Error('Only HTTPS download URLs are allowed');
    }

    // Per D-07: Save episode metadata at download time for offline library
    if (metadata) {
      const posterPath = metadata.posterUrl
        ? await downloadPoster(metadata.posterUrl, episodeId)
        : '';
      storage.upsertEpisodeMetadata({
        episodeId,
        animeTitle: metadata.animeTitle,
        seasonNumber: metadata.seasonNumber ?? '',
        episodeNumber: metadata.episodeNumber ?? '',
        translator: metadata.translator ?? '',
        posterUrl: metadata.posterUrl ?? '',
        posterPath,
        source: 'download',
      });
    }

    return queue.add(episodeId, url, title, subUrls);
  });

  ipcMain.handle('download:pause', async (_event, id: string) => queue.pause(id));
  ipcMain.handle('download:resume', async (_event, id: string) => queue.resume(id));
  ipcMain.handle('download:cancel', async (_event, id: string) => queue.cancel(id));
  ipcMain.handle('download:getQueue', async () => queue.getQueue());

  // --- Forward progress events to renderer ---
  queue.on('progress', (progress) => {
    mainWindow.webContents.send('download:progress', progress);
    // OS taskbar progress bar
    if (progress.totalBytes > 0) {
      mainWindow.setProgressBar(progress.progressPercent / 100);
    }
  });

  queue.on('downloadComplete', (item: { id: string; episodeId: string; title: string }) => {
    mainWindow.webContents.send('download:complete', {
      id: item.id,
      episodeId: item.episodeId,
      title: item.title,
    });
    // Clear taskbar progress
    mainWindow.setProgressBar(-1);
    // Desktop notification (DL-07)
    new Notification({
      title: 'AnimeciX',
      body: `${item.title} indirildi!`,
    }).show();
  });

  queue.on('queueEmpty', () => {
    mainWindow.setProgressBar(-1);
  });

  // --- Cache control ---
  ipcMain.handle('cache:episode', async (_event, episodeId: string, videoUrl: string, isHls: boolean, subs: { language: string; url: string }[], metadata?: { animeTitle: string; seasonNumber?: string; episodeNumber?: string; translator?: string; posterUrl?: string; }) => {
    await cache.cacheEpisode(episodeId, videoUrl, isHls, subs);

    // Per D-07 + PLAY-05: Save episode metadata at cache time for offline library
    // This ensures cached (auto-watched) episodes appear in the library
    if (metadata) {
      const posterPath = metadata.posterUrl
        ? await downloadPoster(metadata.posterUrl, episodeId)
        : '';
      storage.upsertEpisodeMetadata({
        episodeId,
        animeTitle: metadata.animeTitle,
        seasonNumber: metadata.seasonNumber ?? '',
        episodeNumber: metadata.episodeNumber ?? '',
        translator: metadata.translator ?? '',
        posterUrl: metadata.posterUrl ?? '',
        posterPath,
        source: 'cache',
      });
    }
  });

  // --- Offline availability ---
  ipcMain.handle('offline:isAvailable', async (_event, episodeId: string) => {
    // Check downloads first (completed), then cache
    const dl = storage.getDownloadById(episodeId);
    if (dl && dl.status === 'completed') return true;
    const cached = storage.getCacheEntry(episodeId);
    return cached !== null;
  });

  ipcMain.handle('offline:getUrl', async (_event, episodeId: string) => {
    const dl = storage.getDownloadById(episodeId);
    if (dl && dl.status === 'completed') {
      return `animecix-offline://episode/${episodeId}/video`;
    }
    const cached = storage.getCacheEntry(episodeId);
    if (cached) {
      return `animecix-offline://episode/${episodeId}/video`;
    }
    return null;
  });

  // --- Storage management (INTG-04) ---
  ipcMain.handle('storage:getInfo', async () => {
    const downloads = storage.getAllDownloads();
    const cacheStats = storage.getCacheStats();
    let downloadsBytes = 0;
    const episodes: { episodeId: string; title: string; sizeBytes: number; isDownload: boolean }[] = [];

    for (const dl of downloads.filter(d => d.status === 'completed')) {
      try {
        const stat = fs.statSync(dl.outputPath);
        downloadsBytes += stat.size;
        episodes.push({ episodeId: dl.episodeId, title: dl.title, sizeBytes: stat.size, isDownload: true });
      } catch { /* file may not exist */ }
    }

    for (const ep of cacheStats.episodes) {
      episodes.push({ episodeId: ep.episodeId, title: '', sizeBytes: ep.sizeBytes, isDownload: false });
    }

    return {
      downloadsBytes,
      cacheBytes: cacheStats.totalBytes,
      cacheMaxBytes: evictor.getMaxBytes(),
      episodes,
    };
  });

  ipcMain.handle('storage:deleteDownload', async (_event, episodeId: string) => {
    // Validate episodeId exists in storage before constructing any paths (T-03-14)
    const dl = storage.getDownloadById(episodeId);
    if (!dl) return;
    // Delete main video file
    try { fs.unlinkSync(dl.outputPath); } catch { /* ignore */ }
    // Delete subtitle files
    const dir = path.dirname(dl.outputPath);
    for (const sub of dl.subUrls) {
      try { fs.unlinkSync(path.join(dir, path.basename(dl.outputPath, '.mp4') + '.' + sub.language + '.ass')); } catch { /* ignore */ }
    }
    storage.deleteDownload(episodeId);
  });

  ipcMain.handle('storage:deleteCache', async (_event, episodeId: string) => {
    // Validate episodeId exists in storage before any path ops (T-03-15)
    const entry = storage.getCacheEntry(episodeId);
    if (!entry) return;
    try { fs.unlinkSync(entry.mp4Path); } catch { /* ignore */ }
    const subPaths = JSON.parse(entry.subPaths) as { language: string; path: string }[];
    for (const sub of subPaths) {
      try { fs.unlinkSync(sub.path); } catch { /* ignore */ }
    }
    storage.deleteCacheEntry(episodeId);
  });

  ipcMain.handle('storage:setCacheMax', async (_event, maxBytes: number) => {
    evictor.setMaxBytes(maxBytes);
    evictor.evictIfNeeded();
  });

  // Suppress unused variable warnings — dirs are accepted for future use / logging
  void downloadsDir;
  void cacheDir;
}
