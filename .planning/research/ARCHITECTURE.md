# Architecture Research

**Project:** AnimeciX Desktop v2
**Mode:** Ecosystem / Architecture
**Confidence:** HIGH

## Key Findings

1. **Three-context isolation is the core architectural constraint.** The app has three coexisting web contexts: animecix.tv (remote, lower trust), tau-website (local, higher trust), and the main process (Node.js, full trust). All cross-context communication must route through the main process.

2. **The current app's two critical architectural debts are contextIsolation=false and scattered IPC handlers.** Both must be corrected in v2.

3. **BrowserView (or WebContentsView in Electron 28+) for the player, not an iframe.** tau-website must run in its own webContents with its own preload script.

4. **CacheService requires a local HTTP proxy pattern.** The streaming cache must intercept HLS segments transparently. Cleanest approach is `protocol.handle()` interception or local HTTP proxy.

5. **StorageService must be the single source of truth for all persistent state.** v2 must persist through StorageService so downloads resume after crash and watch progress is never lost.

## Architecture Overview

```
MAIN PROCESS
  BootstrapApp → ServiceRegistry
    ├── StorageService        (SQLite / electron-store — all persistence)
    ├── SessionService        (webRequest hooks, ad block, header injection)
    ├── WindowService         (BrowserWindow + BrowserView lifecycle)
    ├── DownloadService       (queue, multi-thread fetcher, progress)
    ├── CacheService          (streaming proxy/intercept, eviction)
    ├── PlayerService         (episode state machine, coordinates contexts)
    ├── DiscordService        (RPC, subscribes to PlayerService)
    ├── UpdateService         (electron-updater)
    ├── DeeplinkService       (animecix:// protocol)
    └── IPCRouter             (all ipcMain.handle registrations centralized)

preload-site.ts → contextBridge → window.anx  (animecix.tv API surface)
preload-player.ts → contextBridge → window.tau (tau-website API surface)
```

## Component Boundaries

| Component | Owns | Talks To |
|-----------|------|----------|
| BootstrapApp | App init, single-instance lock | ServiceRegistry |
| ServiceRegistry | Service lifecycle (init/destroy order) | All services |
| WindowService | BrowserWindow + BrowserView creation, show/hide player | All services (shared window ref) |
| SessionService | webRequest filters, ad block filters, header rules | DownloadService, StorageService |
| StorageService | SQLite DB or electron-store files | All services that need persistence |
| DownloadService | Download queue, file writes, thread workers | StorageService, IPCRouter |
| CacheService | Local proxy or protocol.handle, cache index, eviction | StorageService, PlayerService |
| PlayerService | Episode state machine (current title/ep/position/source) | IPCRouter, DiscordService, CacheService |
| DiscordService | Discord RPC client | PlayerService (subscribe to episode changes) |
| UpdateService | electron-updater lifecycle | IPCRouter |
| DeeplinkService | animecix:// protocol registration | WindowService, IPCRouter |
| IPCRouter | All ipcMain.handle() registrations | Every service, WindowService |
| preload-site.ts | window.anx contextBridge API | IPCRouter |
| preload-player.ts | window.tau contextBridge API | IPCRouter |

## Data Flow Directions

- **Website → Main:** `window.anx.*` → `preload-site.ts` → `ipcRenderer.invoke` → `IPCRouter` → service method
- **Main → Website (push):** service emits event → `IPCRouter` → `webContents.send` → `preload-site.ts` → `window.anx.on*`
- **Main → Player:** `PlayerService` → `IPCRouter` → `webContents.send` (player BrowserView) → `preload-player.ts` → `window.tau.on*`
- **Player → Main:** `window.tau.*` → `preload-player.ts` → `ipcRenderer.invoke` → `IPCRouter` → `PlayerService`
- **Website ↔ Player:** Never direct. Always via main process relay.

## Suggested Build Order

```
Phase 1 — Foundation
  Electron Forge scaffold + TypeScript + Vite (tau-website bundle)
  BootstrapApp + ServiceRegistry skeleton
  StorageService (everything else depends on this)
  WindowService (BrowserWindow creation only)

Phase 2 — Content Contexts
  preload-site.ts skeleton
  animecix.tv loaded in main window
  tau-website bundled, served locally
  preload-player.ts skeleton
  BrowserView for player (show/hide working)

Phase 3 — IPC Infrastructure + Session
  IPCRouter wired to ServiceRegistry
  SessionService (ad block, header injection)
  DeeplinkService (animecix:// Google auth)

Phase 4 — Player Integration (end-to-end online streaming)
  PlayerService episode state machine
  preload-site.ts: playVideo/playOffline channels
  preload-player.ts: load/timeUpdate/ended channels
  Full path: website click → main → player plays → events flow back

Phase 5 — Downloads
  DownloadService (multi-thread, queue, StorageService writes)
  Progress push events to site context
  Offline playback via PlayerService.playOffline()

Phase 6 — Streaming Cache
  CacheService (local proxy or protocol.handle intercept)
  Triggered automatically by PlayerService on episode start
  Eviction policy + StorageService index

Phase 7 — Native Integrations
  DiscordService (RPC, subscribes to PlayerService)
  UpdateService (electron-updater)
  Centralized NotificationService

Phase 8 — Hardening
  contextIsolation=true + contextBridge audit
  Structured logging (electron-log)
  Error boundaries per service
  Windows + macOS build verification
```

## Open Questions

- **Phase 1:** electron-store vs better-sqlite3 for StorageService
- **Phase 6:** `protocol.handle()` vs local express server for HLS proxy
- **Phase 2:** `WebContentsView` (Electron 28+) vs `BrowserView` (deprecated)
- **Phase 4:** tau-website postMessage API schema for preload-player.ts bridging

---
*Architecture research: 2026-04-11*
