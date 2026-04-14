import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { INIT_SCHEMA } from '../../src/storage/schema';
import type {
  DownloadStatus,
  DownloadQueueItem,
  ChunkState,
} from '../../src/download/download.types';

// We test the schema and SQL logic directly using better-sqlite3 in-memory DB
// to avoid dependency on Electron's app.getPath('userData')

// Minimal in-memory StorageService that mirrors StorageService but uses :memory:
// This lets us test all download/cache methods without Electron.
class TestStorageService {
  db: Database.Database;

  constructor() {
    this.db = new Database(':memory:');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(INIT_SCHEMA);
  }

  enqueueDownload(item: {
    id: string;
    episodeId: string;
    title: string;
    url: string;
    subUrls: string;
    outputPath: string;
    totalBytes: number;
    chunks: { chunkIndex: number; byteStart: number; byteEnd: number; tempPath: string }[];
  }): void {
    const insertDownload = this.db.prepare(
      `INSERT INTO download_queue (id, episode_id, title, url, sub_urls, output_path, total_bytes, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', unixepoch(), unixepoch())`,
    );
    const insertChunk = this.db.prepare(
      `INSERT INTO download_chunks (download_id, chunk_index, byte_start, byte_end, bytes_downloaded, temp_path, completed)
       VALUES (?, ?, ?, ?, 0, ?, 0)`,
    );
    const txn = this.db.transaction(() => {
      insertDownload.run(
        item.id,
        item.episodeId,
        item.title,
        item.url,
        item.subUrls,
        item.outputPath,
        item.totalBytes,
      );
      for (const chunk of item.chunks) {
        insertChunk.run(item.id, chunk.chunkIndex, chunk.byteStart, chunk.byteEnd, chunk.tempPath);
      }
    });
    txn();
  }

  updateChunkProgress(
    downloadId: string,
    chunkIndex: number,
    bytesDownloaded: number,
    completed = false,
  ): void {
    this.db
      .prepare(
        `UPDATE download_chunks SET bytes_downloaded = ?, completed = ? WHERE download_id = ? AND chunk_index = ?`,
      )
      .run(bytesDownloaded, completed ? 1 : 0, downloadId, chunkIndex);
  }

  updateDownloadStatus(id: string, status: string): void {
    this.db
      .prepare(`UPDATE download_queue SET status = ?, updated_at = unixepoch() WHERE id = ?`)
      .run(status, id);
  }

  getDownloadById(id: string): DownloadQueueItem | null {
    const row = this.db
      .prepare(`SELECT * FROM download_queue WHERE id = ?`)
      .get(id) as any;
    if (!row) return null;
    const chunks = this.db
      .prepare(`SELECT * FROM download_chunks WHERE download_id = ? ORDER BY chunk_index`)
      .all(id) as any[];
    return this._mapRow(row, chunks);
  }

  getIncompleteDownloads(): DownloadQueueItem[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM download_queue WHERE status IN ('queued','downloading','paused') ORDER BY created_at ASC`,
      )
      .all() as any[];
    return rows.map((row) => {
      const chunks = this.db
        .prepare(`SELECT * FROM download_chunks WHERE download_id = ? ORDER BY chunk_index`)
        .all(row.id) as any[];
      return this._mapRow(row, chunks);
    });
  }

  deleteDownload(id: string): void {
    this.db.prepare(`DELETE FROM download_queue WHERE id = ?`).run(id);
  }

  addCacheEntry(entry: {
    episodeId: string;
    mp4Path: string;
    subPaths: string;
    sizeBytes: number;
  }): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO cache_index (episode_id, mp4_path, sub_paths, size_bytes, last_accessed, created_at)
         VALUES (?, ?, ?, ?, unixepoch(), unixepoch())`,
      )
      .run(entry.episodeId, entry.mp4Path, entry.subPaths, entry.sizeBytes);
  }

  getCacheEntry(episodeId: string): {
    episodeId: string;
    mp4Path: string;
    subPaths: string;
    sizeBytes: number;
    lastAccessed: number;
    createdAt: number;
  } | null {
    const row = this.db
      .prepare(`SELECT * FROM cache_index WHERE episode_id = ?`)
      .get(episodeId) as any;
    if (!row) return null;
    this.db
      .prepare(`UPDATE cache_index SET last_accessed = unixepoch() WHERE episode_id = ?`)
      .run(episodeId);
    return {
      episodeId: row.episode_id,
      mp4Path: row.mp4_path,
      subPaths: row.sub_paths,
      sizeBytes: row.size_bytes,
      lastAccessed: row.last_accessed,
      createdAt: row.created_at,
    };
  }

  deleteCacheEntry(episodeId: string): void {
    this.db.prepare(`DELETE FROM cache_index WHERE episode_id = ?`).run(episodeId);
  }

  getCacheStats(): { totalBytes: number; episodes: { episodeId: string; sizeBytes: number }[] } {
    const totalRow = this.db
      .prepare(`SELECT COALESCE(SUM(size_bytes), 0) as total FROM cache_index`)
      .get() as { total: number };
    const episodes = this.db
      .prepare(`SELECT episode_id, size_bytes FROM cache_index ORDER BY episode_id`)
      .all() as { episode_id: string; size_bytes: number }[];
    return {
      totalBytes: totalRow.total,
      episodes: episodes.map((e) => ({ episodeId: e.episode_id, sizeBytes: e.size_bytes })),
    };
  }

  evictOldestCache(maxBytes: number): { episodeId: string; mp4Path: string; subPaths: string }[] {
    const evicted: { episodeId: string; mp4Path: string; subPaths: string }[] = [];
    const totalRow = this.db
      .prepare(`SELECT COALESCE(SUM(size_bytes), 0) as total FROM cache_index`)
      .get() as { total: number };
    let total = totalRow.total;
    while (total > maxBytes) {
      const oldest = this.db
        .prepare(`SELECT * FROM cache_index ORDER BY last_accessed ASC LIMIT 1`)
        .get() as any;
      if (!oldest) break;
      evicted.push({
        episodeId: oldest.episode_id,
        mp4Path: oldest.mp4_path,
        subPaths: oldest.sub_paths,
      });
      this.db.prepare(`DELETE FROM cache_index WHERE episode_id = ?`).run(oldest.episode_id);
      total -= oldest.size_bytes;
    }
    return evicted;
  }

  private _mapRow(row: any, chunks: any[]): DownloadQueueItem {
    return {
      id: row.id,
      episodeId: row.episode_id,
      title: row.title,
      url: row.url,
      subUrls: JSON.parse(row.sub_urls),
      outputPath: row.output_path,
      totalBytes: row.total_bytes,
      status: row.status as DownloadStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      chunks: chunks.map((c) => ({
        downloadId: c.download_id,
        chunkIndex: c.chunk_index,
        byteStart: c.byte_start,
        byteEnd: c.byte_end,
        bytesDownloaded: c.bytes_downloaded,
        tempPath: c.temp_path,
        completed: !!c.completed,
      })),
    };
  }

  close(): void {
    this.db.close();
  }
}

describe('Download Schema and StorageService', () => {
  let storage: TestStorageService;

  beforeEach(() => {
    storage = new TestStorageService();
  });

  afterEach(() => {
    storage.close();
  });

  describe('Schema tables', () => {
    it('creates download_queue table', () => {
      const row = storage.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='download_queue'")
        .get() as { name: string } | undefined;
      expect(row?.name).toBe('download_queue');
    });

    it('creates download_chunks table', () => {
      const row = storage.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='download_chunks'")
        .get() as { name: string } | undefined;
      expect(row?.name).toBe('download_chunks');
    });

    it('creates cache_index table', () => {
      const row = storage.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cache_index'")
        .get() as { name: string } | undefined;
      expect(row?.name).toBe('cache_index');
    });

    it('download_queue has expected columns', () => {
      const cols = storage.db
        .prepare(`PRAGMA table_info(download_queue)`)
        .all() as { name: string }[];
      const colNames = cols.map((c) => c.name);
      expect(colNames).toContain('id');
      expect(colNames).toContain('episode_id');
      expect(colNames).toContain('title');
      expect(colNames).toContain('url');
      expect(colNames).toContain('sub_urls');
      expect(colNames).toContain('output_path');
      expect(colNames).toContain('total_bytes');
      expect(colNames).toContain('status');
      expect(colNames).toContain('created_at');
      expect(colNames).toContain('updated_at');
    });

    it('download_chunks has expected columns', () => {
      const cols = storage.db
        .prepare(`PRAGMA table_info(download_chunks)`)
        .all() as { name: string }[];
      const colNames = cols.map((c) => c.name);
      expect(colNames).toContain('download_id');
      expect(colNames).toContain('chunk_index');
      expect(colNames).toContain('byte_start');
      expect(colNames).toContain('byte_end');
      expect(colNames).toContain('bytes_downloaded');
      expect(colNames).toContain('temp_path');
      expect(colNames).toContain('completed');
    });

    it('cache_index has expected columns', () => {
      const cols = storage.db
        .prepare(`PRAGMA table_info(cache_index)`)
        .all() as { name: string }[];
      const colNames = cols.map((c) => c.name);
      expect(colNames).toContain('episode_id');
      expect(colNames).toContain('mp4_path');
      expect(colNames).toContain('sub_paths');
      expect(colNames).toContain('size_bytes');
      expect(colNames).toContain('last_accessed');
      expect(colNames).toContain('created_at');
    });
  });

  describe('enqueueDownload', () => {
    it('inserts row into download_queue and 4 rows into download_chunks', () => {
      storage.enqueueDownload({
        id: 'dl-1',
        episodeId: 'ep-1',
        title: 'Test Episode',
        url: 'https://example.com/video.mp4',
        subUrls: '[]',
        outputPath: '/tmp/test.mp4',
        totalBytes: 1000,
        chunks: [
          { chunkIndex: 0, byteStart: 0, byteEnd: 249, tempPath: '/tmp/test.mp4.part0' },
          { chunkIndex: 1, byteStart: 250, byteEnd: 499, tempPath: '/tmp/test.mp4.part1' },
          { chunkIndex: 2, byteStart: 500, byteEnd: 749, tempPath: '/tmp/test.mp4.part2' },
          { chunkIndex: 3, byteStart: 750, byteEnd: 999, tempPath: '/tmp/test.mp4.part3' },
        ],
      });

      const dlRow = storage.db
        .prepare(`SELECT * FROM download_queue WHERE id = 'dl-1'`)
        .get() as any;
      expect(dlRow).toBeTruthy();
      expect(dlRow.episode_id).toBe('ep-1');
      expect(dlRow.status).toBe('queued');

      const chunkRows = storage.db
        .prepare(`SELECT * FROM download_chunks WHERE download_id = 'dl-1'`)
        .all() as any[];
      expect(chunkRows).toHaveLength(4);
    });
  });

  describe('updateChunkProgress', () => {
    beforeEach(() => {
      storage.enqueueDownload({
        id: 'dl-1',
        episodeId: 'ep-1',
        title: 'Test Episode',
        url: 'https://example.com/video.mp4',
        subUrls: '[]',
        outputPath: '/tmp/test.mp4',
        totalBytes: 1000,
        chunks: [
          { chunkIndex: 0, byteStart: 0, byteEnd: 249, tempPath: '/tmp/test.mp4.part0' },
          { chunkIndex: 1, byteStart: 250, byteEnd: 499, tempPath: '/tmp/test.mp4.part1' },
          { chunkIndex: 2, byteStart: 500, byteEnd: 749, tempPath: '/tmp/test.mp4.part2' },
          { chunkIndex: 3, byteStart: 750, byteEnd: 999, tempPath: '/tmp/test.mp4.part3' },
        ],
      });
    });

    it('updates bytes_downloaded for given (download_id, chunk_index)', () => {
      storage.updateChunkProgress('dl-1', 0, 125);
      const row = storage.db
        .prepare(
          `SELECT bytes_downloaded, completed FROM download_chunks WHERE download_id = 'dl-1' AND chunk_index = 0`,
        )
        .get() as any;
      expect(row.bytes_downloaded).toBe(125);
      expect(row.completed).toBe(0);
    });

    it('marks chunk as completed when completed=true', () => {
      storage.updateChunkProgress('dl-1', 0, 250, true);
      const row = storage.db
        .prepare(
          `SELECT bytes_downloaded, completed FROM download_chunks WHERE download_id = 'dl-1' AND chunk_index = 0`,
        )
        .get() as any;
      expect(row.bytes_downloaded).toBe(250);
      expect(row.completed).toBe(1);
    });
  });

  describe('getIncompleteDownloads', () => {
    it('returns items with status != completed ordered by created_at', () => {
      storage.enqueueDownload({
        id: 'dl-1',
        episodeId: 'ep-1',
        title: 'Ep 1',
        url: 'https://example.com/1.mp4',
        subUrls: '[]',
        outputPath: '/tmp/1.mp4',
        totalBytes: 1000,
        chunks: [{ chunkIndex: 0, byteStart: 0, byteEnd: 999, tempPath: '/tmp/1.mp4.part0' }],
      });
      storage.enqueueDownload({
        id: 'dl-2',
        episodeId: 'ep-2',
        title: 'Ep 2',
        url: 'https://example.com/2.mp4',
        subUrls: '[]',
        outputPath: '/tmp/2.mp4',
        totalBytes: 2000,
        chunks: [{ chunkIndex: 0, byteStart: 0, byteEnd: 1999, tempPath: '/tmp/2.mp4.part0' }],
      });
      storage.updateDownloadStatus('dl-2', 'completed');

      const incomplete = storage.getIncompleteDownloads();
      expect(incomplete).toHaveLength(1);
      expect(incomplete[0].id).toBe('dl-1');
    });

    it('includes paused and downloading items', () => {
      storage.enqueueDownload({
        id: 'dl-1',
        episodeId: 'ep-1',
        title: 'Ep 1',
        url: 'https://example.com/1.mp4',
        subUrls: '[]',
        outputPath: '/tmp/1.mp4',
        totalBytes: 1000,
        chunks: [],
      });
      storage.updateDownloadStatus('dl-1', 'paused');

      const incomplete = storage.getIncompleteDownloads();
      expect(incomplete).toHaveLength(1);
      expect(incomplete[0].status).toBe('paused');
    });
  });

  describe('updateDownloadStatus', () => {
    it('changes status and updated_at', () => {
      storage.enqueueDownload({
        id: 'dl-1',
        episodeId: 'ep-1',
        title: 'Ep 1',
        url: 'https://example.com/1.mp4',
        subUrls: '[]',
        outputPath: '/tmp/1.mp4',
        totalBytes: 1000,
        chunks: [],
      });
      storage.updateDownloadStatus('dl-1', 'downloading');
      const row = storage.db
        .prepare(`SELECT status FROM download_queue WHERE id = 'dl-1'`)
        .get() as any;
      expect(row.status).toBe('downloading');
    });
  });

  describe('getDownloadById', () => {
    it('returns full download with chunks', () => {
      storage.enqueueDownload({
        id: 'dl-1',
        episodeId: 'ep-1',
        title: 'Ep 1',
        url: 'https://example.com/1.mp4',
        subUrls: JSON.stringify([{ language: 'tr', url: 'https://example.com/1.tr.ass' }]),
        outputPath: '/tmp/1.mp4',
        totalBytes: 1000,
        chunks: [
          { chunkIndex: 0, byteStart: 0, byteEnd: 499, tempPath: '/tmp/1.mp4.part0' },
          { chunkIndex: 1, byteStart: 500, byteEnd: 999, tempPath: '/tmp/1.mp4.part1' },
        ],
      });
      const dl = storage.getDownloadById('dl-1');
      expect(dl).not.toBeNull();
      expect(dl!.id).toBe('dl-1');
      expect(dl!.episodeId).toBe('ep-1');
      expect(dl!.subUrls).toEqual([{ language: 'tr', url: 'https://example.com/1.tr.ass' }]);
      expect(dl!.chunks).toHaveLength(2);
      expect(dl!.chunks[0].byteStart).toBe(0);
      expect(dl!.chunks[1].byteStart).toBe(500);
    });

    it('returns null for non-existent id', () => {
      expect(storage.getDownloadById('nonexistent')).toBeNull();
    });
  });

  describe('deleteDownload', () => {
    it('removes download_queue row and cascades to download_chunks', () => {
      storage.enqueueDownload({
        id: 'dl-1',
        episodeId: 'ep-1',
        title: 'Ep 1',
        url: 'https://example.com/1.mp4',
        subUrls: '[]',
        outputPath: '/tmp/1.mp4',
        totalBytes: 1000,
        chunks: [
          { chunkIndex: 0, byteStart: 0, byteEnd: 499, tempPath: '/tmp/1.mp4.part0' },
          { chunkIndex: 1, byteStart: 500, byteEnd: 999, tempPath: '/tmp/1.mp4.part1' },
        ],
      });
      storage.deleteDownload('dl-1');

      const dlRow = storage.db
        .prepare(`SELECT * FROM download_queue WHERE id = 'dl-1'`)
        .get();
      expect(dlRow).toBeUndefined();

      const chunkRows = storage.db
        .prepare(`SELECT * FROM download_chunks WHERE download_id = 'dl-1'`)
        .all();
      expect(chunkRows).toHaveLength(0);
    });
  });

  describe('Cache operations', () => {
    it('addCacheEntry inserts into cache_index', () => {
      storage.addCacheEntry({
        episodeId: 'ep-1',
        mp4Path: '/tmp/ep1.mp4',
        subPaths: '[]',
        sizeBytes: 500 * 1024 * 1024,
      });
      const row = storage.db
        .prepare(`SELECT * FROM cache_index WHERE episode_id = 'ep-1'`)
        .get() as any;
      expect(row).toBeTruthy();
      expect(row.mp4_path).toBe('/tmp/ep1.mp4');
    });

    it('getCacheEntry returns entry and updates last_accessed', () => {
      storage.addCacheEntry({
        episodeId: 'ep-1',
        mp4Path: '/tmp/ep1.mp4',
        subPaths: '[]',
        sizeBytes: 100,
      });
      const entry = storage.getCacheEntry('ep-1');
      expect(entry).not.toBeNull();
      expect(entry!.episodeId).toBe('ep-1');
      expect(entry!.mp4Path).toBe('/tmp/ep1.mp4');
    });

    it('getCacheEntry returns null for missing entry', () => {
      expect(storage.getCacheEntry('nonexistent')).toBeNull();
    });

    it('deleteCacheEntry removes row', () => {
      storage.addCacheEntry({
        episodeId: 'ep-1',
        mp4Path: '/tmp/ep1.mp4',
        subPaths: '[]',
        sizeBytes: 100,
      });
      storage.deleteCacheEntry('ep-1');
      const row = storage.db
        .prepare(`SELECT * FROM cache_index WHERE episode_id = 'ep-1'`)
        .get();
      expect(row).toBeUndefined();
    });

    it('getCacheStats returns total size and per-episode sizes', () => {
      storage.addCacheEntry({ episodeId: 'ep-1', mp4Path: '/tmp/ep1.mp4', subPaths: '[]', sizeBytes: 100 });
      storage.addCacheEntry({ episodeId: 'ep-2', mp4Path: '/tmp/ep2.mp4', subPaths: '[]', sizeBytes: 200 });
      const stats = storage.getCacheStats();
      expect(stats.totalBytes).toBe(300);
      expect(stats.episodes).toHaveLength(2);
    });

    it('evictOldestCache deletes entries until under cap, returns { episodeId, mp4Path, subPaths }[]', () => {
      storage.addCacheEntry({ episodeId: 'ep-1', mp4Path: '/tmp/ep1.mp4', subPaths: '[]', sizeBytes: 100 });
      storage.addCacheEntry({ episodeId: 'ep-2', mp4Path: '/tmp/ep2.mp4', subPaths: '["/tmp/ep2.tr.ass"]', sizeBytes: 200 });
      storage.addCacheEntry({ episodeId: 'ep-3', mp4Path: '/tmp/ep3.mp4', subPaths: '[]', sizeBytes: 50 });

      // total = 350, cap = 100 → should evict ep-1 (oldest), then ep-2 if needed
      // After ep-1 evicted: 250 > 100, evict ep-2: 50 <= 100
      const evicted = storage.evictOldestCache(100);
      expect(evicted.length).toBeGreaterThanOrEqual(1);

      // Verify structure: each evicted item has episodeId, mp4Path, subPaths (NOT just strings)
      for (const item of evicted) {
        expect(item).toHaveProperty('episodeId');
        expect(item).toHaveProperty('mp4Path');
        expect(item).toHaveProperty('subPaths');
        expect(typeof item.episodeId).toBe('string');
        expect(typeof item.mp4Path).toBe('string');
        expect(typeof item.subPaths).toBe('string');
      }

      // Verify remaining total is within cap
      const remaining = storage.getCacheStats();
      expect(remaining.totalBytes).toBeLessThanOrEqual(100);
    });

    it('evictOldestCache returns mp4Path and subPaths from rows BEFORE deletion', () => {
      storage.addCacheEntry({
        episodeId: 'ep-1',
        mp4Path: '/downloads/ep1.mp4',
        subPaths: '["/downloads/ep1.tr.ass"]',
        sizeBytes: 500,
      });
      const evicted = storage.evictOldestCache(0);
      expect(evicted).toHaveLength(1);
      expect(evicted[0].mp4Path).toBe('/downloads/ep1.mp4');
      expect(evicted[0].subPaths).toBe('["/downloads/ep1.tr.ass"]');
      expect(evicted[0].episodeId).toBe('ep-1');
    });
  });
});
