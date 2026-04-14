# Phase 3: Downloads and Offline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 03-downloads-and-offline
**Areas discussed:** Download engine & resumability, Streaming cache strategy, Offline playback & subtitles, Download UI & notifications

---

## Download engine & resumability

| Option | Description | Selected |
|--------|-------------|----------|
| Native HTTP Range chunks | Rewrite Downloader2 pattern with native Node.js fetch/http — split file into N chunks via Range headers, merge on completion. No external download library. | ✓ |
| node-downloader-helper like old app | Keep using node-downloader-helper for each chunk. Simpler but adds dependency. | |
| Single-thread with Range resume | Download sequentially (no parallel chunks) but support pause/resume via Range header. | |

**User's choice:** Native HTTP Range chunks
**Notes:** Proven pattern from old app, removes external dependency

| Option | Description | Selected |
|--------|-------------|----------|
| SQLite queue | Store queue items, progress, and state in SQLite. On restart, resume from last byte position. | ✓ |
| In-memory only like old app | Queue lives in Map — restarting clears all. | |

**User's choice:** SQLite queue
**Notes:** Old app lost queue on restart — this fixes that pain point

| Option | Description | Selected |
|--------|-------------|----------|
| 1 at a time | Sequential queue — one download active, rest queued. | ✓ |
| Configurable (1-3) | User can set max concurrent downloads in settings. | |

**User's choice:** 1 at a time
**Notes:** Matches old app behavior

| Option | Description | Selected |
|--------|-------------|----------|
| 4 threads | Split each file into 4 parallel Range chunks. | ✓ |
| 8 threads | More aggressive parallelism. | |
| You decide | Claude picks. | |

**User's choice:** 4 threads

---

## Streaming cache strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Transparent proxy cache | Intercept video segment requests in session.webRequest, save to disk. Transparent to player. | ✓ |
| Explicit save while watching toggle | User flips toggle to cache current video. | |
| No streaming cache in v1 | Skip PLAY-05 entirely. | |

**User's choice:** Transparent proxy cache
**Notes:** Fully transparent — player doesn't need changes

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed cap with LRU eviction | Default ~10GB cap, oldest unwatched evicted first, user-adjustable. | ✓ |
| Unlimited until manual cleanup | Cache grows without limit. | |
| You decide | Claude picks. | |

**User's choice:** Fixed cap with LRU eviction

| Option | Description | Selected |
|--------|-------------|----------|
| Separate directories | Downloads in Downloads/AnimeciX/, cache in userData/cache/. | ✓ |
| Shared directory | Everything in one place. | |

**User's choice:** Separate directories
**Notes:** Different lifecycle — cache is evictable, downloads are permanent

---

## Offline playback & subtitles

| Option | Description | Selected |
|--------|-------------|----------|
| Custom protocol handler | Register animecix-offline:// protocol. Player receives protocol URLs. | ✓ |
| file:// URLs directly | Pass file:///path/to/video.mp4 to player. | |
| Local HTTP server | Spin up localhost server to serve files. | |

**User's choice:** Custom protocol handler
**Notes:** Works for both downloads and cached videos

| Option | Description | Selected |
|--------|-------------|----------|
| Download all subtitle tracks | Fetch all available ASS subtitle files alongside video. | ✓ |
| Download only selected language | Only cache user's preferred subtitle language. | |
| You decide | Claude picks. | |

**User's choice:** Download all subtitle tracks
**Notes:** No language limitation offline

| Option | Description | Selected |
|--------|-------------|----------|
| Reassemble into single MP4 | After all HLS .ts segments cached, mux into single MP4. | ✓ |
| Serve cached .ts segments via protocol | Keep individual segments, generate local .m3u8. | |
| You decide | Claude picks. | |

**User's choice:** Reassemble into single MP4
**Notes:** Simpler player logic than reconstructing HLS playlists

---

## Download UI & notifications

| Option | Description | Selected |
|--------|-------------|----------|
| IPC to website + taskbar | Send progress via window.animecix IPC. Website renders UI. Taskbar progress bar. | ✓ |
| Separate download window | Dedicated Electron BrowserWindow. | |
| Taskbar only, no in-app UI | Only OS taskbar progress. | |

**User's choice:** IPC to website + taskbar
**Notes:** Same pattern as old app, consistent with app-wraps-website architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Minimize to tray when downloads active | Tray only when downloads running and window closed. Right-click menu. | ✓ |
| Always show tray icon | Tray visible at all times. | |
| You decide | Claude picks. | |

**User's choice:** Minimize to tray when downloads active

| Option | Description | Selected |
|--------|-------------|----------|
| IPC API for website to query | Expose storage stats and delete operations via window.animecix IPC. | ✓ |
| Settings page in Electron | Dedicated Electron-rendered settings page. | |
| You decide | Claude picks. | |

**User's choice:** IPC API for website to query
**Notes:** Consistent with app-wraps-website architecture

## Claude's Discretion

- SQLite schema design for download queue and cache metadata tables
- Chunk merge strategy
- Cache index structure and eviction implementation
- HLS-to-MP4 concatenation approach
- Protocol handler URL structure
- Tray icon design and menu wording
- Error handling and retry strategy
- IPC channel naming

## Deferred Ideas

None — discussion stayed within phase scope
