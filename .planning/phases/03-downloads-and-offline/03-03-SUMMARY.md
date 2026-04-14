---
phase: 03-downloads-and-offline
plan: 03
status: completed
started: 2025-04-13
completed: 2025-04-13
---

## Summary

Built the streaming cache system with transparent auto-caching via session.webRequest.onCompleted, explicit cache:episode IPC, HLS-to-MP4 muxing, and LRU eviction with disk cleanup.

## Tasks Completed

| # | Task | Status |
|---|------|--------|
| 1 | CacheEvictor + StreamCache with transparent auto-caching and explicit caching | Done |
| 2 | HLS-to-MP4 muxer using ffmpeg | Done |

## What Was Built

### Task 1: CacheEvictor & StreamCache
- `CacheEvictor.ts` — LRU eviction with configurable cap (10GB default per D-06), reads/writes user preference to settings, deletes MP4 and subtitle files from disk for evicted entries
- `StreamCache.ts` — Two complementary caching paths per D-05:
  - **Transparent auto-caching**: session.webRequest.onCompleted listener watches video segment requests from known CDN domains (tau-video.xyz), tracks segment URLs per episode in memory, then background-caches after playback ends — no player changes needed
  - **Explicit cache:episode IPC**: Direct episode caching with video download (MP4 or HLS), subtitle co-download, and eviction before caching
- 24 tests covering eviction, disk cleanup, caching, segment tracking, CDN filtering, subtitle download

### Task 2: HlsMuxer
- `HlsMuxer.ts` — ffmpeg concat demuxer with faststart for HLS TS-to-MP4 muxing, byte-level fallback for no-ffmpeg environments, M3U8 playlist parser with http/https-only validation
- Uses execFile (not exec) per T-03-09 threat model
- 5-minute timeout per T-03-12

## Key Files

### Created
- `animecix-v2/src/cache/CacheEvictor.ts`
- `animecix-v2/src/cache/StreamCache.ts`
- `animecix-v2/src/cache/HlsMuxer.ts`
- `animecix-v2/tests/cache/CacheEvictor.test.ts`
- `animecix-v2/tests/cache/StreamCache.test.ts`

## Deviations

None — plan executed as specified.

## Self-Check: PASSED

- [x] Watched episodes auto-cached via transparent session.webRequest interception (D-05)
- [x] Explicit cache:episode IPC available for user-initiated caching
- [x] HLS segments muxed to single MP4 via ffmpeg (with fallback)
- [x] Cache respects configurable size cap with LRU eviction and disk file cleanup
- [x] CDN domain filtering prevents tracking non-video URLs (T-03-17)
- [x] execFile used instead of exec for ffmpeg (T-03-09)
- [x] All 24 tests pass
