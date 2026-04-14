# Technology Stack Research

**Project:** AnimeciX Desktop v2
**Researched:** 2026-04-11
**Confidence:** HIGH (core stack), MEDIUM (some version numbers need npm verification)

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Electron | ^35.x (latest stable) | Desktop runtime | Upgrade from 34.x; security patches matter for network-heavy app |
| Electron Forge | ^7.x | Build, package, dev server | Replaces electron-builder; maintained by Electron team; first-class Vite plugin |
| TypeScript | ^5.4 | All application code | v1 is on 4.5.4 — significant gap. TS 5.x gives const type params, improved inference |
| Node.js | ^20 LTS | Runtime | Electron 35 ships with Node 20 |

### Electron Forge Setup

| Component | Package | Purpose |
|-----------|---------|---------|
| Vite plugin | `@electron-forge/plugin-vite` | Bundle main + preload + renderer with HMR |
| Squirrel maker (Win) | `@electron-forge/maker-squirrel` | Windows installer compatible with electron-updater |
| DMG maker (macOS) | `@electron-forge/maker-dmg` | macOS disk image |
| ZIP maker | `@electron-forge/maker-zip` | macOS ZIP for auto-updates |
| GitHub publisher | `@electron-forge/publisher-github` | Publish to GitHub Releases |
| Auto-unpack-natives | `@electron-forge/plugin-auto-unpack-natives` | Handle native .node modules (better-sqlite3) |

### Auto-Updates

Keep `electron-updater ^6.x`. Works with GitHub Releases and Forge's publisher-github. Do NOT switch to Forge's built-in updater — it requires a custom update server.

### Offline and Streaming Cache (New in v2)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `session.protocol.handle()` | Electron built-in (25+) | Intercept HLS/MP4 responses, write to disk, serve from disk | First-class Electron API |
| `fs/promises` + `stream/promises` | Node built-in | Async segment writes during streaming | Replace v1's sync fs ops |
| `better-sqlite3` | ^9.x | Persistent cache index and download queue | Tracks URL→local path, expiry, size, download state |
| Custom `animecix-offline://` scheme | Electron built-in | Serve local video files to tau-website with Range support | Vidstack expects HTTP semantics (Range requests, 206 responses) |

**Confidence:** MEDIUM — `protocol.handle()` is verified Electron 25+. HLS segment caching needs implementation validation.

### Multi-threaded Downloads

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Custom implementation (Node built-in fetch) | Node 20 | Replace node-downloader-helper | node-downloader-helper is unmaintained. Existing Downloader2 algorithm is proven — rewrite with async/await and state machine |
| `p-queue` | ^8.x | Download queue with concurrency control | Replaces ad-hoc Map+boolean queue |
| `p-retry` | ^6.x | Per-chunk retry with exponential backoff | Fixes v1 bug where single thread failure kills entire download |

### Ad Blocking

Replace `@cliqz/adblocker-electron` with `@ghostery/adblocker-electron ^2.x`. Cliqz scope taken over by Ghostery — direct drop-in replacement, actively maintained.

**Confidence:** MEDIUM — verify exact package name at npmjs.com.

### Discord Rich Presence

Keep `@xhayper/discord-rpc ^1.x`. Actively maintained, typed, no reason to switch.

### Deep Links

Remove `electron-deeplink`. Use Electron's built-in `app.setAsDefaultProtocolClient()` + `app.on('second-instance')`. Forge makers handle OS-level protocol registration.

### HTTP Client

Remove `axios 0.21.1` and `node-fetch 2.x`. Node 20 ships with stable WHATWG Fetch API. Use native `fetch()` for all HTTP.

### Persistence

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `better-sqlite3` | ^9.x | Download queue, cache index | Synchronous (main process friendly), ACID, embedded |
| `electron-store` | ^10.x | App settings (window size, prefs) | Lightweight key-value JSON wrapper |

### Build and Dev Tooling

| Technology | Version | Purpose |
|------------|---------|---------|
| Vite | ^5.x (via Forge plugin) | Bundler for all Electron processes |
| ESLint | ^9.x | Linting with flat config |
| Prettier | ^3.x | Formatting (not in v1, add it) |
| Vitest | ^1.x | Unit testing, integrates with Vite |

## What to Keep vs Replace from v1

| v1 Dependency | Decision | Reason |
|---------------|----------|--------|
| `electron-updater ^6.x` | **Keep** | GitHub Releases delivery unchanged |
| `@xhayper/discord-rpc` | **Keep** | Maintained, no better alternative |
| `@cliqz/adblocker-electron` | **Replace** → `@ghostery/adblocker-electron` | Cliqz unmaintained |
| `axios 0.21.1` | **Remove** | CVEs; Node 20 native fetch sufficient |
| `node-fetch` | **Remove** | Node 20 built-in |
| `node-downloader-helper` | **Remove** | Unmaintained; rewrite custom downloader |
| `electron-deeplink` | **Remove** | Built-in Electron API sufficient with Forge |
| `electron-builder` | **Remove** | Replaced by Electron Forge |
| `typescript 4.5.4` | **Upgrade** → ^5.4 | 18+ months of missing features |
| `node-html-parser` | **Evaluate** | v2 may not need HTML scraping |
| `streamsaver` | **Remove** | Browser-side library; irrelevant in Electron |

## Installation Sketch

```bash
# Initialize with Forge Vite+TS template
npm init electron-app@latest animecix-desktop-v2 -- --template=vite-typescript

# Runtime dependencies
npm install electron-updater better-sqlite3 electron-store p-queue p-retry @xhayper/discord-rpc @ghostery/adblocker-electron

# Types
npm install -D @types/better-sqlite3

# Additional makers/plugins
npm install -D @electron-forge/maker-dmg @electron-forge/plugin-auto-unpack-natives @electron-forge/publisher-github

# Tooling
npm install -D eslint prettier vitest
```

## Open Questions

1. **@ghostery/adblocker-electron exact package name** — verify at npmjs.com
2. **Electron current version** — verify at electronjs.org/releases
3. **HLS segment cache latency** — needs prototype to measure cold-start latency
4. **tau-website animecix-offline:// scheme** — confirm Vidstack handles custom protocol for video src

---
*Stack research: 2026-04-11*
