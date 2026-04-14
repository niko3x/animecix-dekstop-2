---
phase: 02-online-streaming
plan: 07
subsystem: main-process-wiring
tags: [electron, main-process, preload, ipc, discord-rpc, deep-link, ad-blocker, tau-protocol, subtitle-prefs]
dependency_graph:
  requires:
    - 02-01 (request-handler, ad-blocker, header-rewriter)
    - 02-02 (header-rewriter)
    - 02-03 (StorageService subtitle prefs, deep-link)
    - 02-04 (DiscordService)
    - 02-06 (assets/player/ build output)
  provides:
    - animecix-v2/src/main.ts (all Phase 2 services wired end-to-end)
    - animecix-v2/src/preload.ts (subtitle:get/set + episode IPC channels)
    - animecix-v2/src/types/animecix-api.d.ts (complete Phase 2 API types)
    - animecix-v2/src/player/tau-protocol.ts (serves assets/player/ with dev/prod paths)
  affects:
    - animecix.tv website (new IPC channels available on window.animecix)
tech_stack:
  added: []
  patterns:
    - app.isPackaged check for dev vs packaged asset path resolution
    - animecix.tv as postMessage-to-IPC bridge (player iframe cannot access window.animecix)
    - lastEpisodeData module-level state for Discord RPC play state updates
    - registerSchemesAsPrivileged side-effect import before app.whenReady
key_files:
  created: []
  modified:
    - animecix-v2/src/player/tau-protocol.ts
    - animecix-v2/tests/player/tau-protocol.test.ts
    - animecix-v2/src/main.ts
    - animecix-v2/src/preload.ts
    - animecix-v2/src/types/animecix-api.d.ts
decisions:
  - "EpisodeData IPC shape uses seasonNumber/episodeNumber as optional strings (matching DiscordService interface) not season/episode as numbers (plan spec had wrong types)"
  - "tau-protocol basePath uses app.isPackaged + process.resourcesPath for prod (extraResource alongside asar) and app.getAppPath() + assets/player for dev"
  - "discord.destroy() called synchronously in before-quit (not async await) — DiscordService.destroy() returns void, not Promise<void>"
  - "lastEpisodeData typed as Omit<EpisodeData, 'isPlaying' | 'startTimestamp'> to avoid storing transient play state"
metrics:
  duration: 15min
  completed_date: "2026-04-12"
  tasks_completed: 2
  files_created: 0
  files_modified: 5
---

# Phase 02 Plan 07: Phase 2 Service Wiring Summary

Wired all Phase 2 services into main.ts (tau-player:// protocol, ad blocker, header rewriter, deep link auth, Discord RPC), updated tau-protocol.ts to serve from assets/player/ with correct dev/prod path resolution, and extended preload.ts with subtitle preference and episode metadata IPC channels for the animecix.tv bridge architecture.

## What Was Built

### Task 1: Update tau-protocol.ts path and fix test

- **`tau-protocol.ts`**: Changed `basePath` from `assets/tau-website` to `assets/player/` with proper dev/prod detection:
  - Dev: `app.getAppPath() + assets/player/` (project root)
  - Prod: `process.resourcesPath + player/` (extraResource placed alongside asar by Forge)
  - Added `.svg`, `.woff`, `.ttf` to MIME type map for player build outputs
- **`tau-protocol.test.ts`**: Added 3 new MIME type tests for `.svg`, `.woff`, `.ttf`; all 20 tests pass

### Task 2: Wire main.ts with all Phase 2 services and subtitle/episode IPC bridge

- **`main.ts`**: Full Phase 2 service wiring:
  - `import './player/tau-protocol'` as side-effect at top-level (before app.ready) — ensures `registerSchemesAsPrivileged` runs at module import time
  - `registerDeepLinkProtocol()` called before `app.whenReady()` (required by Electron)
  - In `app.whenReady()`: `registerTauProtocol()`, `AdBlocker` + `loadFilterLists()` + `setupRequestInterception()`, `setupHeaderRewriter()`, `new DiscordService()`
  - Cold-start deep link buffering: `extractDeepLinkFromArgs(process.argv)` with `did-finish-load` wait
  - Second-instance handler: restores/focuses window + forwards deep link via `handleDeepLink()`
  - macOS `open-url` handler for deep links
  - Subtitle IPC: `ipcMain.handle('subtitle:get')` and `ipcMain.handle('subtitle:set')` backed by StorageService
  - Episode IPC: `episode:update`, `episode:playState`, `episode:idle` handlers wired to DiscordService
  - `lastEpisodeData` module-level state to carry episode info across play state updates
  - Architecture comment documenting animecix.tv as the postMessage-to-IPC bridge
  - `discord?.destroy()` in `before-quit` alongside `storage?.close()`
- **`preload.ts`**: Added to `window.animecix` API:
  - `getSubtitlePref(animeId)` → `ipcRenderer.invoke('subtitle:get', animeId)`
  - `setSubtitlePref(animeId, language)` → `ipcRenderer.invoke('subtitle:set', animeId, language)`
  - `updateEpisode(data)` → `ipcRenderer.send('episode:update', data)`
  - `updatePlayState(isPlaying)` → `ipcRenderer.send('episode:playState', isPlaying)`
  - `setIdle()` → `ipcRenderer.send('episode:idle')`
- **`animecix-api.d.ts`**: Added complete Phase 2 type definitions for all five new IPC methods

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] EpisodeData interface uses string fields not number fields**
- **Found during:** Task 2 implementation — reading `discord-rpc.ts` before writing main.ts
- **Issue:** Plan spec described `episode:update` IPC payload as `{ title: string; season: number; episode: number; ... }` but the actual `EpisodeData` interface in `discord-rpc.ts` uses `seasonNumber?: string` and `episodeNumber?: string`. Using number types would cause a type mismatch when spreading into `DiscordService.updateActivity()`.
- **Fix:** Aligned IPC data shape with the actual `EpisodeData` interface — used `seasonNumber?: string` and `episodeNumber?: string` in the IPC payload type.
- **Files modified:** `src/main.ts`, `src/types/animecix-api.d.ts`
- **Commits:** fed1974

**2. [Rule 1 - Bug] DiscordService.destroy() returns void not Promise<void>**
- **Found during:** Task 2 implementation — reading `discord-rpc.ts`
- **Issue:** Plan spec showed `await discord?.destroy()` in `before-quit` handler but `destroy()` returns `void`. Awaiting a `void` is harmless but the `before-quit` handler is synchronous anyway.
- **Fix:** Removed `async/await` from `before-quit` handler for `discord?.destroy()`.
- **Files modified:** `src/main.ts`
- **Commits:** fed1974

## Known Stubs

None. All services are fully wired:
- tau-player:// protocol serves real assets from `assets/player/` build output
- AdBlocker loads real EasyList/EasyPrivacy filter lists
- Header rewriter applies real CDN header rules
- Deep link auth handles all three entry points (cold-start, second-instance, open-url)
- Discord RPC receives real episode metadata via IPC bridge
- Subtitle prefs read/write real SQLite via StorageService

## Threat Flags

No new threat surface beyond what the plan's threat model covers (T-02-14 through T-02-17).

## Self-Check: PASSED

- `animecix-v2/src/player/tau-protocol.ts` — contains `assets/player`, `app.isPackaged`, `process.resourcesPath`, `app.getAppPath()`, `.svg` MIME type; no `tau-website` references
- `animecix-v2/src/main.ts` — contains all required imports and service wiring calls
- `animecix-v2/src/preload.ts` — exposes all 5 new IPC channel methods
- `animecix-v2/src/types/animecix-api.d.ts` — complete type definitions for all Phase 2 methods
- Commits 94537c9 and fed1974 exist in git history
- 64 tests pass; 4 pre-existing failures (better-sqlite3 Node ABI mismatch in test environment, unrelated to this plan)
