# Domain Pitfalls

**Domain:** Electron desktop app wrapping external website with offline video and download management
**Researched:** 2026-04-11
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: Keeping contextIsolation Disabled

**What goes wrong:** The existing app has `contextIsolation: false` on a BrowserWindow loading `animecix.tv`. Any JavaScript on the external site has full Node.js API access.

**Prevention:**
- Enable `contextIsolation: true` on all BrowserWindows
- Expose IPC bridge exclusively through `contextBridge.exposeInMainWorld()` in preload scripts
- Use `ipcRenderer.invoke()` in preload — renderer never accesses Node directly

**Warning signs:** `webPreferences: { contextIsolation: false }`, `window.require('electron')` in renderer

**Phase:** Phase 1 (foundation). Retrofitting security after features are built is significantly harder.

### Pitfall 2: SSL Certificate Validation Disabled in Production

**What goes wrong:** `rejectUnauthorized: false` in `downloader.ts` disables certificate validation for all HTTP requests.

**Prevention:**
- Remove `rejectUnauthorized: false` entirely — no exceptions
- Add a pre-commit lint rule that greps for `rejectUnauthorized`

**Phase:** Phase 1. Must not be carried into the rebuilt codebase.

### Pitfall 3: Electron Forge Build Config Does Not Map to electron-builder

**What goes wrong:** electron-builder uses `build` key in package.json. Forge uses `forge.config.ts` with entirely different schema. Silent failures in packaged builds.

**Prevention:**
- Treat Forge config as greenfield — write from scratch
- Configure makers explicitly (Squirrel for Windows, DMG+ZIP for macOS)
- Test packaged builds on both platforms before feature work

**Warning signs:** `MODULE_NOT_FOUND`, `compiled against different Node.js version`, updater finds no updates

**Phase:** Phase 1. Validate with real packaged build immediately.

### Pitfall 4: Multi-Threaded Download State Machine Using Boolean Flags

**What goes wrong:** Current downloader uses boolean flags (`canceled`, `error`, `downloading`) mutated from concurrent async contexts. Race conditions produce corrupt files.

**Prevention:**
- Model download state as explicit enum: `QUEUED | PREPARING | DOWNLOADING | PAUSING | PAUSED | ERROR | CANCELLED | COMPLETED`
- Enforce transitions through single `setState(next)` method
- Throttle progress updates to 150ms intervals
- Store chunk completion as Set of indices for correct resume

**Phase:** Phase 2 (download system). Design state machine before implementing threading.

### Pitfall 5: BrowserView/WebContentsView Lifetime Race Conditions

**What goes wrong:** Views can be destroyed by navigation/close while code still calls their `webContents`. Crashes with `Object has been destroyed`.

**Prevention:**
- Optional chaining on every webContents call
- Centralize view creation/destruction with explicit state: `CREATED → READY → DESTROYED`
- Prefer `WebContentsView` (Electron 28+) over deprecated `BrowserView`

**Phase:** Phase 1. Window lifecycle must be correct before features are layered on.

### Pitfall 6: Deep Link Second-Instance Events Silently Dropped

**What goes wrong:** `animecix://` deep links silently swallowed when app already running if single-instance lock not combined with `second-instance` event handling.

**Prevention:**
- Register protocol before `requestSingleInstanceLock()`
- Handle both `second-instance` (Windows) and `open-url` (macOS) events
- Parse URLs with `new URL()` and validate protocol+hostname

**Phase:** Phase 1. Deep link registration must happen before window creation.

## Moderate Pitfalls

### Pitfall 7: Ad Blocker Initialization Blocking App Startup

**Prevention:** Initialize asynchronously after window shown. Cache parsed filter lists to disk. Switch to `@ghostery/adblocker-electron` (maintained fork).

**Phase:** Phase 1 (startup performance).

### Pitfall 8: IPC Channel Proliferation Without Schema Validation

**Prevention:**
- Define `IPCChannels` enum for all channel names
- Typed request/response interfaces per channel
- Use `ipcMain.handle()` instead of `ipcMain.on()` for request/response
- Validate payloads at main process boundary

**Phase:** Phase 1 (architecture).

### Pitfall 9: Streaming Cache Filling Disk Without Bound

**Prevention:**
- Configurable max cache size (default 10GB)
- LRU eviction policy
- Check available disk space before writes (`fs.statfs()`)
- Store cache manifest in SQLite

**Phase:** Phase 3 (cache implementation).

### Pitfall 10: Auto-Updater Broken on macOS Without Code Signing

**Prevention:**
- Set up Apple Developer code signing and notarization in CI
- Configure Forge makers with signing identities
- Test full update flow end-to-end before release

**Phase:** Phase 4 (distribution).

### Pitfall 11: tau-website postMessage Bridge Routing Through animecix.tv

**Prevention:**
- Direct IPC bridge to tau-website BrowserView via preload — bypass animecix.tv
- Version the postMessage protocol with a `version` field

**Phase:** Phase 2 (player integration).

## Minor Pitfalls

### Pitfall 12: ASAR Packaging Breaking File Path Assumptions

**Prevention:** Use `app.getAppPath()` for app-relative paths. Configure `unpackDir` for files needing real filesystem paths (JASSUB fonts, native modules).

**Phase:** Phase 1 (build setup).

### Pitfall 13: Request Header Manipulation Triggering CORB in Renderer

**Prevention:** Perform all header manipulation in main process via `session.webRequest`. For renderer video fetching, use custom protocol handler to proxy through main process.

**Phase:** Phase 2 (video playback).

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Phase 1 (Foundation) | contextIsolation, SSL, Forge config, IPC contract, deep links, ASAR, BrowserView lifecycle, ad blocker | All foundation work — expensive to fix later |
| Phase 2 (Player/Downloads) | Download state machine races, postMessage bridge, CORB | Design state machines and bridges before implementation |
| Phase 3 (Cache) | Unbounded disk growth | Design eviction before writing first cache entry |
| Phase 4 (Distribution) | macOS code signing, auto-update compatibility | Set up signing in CI before first public release |

---
*Pitfalls research: 2026-04-11*
