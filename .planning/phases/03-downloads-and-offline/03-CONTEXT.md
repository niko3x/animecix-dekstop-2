# Phase 3: Downloads and Offline - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Multi-threaded video downloads with persistent queue, transparent streaming cache with LRU eviction, offline playback via custom protocol handler with full ASS subtitle support, system tray for background downloads, desktop notifications, and storage management IPC API. No auto-updates, no CI/CD, no new player features — those are Phase 4 or later.

</domain>

<decisions>
## Implementation Decisions

### Download engine & resumability
- **D-01:** Native HTTP Range-based multi-threaded downloads — rewrite old Downloader2 pattern using native Node.js `http`/`https` modules. No external download library (no `node-downloader-helper`). Split each file into 4 parallel chunks via Range headers, merge on completion.
- **D-02:** Download queue persists in SQLite via StorageService — store queue items, per-chunk byte progress, and state (queued/downloading/paused/completed/failed). On restart, resume incomplete downloads from last byte position.
- **D-03:** Sequential download queue — 1 active download at a time, rest queued. Matches old app behavior, avoids bandwidth contention.
- **D-04:** 4 threads (parallel Range chunks) per download — good balance of speed vs complexity for typical anime episode sizes.

### Streaming cache strategy
- **D-05:** Transparent proxy cache — intercept video segment requests (HLS `.ts` chunks, MP4 byte ranges) in `session.webRequest`, save to disk as they stream through. Fully transparent to the player — no player changes needed.
- **D-06:** Fixed cache cap with LRU eviction — default cap (e.g., 10 GB). When full, oldest unwatched cached episodes are evicted first. User can adjust cap in settings via StorageService.
- **D-07:** Separate storage directories — explicit downloads in `Downloads/AnimeciX/`, streaming cache in `userData/cache/`. Different lifecycle: cache is evictable, downloads are permanent until user deletes.

### Offline playback & subtitles
- **D-08:** Custom `animecix-offline://` protocol handler for serving offline video and subtitle files. Player receives `animecix-offline://episode-id` URLs via the dual source interface (Phase 2, D-06). Protocol handler resolves to local file on disk. Works for both downloads and cached videos.
- **D-09:** Download all available ASS subtitle tracks alongside the video — when downloading or caching a video, also fetch all subtitle files from tau-video.xyz and store alongside the video file. Player resolves subtitle URLs to local files via the same offline protocol.
- **D-10:** HLS streams reassembled into single MP4 for offline — after all HLS `.ts` segments are cached, concatenate into a single MP4 file. Offline playback uses the MP4 directly via `animecix-offline://` protocol. Simpler player logic than reconstructing HLS playlists.

### Download UI & notifications
- **D-11:** Download progress via IPC to website + OS taskbar — send progress, speed, queue state via `window.animecix` IPC bridge to animecix.tv (website renders the download panel UI). Also show progress on the OS taskbar icon via `BrowserWindow.setProgressBar()`.
- **D-12:** System tray on active downloads — when user closes the window while downloads are running, minimize to system tray instead of quitting. Tray icon with right-click menu: Show window, Pause all, Cancel all, Quit. Tray only appears when downloads are active.
- **D-13:** Desktop notification on download completion (DL-07) — native Electron `Notification` API, Turkish text.
- **D-14:** Storage management via IPC API — expose total downloads size, total cache size, per-episode sizes, and delete operations via `window.animecix` IPC bridge. Website renders the storage management UI. Consistent with app-wraps-website architecture.

### Claude's Discretion
- SQLite schema design for download queue and cache metadata tables
- Exact chunk merge strategy (sequential write vs temp file assembly)
- Cache index structure and eviction implementation details
- HLS-to-MP4 concatenation approach (ffmpeg binary vs manual TS muxing)
- Protocol handler URL structure for `animecix-offline://`
- Tray icon design and menu wording
- Error handling and retry strategy for failed chunks
- IPC channel naming for download-related events

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Old app download implementation (reference patterns)
- `animecix-desktop/modules/downloader.ts` — Multi-threaded downloader with Range headers, chunk progress, merge logic
- `animecix-desktop/modules/controllers/download-controller.ts` — Download queue management, sequential processing, progress reporting to renderer
- `animecix-desktop/models/download-item.ts` — DownloadItem interface

### animecix-v2 existing infrastructure
- `animecix-v2/src/storage/StorageService.ts` — SQLite wrapper, will host download queue and cache metadata tables
- `animecix-v2/src/storage/schema.ts` — Current schema (settings, window_bounds, subtitle_prefs) — extend for Phase 3
- `animecix-v2/src/preload.ts` — IPC bridge, needs new download/cache/storage channels
- `animecix-v2/src/types/animecix-api.d.ts` — AnimecixAPI type contract, needs download/cache/storage methods
- `animecix-v2/src/player/tau-protocol.ts` — Existing protocol handler pattern, reference for `animecix-offline://`
- `animecix-v2/src/network/request-handler.ts` — Request interception layer, extend for cache proxy
- `animecix-v2/src/player-page/types.ts` — Player source types with dual source interface (D-06 from Phase 2)

### animecix.tv website (integration surface)
- `animecix-angular/src/app/site/player/player.component.ts` — Orchestrator for postMessage, IPC, episode navigation
- `animecix-angular/src/app/site/player/player.service.ts` — Video cuing, URL management

### Notification patterns
- `animecix-desktop/modules/helpers/notification-helper.ts` — Desktop notification patterns from old app

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StorageService` (animecix-v2/src/storage/): SQLite ready for new tables — download_queue, cache_index
- `request-handler.ts` (animecix-v2/src/network/): Request interception layer — extend `onBeforeRequest` to intercept and cache video segments
- `tau-protocol.ts` (animecix-v2/src/player/): Protocol handler pattern — reference for `animecix-offline://` registration
- `Downloader2` (animecix-desktop/modules/downloader.ts): Multi-threaded download logic — port Range-splitting and chunk-merge patterns (but rewrite with native Node.js, no node-downloader-helper)
- `NotificationHelper` (animecix-desktop/modules/helpers/notification-helper.ts): Notification creation pattern

### Established Patterns
- Feature-based module layout: `src/download/`, `src/cache/` for new features
- Typed IPC bridge via contextBridge — all new download/cache/storage channels follow same pattern
- camelCase IPC event naming: `downloadVideo`, `downloadProgress`, etc.
- SQLite via better-sqlite3 for all persistent state
- `session.webRequest` for request interception (ad blocking, header rewriting — now also caching)

### Integration Points
- `window.animecix` — new methods for download control, cache queries, storage management
- `session.webRequest.onBeforeRequest` — extend to intercept and cache video segments
- `BrowserWindow.setProgressBar()` — OS taskbar download progress
- `Tray` — new system tray for background download mode
- `animecix-offline://` — new protocol for offline file serving
- Player dual source interface — pass offline URLs instead of remote URLs

</code_context>

<specifics>
## Specific Ideas

- Downloads save to `Downloads/AnimeciX/` (same location as old app — user familiarity)
- Cache lives in `userData/cache/` (managed by the app, evictable)
- HLS segments are transparently cached then muxed to MP4 for clean offline replay
- All subtitle tracks fetched and stored — no language limitation offline
- Tray is contextual: only appears when downloads are active and user closes the window
- Website handles all download UI (queue, progress, storage management) — Electron only provides the IPC API

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-downloads-and-offline*
*Context gathered: 2026-04-13*
