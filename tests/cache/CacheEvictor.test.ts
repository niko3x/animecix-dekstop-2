import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { CacheEvictor } from '../../src/cache/CacheEvictor';

// ── In-memory mock StorageService ──────────────────────────────────────────

interface CacheEntry {
  episodeId: string;
  mp4Path: string;
  subPaths: string; // JSON
  sizeBytes: number;
  lastAccessed: number;
  createdAt: number;
}

function createMockStorage(settings: Record<string, string> = {}) {
  const cacheEntries = new Map<string, CacheEntry>();
  const settingsMap = new Map(Object.entries(settings));

  return {
    cacheEntries,
    settingsMap,

    getSetting(key: string): string | null {
      return settingsMap.get(key) ?? null;
    },

    setSetting(key: string, value: string): void {
      settingsMap.set(key, value);
    },

    addCacheEntry(entry: {
      episodeId: string;
      mp4Path: string;
      subPaths: string;
      sizeBytes: number;
    }): void {
      cacheEntries.set(entry.episodeId, {
        ...entry,
        lastAccessed: Date.now(),
        createdAt: Date.now(),
      });
    },

    getCacheEntry(episodeId: string): CacheEntry | null {
      const entry = cacheEntries.get(episodeId);
      if (!entry) return null;
      entry.lastAccessed = Date.now();
      return entry;
    },

    deleteCacheEntry(episodeId: string): void {
      cacheEntries.delete(episodeId);
    },

    getCacheStats(): { totalBytes: number; episodes: { episodeId: string; sizeBytes: number }[] } {
      let total = 0;
      const episodes: { episodeId: string; sizeBytes: number }[] = [];
      for (const e of cacheEntries.values()) {
        total += e.sizeBytes;
        episodes.push({ episodeId: e.episodeId, sizeBytes: e.sizeBytes });
      }
      return { totalBytes: total, episodes };
    },

    evictOldestCache(maxBytes: number): { episodeId: string; mp4Path: string; subPaths: string }[] {
      const evicted: { episodeId: string; mp4Path: string; subPaths: string }[] = [];
      let total = 0;
      for (const e of cacheEntries.values()) total += e.sizeBytes;

      while (total > maxBytes) {
        // Find oldest by lastAccessed
        let oldest: CacheEntry | null = null;
        for (const e of cacheEntries.values()) {
          if (!oldest || e.lastAccessed < oldest.lastAccessed) {
            oldest = e;
          }
        }
        if (!oldest) break;
        evicted.push({
          episodeId: oldest.episodeId,
          mp4Path: oldest.mp4Path,
          subPaths: oldest.subPaths,
        });
        total -= oldest.sizeBytes;
        cacheEntries.delete(oldest.episodeId);
      }
      return evicted;
    },
  };
}

// ── Test helper: create temp files ─────────────────────────────────────────

let tmpDir: string;

function createTmpFile(filename: string, content = 'data'): string {
  const filePath = path.join(tmpDir, filename);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CacheEvictor', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-evictor-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('uses default 10 GB cap when no setting stored', () => {
      const storage = createMockStorage();
      const evictor = new CacheEvictor(storage as any);
      expect(evictor.getMaxBytes()).toBe(10 * 1024 * 1024 * 1024);
    });

    it('reads user-configured cap from settings', () => {
      const fiveGB = 5 * 1024 * 1024 * 1024;
      const storage = createMockStorage({ cache_max_bytes: String(fiveGB) });
      const evictor = new CacheEvictor(storage as any);
      expect(evictor.getMaxBytes()).toBe(fiveGB);
    });

    it('accepts custom defaultMaxBytes override', () => {
      const storage = createMockStorage();
      const evictor = new CacheEvictor(storage as any, 1000);
      expect(evictor.getMaxBytes()).toBe(1000);
    });
  });

  describe('setMaxBytes', () => {
    it('updates in-memory cap and persists to storage', () => {
      const storage = createMockStorage();
      const evictor = new CacheEvictor(storage as any);
      evictor.setMaxBytes(500);
      expect(evictor.getMaxBytes()).toBe(500);
      expect(storage.getSetting('cache_max_bytes')).toBe('500');
    });
  });

  describe('evictIfNeeded', () => {
    it('does nothing when total size is under cap', () => {
      const storage = createMockStorage();
      const mp4 = createTmpFile('ep1/video.mp4', 'videodata');
      storage.addCacheEntry({
        episodeId: 'ep1',
        mp4Path: mp4,
        subPaths: '[]',
        sizeBytes: 500,
      });

      const evictor = new CacheEvictor(storage as any, 1000);
      const evicted = evictor.evictIfNeeded();

      expect(evicted).toHaveLength(0);
      expect(storage.cacheEntries.size).toBe(1);
      // File should still exist
      expect(fs.existsSync(mp4)).toBe(true);
    });

    it('evicts oldest 1-2 entries when 3 entries total 15GB with cap 10GB', () => {
      const storage = createMockStorage();
      const GB = 1024 * 1024 * 1024;

      // Create 3 entries totaling 15 GB, with different last-accessed times
      const mp4a = createTmpFile('ep-a/video.mp4', 'aaa');
      const mp4b = createTmpFile('ep-b/video.mp4', 'bbb');
      const mp4c = createTmpFile('ep-c/video.mp4', 'ccc');

      // Manually set entries with different lastAccessed times
      storage.cacheEntries.set('ep-a', {
        episodeId: 'ep-a',
        mp4Path: mp4a,
        subPaths: '[]',
        sizeBytes: 5 * GB,
        lastAccessed: 1000, // oldest
        createdAt: 1000,
      });
      storage.cacheEntries.set('ep-b', {
        episodeId: 'ep-b',
        mp4Path: mp4b,
        subPaths: '[]',
        sizeBytes: 5 * GB,
        lastAccessed: 2000,
        createdAt: 2000,
      });
      storage.cacheEntries.set('ep-c', {
        episodeId: 'ep-c',
        mp4Path: mp4c,
        subPaths: '[]',
        sizeBytes: 5 * GB,
        lastAccessed: 3000, // newest
        createdAt: 3000,
      });

      const evictor = new CacheEvictor(storage as any, 10 * GB);
      const evicted = evictor.evictIfNeeded();

      // With 15 GB total and 10 GB cap:
      // After evicting ep-a (5 GB): 10 GB remaining — under cap
      expect(evicted.length).toBeGreaterThanOrEqual(1);
      expect(evicted.length).toBeLessThanOrEqual(2);
      // ep-a is oldest, should be evicted first
      expect(evicted[0]).toBe('ep-a');
    });

    it('deletes MP4 and subtitle files from disk for evicted entries', () => {
      const storage = createMockStorage();
      const GB = 1024 * 1024 * 1024;

      const mp4 = createTmpFile('ep-del/video.mp4', 'video content');
      const sub1 = createTmpFile('ep-del/tr.ass', 'subtitle content');
      const sub2 = createTmpFile('ep-del/en.ass', 'subtitle content en');

      const subPathsJson = JSON.stringify([
        { language: 'tr', path: sub1 },
        { language: 'en', path: sub2 },
      ]);

      storage.cacheEntries.set('ep-del', {
        episodeId: 'ep-del',
        mp4Path: mp4,
        subPaths: subPathsJson,
        sizeBytes: 6 * GB,
        lastAccessed: 1000,
        createdAt: 1000,
      });

      // Cap is 5 GB so ep-del (6 GB) should be evicted
      const evictor = new CacheEvictor(storage as any, 5 * GB);
      const evicted = evictor.evictIfNeeded();

      expect(evicted).toContain('ep-del');
      // Files must be deleted from disk
      expect(fs.existsSync(mp4)).toBe(false);
      expect(fs.existsSync(sub1)).toBe(false);
      expect(fs.existsSync(sub2)).toBe(false);
    });

    it('tolerates missing files (no crash when file already deleted)', () => {
      const storage = createMockStorage();
      const GB = 1024 * 1024 * 1024;

      // Reference a non-existent mp4 path
      storage.cacheEntries.set('ep-missing', {
        episodeId: 'ep-missing',
        mp4Path: path.join(tmpDir, 'nonexistent/video.mp4'),
        subPaths: JSON.stringify([{ language: 'tr', path: path.join(tmpDir, 'nonexistent/tr.ass') }]),
        sizeBytes: 6 * GB,
        lastAccessed: 1000,
        createdAt: 1000,
      });

      const evictor = new CacheEvictor(storage as any, 5 * GB);
      // Should not throw even though files don't exist
      expect(() => evictor.evictIfNeeded()).not.toThrow();
    });
  });

  describe('deleteFilesForEntry', () => {
    it('deletes MP4 and all subtitle files', () => {
      const storage = createMockStorage();
      const evictor = new CacheEvictor(storage as any);

      const mp4 = createTmpFile('test/video.mp4', 'mp4data');
      const sub = createTmpFile('test/tr.ass', 'subtitle');

      evictor.deleteFilesForEntry(mp4, [{ language: 'tr', path: sub }]);

      expect(fs.existsSync(mp4)).toBe(false);
      expect(fs.existsSync(sub)).toBe(false);
    });

    it('does not throw if files are already gone', () => {
      const storage = createMockStorage();
      const evictor = new CacheEvictor(storage as any);

      expect(() =>
        evictor.deleteFilesForEntry('/nonexistent/video.mp4', [
          { language: 'tr', path: '/nonexistent/tr.ass' },
        ]),
      ).not.toThrow();
    });
  });
});
