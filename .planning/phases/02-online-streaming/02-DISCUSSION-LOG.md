# Phase 2: Online Streaming - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 02-online-streaming
**Areas discussed:** Player tech stack, Data flow & API, Offline readiness, Player features scope
**Trigger:** User rejected tau-website bundle approach during E2E verification checkpoint. Wants built-in player maintained inside animecix-v2.

---

## Player Tech Stack

### Rendering approach

| Option | Description | Selected |
|--------|-------------|----------|
| Iframe in animecix.tv | Player is a local HTML page served via tau-player:// protocol, loaded inside iframe. Reuses existing intercept. | ✓ |
| Separate BrowserWindow | Player opens in own native window. More isolation but breaks embedded feel. | |
| WebContentsView overlay | Player as native view overlaid on animecix.tv. Complex but full positioning control. | |

**User's choice:** Iframe in animecix.tv
**Notes:** Reuses existing iframe intercept architecture from 02-01.

### UI framework

| Option | Description | Selected |
|--------|-------------|----------|
| React + Vidstack | Same stack as tau-website. Can reference tau-website code. Needs Vite build. | ✓ |
| Vanilla JS + Vidstack | No React overhead. Lighter bundle. | |
| Vanilla JS + custom player | Build from scratch with HLS.js. Maximum control, most work. | |

**User's choice:** React + Vidstack
**Notes:** Mirrors tau-website for easier reference.

### Build approach

| Option | Description | Selected |
|--------|-------------|----------|
| Vite sub-build in animecix-v2 | Player source in src/player-page/. Secondary Vite config builds to assets/player/. Single repo. | ✓ |
| Separate package in monorepo | Player as own npm workspace. More isolation, more complexity. | |

**User's choice:** Vite sub-build in animecix-v2

---

## Data Flow & API

### Video data source

| Option | Description | Selected |
|--------|-------------|----------|
| postMessage from animecix.tv | Same protocol as tau-website. Player doesn't care where data comes from. | ✓ |
| Main process mediates | Main process intercepts, resolves sources, passes to player via IPC. | |

**User's choice:** postMessage from animecix.tv
**Notes:** User clarified: "We don't have only tau-video. This player must support generic sources, single source, ASS and all other tau-website player supports." The player must be source-agnostic.

### Source types

| Option | Description | Selected |
|--------|-------------|----------|
| HLS + MP4 multi-quality + single MP4 | Covers tau-video + Sibnet + OK.ru sources. | ✓ |
| HLS + MP4 only (tau-video focused) | Only tau-video.xyz sources. Others deferred. | |

**User's choice:** HLS + MP4 multi-quality + single MP4

### Communication protocol

| Option | Description | Selected |
|--------|-------------|----------|
| Keep postMessage | Same as tau-website. animecix.tv works unchanged. | ✓ |
| IPC through main process | More Electron-native but requires animecix.tv changes. | |

**User's choice:** Keep postMessage

---

## Offline Readiness

### Source interface design

| Option | Description | Selected |
|--------|-------------|----------|
| Dual source interface | Generic source object: {type, url, qualities}. Online=remote URLs, offline=local URLs. | ✓ |
| Separate offline mode | Explicit 'offline' flag switching logic. Two code paths. | |

**User's choice:** Dual source interface

### Subtitle caching

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to Phase 3 | Online fetches remotely. Phase 3 adds local resolution. | ✓ |
| Design cache now | Build local subtitle storage now for smoother Phase 3. | |

**User's choice:** Defer to Phase 3

---

## Player Features Scope

### Feature set

| Option | Description | Selected |
|--------|-------------|----------|
| Full parity | Everything tau-website has: skip, nav, ASS, Turkish, thumbnails, quality, speed, color extraction. | ✓ |
| Core only | Playback, quality, subtitles, skip. Drop nav, color, thumbnails. | |
| Core + navigation | Everything except color extraction and thumbnails. | |

**User's choice:** Full parity

### Color extraction

| Option | Description | Selected |
|--------|-------------|----------|
| Include it | Port canvas-based color extraction. Used for UI theming. | ✓ |
| Skip for now | Defer as visual polish. | |

**User's choice:** Include it

---

## Claude's Discretion

- Vite config details for player page build
- JASSUB worker/wasm bundling approach
- HLS.js error recovery strategy
- Player page CSS/layout implementation
- postMessage origin validation
- Error handling and loading states

## Deferred Ideas

- User-configurable subtitle fonts — post-v1
- Cosmetic ad filtering — v1 is request blocking only
- Remote-updated filter rules — static for v1
- Local subtitle caching — Phase 3
- Main-process mediated video data — unnecessary for v1
