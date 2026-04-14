import { StorageService } from '../storage/StorageService';
import fs from 'node:fs';

/**
 * CacheEvictor enforces a configurable size cap on the streaming cache.
 * Uses LRU (least-recently-accessed) eviction order.
 * Deletes MP4 and subtitle files from disk for each evicted entry.
 *
 * Default cap: 10 GB per D-06.
 */
export class CacheEvictor {
  private storage: StorageService;
  private maxBytes: number;

  constructor(storage: StorageService, defaultMaxBytes: number = 10 * 1024 * 1024 * 1024) {
    this.storage = storage;
    // Read user-configured cap from settings, fall back to default (10 GB per D-06)
    const saved = storage.getSetting('cache_max_bytes');
    this.maxBytes = saved ? parseInt(saved, 10) : defaultMaxBytes;
  }

  setMaxBytes(maxBytes: number): void {
    this.maxBytes = maxBytes;
    this.storage.setSetting('cache_max_bytes', String(maxBytes));
  }

  getMaxBytes(): number {
    return this.maxBytes;
  }

  /**
   * Evicts oldest cache entries until total cache size is under maxBytes.
   * Deletes MP4 and subtitle files from disk for each evicted entry.
   * Returns array of evicted episodeIds.
   */
  evictIfNeeded(): string[] {
    const evictedEntries = this.storage.evictOldestCache(this.maxBytes);
    // For each evicted entry, delete disk files
    for (const entry of evictedEntries) {
      const subPaths = JSON.parse(entry.subPaths || '[]') as { language: string; path: string }[];
      this.deleteFilesForEntry(entry.mp4Path, subPaths);
    }
    return evictedEntries.map((e) => e.episodeId);
  }

  /**
   * Delete files for a specific cache entry from disk.
   */
  deleteFilesForEntry(mp4Path: string, subPaths: { language: string; path: string }[]): void {
    try {
      fs.unlinkSync(mp4Path);
    } catch {
      /* file may not exist */
    }
    for (const sub of subPaths) {
      try {
        fs.unlinkSync(sub.path);
      } catch {
        /* file may not exist */
      }
    }
  }
}
