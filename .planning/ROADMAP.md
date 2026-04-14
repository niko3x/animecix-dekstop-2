# Roadmap: AnimeciX Desktop v2

**Created:** 2026-04-11
**Granularity:** Coarse
**Total phases:** 4
**Requirement coverage:** 26/26 ✓

## Phases

- [x] **Phase 1: Foundation** — Secure Electron Forge scaffold with app shell, storage, and IPC infrastructure (completed 2026-04-11)
- [ ] **Phase 2: Online Streaming** — End-to-end video playback, ad blocking, auth, and Discord integration
- [ ] **Phase 3: Downloads and Offline** — Multi-threaded downloads, streaming cache, offline playback, and tray
- [ ] **Phase 4: Ship** — Auto-updates, CI distribution pipeline, cross-platform build verification

## Phase Details

### Phase 1: Foundation

**Goal**: A secure, installable Electron shell that loads animecix.tv with single-instance enforcement, persistent sessions, and a typed IPC bridge — ready for feature development with no security regressions.

**Depends on**: Nothing

**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, AUTH-02, AUTH-03, NET-02

**Success Criteria** (what must be TRUE):
1. App launches to animecix.tv in a native frameless window with working window controls
2. Launching a second instance focuses the existing window instead of opening a new one
3. User stays logged in across app restarts and updates without re-authenticating
4. All renderer contexts use contextIsolation=true with contextBridge-only IPC — no raw Node.js access from any renderer
5. HTTPS certificate validation is fully enforced — no rejectUnauthorized bypass anywhere in the codebase

**Plans:** 2/2 plans complete

Plans:
- [x] 01-01-PLAN.md — Scaffold Electron Forge project, types, and StorageService
- [x] 01-02-PLAN.md — Main process, WindowService, IPC, and preload bridge

---

### Phase 2: Online Streaming

**Goal**: Users can watch anime through a built-in Vidstack player page (maintained inside animecix-v2) with full quality, subtitle, and skip-marker support — alongside ad blocking, Google login, and Discord Rich Presence.

**Depends on**: Phase 1

**Requirements**: PLAY-01, PLAY-02, PLAY-03, PLAY-04, AUTH-01, AUTH-04, NET-01, INTG-02

**Success Criteria** (what must be TRUE):
1. Clicking a video on animecix.tv opens the built-in Vidstack player in an iframe and streams the episode end-to-end
2. Player handles HLS streams, MP4 multi-quality, and single direct MP4 sources without fallback to any external player
3. ASS subtitles render correctly via JASSUB with language selection available
4. Skip intro and skip outro buttons appear at the correct timestamps
5. User can log in via Google using the animecix:// deep link without a browser popup regression
6. Ads and trackers are blocked across the session; Discord shows the current anime title and episode

**Plans:** 7 plans (4 complete + 2 gap closure)

Plans:
- [x] 02-01-PLAN.md — tau-player:// protocol handler, type declarations, and Wave 0 test scaffolds
- [x] 02-02-PLAN.md — Network layer: combined request handler (iframe intercept + ad blocker + header rewriter)
- [x] 02-03-PLAN.md — Deep link auth and per-anime subtitle preference storage
- [x] 02-04-PLAN.md — Discord Rich Presence integration
- [x] 02-06-PLAN.md — Built-in Vidstack player page (React app with full feature parity)
- [x] 02-07-PLAN.md — Protocol path update, main.ts wiring, preload IPC extensions

---

### Phase 3: Downloads and Offline

**Goal**: Users can download episodes for offline watching, resume interrupted downloads, and rewatch any streamed episode without downloading again — with full subtitle support offline.

**Depends on**: Phase 2

**Requirements**: DL-01, DL-02, DL-03, DL-04, DL-05, DL-06, DL-07, PLAY-05, INTG-03, INTG-04

**Success Criteria** (what must be TRUE):
1. User can start a download and see live multi-threaded progress; queue survives app restart and crash
2. User can pause a download and resume it later without re-downloading completed chunks
3. A previously watched episode is available for offline playback in the tau-website player without a separate download step
4. Offline playback includes ASS subtitles — no subtitle regression compared to online streaming
5. Desktop notification fires when a download completes; app minimizes to tray and continues downloading in the background
6. User can view total download storage usage and delete individual downloaded episodes from within the app

**Plans:** 4 plans

Plans:
- [x] 03-01-PLAN.md — Download types, SQLite schema, StorageService extensions, Downloader, and DownloadQueue
- [x] 03-02-PLAN.md — animecix-offline:// protocol handler with path traversal protection
- [x] 03-03-PLAN.md — Streaming cache (CacheEvictor, StreamCache, HlsMuxer)
- [x] 03-04-PLAN.md — IPC wiring, TrayManager, notifications, main.ts integration

---

### Phase 4: Ship

**Goal**: The app auto-updates itself from GitHub Releases and produces verified, signed installer packages for both Windows and macOS ready for public distribution.

**Depends on**: Phase 3

**Requirements**: INTG-01

**Success Criteria** (what must be TRUE):
1. When a new version is published to GitHub Releases, the running app detects the update, downloads it in the background, and prompts the user to restart
2. Windows installer (Squirrel) and macOS DMG/ZIP packages are produced by CI and verified installable on clean machines of both platforms

**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete   | 2026-04-11 |
| 2. Online Streaming | 4/7 | Gap closure planned | — |
| 3. Downloads and Offline | 0/4 | Planned | — |
| 4. Ship | 0/? | Not started | — |

---
*Roadmap created: 2026-04-11*
*Last updated: 2026-04-13 after Phase 3 planning*
