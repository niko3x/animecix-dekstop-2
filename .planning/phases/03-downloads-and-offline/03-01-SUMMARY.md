---
phase: 03-downloads-and-offline
plan: 01
status: completed
started: 2025-04-13
completed: 2025-04-13
---

## Summary

Built the download engine core: types, SQLite schema extension, multi-threaded Range-based downloader, and sequential download queue with full persistence.

## Tasks Completed

| # | Task | Status |
|---|------|--------|
| 1 | Types, schema, and StorageService download/cache methods | Done |
| 2 | Native Range-based Downloader and sequential DownloadQueue | Done |

## What Was Built

### Task 1: Types, Schema & StorageService
- `download.types.ts` — DownloadStatus, ChunkState, DownloadQueueItem, DownloadProgress types
- Extended `schema.ts` with 3 new tables: download_queue, download_chunks, cache_index
- Extended `StorageService` with full CRUD for downloads (enqueue, updateChunk, getIncomplete, delete) and cache (add, get, delete, stats, evictOldest)
- Enabled WAL mode and foreign keys in StorageService constructor
- 22 unit tests for schema and storage methods

### Task 2: Downloader & DownloadQueue
- `Downloader.ts` — EventEmitter-based downloader with 4-chunk parallel Range requests, pause/resume, 1MB progress persistence interval, 3-second sliding window speed tracking, chunk merge on completion
- `DownloadQueue.ts` — Sequential queue (1 active download), crash recovery (resets 'downloading' to 'queued' on construction), subtitle co-download, URL scheme validation (rejects file:/data:/javascript:), 10GB max size enforcement, sanitizeFilename helper
- 18 unit tests with local HTTP server for Downloader and mock storage for DownloadQueue

## Key Files

### Created
- `animecix-v2/src/download/download.types.ts`
- `animecix-v2/src/download/Downloader.ts`
- `animecix-v2/src/download/DownloadQueue.ts`
- `animecix-v2/tests/download/Downloader.test.ts`
- `animecix-v2/tests/download/DownloadQueue.test.ts`
- `animecix-v2/tests/storage/download-schema.test.ts`

### Modified
- `animecix-v2/src/storage/schema.ts` — added 3 new CREATE TABLE statements
- `animecix-v2/src/storage/StorageService.ts` — added download/cache CRUD methods, WAL mode, foreign keys

## Deviations

None — plan executed as specified.

## Self-Check: PASSED

- [x] Downloader splits into 4 Range-based chunks and downloads in parallel
- [x] Download queue processes items sequentially (1 active at a time)
- [x] State persists in SQLite and survives process restart (crash recovery)
- [x] Paused downloads resume from last byte position via Range headers
- [x] URL scheme validation rejects file:/data:/javascript:
- [x] Never sets rejectUnauthorized: false
- [x] All 40 tests pass (22 storage + 18 download)
