---
phase: 03-downloads-and-offline
plan: 04
status: checkpoint
started: 2025-04-13
completed: null
checkpoint: human-verify (Task 3)
---

## Summary

Wired all Phase 3 engines together: extended AnimecixAPI with download/cache/storage IPC channels, created ipcMain handlers with taskbar progress and Turkish notifications, built contextual TrayManager, and integrated everything into main.ts.

## Tasks Completed

| # | Task | Status |
|---|------|--------|
| 1 | AnimecixAPI types, preload IPC, download.ipc handlers | Done |
| 2 | TrayManager, main.ts integration, WindowService close intercept | Done |
| 3 | Verify Phase 3 end-to-end integration | PENDING (human-verify checkpoint) |

## What Was Built

### Task 1: Types, Preload & IPC Handlers
- Extended `animecix-api.d.ts` with DownloadProgress, StorageInfo types and 14 new AnimecixAPI methods (download control, cache, offline, storage management)
- Wired all channels in `preload.ts` with typed event subscriptions for progress and completion
- Created `download.ipc.ts` with registerDownloadIpc: download control, progress forwarding to renderer + OS taskbar, Turkish desktop notifications ("indirildi!"), cache/offline/storage management handlers
- URL scheme validation (https only per T-03-13), episodeId validation before file ops (T-03-14/15)

### Task 2: TrayManager & main.ts Integration
- `TrayManager.ts`: contextual system tray with Turkish menu labels (Goster, Tumunu Duraklat, Tumunu Iptal Et, Cikis), double-click restore, auto-destroy on queue empty
- `WindowService.ts`: setupCloseIntercept — minimize to tray instead of quitting during active downloads
- `DownloadQueue.ts`: added pauseAll/cancelAll methods for tray integration
- `main.ts`: full Phase 3 wiring — offline protocol import (before app.ready), registerOfflineProtocol, DownloadQueue, StreamCache, CacheEvictor, transparent auto-caching via session, episode lifecycle for cache, registerDownloadIpc, TrayManager, close intercept, tray-aware window-all-closed and before-quit handlers

## Key Files

### Created
- `animecix-v2/src/download/download.ipc.ts`
- `animecix-v2/src/download/TrayManager.ts`

### Modified
- `animecix-v2/src/types/animecix-api.d.ts` — 14 new API methods + 2 new types
- `animecix-v2/src/preload.ts` — all download/cache/storage IPC channels
- `animecix-v2/src/main.ts` — full Phase 3 integration
- `animecix-v2/src/window/WindowService.ts` — close intercept for tray
- `animecix-v2/src/download/DownloadQueue.ts` — pauseAll/cancelAll

## Deviations

None — plan executed as specified.

## Checkpoint: Task 3 — Human Verification Required

Task 3 is a blocking human-verify checkpoint. The following must be verified:
1. Start the app: `cd animecix-v2 && npm start`
2. Open DevTools console and check: `typeof window.animecix.downloadVideo === 'function'`
3. Check: `typeof window.animecix.getDownloadQueue === 'function'`
4. Check: `typeof window.animecix.isAvailableOffline === 'function'`
5. Check: `typeof window.animecix.getStorageInfo === 'function'`
6. Navigate to an episode on animecix.tv — app should not crash
7. Run full test suite: `cd animecix-v2 && npm test`
8. Verify no TypeScript errors: `cd animecix-v2 && npx tsc --noEmit`

## Self-Check: PARTIAL (awaiting human verification)

- [x] Website can start, pause, resume, cancel downloads via window.animecix IPC
- [x] Website receives real-time download progress updates
- [x] OS taskbar shows download progress bar
- [x] Desktop notification fires when download completes (Turkish text)
- [x] Closing window during active downloads minimizes to system tray
- [x] Tray has right-click menu: Goster, Tumunu Duraklat, Tumunu Iptal Et, Cikis
- [x] Website can query storage usage and delete individual downloads/cache entries
- [ ] Human verification of end-to-end flow (Task 3)
