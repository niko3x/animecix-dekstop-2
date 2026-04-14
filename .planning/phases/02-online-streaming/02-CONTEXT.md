# Phase 2: Online Streaming - Context

**Gathered:** 2026-04-12 (updated)
**Status:** Ready for gap planning

<domain>
## Phase Boundary

End-to-end online video playback through a **built-in Vidstack player page** living inside animecix-v2, rendered as an iframe intercepted from animecix.tv. The player supports HLS/MP4 multi-quality/single-MP4 sources, ASS subtitles via JASSUB, skip intro/outro markers, next/prev navigation, color extraction, Turkish UI, and playback speed control. Data flows via postMessage from animecix.tv (same protocol as tau-website). Player is designed with a dual source interface for Phase 3 offline readiness. Also covers video-host header rewriting, EasyList ad/tracker blocking, Google login via animecix:// deep link, and Discord Rich Presence. No downloads, no offline cache, no auto-update, no tray — those are later phases.

</domain>

<decisions>
## Implementation Decisions

### Player architecture (UPDATED — replaces tau-website bundle approach)
- **D-01:** Player is a **built-in React + Vidstack page** living in `animecix-v2/src/player-page/`. NOT a copy of tau-website. Maintained independently inside the animecix-v2 project
- **D-02:** Player page is built via a **secondary Vite config** in animecix-v2, output to `animecix-v2/assets/player/`. Electron Forge packages it. Single repo, single build
- **D-03:** Player renders as an **iframe inside animecix.tv** — same as tau-website today. Served via `tau-player://` protocol handler (from 02-01, needs path update to serve new player)
- **D-04:** animecix.tv iframe intercept redirects to the local player — animecix.tv doesn't know the player changed

### Source support
- **D-05:** Player supports **HLS + MP4 multi-quality + single direct MP4** from day one. Covers tau-video, Sibnet, OK.ru, and any other source animecix.tv resolves
- **D-06:** Player accepts a **dual source interface** for offline readiness: `{type: 'hls'|'mp4'|'local', url: string, qualities?: [...]}`. Online passes remote URLs, Phase 3 offline passes local file:// or custom protocol URLs. Same player, different source

### Data flow
- **D-07:** animecix.tv communicates with the player via **postMessage** — same protocol as tau-website. Video sources, subtitles, skip markers, navigation info all flow through postMessage
- **D-08:** Player handles its own API calls when needed (e.g., fetching video data from tau-video.xyz if opened directly). But primary flow is postMessage from animecix.tv parent
- **D-09:** Main process does NOT mediate video data. Its role is network-layer only: headers, ad blocking, protocol serving

### Player features (full parity with tau-website)
- **D-10:** Skip intro/outro buttons with timestamp-based visibility
- **D-11:** Next/previous episode navigation buttons (data from animecix.tv via postMessage)
- **D-12:** ASS subtitle rendering via JASSUB with language selection
- **D-13:** Turkish UI translations (Vidstack layout)
- **D-14:** Video thumbnail previews on seek bar
- **D-15:** Quality selector for multi-quality MP4 sources
- **D-16:** Playback speed control (0.5x to 4x)
- **D-17:** Canvas-based color extraction (dominant color sent to parent for UI theming)
- **D-18:** Ping/pong validation, currentTime reporting, play/pause/seek/fullscreen control — all postMessage actions from tau-website's useParentMessages

### Subtitle UX (unchanged from prior context)
- **D-19:** Default language: remember per-anime in SQLite (StorageService from Phase 1, subtitle_prefs table from 02-03)
- **D-20:** First episode of new series defaults to Turkish if available
- **D-21:** JASSUB rendering with default fonts, no user-facing font settings in v1

### Offline readiness
- **D-22:** Subtitle caching **deferred to Phase 3**. Online player fetches subtitles from remote URLs. Phase 3 adds local subtitle file resolution
- **D-23:** Player source interface designed from day one to accept both remote and local URLs — no major refactoring needed for Phase 3

### Request header rewriting (AUTH-04) — unchanged, implemented in 02-02
- Scope: video/CDN hosts only
- Static rule list in `src/network/header-rules.ts`
- Electron `session.webRequest.onBeforeSendHeaders`

### Ad & tracker blocking (NET-01) — unchanged, implemented in 02-02
- EasyList + EasyPrivacy bundled as static assets
- `session.webRequest.onBeforeRequest` with parsed matcher
- Request blocking only, no cosmetic filtering in v1

### Google deep-link auth (AUTH-01) — unchanged, implemented in 02-03
- `animecix://` protocol via `app.setAsDefaultProtocolClient`
- Single-instance lock forwards deep links

### Discord Rich Presence (INTG-02) — unchanged, implemented in 02-04
- Update on episode change and play/pause
- Anime title, season/episode, poster, timestamps
- Silent no-op when Discord not running

### Claude's Discretion
- Exact player page build configuration (Vite config details)
- JASSUB worker/wasm asset bundling approach
- HLS.js configuration and error recovery strategy
- Player page CSS and layout implementation details
- postMessage origin validation approach
- Error handling and loading states

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### tau-website player (reference implementation)
- `tau-website/src/components/EmbedPlayer/EmbedPlayer.tsx` — Main player component with Vidstack, JASSUB, skip buttons, navigation
- `tau-website/src/components/EmbedPlayer/SkipButton.tsx` — Skip intro/outro button implementation
- `tau-website/src/components/EmbedPlayer/NavigationButtons.tsx` — Next/prev episode buttons
- `tau-website/src/components/EmbedPlayer/translations.ts` — Turkish UI translations for Vidstack
- `tau-website/src/components/hooks/useVideoData.ts` — Video data fetching from tau-video.xyz API
- `tau-website/src/components/hooks/useParentMessages.ts` — postMessage protocol with animecix.tv parent
- `tau-website/src/components/hooks/useColorExtraction.ts` — Canvas-based dominant color extraction
- `tau-website/src/types/video.ts` — Video and SkipMeta type definitions

### Old desktop app (source handling reference)
- `animecix-desktop/modules/controllers/player-controller.ts` — Multi-source handling (Fembed, Sibnet, OK.ru, Standart)
- `animecix-desktop/modules/controllers/request-controller.ts` — Header rewriting patterns

### animecix.tv website (source of truth for integration)
- `animecix-angular/src/app/site/player/player.component.ts` — Main orchestrator: postMessage listener, Electron IPC, episode navigation
- `animecix-angular/src/app/site/player/player.service.ts` — Video cuing, iframe URL management, tau-video URL building
- `animecix-angular/src/app/site/player/player.component.html` — Iframe template with `#plyrFrame`
- `animecix-angular/src/app/models/video.ts` — Video data model (url, type, captions)

### Phase 2 existing implementations
- `animecix-v2/src/player/tau-protocol.ts` — Protocol handler (needs path update for new player)
- `animecix-v2/src/network/` — Ad blocker, header rewriter, request handler (complete)
- `animecix-v2/src/auth/deep-link.ts` — Deep link authentication (complete)
- `animecix-v2/src/integrations/discord-rpc.ts` — Discord RPC (complete)
- `animecix-v2/src/storage/StorageService.ts` — Subtitle preferences (complete)

</canonical_refs>

<postmessage_protocol>
## Complete postMessage Protocol (from animecix-angular)

### Iframe → Website (player sends to animecix.tv)
| Action | Data | Purpose |
|--------|------|---------|
| captionsChanged | `{track: number}` | User changed subtitle track |
| currentTime | `{time, duration, isPlaying}` | Periodic time reporting (5s interval) |
| currentTimeQuick | `{time, duration}` | Fast time reporting (1s interval) |
| getCurrentTime | *(request)* | Ask website for user's last watch position |
| requestCaptions | *(request)* | Ask website for caption list |
| ping | *(request)* | Keepalive, expects pong |
| ended | *(signal)* | Episode finished playing |
| next | *(signal)* | User clicked next button |
| prev | *(signal)* | User clicked prev button |
| canPlay | `{first: boolean}` | Player ready, video can play |
| currentTarget | `{target: string}` | Actual iframe URL after redirects |
| play | *(signal)* | Playback started |
| pause | *(signal)* | Playback paused |
| dominantColor | `{data: number[][]}` | Extracted dominant color for background |

### Website → Iframe (animecix.tv sends to player)
| Action | Data | Purpose |
|--------|------|---------|
| changeVideo | `{url: string}` | Seamless tau→tau episode transition |
| seek | `{time: number}` | Seek to timestamp (from watch history or shared room) |
| play | *(no data)* | Resume playback |
| pause | *(no data)* | Pause playback |
| toggle | *(no data)* | Toggle play/pause (spacebar) |
| changeSub | `{index: number}` | Change subtitle track |
| title | `{title: string}` | Set video title |
| navigationInfo | `{hasNext, hasPrev}` | Enable/disable next/prev buttons |
| captions | `{captions: VideoCaption[]}` | Caption list response |
| pong | *(no data)* | Keepalive response |
| fullscreenExit | *(no data)* | Exit fullscreen before transition |
| fullscreenToggle | *(no data)* | Toggle fullscreen |
| fullscreenEnter | *(no data)* | Enter fullscreen |
| skipForward | `{seconds: number}` | Skip forward N seconds |
| skipBackward | `{seconds: number}` | Skip backward N seconds |
| mute | *(no data)* | Toggle mute |
| volumeUp | `{step: number}` | Increase volume |
| volumeDown | `{step: number}` | Decrease volume |

### Electron-specific IPC (website detects via `fromApp` + `electron` globals)
| Channel | Direction | Data | Purpose |
|---------|-----------|------|---------|
| captions | site→main | VideoCaption[] | Send caption list on video change |
| updateCurrent | site→main | url, identifier | Track current video URL |
| canDownload | main→site | boolean | Enable download button |
| nextEpisode | main→site | *(signal)* | Auto-next episode trigger |
| playerError | main→site | *(signal)* | Fallback to next video |

### Target origin logic
- Electron app: `'https://m.animecix.com'`
- Web: `player.currentTarget` or `iframe.src`

</postmessage_protocol>

<code_context>
## Existing Code Insights

### Reusable Assets (already built in Phase 2)
- `src/network/request-handler.ts` — Combined iframe intercept + ad blocking (02-02)
- `src/network/header-rewriter.ts` — CDN header rewriting (02-02)
- `src/network/ad-blocker.ts` — EasyList/EasyPrivacy ad blocker (02-02)
- `src/auth/deep-link.ts` — Google deep-link auth (02-03)
- `src/storage/StorageService.ts` — SQLite with subtitle_prefs table (02-03)
- `src/integrations/discord-rpc.ts` — Discord Rich Presence (02-04)
- `src/player/tau-protocol.ts` — Protocol handler (02-01, needs update)

### Established Patterns (from Phase 1)
- Feature-based module layout: `src/window/`, `src/player/`, `src/network/`, `src/auth/`, `src/integrations/`
- Typed IPC bridge on `window.animecix` via contextBridge
- camelCase IPC event names
- SQLite via better-sqlite3 StorageService

### Integration Points
- tau-player:// protocol serves the built-in player page from `assets/player/`
- Iframe intercept in request-handler.ts redirects tau-video.xyz/embed/ to tau-player://
- Player communicates with animecix.tv via postMessage (same protocol as tau-website)
- Main process observes postMessage-forwarded metadata for Discord RPC

</code_context>

<specifics>
## Specific Ideas

- Player is a self-contained React+Vidstack app inside animecix-v2 — reference tau-website code but don't copy it
- Full feature parity with tau-website: skip buttons, nav buttons, subtitles, color extraction, thumbnails, speed control, Turkish UI
- postMessage is the contract — player speaks the same language as tau-website so animecix.tv works unchanged
- Generic source support (HLS, MP4 multi-quality, single MP4) — not tied to tau-video.xyz only
- Dual source interface from day one: `{type, url, qualities}` so Phase 3 offline just passes different URLs
- Subtitle caching deferred to Phase 3 — clean separation

</specifics>

<deferred>
## Deferred Ideas

- User-configurable JASSUB fonts / subtitle rendering settings — defer to post-v1
- Cosmetic ad filtering (DOM node hiding) — request blocking only for v1
- Remote-updated header/filter rules — static bundled for v1
- Cache status surfacing in Discord RPC — Phase 3
- Subtitle per-device sync — out of scope; local-only
- Local subtitle caching for offline — Phase 3
- Main-process mediated video data fetching — unnecessary complexity for v1

</deferred>

---

*Phase: 02-online-streaming*
*Context gathered: 2026-04-12 (updated with built-in player architecture)*
