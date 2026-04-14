# Project Research Summary

**Project:** AnimeciX Desktop v2
**Domain:** Electron desktop app wrapping external website with offline video and download management
**Researched:** 2026-04-11
**Confidence:** HIGH (architecture, security patterns), MEDIUM (stack versions, streaming cache implementation)

## Executive Summary

AnimeciX Desktop v2 is an Electron shell over animecix.tv that extends the website with capabilities the browser cannot provide: multi-threaded downloads, offline video playback, and opportunistic streaming cache. The recommended approach is to treat v2 as a near-complete rewrite of the application layer — keeping Electron and electron-updater, but replacing the build system (electron-builder to Electron Forge), the HTTP client (axios/node-fetch to Node 20 native fetch), the download library (node-downloader-helper to custom state machine), and the ad blocker package (Cliqz to Ghostery). The app's three-context model (animecix.tv, tau-website player, main process) must be architecturally enforced from day one, not retrofitted.

The single most important v2 headline feature is the streaming cache: intercepting HLS segments as they play and storing them transparently so the user can rewatch offline without a separate download step. This is something neither the browser nor the website can offer, and it is the strongest argument for installing the desktop app. The second headline is completing the download loop with offline playback support and a persistent, resumable download queue backed by SQLite.

The two critical risks inherited from v1 must be resolved in Phase 1 before any feature work: contextIsolation=false (full Node.js API exposure to the external animecix.tv site) and rejectUnauthorized=false (SSL certificate validation disabled globally). Both are security regressions that become exponentially harder to fix after features are built on top of them. The build-system migration from electron-builder to Electron Forge must also be validated with a real packaged build on both platforms before feature development begins, since misconfigured Forge makers fail silently in ways that only surface at distribution time.

## Key Findings

### Recommended Stack

The core runtime stays Electron (upgrade to ^35.x) + TypeScript (upgrade from 4.5.4 to ^5.4) + Node 20 LTS. The significant change is adopting Electron Forge as the build/package/publish system, replacing electron-builder. Forge is now maintained by the Electron team and provides first-class Vite integration with HMR across all three Electron processes. The @electron-forge/plugin-vite handles main, preload, and renderer bundling from a single config.

New v2 runtime additions are better-sqlite3 (persistent download queue and cache index), p-queue + p-retry (concurrency-controlled download queue with per-thread retry), and a custom animecix-offline:// Electron protocol scheme for serving cached video files with HTTP Range semantics. Removed dependencies are axios, node-fetch, node-downloader-helper, electron-deeplink, electron-builder, and streamsaver — all either obsolete given Node 20 built-in fetch, unmaintained, or replaced by Electron built-ins.

**Core technologies:**
- Electron ^35.x + Electron Forge ^7.x: desktop runtime and build system — Forge replaces electron-builder, maintained by Electron team
- TypeScript ^5.4: all application code — significant upgrade from v1's 4.5.4
- better-sqlite3 ^9.x: persistent state (download queue, cache index) — synchronous, ACID, main-process friendly
- p-queue ^8.x + p-retry ^6.x: download concurrency and retry — replaces ad-hoc boolean flag queue
- @ghostery/adblocker-electron ^2.x: ad blocking — maintained replacement for abandoned @cliqz package
- electron-updater ^6.x: auto-updates — keep unchanged, works with Forge's GitHub publisher
- Vite ^5.x via Forge plugin: bundler — HMR across all three Electron processes

### Expected Features

The v2 gap versus v1 is almost entirely in the offline stack and download reliability. Ad blocking and request header injection are table-stakes infrastructure — invisible when working, fatal when broken.

**Must have (table stakes):**
- Video playback (HLS + MP4 via Vidstack in tau-website) — core product function
- Ad blocking — desktop app must be cleaner than browser
- Request header manipulation (Referer/User-Agent injection) — required for video host compatibility
- Auto-updates via GitHub Releases — stale apps break against a live website
- Persistent login session via Electron cookies — re-login on launch causes immediate uninstalls
- Deep link auth (animecix://) — Google OAuth in Electron requires protocol redirect
- Download video to disk (multi-threaded, resumable) — primary install reason
- Download progress UI persisted across restarts — users abandon opaque downloads
- Offline playback of downloaded files — completing the download loop (new in v2)
- HTTPS security (no rejectUnauthorized bypass) — currently broken in v1

**Should have (competitive differentiators):**
- Streaming cache (watch-and-save) — headline v2 differentiator; browser cannot do this
- Offline ASS subtitle support — Turkish fansubs require ASS; SRT is a regression
- Download pause/resume via HTTP Range — missing in v1
- Persistent download queue via SQLite — survives app restart and crash
- Discord Rich Presence with accurate episode metadata — drives installs via word-of-mouth in Turkish anime Discord community
- System tray presence for background downloads — not in v1

**Defer to v2+ milestone:**
- Download storage management UI (disk usage, per-episode delete)
- Global keyboard shortcuts
- Per-video quality selection
- Linux support

### Architecture Approach

The architecture is organized around a ServiceRegistry in the main process that owns the lifecycle of all services. The fundamental constraint is three-context isolation: animecix.tv (remote, lower trust), tau-website/player (local, higher trust), and main process (full Node.js trust). All cross-context communication must route through the main process via typed IPC channels defined in a central IPCRouter. The two preload scripts (preload-site.ts for animecix.tv and preload-player.ts for tau-website) expose narrow contextBridge APIs only — no direct Node.js access in any renderer.

**Major components:**
1. StorageService — single source of truth for all persistent state (SQLite + electron-store); everything else depends on it
2. SessionService — webRequest hooks, ad block filters, header injection rules for all network traffic
3. DownloadService — multi-thread fetcher with explicit state machine (QUEUED/PREPARING/DOWNLOADING/PAUSING/PAUSED/ERROR/CANCELLED/COMPLETED), p-queue concurrency, p-retry per-chunk
4. CacheService — protocol.handle() interception of HLS segments, LRU eviction, disk write via StorageService index
5. PlayerService — episode state machine coordinating website context, player BrowserView, and DiscordService
6. WindowService — BrowserWindow + WebContentsView (Electron 28+) lifecycle with explicit CREATED/READY/DESTROYED states
7. IPCRouter — all ipcMain.handle() registrations centralized; typed channels prevent proliferation
8. DeeplinkService — animecix:// protocol handler combining app.setAsDefaultProtocolClient + second-instance + open-url

### Critical Pitfalls

1. **contextIsolation disabled** — v1 exposes full Node.js to animecix.tv; fix in Phase 1 by enabling contextIsolation on all BrowserWindows and using contextBridge exclusively. Retrofitting after features are built costs 2-3x more.

2. **SSL validation disabled** — rejectUnauthorized=false in downloader.ts is a MITM vulnerability; remove completely in Phase 1 and add a pre-commit lint check that greps for it.

3. **Forge vs electron-builder config mismatch** — entirely different schemas; silent failures in packaged builds; write Forge config from scratch and verify a packaged build on both platforms before any feature work.

4. **Download state machine race conditions** — boolean flags mutated across concurrent async contexts produce corrupt files; model state as an explicit enum with enforced transitions through a single setState() method before implementing threading.

5. **BrowserView/WebContentsView lifetime races** — views destroyed by navigation while code still calls their webContents crash with "Object has been destroyed"; use optional chaining on every webContents call and prefer WebContentsView (Electron 28+) over deprecated BrowserView.

6. **Streaming cache unbounded disk growth** — no eviction policy means disk full; design LRU eviction with configurable size limit (default 10 GB) and fs.statfs() pre-write check before writing the first cache entry.

## Implications for Roadmap

Based on combined research, the architecture file's suggested 8-phase build order is well-reasoned and should be adopted. The key constraint driving order: security and build infrastructure must be solid before any feature work, because fixing contextIsolation or Forge config after the fact is extremely expensive.

### Phase 1: Foundation and Security Baseline
**Rationale:** Security issues (contextIsolation, SSL) and build infrastructure (Forge migration, packaged build verification) are highest-leverage — cheap to fix now, exponentially expensive later. Cannot build features on an insecure or misconfigured shell.
**Delivers:** Electron Forge scaffold with Vite+TypeScript, BootstrapApp + ServiceRegistry skeleton, StorageService, WindowService (BrowserWindow creation), contextIsolation=true enforced, rejectUnauthorized removed, packaged build verified on Windows and macOS.
**Addresses:** HTTPS security fix, single-instance lock, deep link registration (pre-window)
**Avoids:** Pitfalls 1 (contextIsolation), 2 (SSL), 3 (Forge config), 5 (BrowserView lifecycle), 6 (deep link events dropped), 12 (ASAR paths)

### Phase 2: Content Contexts and IPC Infrastructure
**Rationale:** Loading animecix.tv and tau-website with their respective preload scripts is a prerequisite for all feature work. IPC typed contracts must exist before services use them.
**Delivers:** animecix.tv in main window, tau-website bundled and served locally, WebContentsView for player, both preload skeletons, IPCRouter with IPCChannels enum, SessionService (ad block + header injection), DeeplinkService.
**Avoids:** Pitfalls 8 (IPC channel proliferation), 11 (postMessage bridge routing through wrong context), 13 (CORB from renderer header manipulation)

### Phase 3: Player Integration (Online Streaming End-to-End)
**Rationale:** Online streaming is the app's core function. PlayerService and the full website-click-to-video-playing path must work before offline features are layered on top.
**Delivers:** PlayerService episode state machine, preload-site.ts playVideo channel, preload-player.ts load/timeUpdate/ended channels, Discord RPC wired to episode metadata.
**Implements:** PlayerService, DiscordService

### Phase 4: Downloads and Offline Playback
**Rationale:** Downloads are the primary install reason. Completing the download loop (download + offline playback) is the second-highest value-add over the browser.
**Delivers:** DownloadService with explicit state machine (not boolean flags), multi-thread fetch with p-queue + p-retry, HTTP Range resume, persistent queue in SQLite, progress push events, offline playback via PlayerService.playOffline(), system tray.
**Uses:** better-sqlite3, p-queue, p-retry, animecix-offline:// custom protocol
**Avoids:** Pitfall 4 (download state machine races)

### Phase 5: Streaming Cache
**Rationale:** The headline differentiator. Depends on PlayerService (Phase 3), StorageService (Phase 1), and the custom protocol handler proven in Phase 4. Cannot be built until the full online and offline stacks are solid.
**Delivers:** CacheService with protocol.handle() HLS segment interception, transparent watch-and-save, LRU eviction, configurable size limit, disk-space pre-check, SQLite cache manifest.
**Avoids:** Pitfall 9 (unbounded disk growth)

### Phase 6: Auto-Update and Native Integrations
**Rationale:** UpdateService and notifications are important for production but not feature blockers. Ship here when the core product is stable.
**Delivers:** UpdateService (electron-updater + GitHub Releases publish pipeline), centralized NotificationService, macOS code signing and notarization in CI.
**Avoids:** Pitfall 10 (macOS code signing required for auto-updater)

### Phase 7: Hardening and Distribution
**Rationale:** contextBridge audit, structured logging, error boundaries, and verified builds on both platforms before public release.
**Delivers:** Full contextBridge audit, electron-log integration, per-service error boundaries, Windows installer (Squirrel) + macOS DMG/ZIP makers verified, CI distribution pipeline.

### Phase Ordering Rationale

- Security baseline before features: contextIsolation and SSL are architectural choices that cascade through every subsequent phase. A single wrong call from an insecure context undoes the fix.
- StorageService first: every other service writes to storage. Defining schema and API in Phase 1 prevents drift.
- Online streaming before offline: offline playback reuses PlayerService.playOffline(), which cannot be designed until PlayerService exists.
- Downloads before streaming cache: CacheService is a special case of the download and offline playback stack. The protocol handler, chunk storage model, and SQLite index patterns should be proven by the download system first.
- Native integrations late: Discord RPC and auto-updates are not feature blockers; they polish a working product.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Streaming Cache):** protocol.handle() for HLS interception is verified Electron API, but the segment caching implementation (cold-start latency, tau-website Vidstack compatibility with animecix-offline:// scheme) needs a proof-of-concept prototype before roadmapping tasks.
- **Phase 2 (Content Contexts):** WebContentsView vs BrowserView differences need verification against Electron 35.x. tau-website postMessage bridge schema is undefined and requires design coordination before implementation.
- **Phase 6 (Distribution):** macOS code signing and notarization CI setup is notoriously brittle. Plan a dedicated research day before this phase.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Electron Forge + Vite + TypeScript is a well-documented official template. contextIsolation pattern is canonical Electron security guidance.
- **Phase 3 (Player/Discord):** Discord RPC with @xhayper/discord-rpc is a stable, typed library. IPC state machine patterns are standard Electron practice.
- **Phase 4 (Downloads):** HTTP Range download with p-queue + p-retry is a well-established Node.js pattern. SQLite via better-sqlite3 is standard.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core choices (Forge, TypeScript 5.x, better-sqlite3, p-queue) are well-established. Two open questions: exact @ghostery package name and current Electron version need verification before scaffold. |
| Features | MEDIUM-HIGH | Table stakes are clear from v1 analysis. Differentiator set (streaming cache, offline ASS subtitles) is well-reasoned but cache implementation feasibility needs prototype validation. |
| Architecture | HIGH | Three-context isolation, ServiceRegistry pattern, and contextBridge-only IPC are canonical Electron architecture. Component boundaries are internally consistent and match established patterns. |
| Pitfalls | MEDIUM | Security pitfalls (contextIsolation, SSL) are verified v1 regressions. Race condition patterns are well-documented. Streaming cache disk eviction is inferred from general principles — implementation details need validation. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **@ghostery/adblocker-electron exact package name:** verify at npmjs.com before Phase 1 scaffold.
- **Electron 35.x current stable version:** verify at electronjs.org/releases before locking package.json.
- **HLS segment cache cold-start latency:** needs prototype measurement — could affect UX design of the cache feature.
- **Vidstack + animecix-offline:// scheme compatibility:** confirm Vidstack handles custom protocol as video src with Range request semantics before designing Phase 5.
- **tau-website postMessage API schema:** undefined; requires coordination with tau-website owners before Phase 2 player integration.
- **WebContentsView API surface in Electron 35.x:** BrowserView is deprecated in Electron 28+; confirm WebContentsView is stable in target version.

## Sources

### Primary (HIGH confidence)
- Electron official docs (electronjs.org) — protocol.handle(), contextBridge, contextIsolation, app.setAsDefaultProtocolClient, WebContentsView, session.webRequest
- Electron Forge official docs (electronforge.io) — Vite plugin, makers, publisher-github configuration
- electron-updater docs — GitHub Releases delivery, Forge publisher-github compatibility

### Secondary (MEDIUM confidence)
- npmjs.com — better-sqlite3 ^9.x, p-queue ^8.x, p-retry ^6.x, @xhayper/discord-rpc, electron-store ^10.x
- @ghostery/adblocker-electron — described as maintained Cliqz fork; package name needs npm verification
- Electron security best practices (electronjs.org/docs/tutorial/security) — contextIsolation, nodeIntegration guidance

### Tertiary (LOW confidence)
- HLS segment caching via protocol.handle() — pattern is architecturally sound but no direct implementation reference; needs prototype validation
- Streaming cache cold-start performance — inferred, not measured

---
*Research completed: 2026-04-11*
*Ready for roadmap: yes*
