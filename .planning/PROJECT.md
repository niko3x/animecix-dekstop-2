# AnimeciX Desktop (v2)

## What This Is

A rebuilt desktop companion app for animecix.tv — an anime streaming platform with Turkish audience. The app wraps the animecix.tv website in Electron, adding native capabilities: multi-threaded video downloads, offline playback with ASS subtitle support, streaming cache, Discord Rich Presence, Google login via deep links, ad blocking, and automatic updates. The video player is tau-website (React + Vidstack) running locally inside Electron for both online streaming and offline playback.

## Core Value

Users can watch anime seamlessly — online or offline — with full subtitle support, download management, and native desktop integration that the website alone can't provide.

## Requirements

### Validated

- [x] Load animecix.tv as main app shell with native window chrome — Validated in Phase 1: Foundation
- [x] Preload bridge for website-to-Electron communication — Validated in Phase 1: Foundation
- [x] Single instance lock — Validated in Phase 1: Foundation
- [x] Tau-website (Vidstack player) runs locally as the sole video player — Validated in Phase 2: Online Streaming (built-in player page)
- [x] Discord Rich Presence showing current anime/episode — Validated in Phase 2: Online Streaming
- [x] Google login via deep link protocol (animecix://) — Validated in Phase 2: Online Streaming
- [x] Ad and tracker blocking — Validated in Phase 2: Online Streaming
- [x] Request header manipulation (referer, user-agent spoofing for video hosts) — Validated in Phase 2: Online Streaming
- [x] Offline ASS subtitle support via JASSUB — Validated in Phase 2: Online Streaming (JASSUB integrated in built-in player)

### Active

- [ ] Multi-threaded video download with progress tracking and queue management
- [ ] Offline video playback from downloaded files using tau-website player
- [ ] Streaming cache — videos cache as user watches, available offline later
- [ ] Automatic app updates via electron-updater
- [ ] Cross-platform builds (Windows + macOS)

### Out of Scope

- Linux support — defer to later milestone
- Fully local UI / custom frontend — app loads animecix.tv website
- Real-time chat or social features — not part of desktop app
- Video transcoding or re-encoding — play files as-is

## Context

- **Existing codebase:** Current app (animecix-desktop) is a working Electron app with all core features but uses older architecture (electron-builder, ad-hoc controllers, TypeScript 4.5, no Electron Forge). Codebase map in `.planning/codebase/`.
- **Tau-website:** React 18 + Vite + Vidstack player with HLS/MP4 support, ASS subtitles (JASSUB), skip intro/outro markers, Turkish translations, postMessage communication with parent frame. Currently has Electron IPC detection that redirects to a native player — in v2, tau-website IS the player directly.
- **API backend:** tau-video.xyz serves video metadata, streams, subtitle files, and preview thumbnails.
- **Target audience:** Turkish anime fans using the animecix.tv platform.
- **Old app pain points:** No offline playback, no streaming cache, architecture makes features hard to add, no test coverage.

## Constraints

- **Framework**: Electron Forge (not electron-builder) — modern tooling, better DX
- **Player**: Tau-website with Vidstack — single player for all scenarios (online, offline, cached)
- **Platforms**: Windows (x64) and macOS for v1
- **Website**: Must maintain compatibility with animecix.tv as it evolves
- **Authentication**: Google login flows via animecix:// deep link protocol

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Electron Forge over electron-builder | Better plugin ecosystem, maintained by Electron team, modern build pipeline | — Pending |
| Tau-website as sole player | Eliminates dual-player complexity, consistent experience online/offline | — Pending |
| Load website (not build local UI) | Faster to ship, stays in sync with website changes, reduces maintenance | — Pending |
| Streaming cache + download for offline | Covers both intentional (download) and opportunistic (cache) offline use cases | — Pending |

---
*Last updated: 2026-04-11 after initialization*
