---
phase: 01-foundation
plan: 02
subsystem: ui
tags: [electron, vite, typescript, ipc, contextbridge, window-management, sqlite]

# Dependency graph
requires:
  - phase: 01-foundation-01
    provides: StorageService (SQLite), AnimecixAPI type contract, Electron Forge scaffold

provides:
  - Launchable Electron app loading https://animecix.tv in a frameless BrowserWindow
  - WindowService with platform-specific titlebar, bounds persistence, popup interception
  - window.ipc.ts with 4 window control IPC handlers + fullscreen event forwarding
  - preload.ts exposing window.animecix contextBridge API implementing AnimecixAPI
  - main.ts with single-instance lock, StorageService lifecycle, and graceful shutdown

affects: [02-streaming, 03-downloads, 04-ship]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - contextBridge.exposeInMainWorld wraps all IPC — ipcRenderer never exposed directly
    - WindowService owns BrowserWindow creation; main.ts orchestrates lifecycle only
    - StorageService passed as dependency to WindowService — no global singletons
    - window-all-closed and before-quit both guard StorageService.close() for safety

key-files:
  created:
    - animecix-v2/src/window/WindowService.ts
    - animecix-v2/src/window/window.ipc.ts
  modified:
    - animecix-v2/src/preload.ts
    - animecix-v2/src/main.ts

key-decisions:
  - "window-all-closed handler split between WindowService (app.quit) and main.ts (storage.close) — both guard independently for safety"
  - "Bounds persistence skips saving during maximized state to preserve restore dimensions; maximize/unmaximize events save the correct flag"
  - "setWindowOpenHandler returns action:deny for all popups — external URLs opened via shell.openExternal"
  - "Renderer entry kept in forge.config.ts to avoid Forge VitePlugin errors; renderer files (renderer.ts, index.html) remain but are never loaded by loadURL path"

patterns-established:
  - "IPC pattern: ipcMain.handle in window.ipc.ts, ipcRenderer.invoke in preload.ts — no direct ipcRenderer exposure"
  - "Security baseline: contextIsolation=true, nodeIntegration=false, sandbox=true on all BrowserWindow instances"
  - "Window lifecycle: show:false + ready-to-show event prevents flash of unstyled content"

requirements-completed: [SHELL-01, SHELL-02, SHELL-03, SHELL-04, AUTH-02, AUTH-03, NET-02]

# Metrics
duration: 18min
completed: 2026-04-11
---

# Phase 01 Plan 02: App Shell Summary

**Frameless Electron BrowserWindow loading https://animecix.tv with contextBridge IPC, bounds persistence via SQLite, and single-instance lock**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-11T21:22:31Z
- **Completed:** 2026-04-11T21:40:40Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- WindowService creates a frameless BrowserWindow loading animecix.tv with platform-specific titlebar (macOS: hidden/traffic lights; Windows: titleBarOverlay with custom colors)
- Preload bridge exposes full AnimecixAPI contract via contextBridge with typed IPC wrappers; ipcRenderer never exposed directly
- main.ts wires single-instance lock, StorageService lifecycle, graceful shutdown, and macOS dock re-create behavior
- `npm run package` succeeds — app packages without errors

## Task Commits

1. **Task 1: WindowService, window IPC handlers, and preload bridge** - `eb88222` (feat)
2. **Task 2: Wire main.ts entry point with single-instance lock** - `f640c7c` (feat)

**Plan metadata:** (to be committed with this summary)

## Files Created/Modified

- `animecix-v2/src/window/WindowService.ts` - Frameless BrowserWindow factory with bounds persistence, popup interception, platform titlebar config
- `animecix-v2/src/window/window.ipc.ts` - registerWindowIpc: 4 window control handlers + fullscreen enter/leave events
- `animecix-v2/src/preload.ts` - contextBridge.exposeInMainWorld('animecix') implementing AnimecixAPI contract
- `animecix-v2/src/main.ts` - App entry: single-instance lock, StorageService init, window creation, lifecycle management

## Decisions Made

- Bounds persistence uses debounced save (500ms) on resize/move events, skipping while maximized to preserve restore dimensions. Separate maximize/unmaximize handlers save the correct `maximized` flag.
- `window-all-closed` and `before-quit` both call `storage.close()` defensively — whichever fires first on a given platform is covered.
- `setWindowOpenHandler` returns `{ action: 'deny' }` for all popups and opens URLs via `shell.openExternal` — no new BrowserWindows can be spawned from the renderer.
- Renderer Forge config entry kept as-is — since the app loads via `loadURL('https://animecix.tv')`, the local renderer HTML is never served but removing the renderer entry would cause VitePlugin errors.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compilation passed on first attempt and `npm run package` succeeded.

## User Setup Required

None - no external service configuration required. App loads animecix.tv which handles authentication via Electron's persistent Chromium cookie store automatically.

## Next Phase Readiness

- App shell is complete and launchable — Phase 1 Foundation requirements SHELL-01 through SHELL-04, AUTH-02, AUTH-03, NET-02 are satisfied
- Phase 2 (Online Streaming) can build on the existing BrowserWindow and IPC infrastructure
- Research flags from Phase 1 still apply: WebContentsView API, tau-website postMessage schema, and Vidstack + custom scheme compatibility need verification before Phase 2 implementation

---
*Phase: 01-foundation*
*Completed: 2026-04-11*
