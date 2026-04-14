# Phase 1: Foundation - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Secure Electron Forge scaffold that loads animecix.tv in a native frameless window with single-instance enforcement, persistent sessions, a typed IPC bridge using contextIsolation + contextBridge, and a SQLite storage layer. No video playback, no downloads, no integrations — just the installable shell ready for feature development.

</domain>

<decisions>
## Implementation Decisions

### Window chrome & title bar
- Fully frameless window — no custom Electron title bar, animecix.tv's own header/nav acts as the app chrome
- Window controls (minimize, maximize, close) float as overlay in top-right corner
- On macOS, use native traffic lights in top-left position
- Website header is the drag region (CSS -webkit-app-region: drag), with no-drag on clickable elements
- True OS fullscreen for video player (hides taskbar/dock) — not window-fill

### Migration strategy
- Fresh Electron Forge scaffold in a new directory (animecix-v2/) alongside the old animecix-desktop/
- Old codebase kept untouched as reference — port proven logic selectively (downloader, ad blocker, RPC patterns)
- No legacy patterns carry over — clean architecture from day one
- Feature-based module organization: src/window/, src/download/, src/player/, etc. — each feature contains its own IPC handlers, services, and types
- TypeScript targeting ESNext with ES modules — modern syntax, native Electron support

### IPC bridge contract
- Typed API object exposed on window.animecix via contextBridge — website calls methods directly
- Phase 1 channels: window controls (minimize, maximize, close, isMaximized, onFullscreen) + navigation events + platform info (platform, version, isOnline)
- Desktop detection: website checks `if (window.animecix)` to know it's running in the desktop app — enables desktop-only UI
- Tau-website (player) keeps postMessage protocol — main process translates postMessage to IPC internally, no change to tau-website's communication pattern

### Storage & session persistence
- Login sessions persist via Electron's built-in session/cookie store — zero custom auth token management
- SQLite storage layer (better-sqlite3) included in Phase 1 as StorageService — stores app settings, window bounds; download queue and cache metadata use it in Phase 3
- All app data stored in Electron userData path (app.getPath('userData')) — standard OS location
- Window bounds (size + position) persisted to SQLite and restored on launch

### Claude's Discretion
- Electron Forge template choice (webpack vs vite plugin)
- Exact preload script structure and type definitions
- SQLite schema design for settings table
- Error handling and logging approach
- ESLint/Prettier configuration
- Dev tooling setup (hot reload, debugging)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- WindowController (animecix-desktop/modules/controllers/window-controller.ts): Frameless window setup, fullscreen handling, user agent spoofing — port the logic patterns
- RequestController (animecix-desktop/modules/controllers/request-controller.ts): Header manipulation and ad blocker setup — reference for Phase 2
- Downloader2 (animecix-desktop/modules/downloader.ts): Multi-threaded HTTP download with progress — reference for Phase 3
- NotificationHelper (animecix-desktop/modules/helpers/notification-helper.ts): Desktop notification patterns — reference for Phase 3

### Established Patterns
- Controller pattern with execute() method for IPC listener setup — v2 uses feature-based modules instead but same execute() concept applies
- IPC event naming: camelCase verbs (downloadVideo, playPause, updateCurrent) — keep this convention
- Optional chaining for BrowserWindow access (win?.webContents) — carry forward

### Integration Points
- animecix.tv website loads in main webContents — preload bridge is the only connection
- Tau-website postMessage protocol bridges through webContents message events
- Single instance lock via app.requestSingleInstanceLock() — Electron standard

</code_context>

<specifics>
## Specific Ideas

- Website's own header/nav serves as the entire app chrome — no visible Electron UI above the website
- Detection pattern matches old app: presence of window.animecix namespace = desktop app
- Platform-native window controls: macOS traffic lights in standard position, Windows controls overlaid top-right

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-11*
