# Phase 1: Foundation - Research

**Researched:** 2026-04-11
**Domain:** Electron (Forge + Vite + TypeScript), contextBridge IPC, SQLite storage, frameless window, session persistence
**Confidence:** HIGH (core Electron APIs) / MEDIUM (better-sqlite3 + Electron 41 rebuild path)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Window chrome & title bar**
- Fully frameless window — no custom Electron title bar, animecix.tv's own header/nav acts as the app chrome
- Window controls (minimize, maximize, close) float as overlay in top-right corner
- On macOS, use native traffic lights in top-left position
- Website header is the drag region (CSS -webkit-app-region: drag), with no-drag on clickable elements
- True OS fullscreen for video player (hides taskbar/dock) — not window-fill

**Migration strategy**
- Fresh Electron Forge scaffold in a new directory (animecix-v2/) alongside the old animecix-desktop/
- Old codebase kept untouched as reference — port proven logic selectively (downloader, ad blocker, RPC patterns)
- No legacy patterns carry over — clean architecture from day one
- Feature-based module organization: src/window/, src/download/, src/player/, etc. — each feature contains its own IPC handlers, services, and types
- TypeScript targeting ESNext with ES modules — modern syntax, native Electron support

**IPC bridge contract**
- Typed API object exposed on window.animecix via contextBridge — website calls methods directly
- Phase 1 channels: window controls (minimize, maximize, close, isMaximized, onFullscreen) + navigation events + platform info (platform, version, isOnline)
- Desktop detection: website checks `if (window.animecix)` to know it's running in the desktop app — enables desktop-only UI
- Tau-website (player) keeps postMessage protocol — main process translates postMessage to IPC internally, no change to tau-website's communication pattern

**Storage & session persistence**
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

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SHELL-01 | User sees a native frameless window with minimize/maximize/close controls | BrowserWindow frame:false + titleBarStyle, platform-specific overlay controls |
| SHELL-02 | App enforces single instance lock — second launch focuses existing window | app.requestSingleInstanceLock() + second-instance event pattern |
| SHELL-03 | App loads animecix.tv as main content in the window | win.loadURL() with defaultSession cookie persistence |
| SHELL-04 | User login session persists across app restarts and updates without re-authenticating | Electron defaultSession persists to disk automatically at userData path |
| AUTH-02 | App uses proper HTTPS with certificate validation (no rejectUnauthorized bypass) | Never call setCertificateVerifyProc with blanket accept; default behavior is correct |
| AUTH-03 | All windows use contextIsolation with contextBridge for IPC | contextIsolation:true (Electron default since v12), exposeInMainWorld pattern |
| NET-02 | Preload bridge exposes typed IPC API between website and Electron main process | contextBridge.exposeInMainWorld('animecix', {...}), TypeScript Window augmentation |
</phase_requirements>

---

## Summary

Phase 1 builds the Electron Forge scaffold that every subsequent phase depends on. The foundation is a fresh `animecix-v2/` directory using Electron Forge 7.11.1 with the Vite + TypeScript template — chosen over the Webpack template for faster HMR, cleaner ESM output, and modern toolchain. The old `animecix-desktop/` codebase stays as a reference but no code is ported wholesale; patterns are adapted into the new feature-based module structure.

The two security-critical requirements (AUTH-02, AUTH-03) must be set correctly from day one. Electron defaults (`contextIsolation: true`, certificate validation on) are correct — the risk is accidentally disabling them, which the old codebase did (`contextIsolation: false`, `nodeIntegration: true`). The new scaffold must never set these back. The `window.animecix` contextBridge API forms the sole communication channel between animecix.tv renderer and the main process.

The one notable technical risk in this phase is `better-sqlite3` + native module rebuild. As of April 2026, Electron 41 is current stable, and better-sqlite3 v12.8.0 ships prebuilt binaries for Electron v143 (V8 ABI). The rebuild workflow via `@electron-forge/plugin-auto-unpack-natives` and `electron-rebuild` is well-understood but requires explicit forge.config and Vite externals configuration. If native rebuild proves unstable during development, `node-sqlite3-wasm` is a drop-in WASM alternative with no rebuild requirement.

**Primary recommendation:** Scaffold with `npx create-electron-app@latest animecix-v2 --template=vite-typescript`, lock Electron to 41.x, configure contextBridge with typed `window.animecix` API, and set up StorageService with better-sqlite3 + explicit native module rebuild config.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron | ^41.2.0 | App runtime | Current stable (April 2026); includes Node 24, Chromium 146 |
| @electron-forge/cli | ^7.11.1 | Build/package toolchain | Official Electron toolchain; handles signing, publishing |
| @electron-forge/plugin-vite | ^7.11.1 | Vite build integration | Separate configs for main/preload/renderer, fast HMR |
| typescript | ^5.x | Type safety | ESNext target, strict mode |
| better-sqlite3 | ^12.8.0 | Synchronous SQLite in main process | Fastest Node SQLite binding; prebuilt binaries for Electron 41 |
| @types/better-sqlite3 | ^7.x | TypeScript types for SQLite | Official types package |
| vite | ^6.x | Bundler (pulled in by forge plugin) | Dev server + production builds |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron-rebuild | ^3.x | Rebuild native modules for Electron ABI | Required after install/update of better-sqlite3 |
| @electron-forge/plugin-auto-unpack-natives | ^7.x | Unpack .node files in asar | Required to package native modules correctly |
| eslint | ^9.x | Linting | Enforce code conventions |
| prettier | ^3.x | Formatting | Consistent code style |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| better-sqlite3 | node-sqlite3-wasm | WASM is zero-rebuild, cross-platform, slightly slower; use if native rebuild causes CI pain |
| Forge Vite plugin | electron-vite (separate tool) | electron-vite has more examples but is a separate tool outside Electron Forge ecosystem |
| Forge Vite plugin | Forge Webpack plugin | Webpack is more battle-tested with Forge but slower DX; Vite is the right default now |

**Installation:**
```bash
# Scaffold
npx create-electron-app@latest animecix-v2 --template=vite-typescript

# In animecix-v2/:
npm install better-sqlite3 @types/better-sqlite3
npm install --save-dev @electron-forge/plugin-auto-unpack-natives electron-rebuild
```

---

## Architecture Patterns

### Recommended Project Structure

```
animecix-v2/
├── forge.config.ts          # Electron Forge config (makers, plugins, packager)
├── vite.main.config.mjs     # Vite config for main process
├── vite.preload.config.mjs  # Vite config for preload scripts
├── tsconfig.json            # Shared TS config
├── src/
│   ├── main.ts              # App entry — single instance, BrowserWindow creation
│   ├── preload.ts           # contextBridge exposeInMainWorld('animecix', ...)
│   ├── types/
│   │   └── animecix-api.d.ts  # Window augmentation: declare global { interface Window { animecix: AnimecixAPI } }
│   ├── window/
│   │   ├── WindowService.ts   # BrowserWindow lifecycle, bounds persistence, fullscreen
│   │   └── window.ipc.ts      # ipcMain.handle calls for window controls
│   └── storage/
│       ├── StorageService.ts  # better-sqlite3 wrapper, init schema, get/set settings
│       └── schema.ts          # CREATE TABLE IF NOT EXISTS definitions
└── assets/
    ├── icon.png
    └── icon.icns
```

### Pattern 1: Typed contextBridge API (window.animecix)

**What:** Expose a strongly-typed API namespace on `window.animecix` that the animecix.tv website checks for to detect desktop context.
**When to use:** This is the sole IPC channel for all Phase 1 communication. All subsequent phases ADD to this object.

```typescript
// src/preload.ts
// Source: https://www.electronjs.org/docs/latest/api/context-bridge
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('animecix', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Events from main → renderer
  onFullscreenChange: (cb: (isFullscreen: boolean) => void) => {
    const handler = (_: Electron.IpcRendererEvent, val: boolean) => cb(val);
    ipcRenderer.on('window:fullscreen-changed', handler);
    return () => ipcRenderer.removeListener('window:fullscreen-changed', handler);
  },

  // Platform info
  platform: process.platform,
  version: process.env.npm_package_version,
  isOnline: () => navigator.onLine,
});
```

```typescript
// src/types/animecix-api.d.ts
// Source: https://www.electronjs.org/docs/latest/tutorial/context-isolation
export interface AnimecixAPI {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onFullscreenChange: (cb: (val: boolean) => void) => () => void;
  platform: NodeJS.Platform;
  version: string | undefined;
  isOnline: () => boolean;
}

declare global {
  interface Window {
    animecix?: AnimecixAPI;
  }
}
```

### Pattern 2: Single Instance Lock

**What:** Call `app.requestSingleInstanceLock()` before `app.whenReady()`. If lock fails, quit immediately. Register `second-instance` handler to focus the existing window.
**When to use:** Required before any window is created (SHELL-02).

```typescript
// src/main.ts
// Source: https://www.electronjs.org/docs/latest/api/app
import { app, BrowserWindow } from 'electron';

let mainWindow: BrowserWindow | null = null;

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    mainWindow = createWindow();
  });
}
```

### Pattern 3: Frameless Window — Cross-Platform

**What:** Different BrowserWindow options per platform to achieve frameless window with appropriate native controls.
**When to use:** Applied at window creation time (SHELL-01).

```typescript
// src/window/WindowService.ts
// Source: https://www.electronjs.org/docs/latest/tutorial/custom-title-bar
import { BrowserWindow, app } from 'electron';
import path from 'node:path';

const isMac = process.platform === 'darwin';

const win = new BrowserWindow({
  width: 1280,
  height: 800,
  show: false,
  backgroundColor: '#1D1D1D',
  frame: false,
  // macOS: keep native traffic lights at standard position
  ...(isMac && { titleBarStyle: 'hidden' }),
  // Windows: overlay native controls top-right
  ...(!isMac && {
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1D1D1D',
      symbolColor: '#ffffff',
      height: 40,
    },
  }),
  webPreferences: {
    contextIsolation: true,        // REQUIRED — never disable
    nodeIntegration: false,        // REQUIRED — never enable for remote content
    sandbox: true,                 // Recommended: extra process isolation
    preload: path.join(__dirname, 'preload.js'),
  },
  title: 'AnimeciX',
  icon: path.join(__dirname, '..', 'assets', 'icon.png'),
});
```

Note: On macOS, the website's header drag region (`-webkit-app-region: drag`) handles window dragging. On Windows, the `titleBarOverlay` reserves a 40px strip for native controls at the top-right; the rest of the header should also have `-webkit-app-region: drag`.

### Pattern 4: StorageService (better-sqlite3)

**What:** Synchronous SQLite wrapper initialized in main process, keyed by setting name. Used for window bounds, app settings.
**When to use:** Initialize once on app startup before restoring window bounds.

```typescript
// src/storage/StorageService.ts
import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';

export class StorageService {
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'animecix.db');
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS window_bounds (
        id     INTEGER PRIMARY KEY CHECK (id = 1),
        x      INTEGER,
        y      INTEGER,
        width  INTEGER NOT NULL DEFAULT 1280,
        height INTEGER NOT NULL DEFAULT 800,
        maximized INTEGER NOT NULL DEFAULT 0
      );
      INSERT OR IGNORE INTO window_bounds (id) VALUES (1);
    `);
  }

  getSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  setSetting(key: string, value: string): void {
    this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }

  getWindowBounds(): { x?: number; y?: number; width: number; height: number; maximized: boolean } {
    const row = this.db.prepare('SELECT * FROM window_bounds WHERE id = 1').get() as any;
    return { x: row.x ?? undefined, y: row.y ?? undefined, width: row.width, height: row.height, maximized: !!row.maximized };
  }

  saveWindowBounds(bounds: { x: number; y: number; width: number; height: number; maximized: boolean }): void {
    this.db.prepare('UPDATE window_bounds SET x=?, y=?, width=?, height=?, maximized=? WHERE id=1')
      .run(bounds.x, bounds.y, bounds.width, bounds.height, bounds.maximized ? 1 : 0);
  }
}
```

### Pattern 5: Session Persistence (SHELL-04)

**What:** Electron's `defaultSession` persists cookies to disk by default at `app.getPath('userData')/Cookies`. No code required to enable it — just avoid clearing cache on startup (the old codebase cleared it).
**When to use:** Default behavior; verify by NOT calling `session.defaultSession.clearCache()`.

The old codebase (`window-controller.ts` lines 41-44) aggressively cleared session cache on every launch. This must NOT be carried forward — it would destroy auth tokens on every restart, breaking SHELL-04.

### Anti-Patterns to Avoid

- **`nodeIntegration: true` + `contextIsolation: false`**: What the old animecix-desktop does. Never replicate. Exposes entire Node.js API to any XSS payload on animecix.tv.
- **`setCertificateVerifyProc` blanket accept**: `callback(0)` for all certs breaks AUTH-02. Only valid use is pin-pointing known certs or logging.
- **Exposing `ipcRenderer` directly**: `contextBridge.exposeInMainWorld('ipcRenderer', ipcRenderer)` is equivalent to nodeIntegration. Always wrap with specific method calls.
- **`session.defaultSession.clearCache()` on startup**: Destroys persisted cookies; breaks SHELL-04. The old code does this — do not port it.
- **Bundling `.node` files with Vite/Rollup**: Native modules must be marked `external` in Vite config and unpacked from asar; otherwise the packaged app crashes.
- **`webPreferences: {}` empty object in popup windows**: The old window-controller.ts line 159 creates popup windows with empty webPreferences, which inherits insecure defaults. Any window created via `setWindowOpenHandler` must explicitly set `contextIsolation: true, nodeIntegration: false`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session / cookie persistence | Custom token storage, localStorage sync | Electron `defaultSession` (built-in) | Handles Set-Cookie headers, Secure/HttpOnly flags, expiry; survives app restarts automatically |
| Native module packaging | Custom asar extraction logic | `@electron-forge/plugin-auto-unpack-natives` | Correctly handles .node file placement outside asar archive |
| Window bounds save/restore | JSON file in userData | StorageService (better-sqlite3) | Already decided; SQLite handles concurrent writes safely, extensible to Phase 3 |
| IPC type safety | Runtime string-matching + casts | TypeScript interface on `window.animecix` + `AnimecixAPI` d.ts | Compiler catches API mismatches before runtime |
| Single instance | Custom socket/pid-file approach | `app.requestSingleInstanceLock()` | Cross-platform, handles edge cases (crash recovery, different users) |

**Key insight:** Electron's session layer is a full Chromium cookie store. Trying to replicate auth token management on top of it adds complexity with no benefit — the browser's cookie jar IS the auth layer for animecix.tv.

---

## Common Pitfalls

### Pitfall 1: Security Regressions from Legacy Code

**What goes wrong:** Developer ports `nodeIntegration: true` or `contextIsolation: false` from old codebase because "it worked before."
**Why it happens:** Old animecix-desktop (main.ts line 29-35) used these insecure settings as the foundation.
**How to avoid:** The new BrowserWindow constructor must have `contextIsolation: true, nodeIntegration: false, sandbox: true` hardcoded. Add an ESLint rule or a startup assertion that checks these values.
**Warning signs:** Website can access `window.require`, `window.process`, or `window.module`.

### Pitfall 2: better-sqlite3 Native Rebuild Failure

**What goes wrong:** `better-sqlite3` was installed with Node.js 24 system binary but Electron bundles its own Node.js (also 24.14 in Electron 41, but different ABI). App crashes with "was compiled against a different Node.js version."
**Why it happens:** Native .node binaries are ABI-specific. Even same Node version major can differ.
**How to avoid:** Add `postinstall` script: `"postinstall": "electron-rebuild -f -w better-sqlite3"`. Configure `rebuildConfig` in forge.config.ts with `force: true, buildFromSource: true`. Mark `better-sqlite3` as external in `vite.main.config.mjs`.
**Warning signs:** `Error: The module '.../better-sqlite3.node' was compiled against a different Node.js version`.
**Fallback:** If rebuild consistently fails in CI, swap to `node-sqlite3-wasm` — same API surface, no native rebuild required.

### Pitfall 3: Vite Bundles Native Modules

**What goes wrong:** Vite/Rollup tries to bundle `better-sqlite3` into the main process output, fails because `.node` files cannot be processed by Rollup.
**Why it happens:** Vite's default behavior is to bundle all imports.
**How to avoid:** Add to `vite.main.config.mjs`:
```javascript
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['better-sqlite3'],
    },
  },
});
```
**Warning signs:** Build error mentioning `.node` files or "Cannot bundle binary files."

### Pitfall 4: Session Cache Cleared on Startup (SHELL-04 regression)

**What goes wrong:** Copying `session.defaultSession.clearCache()` from old WindowController causes users to be logged out after every app restart.
**Why it happens:** Old codebase cleared cache on every launch (lines 41-44 of window-controller.ts).
**How to avoid:** Never call `clearCache()` in the new code. Session persistence is passive.
**Warning signs:** User must re-log in every time the app starts.

### Pitfall 5: titleBarOverlay Height Misalignment on Windows

**What goes wrong:** The `titleBarOverlay` height doesn't match the website's header height, causing the native close/maximize/minimize buttons to overlap with website content or leave a visible gap.
**Why it happens:** Default overlay height is platform-dependent and may not match animecix.tv's header.
**How to avoid:** Set `titleBarOverlay: { height: N }` where N matches the website header height. The website may need to add `padding-top` equal to the overlay height on Windows, detectable via `window.animecix.platform`.
**Warning signs:** Window controls cover clickable website elements.

### Pitfall 6: Popup Windows Inherit Insecure webPreferences

**What goes wrong:** `setWindowOpenHandler` returns `{ action: 'allow', overrideBrowserWindowOptions: { webPreferences: {} } }` — empty `webPreferences` causes Electron to use insecure defaults.
**Why it happens:** Old codebase (window-controller.ts line 159) does exactly this.
**How to avoid:** Any `overrideBrowserWindowOptions` must explicitly set `contextIsolation: true, nodeIntegration: false`.

---

## Code Examples

### forge.config.ts (key sections)

```typescript
// Source: https://www.electronforge.io/config/plugins/vite
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import type { ForgeConfig } from '@electron-forge/shared-types';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
  },
  rebuildConfig: {
    force: true,
    buildFromSource: true,
    onlyModules: ['better-sqlite3'],
  },
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        { entry: 'src/main.ts', config: 'vite.main.config.mjs' },
        { entry: 'src/preload.ts', config: 'vite.preload.config.mjs' },
      ],
      renderer: [
        { name: 'main_window', config: 'vite.renderer.config.mjs' },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    }),
  ],
};

export default config;
```

### vite.main.config.mjs

```javascript
// Source: https://www.electronforge.io/config/plugins/vite
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['better-sqlite3'],
    },
  },
});
```

### Fullscreen IPC (main → renderer notification)

```typescript
// src/window/window.ipc.ts
// Source: https://www.electronjs.org/docs/latest/tutorial/ipc
import { ipcMain, BrowserWindow } from 'electron';

export function registerWindowIpc(win: BrowserWindow): void {
  ipcMain.handle('window:minimize', () => win.minimize());
  ipcMain.handle('window:maximize', () => {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });
  ipcMain.handle('window:close', () => win.close());
  ipcMain.handle('window:isMaximized', () => win.isMaximized());

  win.on('enter-full-screen', () => win.webContents.send('window:fullscreen-changed', true));
  win.on('leave-full-screen', () => win.webContents.send('window:fullscreen-changed', false));
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `nodeIntegration: true, contextIsolation: false` | `nodeIntegration: false, contextIsolation: true` (default) | Electron 12 (2021) | Security default flipped; old code is now explicitly insecure |
| electron-builder | Electron Forge | Industry shift 2022-2023 | Forge is now the officially recommended toolchain |
| Webpack bundler in Forge | Vite plugin in Forge | Forge 7.x (2023) | Vite gives faster HMR; marked experimental but production-ready |
| `ipcRenderer.send` direct | `ipcRenderer.invoke` + `ipcMain.handle` | Electron 7+ (2019), now standard | Two-way async IPC; avoids event juggling |
| No TypeScript on preload | TypeScript + Window type augmentation | Community standard 2022+ | Type-safe bridge contract |
| electron-builder + node-gyp manual | Forge `rebuildConfig` + `@electron-forge/plugin-auto-unpack-natives` | Forge 7.x | Rebuild integrated into build pipeline |

**Deprecated/outdated from old codebase:**
- `nodeIntegration: true` in webPreferences: Replaced by contextBridge pattern
- `contextIsolation: false`: Explicitly insecure; default changed in Electron 12
- `session.defaultSession.clearCache()` on startup: Causes SHELL-04 regression
- Direct `ipcMain.on` for window controls (old controller pattern): Use `ipcMain.handle` for two-way invoke/handle pattern instead

---

## Open Questions

1. **better-sqlite3 Electron 41 rebuild in CI (macOS + Windows)**
   - What we know: better-sqlite3 v12.8.0 ships prebuilt binaries for Electron v143 ABI; Electron 41 uses V8 14.6 which required V8 API fixes in v12.8.0; force rebuild is the safe approach
   - What's unclear: Whether `buildFromSource: true` succeeds on GitHub Actions macOS and Windows runners without extra node-gyp setup; the open issue from April 2025 (Electron 35 era) may or may not be fully resolved for Electron 41
   - Recommendation: During scaffold setup (Wave 0), test `npm run rebuild` on macOS and Windows. If it fails, switch to `node-sqlite3-wasm` — the StorageService API surface remains identical

2. **animecix.tv header height on Windows for titleBarOverlay**
   - What we know: `titleBarOverlay: { height: N }` controls the reserved strip height
   - What's unclear: Exact pixel height of animecix.tv's header; may vary with responsive breakpoints
   - Recommendation: Inspect animecix.tv header height, set overlay height to match, expose platform info via `window.animecix.platform` so the website can conditionally add padding

3. **Electron Forge Vite plugin "experimental" status for production**
   - What we know: Marked experimental since v7.5.0; v7.11.1 is current; widely used in community
   - What's unclear: Whether "experimental" means API instability or just feature completeness lag
   - Recommendation: Use it — the scaffold command generates it by default and it is the path forward. Pin `@electron-forge/plugin-vite` to `^7.11.1` to prevent unexpected breaking changes.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected in existing codebase — Wave 0 must establish |
| Config file | `vitest.config.ts` — create in Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

**Rationale for Vitest:** The project uses Vite as the build tool (Electron Forge Vite plugin). Vitest is Vite-native, shares the same config, and supports TypeScript out of the box. Jest requires additional transform setup for ESM/TypeScript in this environment.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHELL-01 | BrowserWindow created with frame:false and correct webPreferences | unit | `npx vitest run tests/window/WindowService.test.ts` | Wave 0 |
| SHELL-02 | Second instance triggers focus of first window | unit | `npx vitest run tests/main/singleInstance.test.ts` | Wave 0 |
| SHELL-03 | win.loadURL called with https://animecix.tv | unit | `npx vitest run tests/window/WindowService.test.ts` | Wave 0 |
| SHELL-04 | clearCache NOT called; defaultSession used | unit | `npx vitest run tests/window/WindowService.test.ts` | Wave 0 |
| AUTH-02 | setCertificateVerifyProc never called with blanket accept | unit/grep | `npx vitest run tests/security/certValidation.test.ts` | Wave 0 |
| AUTH-03 | contextIsolation:true and nodeIntegration:false in all BrowserWindow instances | unit | `npx vitest run tests/security/webPreferences.test.ts` | Wave 0 |
| NET-02 | window.animecix API has all required methods | unit | `npx vitest run tests/preload/animecixAPI.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/ --reporter=dot`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/window/WindowService.test.ts` — covers SHELL-01, SHELL-03, SHELL-04
- [ ] `tests/main/singleInstance.test.ts` — covers SHELL-02 (mock app.requestSingleInstanceLock)
- [ ] `tests/security/webPreferences.test.ts` — covers AUTH-03
- [ ] `tests/security/certValidation.test.ts` — covers AUTH-02
- [ ] `tests/preload/animecixAPI.test.ts` — covers NET-02
- [ ] `tests/storage/StorageService.test.ts` — covers StorageService schema and CRUD
- [ ] `vitest.config.ts` — base config
- [ ] Framework install: `npm install --save-dev vitest @vitest/coverage-v8`

---

## Sources

### Primary (HIGH confidence)

- Electron official docs: Context Isolation — https://www.electronjs.org/docs/latest/tutorial/context-isolation
- Electron official docs: contextBridge API — https://www.electronjs.org/docs/latest/api/context-bridge
- Electron official docs: IPC tutorial — https://www.electronjs.org/docs/latest/tutorial/ipc
- Electron official docs: Custom title bar — https://www.electronjs.org/docs/latest/tutorial/custom-title-bar
- Electron official docs: app.requestSingleInstanceLock — https://www.electronjs.org/docs/latest/api/app
- Electron official docs: Session — https://www.electronjs.org/docs/latest/api/session
- Electron official docs: Security — https://www.electronjs.org/docs/latest/tutorial/security
- Electron Forge docs: Vite plugin — https://www.electronforge.io/config/plugins/vite
- Electron Forge docs: Vite + TypeScript template — https://www.electronforge.io/templates/vite-+-typescript
- better-sqlite3 GitHub releases — https://github.com/WiseLibs/better-sqlite3/releases

### Secondary (MEDIUM confidence)

- electron/rebuild issue #1179: better-sqlite3 on Electron 35 C++20 error — https://github.com/electron/rebuild/issues/1179 (issue was for 35.x; v12.8.0 addresses Electron 41 V8 changes)
- Electron Forge issue #3502: "type:module" + Vite templates — https://github.com/electron/forge/issues/3502
- Electron releases page: v41.2.0 current stable — https://releases.electronjs.org/

### Tertiary (LOW confidence)

- WebSearch: Electron Forge + Vite + better-sqlite3 rebuildConfig pattern — from community blog posts; verify with actual test during Wave 0

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against official Electron docs and Forge docs, npm release data
- Architecture: HIGH — patterns sourced from official Electron docs with code examples
- Pitfalls: HIGH for security pitfalls (directly from old codebase analysis + official docs); MEDIUM for native module rebuild (known issue, resolution depends on Electron 41 specifically)
- Validation architecture: HIGH — Vitest rationale clear given Vite toolchain

**Research date:** 2026-04-11
**Valid until:** 2026-06-11 (Electron releases every 8 weeks; verify Electron version before Phase 2)
