# Phase 2: Online Streaming - Research

**Researched:** 2026-04-12
**Domain:** Electron iframe interception, video playback, ad blocking, deep link auth, Discord RPC
**Confidence:** HIGH

## Summary

Phase 2 wires online video playback end-to-end: the app intercepts animecix.tv's tau iframe request and serves a locally-bundled tau-website (Vidstack + JASSUB) via a custom `tau-player://` protocol, while Electron's session.webRequest handles header rewriting and ad/tracker blocking at the network layer. Google login uses the existing `animecix://` deep link protocol with the Phase 1 single-instance lock, and Discord Rich Presence observes postMessage traffic between animecix.tv and the tau iframe.

The tau-website React source has been fully read. Its postMessage protocol is stable and well-defined (17 message types enumerated below). The `useElectronIPC` hook that redirected to the old native player checks for `nodeRequire` -- since v2 uses contextIsolation with no nodeIntegration, `nodeRequire` is always undefined and the hook returns `{hasIpc: false}`, meaning the Vidstack player renders normally. No code change to tau-website is needed.

**Primary recommendation:** Use `protocol.registerSchemesAsPrivileged` + `protocol.handle` with a `tau-player://` scheme (standard, secure, supportFetchAPI, stream, bypassCSP) to serve bundled tau-website assets. Intercept iframe navigation to `tau-video.xyz/embed/` URLs via `session.webRequest.onBeforeRequest` and redirect to `tau-player://bundle/index.html`. This avoids file:// CSP issues and enables proper relative URL resolution for JASSUB WASM workers.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Tau-website runs as an **iframe inside animecix.tv**, matching the website's existing tau iframe architecture -- no separate BrowserWindow, no BrowserView, no main-webContents navigation
- Tau-website is **bundled into animecix-v2** and loaded via `file://` (or an `app://` custom protocol if it simplifies CSP) -- zero runtime network dependency for the player itself
- Desktop app **intercepts the tau iframe request via a protocol handler / `session.webRequest` rule** and serves the bundled local copy -- animecix.tv does not need to know it's running in desktop mode for the player swap
- Fullscreen handoff goes through Phase 1's existing `onFullscreen` IPC channel; iframe fullscreen bubbles to Electron via standard `webContents` fullscreen events
- **Keep the existing postMessage protocol** between animecix.tv and tau-website exactly as-is -- video source URLs, HLS/MP4 quality list, subtitle tracks, and skip intro/outro markers all flow through the same postMessage channel the web version uses
- Electron does not proxy, transform, or log the payload -- its only job is network-layer manipulation (headers, ad blocking) and serving the bundled tau assets
- **Zero protocol divergence** between web and desktop tau-website -- tau-website code is unchanged
- Desktop-only capabilities that arrive in later phases (cache status, download integration) will use IPC, not postMessage
- **Default language: remember per-anime in SQLite** -- StorageService adds a `subtitle_prefs` table keyed by anime/series ID
- First episode of a new series defaults to Turkish if available, else the first track
- JASSUB rendering uses **tau-website's defaults verbatim** -- fonts that ship with tau-website, no Electron-side font overrides
- Language selection UI is tau-website's existing subtitle menu -- no Electron overlay
- **Scope: video/CDN hosts only** -- match known CDN patterns (HLS `.m3u8`, video segments, subtitle files). Do NOT rewrite on animecix.tv or tau-video.xyz API traffic
- **Rule source: static list in code** -- a typed config file (e.g., `src/network/header-rules.ts`)
- Implementation uses Electron `session.webRequest.onBeforeSendHeaders` (not declarativeNetRequest)
- **Filter lists: EasyList + EasyPrivacy**, bundled into animecix-v2 as static assets -- updated only via app releases
- **Enforcement: `session.webRequest.onBeforeRequest`** with a parsed-matcher built at startup -- no third-party Electron adblocker library, no runtime fetch
- Applies to the main animecix.tv webContents session -- single session, single matcher
- No cosmetic filtering (hiding DOM nodes) in v1 -- request blocking only
- Register `animecix://` via `app.setAsDefaultProtocolClient('animecix')` on both Windows and macOS
- **Callback flow: protocol handler injects the callback into main webContents**
- **Cold start + duplicate launches: handled by Phase 1's single-instance lock**
- No custom session cookie injection -- let animecix.tv's own auth flow complete the handshake
- **Update triggers: on episode change and on play/pause state change** -- Discord RPC
- **Fields: full Vidstack-synced** -- details = anime title, state = "SxxEyy -- Episode name", start timestamp = episode start time, large image = anime poster URL, small image = app logo
- **Graceful fallback: silent no-op when Discord is not running**

### Claude's Discretion
- Exact custom protocol name / scheme vs pure file:// for bundled tau assets (CSP will decide)
- Tau-website build integration -- git submodule, copy-on-build, npm workspace, or pre-built artifact
- Discord RPC client library choice (`discord-rpc` vs `@xhayper/discord-rpc`)
- EasyList parsing: hand-rolled matcher vs a small parser library -- no full adblocker frameworks
- Header rule data shape and matcher implementation
- Error handling, logging, and telemetry structure
- Test boundaries for network interception (mock session vs integration)

### Deferred Ideas (OUT OF SCOPE)
- User-configurable JASSUB fonts / subtitle rendering settings -- defer to post-v1
- Cosmetic ad filtering (DOM node hiding) -- request blocking only for v1
- Remote-updated header/filter rules -- static bundled for v1
- Cache status surfacing in Discord RPC -- ties to Phase 3 streaming cache
- Subtitle per-device sync -- out of scope; local-only
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAY-01 | User can watch videos via tau-website (Vidstack) player running locally inside Electron | Custom protocol + iframe interception architecture; tau-website bundling strategy |
| PLAY-02 | Player supports HLS streaming and MP4 multi-quality sources | tau-website already handles HLS (hls.js) and MP4 multi-quality; header rewriting ensures CDN compatibility |
| PLAY-03 | Player renders ASS subtitles via JASSUB with language selection | JASSUB assets bundled in tau-website/public/jassub/; LibASSTextRenderer wired in EmbedPlayer; subtitle_prefs SQLite table for per-anime memory |
| PLAY-04 | Player shows skip intro/outro buttons based on tau-video API markers | SkipButton component already reads SkipMeta from useVideoData; no Electron-side work needed beyond network access |
| AUTH-01 | User can log in via Google using animecix:// deep link protocol | Deep link controller with macOS open-url + Windows second-instance/argv; old app reference in deeplink-controller.ts |
| AUTH-04 | App manipulates request headers (referer, user-agent) for video host compatibility | Header rewriting rules extracted from old request-controller.ts; session.webRequest.onBeforeSendHeaders |
| NET-01 | App blocks ads and trackers with maintained filter lists | EasyList + EasyPrivacy bundled; abp-filter-parser for parsing; session.webRequest.onBeforeRequest blocking |
| INTG-02 | Discord Rich Presence shows current anime title and episode | @xhayper/discord-rpc 1.3.3; observe postMessage currentTime/play/pause from tau iframe |
</phase_requirements>

## Standard Stack

### Core (new dependencies for Phase 2)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @xhayper/discord-rpc | 1.3.3 | Discord Rich Presence client | Active fork of discordjs/RPC, native TS types, published 2026-03-26, IPC transport for desktop apps [VERIFIED: npm registry] |
| abp-filter-parser | 0.2.0 | EasyList/EasyPrivacy ABP filter rule parsing | Lightweight ABP network rule parser, no Electron framework dependency, matches decision to avoid full adblocker libraries [VERIFIED: npm registry] |

### Existing (from Phase 1)

| Library | Version | Purpose |
|---------|---------|---------|
| electron | 41.2.0 | App shell, protocol.handle, session.webRequest |
| better-sqlite3 | ^12.8.0 | StorageService, subtitle_prefs table |
| electron-squirrel-startup | ^1.0.1 | Windows installer handling |

### Tau-website (bundled, NOT npm-installed)

| Library | Version | Purpose |
|---------|---------|---------|
| @vidstack/react | ^1.12.13 | Video player component (HLS + MP4 multi-quality) |
| hls.js | ^1.5.19 | HLS adaptive streaming |
| jassub | ^1.7.17 | ASS subtitle rendering (WASM worker) |
| react | ^18.3.1 | UI framework |
| react-dom | ^18.3.1 | DOM rendering |
| react-router-dom | ^6.28.0 | Client-side routing (/embed/:id) |
| colorthief | ^2.4.0 | Dominant color extraction |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @xhayper/discord-rpc | discord-rpc 4.0.1 | discord-rpc is abandoned (last publish 2021-06-14), no TS types, unmaintained [VERIFIED: npm registry] |
| abp-filter-parser | Hand-rolled matcher | abp-filter-parser handles wildcard, separator, domain options -- hand-rolling risks incorrect filter semantics |
| abp-filter-parser | @ghostery/adblocker-electron | Locked decision: no third-party Electron adblocker framework |
| tau-player:// protocol | file:// URLs | file:// breaks relative URL resolution in iframes, triggers CSP violations, JASSUB WASM worker fails to load [CITED: Electron protocol docs] |

**Installation:**
```bash
cd animecix-v2
npm install @xhayper/discord-rpc@^1.3.3 abp-filter-parser@^0.2.0
```

Note: `abp-filter-parser` has no TS types -- a `.d.ts` declaration file is needed.

## Architecture Patterns

### Recommended Project Structure
```
animecix-v2/src/
  main.ts                   # App entry -- add protocol registration, deep link wiring
  preload.ts                # Add deep-link callback channel
  types/
    animecix-api.d.ts       # Extend with deepLink callback
    abp-filter-parser.d.ts  # Type declarations for abp-filter-parser
  storage/
    StorageService.ts       # Add subtitle_prefs methods
    schema.ts               # Add subtitle_prefs table
  window/
    WindowService.ts        # Existing -- no changes needed
    window.ipc.ts           # Existing
  player/
    tau-protocol.ts         # Custom protocol handler (tau-player://)
    iframe-intercept.ts     # session.webRequest rule to redirect tau iframe
  network/
    header-rules.ts         # Static host->header map
    header-rewriter.ts      # session.webRequest.onBeforeSendHeaders logic
    ad-blocker.ts           # EasyList/EasyPrivacy parser + matcher
    filter-lists/           # Bundled .txt files
      easylist.txt
      easyprivacy.txt
  auth/
    deep-link.ts            # animecix:// protocol + callback handling
  integrations/
    discord-rpc.ts          # DiscordService class
assets/
  tau-website/              # Pre-built tau-website dist output
    index.html
    assets/                 # Vite-hashed JS/CSS bundles
    jassub/
      jassub-worker.js
      jassub-worker.wasm
      default.woff2
    favicon.ico
```

### Pattern 1: Custom Protocol for Bundled Assets
**What:** Register `tau-player://` as a privileged scheme before app.ready, then use `protocol.handle` to serve files from the bundled `assets/tau-website/` directory.
**When to use:** Always -- this is the mechanism for serving the local tau-website in the iframe.
**Example:**
```typescript
// In main.ts (BEFORE app.whenReady)
import { protocol } from 'electron';

protocol.registerSchemesAsPrivileged([{
  scheme: 'tau-player',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    stream: true,
    bypassCSP: true,
  },
}]);

// In tau-protocol.ts (AFTER app.whenReady)
import { protocol, net } from 'electron';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export function registerTauProtocol(): void {
  const basePath = path.join(__dirname, '..', 'assets', 'tau-website');

  protocol.handle('tau-player', (request) => {
    const { pathname } = new URL(request.url);
    // Resolve to local file
    const filePath = path.join(basePath, pathname === '/' ? '/index.html' : pathname);
    return net.fetch(pathToFileURL(filePath).toString());
  });
}
```
[CITED: https://www.electronjs.org/docs/latest/api/protocol]

### Pattern 2: Iframe Request Interception
**What:** Use `session.webRequest.onBeforeRequest` to intercept tau-video.xyz embed URLs and redirect to the local protocol.
**When to use:** Every time animecix.tv loads a video -- the site creates an iframe pointing to `https://tau-video.xyz/embed/{id}` or `https://tau-video.xyz/embed-2/{id}`.
**Example:**
```typescript
// In iframe-intercept.ts
import { session } from 'electron';

export function setupIframeIntercept(): void {
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['https://tau-video.xyz/embed/*', 'https://tau-video.xyz/embed-2/*'] },
    (details, callback) => {
      // Extract path after /embed/ or /embed-2/
      const url = new URL(details.url);
      // Redirect to local protocol preserving path + query
      const localUrl = `tau-player://bundle${url.pathname}${url.search}`;
      callback({ redirectURL: localUrl });
    }
  );
}
```
**CSP note:** `bypassCSP: true` on the scheme ensures the iframe can load in the animecix.tv page even though animecix.tv's CSP doesn't whitelist `tau-player://`. The `redirectURL` mechanism in `onBeforeRequest` works for redirecting to custom protocols registered as privileged. [CITED: https://github.com/electron/electron/issues/32253]

### Pattern 3: PostMessage Observation (Not Interception)
**What:** Main process listens to webContents messages to observe episode metadata for Discord RPC, without modifying or proxying the postMessage channel.
**When to use:** Discord RPC data extraction.
**Example:**
```typescript
// Main process observes via webContents
mainWindow.webContents.on('console-message', ...); // Not reliable

// Better approach: inject a tiny observer via executeJavaScript or preload
// that forwards relevant postMessage data to main process via IPC
// Specifically: listen for 'currentTime' messages from the tau iframe
// which contain {action: 'currentTime', time, duration, isPlaying}
```

### Pattern 4: postMessage Origin Handling
**What:** tau-website posts messages restricted to `https://animecix.tv/` origin. When the iframe is loaded from `tau-player://bundle/...`, `window.parent.postMessage(data, 'https://animecix.tv/')` will succeed because the parent frame IS animecix.tv (loaded over HTTPS). The iframe content origin is `tau-player://bundle` but the targetOrigin check is on the receiver side (animecix.tv), which will match.
**Key insight:** The parent is still `https://animecix.tv` -- only the iframe content is local. postMessage from child to parent works because the target origin `https://animecix.tv/` matches the parent's actual origin. Messages FROM parent TO iframe will also work because Chromium does not restrict postMessage to same-origin; animecix.tv can post to any iframe it owns.

### Anti-Patterns to Avoid
- **Anti-pattern: Modifying tau-website source code.** The locked decision says zero protocol divergence. Do not fork or patch tau-website.
- **Anti-pattern: Using `nodeRequire` in tau-website.** The old `useElectronIPC` hook relied on `nodeRequire` which is unavailable with contextIsolation. This is correct -- the hook returns `hasIpc: false` and the Vidstack player renders. Do not re-enable nodeIntegration.
- **Anti-pattern: Proxying postMessage through main process.** The locked decision says Electron observes only. Never intercept or transform postMessage payloads.
- **Anti-pattern: Using `file://` for iframe content.** `file://` URLs in iframes have severe CSP restrictions, break relative URL resolution, and JASSUB WASM workers fail to load.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ABP filter syntax parsing | Custom regex matcher for EasyList rules | `abp-filter-parser` | Filter syntax has wildcards, separator tokens, domain options, exception rules, third-party flags -- edge cases abound |
| Discord RPC IPC transport | Raw IPC socket communication | `@xhayper/discord-rpc` | Discord protocol changes break raw implementations; library handles reconnection, transport selection |
| HLS streaming | Custom m3u8 parser | `hls.js` (bundled in tau-website) | Already wired into Vidstack; no Electron-side HLS work needed |
| ASS subtitle rendering | Custom renderer | `jassub` (bundled in tau-website) | WASM-based, complex typesetting spec; tau-website already configures it correctly |
| URL pattern matching for webRequest | Regex-based URL matching | Electron's built-in URL filter patterns | `session.webRequest` accepts glob patterns like `*://tau-video.xyz/embed/*` natively |

**Key insight:** Phase 2 adds zero player logic -- all video, subtitle, and skip-marker functionality lives in the bundled tau-website. Electron's role is purely network-layer (headers, ad blocking, protocol serving) and integration (deep links, Discord RPC).

## Tau-Website PostMessage Protocol (Complete Enumeration)

### Messages FROM tau-website TO parent (animecix.tv)

| Action | Payload | Frequency | Purpose |
|--------|---------|-----------|---------|
| `currentTarget` | `{ target: string }` | Once on mount | Reports iframe URL to parent |
| `ping` | `{}` | Every 5s | Keep-alive / validation |
| `currentTime` | `{ time: number, duration: number, isPlaying: boolean }` | Every 5s | Progress reporting (used for Discord RPC) |
| `currentTimeQuick` | `{ time: number, duration: number }` | Every 1s | Fast progress reporting |
| `canPlay` | `{ first: boolean }` | On canplay event | Signals video is ready; `first=true` triggers `getCurrentTime` request |
| `getCurrentTime` | `{}` | Once (after first canPlay) | Asks parent for saved playback position |
| `ended` | `{}` | On video end | Episode finished |
| `play` | `{}` | On play | Play state change |
| `pause` | `{}` | On pause | Pause state change |
| `captionsChanged` | `{ track: number }` | On subtitle change | 1-based index of active subtitle track |
| `dominantColor` | `{ data: number[][] }` | Every 1s (if deviceMemory > 4) | Color palette from video frame |
| `prev` | `{}` | On prev button click (fullscreen only) | Navigate to previous episode |
| `next` | `{}` | On next button click (fullscreen only) | Navigate to next episode |

### Messages FROM parent (animecix.tv) TO tau-website

| Action | Payload | Purpose |
|--------|---------|---------|
| `pong` | `{}` | Response to ping |
| `seek` | `{ time: number }` | Seek to timestamp (e.g., resume position) |
| `play` | `{}` | Resume playback |
| `pause` | `{}` | Pause playback |
| `toggle` | `{}` | Toggle play/pause |
| `fullscreenToggle` / `fullscreen` | `{}` | Toggle fullscreen |
| `fullscreenEnter` | `{}` | Enter fullscreen |
| `fullscreenExit` | `{}` | Exit fullscreen |
| `title` | `{ title: string }` | Set video title |
| `changeSub` | `{ index: number }` | Change subtitle (0=off, 1-based) |
| `skipForward` | `{ seconds?: number }` | Skip forward (default 10s) |
| `skipBackward` | `{ seconds?: number }` | Skip backward (default 10s) |
| `mute` | `{}` | Toggle mute |
| `volumeUp` | `{ step?: number }` | Increase volume (default 0.1) |
| `volumeDown` | `{ step?: number }` | Decrease volume (default 0.1) |
| `navigationInfo` | `{ hasNext: boolean, hasPrev: boolean }` | Episode navigation availability |
| `changeVideo` | `{ url: string }` | Navigate to different video (URL with /embed/:id?vid=) |

### Messages Relevant for Discord RPC

The main process needs to observe `currentTime` messages (every 5s) which contain `{ time, duration, isPlaying }`. Episode metadata (anime title, season, episode) comes from the tau-video.xyz API response (`Video` type: `title_id`, `season_number`, `episode_number`, `translator`). To get this metadata, the main process can either:
1. Observe the tau-video.xyz API request/response via `session.webRequest.onCompleted` + response body reading, OR
2. Have the preload script inject a message listener into animecix.tv that forwards relevant episode data to main via IPC

**Recommendation:** Option 2 is simpler -- inject a small `window.addEventListener('message', ...)` in the preload that captures `currentTime` events and forwards `{time, duration, isPlaying}` to main via IPC. For episode metadata (title, season, episode), either parse the animecix.tv page URL (e.g., `/anime-slug/sezon-X/bolum-Y`) or intercept the tau-video.xyz API response.

## Video Data Model (from tau-website source)

```typescript
// Source: tau-website/src/types/video.ts [VERIFIED: codebase]
interface Video {
  _id: string;
  durationDifference?: number;
  duration: number;
  title_id: string;        // Used for skip markers + Discord RPC
  season_number: string;   // S## for Discord RPC
  episode_number: string;  // E## for Discord RPC
  ratio?: number;          // Aspect ratio (default 16/9)
  hls?: string;            // HLS manifest URL (when available)
  urls: {                  // MP4 multi-quality sources
    label: string;         // e.g., "720p", "1080p"
    url: string;
    size: number;
  }[];
  subs: {                  // Subtitle tracks
    id: number;
    language: string;      // ISO 639 code (e.g., "tr", "en")
    url: string;           // ASS file URL
    name: string;          // Translator/fansub name
  }[];
  translator: string;      // Translator identifier
}

interface SkipMeta {
  [key: string]: { from: number; to: number };  // Skip markers keyed by segment name
}
```

## Tau-Website Bundling Strategy

**Recommendation: Pre-built artifact with copy-on-build script.** [ASSUMED]

Approach:
1. Build tau-website once: `cd tau-website && npm run build` produces `dist/tau-video/` with `index.html`, `assets/`, and `jassub/` directory
2. Copy the built output into `animecix-v2/assets/tau-website/` via a build script
3. Add a `prebuild` npm script in animecix-v2: `"prebuild:tau": "cd ../tau-website && npm run build && cp -r dist/tau-video ../animecix-v2/assets/tau-website"`
4. The `assets/` directory is included in the asar package by Electron Forge automatically

**Why not git submodule:** tau-website already exists in the monorepo root. Submodule adds complexity for no benefit.
**Why not npm workspace:** tau-website has its own package.json with different tooling (Vite + React plugin). Merging into Electron Forge's Vite config is fragile.
**Why not real-time dev server:** Locked decision requires zero runtime network dependency.

**Build output structure (from `vite.config.ts`: `outDir: 'dist/tau-video'`):**
```
dist/tau-video/
  index.html
  assets/
    index-[hash].js
    index-[hash].css
  jassub/
    jassub-worker.js
    jassub-worker.wasm
    default.woff2
  favicon.ico
```

**JASSUB worker URLs:** The EmbedPlayer configures LibASSTextRenderer with `workerUrl: '/jassub/jassub-worker.js'` and `wasmUrl: '/jassub/jassub-worker.wasm'`. With the `tau-player://` scheme registered as `standard`, these resolve to `tau-player://bundle/jassub/jassub-worker.js` -- which the protocol handler serves from the local assets directory. [VERIFIED: tau-website source + Electron protocol docs]

## Header Rewriting Rules (from old request-controller.ts)

### Analysis of Old Code [VERIFIED: codebase]

The old `request-controller.ts` applies headers **globally** with these rules:
1. **Referer:** Set to `currentFrameUrl` (the video embed page URL) for ALL requests except disqus and google domains
2. **User-Agent:** Set to `"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:70.0) Gecko/20100101 Firefox/70.0"` for ALL requests
3. **X-CSRF-TOKEN:** Injected on animecix domain requests (replacing X-XSRF-TOKEN)
4. **Content-Range header fix:** For `/file/tau-video` responses, adds Content-Range header and forces HTTP 206 status

### Recommended v2 Header Rules Schema

```typescript
// src/network/header-rules.ts
interface HeaderRule {
  /** URL pattern to match (Electron webRequest filter format) */
  urlPatterns: string[];
  /** Headers to set */
  headers: {
    referer?: string | 'from-iframe-url';
    userAgent?: string;
  };
  /** Human-readable purpose */
  purpose: string;
}

const HEADER_RULES: HeaderRule[] = [
  {
    urlPatterns: ['*://*.tau-video.xyz/file/*'],
    headers: { referer: 'from-iframe-url', userAgent: 'Firefox/70' },
    purpose: 'Video file CDN -- needs referer from embed page to authorize',
  },
  {
    urlPatterns: ['*://*.tau-video.xyz/api/*'],
    headers: { referer: 'from-iframe-url' },
    purpose: 'Tau-video API requests -- needs referer for auth',
  },
  // Add more patterns as CDN hosts are discovered
];
```

**Key difference from old code:** v2 scopes to video/CDN hosts only (locked decision). The old code rewrote ALL requests. The CSRF token injection may still be needed for animecix.tv API calls -- this should be verified during implementation.

### Content-Range Fix (listenStatus)

The old code forces HTTP 206 + Content-Range headers on `/file/tau-video` responses. This is likely needed for seeking in MP4 files served by tau-video.xyz. The v2 implementation should replicate this in `session.webRequest.onHeadersReceived` for the same URL pattern. [VERIFIED: codebase]

## Ad Blocker Architecture

### EasyList + EasyPrivacy Parsing

**Approach:** Use `abp-filter-parser` to parse bundled filter lists at startup. The library provides:
- `parse(rawFilterData: string, filterParseData: object)` -- parse filter text into an object
- `matches(filterParseData: object, url: string, filterOptions: object)` -- check if URL should be blocked

```typescript
// src/network/ad-blocker.ts
import ABPFilterParser from 'abp-filter-parser';
import fs from 'node:fs';
import path from 'node:path';
import { session } from 'electron';

export class AdBlocker {
  private filterData: Record<string, unknown> = {};

  constructor() {
    this.loadFilterLists();
  }

  private loadFilterLists(): void {
    const listsDir = path.join(__dirname, '..', 'assets', 'filter-lists');
    const easylist = fs.readFileSync(path.join(listsDir, 'easylist.txt'), 'utf-8');
    const easyprivacy = fs.readFileSync(path.join(listsDir, 'easyprivacy.txt'), 'utf-8');

    ABPFilterParser.parse(easylist, this.filterData);
    ABPFilterParser.parse(easyprivacy, this.filterData);
  }

  register(): void {
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['*://*/*'] },
      (details, callback) => {
        // Whitelist animecix.tv and tau-video.xyz
        if (details.url.includes('animecix') || details.url.includes('tau-video')) {
          callback({});
          return;
        }

        if (ABPFilterParser.matches(this.filterData, details.url, {
          domain: new URL(details.url).hostname,
          elementType: details.resourceType,
        })) {
          callback({ cancel: true });
        } else {
          callback({});
        }
      }
    );
  }
}
```

**Startup cost:** EasyList is ~80,000 rules, EasyPrivacy ~15,000 rules. `abp-filter-parser` uses a trie-based approach that parses both lists in <500ms on modern hardware. [ASSUMED]

**Important:** Only one `onBeforeRequest` handler can be registered per session. The ad blocker and iframe interceptor must be combined into a single handler, or the iframe interceptor must use a more specific URL filter that fires first.

**Resolution:** Use separate URL filters:
- Iframe intercept: `{ urls: ['https://tau-video.xyz/embed/*', 'https://tau-video.xyz/embed-2/*'] }` -- specific, fires for iframe navigation only
- Ad blocker: `{ urls: ['*://*/*'] }` -- broad, fires for everything else

**Actually, Electron supports multiple `onBeforeRequest` handlers** -- each call to `onBeforeRequest` replaces the previous one. So the two must be combined into a single handler. The iframe redirect check should come first (cheap URL prefix check), then the ad blocker check.

## Deep Link Auth Flow

### animecix:// Protocol Registration [VERIFIED: codebase + Electron docs]

```typescript
// src/auth/deep-link.ts
import { app } from 'electron';
import path from 'node:path';

export function registerDeepLinkProtocol(): void {
  if (process.defaultApp) {
    // Dev mode: need to pass the script path
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('animecix', process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient('animecix');
  }
}
```

### Callback Flow

From old `auth-controller.ts` and `deeplink-controller.ts`:
1. User clicks "Google Login" on animecix.tv -> opens browser to Google OAuth
2. Google redirects to animecix.tv callback -> animecix.tv redirects to `animecix://login{status|data}`
3. OS routes `animecix://login...` to the Electron app

**macOS (warm start):** `app.on('open-url', (event, url) => { ... })` fires with the URL [CITED: Electron deep links docs]

**Windows (warm start):** `app.on('second-instance', (event, commandLine) => { ... })` fires -- extract URL from `commandLine.find(arg => arg.includes('animecix://'))` [CITED: Electron deep links docs]

**Cold start (both platforms):** Read `process.argv` on startup, find the `animecix://` argument, defer handling until main window has loaded animecix.tv [VERIFIED: old deeplink-controller.ts]

**Callback injection:** Parse the deep link URL to extract the login token, then navigate main webContents to `https://animecix.tv/secure/short-login/{data}` (same pattern as old auth-controller.ts). [VERIFIED: codebase -- `auth-controller.ts` line 18]

### Integration with Phase 1 Single-Instance Lock

Phase 1 already has `app.on('second-instance', ...)` in `main.ts`. Phase 2 extends this handler to also check for `animecix://` URLs in the command line args and process them.

## Discord RPC Service

### Library Choice: @xhayper/discord-rpc 1.3.3

**Decision: Use `@xhayper/discord-rpc`**

| Criterion | @xhayper/discord-rpc | discord-rpc |
|-----------|---------------------|-------------|
| Last publish | 2026-03-26 | 2021-06-14 |
| TypeScript | Native .d.ts | Needs @types/discord-rpc |
| Maintenance | Active (1.3.3) | Abandoned (4.0.1 from 2021) |
| Electron compat | IPC transport, tested | IPC transport, untested with modern Electron |
| Used by old app | Yes (rpc-controller.ts uses it) | No |

[VERIFIED: npm registry for both packages]

### Implementation Pattern

```typescript
// src/integrations/discord-rpc.ts
import { Client } from '@xhayper/discord-rpc';

const CLIENT_ID = '921684324141641728'; // From old rpc-controller.ts

export class DiscordService {
  private client: Client;
  private connected = false;

  constructor() {
    this.client = new Client({ clientId: CLIENT_ID });
    this.connect();
  }

  private async connect(): Promise<void> {
    try {
      this.client.once('ready', () => { this.connected = true; });
      await this.client.login();
    } catch {
      this.connected = false; // Silent no-op per locked decision
    }
  }

  updateActivity(data: {
    title: string;
    episode: string;
    isPlaying: boolean;
    startTimestamp?: number;
    posterUrl?: string;
  }): void {
    if (!this.connected) return;

    this.client.user?.setActivity({
      details: data.title,
      state: data.episode,
      startTimestamp: data.isPlaying ? data.startTimestamp : undefined,
      largeImageKey: data.posterUrl || 'animecix-logo',
      smallImageKey: 'animecix-logo',
      type: 3, // Watching
    }).catch(() => {}); // Silent fail
  }

  setIdle(): void {
    if (!this.connected) return;
    this.client.user?.setActivity({
      state: 'Bakiniyor',
      largeImageKey: 'animecix-logo',
      type: 3,
    }).catch(() => {});
  }

  destroy(): void {
    if (!this.connected) return;
    this.client.user?.clearActivity().catch(() => {});
  }
}
```

**Data flow for Discord RPC:**
1. tau-website emits `currentTime` postMessage every 5s with `{ time, duration, isPlaying }`
2. Preload script's injected listener catches this and forwards to main via IPC: `ipcRenderer.send('player:state', { time, duration, isPlaying })`
3. For episode metadata: observe the tau-video.xyz API response (`/api/video/:id`) via `session.webRequest.onCompleted` + `webContents.debugger` to read response body, OR simpler -- parse animecix.tv's page URL for anime/season/episode info
4. Main process DiscordService updates activity on state change

**Simpler metadata approach:** Since animecix.tv controls the iframe, it likely sends a `title` postMessage to tau-website with the episode title. The preload observer can capture this too.

## Subtitle Preference Storage

### Schema Addition

```sql
-- Add to schema.ts INIT_SCHEMA
CREATE TABLE IF NOT EXISTS subtitle_prefs (
  anime_id TEXT PRIMARY KEY NOT NULL,
  language TEXT NOT NULL DEFAULT 'tr',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### StorageService Methods

```typescript
// Add to StorageService
getSubtitlePref(animeId: string): string {
  const row = this.db
    .prepare('SELECT language FROM subtitle_prefs WHERE anime_id = ?')
    .get(animeId) as { language: string } | undefined;
  return row?.language ?? 'tr'; // Default to Turkish
}

setSubtitlePref(animeId: string, language: string): void {
  this.db
    .prepare('INSERT OR REPLACE INTO subtitle_prefs (anime_id, language, updated_at) VALUES (?, ?, unixepoch())')
    .run(animeId, language);
}
```

**Integration note:** tau-website already stores subtitle preference in `localStorage` (`prefered_language` key) and uses it as the default for track selection. However, this is a global preference, not per-anime. The locked decision requires per-anime in SQLite.

**Implementation approach:** When a video loads (detected via iframe intercept or API observation), read the anime ID from the tau-video API response, look up the per-anime preference in SQLite, and inject it into the tau-website's `localStorage` before the player reads it. This can be done via `webContents.executeJavaScript` on the iframe's webContents, or by setting localStorage in the protocol handler's HTML response.

**Simpler alternative:** Since tau-website reads `localStorage.getItem('prefered_language')` synchronously at render time, the main process can set the iframe's localStorage via `session.defaultSession.cookies` or by having the protocol handler serve a modified index.html that sets localStorage. However, modifying tau-website source violates the zero-divergence decision.

**Best approach:** The preload script observes `captionsChanged` postMessages and saves the language to SQLite via IPC. When a new video loads (detected via the `canPlay` message with `first: true`), the main process reads the per-anime preference from SQLite and sends it to the preload, which calls `window.parent.postMessage({action: 'changeSub', index: N}, ...)` -- but this goes to the wrong direction (parent, not the iframe).

**Actually simplest:** tau-website's own localStorage `prefered_language` already persists across sessions within the same origin. Since all tau-player:// pages share the same origin, this gives us a global preference for free. For PER-ANIME preference (locked decision), the preload observer must:
1. Watch `captionsChanged` events, extract anime_id from the current video data, save `{anime_id, language}` to SQLite via IPC
2. When a new video loads, send a `changeSub` postMessage from the parent (animecix.tv) to the tau iframe with the stored preference index
3. This requires the preload to map language code -> subtitle index from the tracks available in the current video

This will need a thin coordination layer. The preload listens for `canPlay` with `first: true`, asks main for the subtitle preference for the current anime, then sends a `changeSub` message to the iframe.

## Common Pitfalls

### Pitfall 1: Multiple onBeforeRequest Handlers
**What goes wrong:** Registering `session.webRequest.onBeforeRequest` multiple times -- each call REPLACES the previous handler.
**Why it happens:** Ad blocker and iframe interceptor both need onBeforeRequest.
**How to avoid:** Combine into a single handler. Check iframe redirect patterns first (cheap string prefix check), then run ad blocker check.
**Warning signs:** Ads not blocked, or iframe not redirecting.

### Pitfall 2: registerSchemesAsPrivileged Timing
**What goes wrong:** Calling `protocol.registerSchemesAsPrivileged` after `app.ready` -- silently fails.
**Why it happens:** This API must be called before the `ready` event, as a top-level call in the main process entry point.
**How to avoid:** Place the call at module top level in main.ts, before any `app.whenReady()`.
**Warning signs:** Custom protocol returns ERR_UNKNOWN_URL_SCHEME.

### Pitfall 3: postMessage Origin Mismatch
**What goes wrong:** tau-website posts to `https://animecix.tv/` origin but the parent might be on a different URL (e.g., during development or if the user navigates).
**Why it happens:** The `SITE_URL` constant in useParentMessages.ts is hardcoded to `https://animecix.tv/`.
**How to avoid:** Ensure main webContents always loads animecix.tv. This is already the case from Phase 1.
**Warning signs:** postMessage silently dropped if origin doesn't match.

### Pitfall 4: file:// in Iframes
**What goes wrong:** JASSUB WASM workers fail to load, relative paths break, CSP blocks resources.
**Why it happens:** file:// protocol doesn't support standard URL resolution or fetch API in iframes.
**How to avoid:** Use custom protocol with `standard: true, supportFetchAPI: true` privileges.
**Warning signs:** Blank player, console errors about blocked resources.

### Pitfall 5: Deep Link Cold Start Race
**What goes wrong:** App receives `animecix://login...` URL before main window is loaded and ready.
**Why it happens:** Cold start -- OS passes URL in argv but window hasn't loaded animecix.tv yet.
**How to avoid:** Buffer the deep link URL, process it after `did-finish-load` fires on main webContents.
**Warning signs:** Login callback URL navigated to a not-yet-loaded window, showing blank page.

### Pitfall 6: Discord RPC Reconnection Storm
**What goes wrong:** If Discord is not running, the RPC client throws on every `setActivity` call, filling logs.
**Why it happens:** No connection check before activity update.
**How to avoid:** Track `connected` flag, wrap all setActivity calls in silent try/catch, reconnect lazily on next update attempt.
**Warning signs:** Console spam with ECONNREFUSED errors.

### Pitfall 7: abp-filter-parser Type Safety
**What goes wrong:** `abp-filter-parser` has no TypeScript types -- compilation errors or unsafe `any` usage.
**Why it happens:** Package published 10 years ago, no TypeScript support.
**How to avoid:** Write a `src/types/abp-filter-parser.d.ts` declaration file.
**Warning signs:** TypeScript compilation errors on import.

### Pitfall 8: Single onBeforeRequest Handler for Both Redirect and Cancel
**What goes wrong:** Calling `callback({ redirectURL: ... })` and `callback({ cancel: true })` in the same handler -- only one callback is valid per request.
**Why it happens:** Both iframe interception and ad blocking use onBeforeRequest.
**How to avoid:** Check iframe redirect pattern FIRST. If it matches, redirect and return. Otherwise, check ad blocker. If neither, pass through with `callback({})`.
**Warning signs:** ERR_INVALID_CALLBACK or requests not being properly redirected.

## Code Examples

### Combined onBeforeRequest Handler
```typescript
// Source: Electron session.webRequest docs [CITED: electronjs.org/docs/latest/api/web-request]
export function setupRequestInterception(adBlocker: AdBlocker): void {
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['*://*/*'] },
    (details, callback) => {
      // 1. Iframe redirect check (specific URL patterns)
      if (details.url.startsWith('https://tau-video.xyz/embed/') ||
          details.url.startsWith('https://tau-video.xyz/embed-2/')) {
        const url = new URL(details.url);
        callback({ redirectURL: `tau-player://bundle${url.pathname}${url.search}` });
        return;
      }

      // 2. Whitelist animecix and tau-video domains
      if (details.url.includes('animecix') || details.url.includes('tau-video')) {
        callback({});
        return;
      }

      // 3. Ad blocker check
      if (adBlocker.shouldBlock(details.url)) {
        callback({ cancel: true });
        return;
      }

      // 4. Pass through
      callback({});
    }
  );
}
```

### Type Declaration for abp-filter-parser
```typescript
// src/types/abp-filter-parser.d.ts
declare module 'abp-filter-parser' {
  interface FilterData {
    [key: string]: unknown;
  }
  interface MatchOptions {
    domain?: string;
    elementType?: string;
  }
  export function parse(input: string, data: FilterData): void;
  export function matches(data: FilterData, url: string, options?: MatchOptions): boolean;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `protocol.registerFileProtocol` | `protocol.handle` | Electron 25+ | Simpler API, returns standard Response objects |
| `nodeRequire('electron')` in renderer | contextBridge + contextIsolation | Electron 12+ | Security baseline; tau-website's useElectronIPC hook is dead code in v2 |
| `@cliqz/adblocker-electron` | `@ghostery/adblocker-electron` (renamed) | 2024 | Same package, new scope; but decision says no framework |
| `discord-rpc` | `@xhayper/discord-rpc` | 2023 | Old package abandoned; fork is maintained |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | abp-filter-parser parses both EasyList and EasyPrivacy in <500ms | Ad Blocker Architecture | If slow, startup UX suffers; could defer parsing to background thread |
| A2 | `tau-player://` redirect from onBeforeRequest works for cross-scheme redirect | Architecture Patterns | If Chromium blocks cross-scheme redirect in onBeforeRequest, need alternative approach (protocol.handle intercepting https) |
| A3 | Pre-built copy approach for tau-website is sufficient | Bundling Strategy | If tau-website changes frequently, a more automated integration may be needed |
| A4 | postMessage from tau-player:// iframe to https://animecix.tv parent works | Architecture Patterns | If Chromium restricts cross-origin postMessage from custom schemes, player data bridge breaks entirely |

**Critical assumption A2 and A4:** The redirect-to-custom-scheme and cross-origin postMessage patterns should be prototyped early in Phase 2 implementation as a proof-of-concept before building out the full feature set.

## Open Questions (RESOLVED)

1. **Redirect to custom protocol from onBeforeRequest** (RESOLVED)
   - What we know: Electron docs say `redirectURL` can redirect to any URL. GitHub issue #32253 reports `ERR_UNKNOWN_URL_SCHEME` for custom schemes in intercept handlers.
   - Resolution: `registerSchemesAsPrivileged` with `standard: true` makes the scheme known to Chromium's URL parser before any navigation occurs. The issue #32253 was for `protocol.interceptFileProtocol` (deprecated API), not `session.webRequest.onBeforeRequest`. The plan uses `protocol.handle` (modern API) + `onBeforeRequest` redirect, which is the documented approach. If redirect still fails at runtime, fallback is `protocol.handle('https', ...)` intercepting the HTTPS request directly for tau-video.xyz embed URLs and serving local files while keeping the https origin. Plan 05 Task 3 (manual verification) will validate this.

2. **postMessage between custom scheme iframe and https parent** (RESOLVED)
   - What we know: postMessage does not enforce same-origin -- `targetOrigin` is checked on the RECEIVER side only.
   - Resolution: The parent frame IS `https://animecix.tv` (loaded via `loadURL`). tau-website posts to `targetOrigin: 'https://animecix.tv/'` which matches the parent's actual origin. The iframe content origin (`tau-player://bundle`) is irrelevant for the targetOrigin check -- Chromium checks whether the receiver's origin matches the targetOrigin, not the sender's. Messages FROM parent TO iframe use `'*'` or the iframe's origin and are unrestricted by Chromium. Pattern 4 in Architecture Patterns section confirms this analysis. Plan 05 Task 3 (manual verification) will validate end-to-end.

3. **CSRF token handling** (RESOLVED)
   - What we know: Old code injects X-CSRF-TOKEN on animecix domain requests. v2 CONTEXT.md locked decision scopes header rewriting to "video/CDN hosts only" -- explicitly excludes animecix.tv.
   - Resolution: Do NOT inject CSRF tokens in Phase 2. The locked decision says "Do NOT rewrite on animecix.tv or tau-video.xyz API traffic". Chromium's built-in cookie handling will send XSRF-TOKEN cookies naturally. If animecix.tv API calls fail with 419/403 during manual verification (Plan 05 Task 3), a gap closure plan will add CSRF handling scoped to animecix.tv API endpoints only.

4. **Content-Range header fix** (RESOLVED)
   - What we know: Old code forces HTTP 206 + Content-Range on `/file/tau-video` responses for MP4 seeking.
   - Resolution: Modern CDNs and hls.js/Vidstack handle range requests correctly via standard HTTP Range headers. The old fix was likely for a tau-video.xyz CDN quirk that may no longer exist. Plan 02 header-rewriter.ts does not include Content-Range manipulation. If MP4 seeking fails during manual verification (Plan 05 Task 3), a gap closure plan will add `onHeadersReceived` rules for the `/file/tau-video` pattern.

5. **Episode metadata for Discord RPC** (RESOLVED)
   - What we know: tau-website fetches from `https://tau-video.xyz/api/video/:id` which returns a Video object with `title_id`, `season_number`, `episode_number`, `translator`.
   - Resolution: Main process intercepts tau-video.xyz API responses via `session.webRequest.onCompleted` for URLs matching `*://tau-video.xyz/api/video/*`. When a matching response completes, main process fetches the same URL using `net.fetch` (same session cookies) to read the Video JSON. This provides `title_id`, `season_number`, `episode_number`, `translator`, and poster URL. For the human-readable anime title, main process reads it from `document.title` via `webContents.getTitle()` on the main window (animecix.tv pages set the page title to the anime name). This approach is implemented in Plan 05 Task 1 via an `episode-metadata-interceptor` in main.ts.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build tooling | Yes | (via Electron) | -- |
| npm | Package install | Yes | (system) | -- |
| Discord app | Discord RPC | Optional | -- | Silent no-op (locked decision) |
| Internet | animecix.tv, tau-video.xyz API | Required | -- | No fallback for online streaming |

**Missing dependencies with no fallback:** None -- all new npm packages are straightforward installs.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.4 |
| Config file | animecix-v2/vitest.config.ts |
| Quick run command | `cd animecix-v2 && npx vitest run --reporter=dot` |
| Full suite command | `cd animecix-v2 && npx vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAY-01 | tau-player:// protocol serves local files | unit | `npx vitest run tests/player/tau-protocol.test.ts -t "serves index.html"` | No -- Wave 0 |
| PLAY-01 | iframe redirect intercepts tau-video.xyz/embed/ URLs | unit | `npx vitest run tests/player/iframe-intercept.test.ts` | No -- Wave 0 |
| PLAY-02 | HLS + MP4 source handling | manual-only | Manual: play video with HLS source, then MP4 multi-quality | N/A |
| PLAY-03 | JASSUB subtitle rendering | manual-only | Manual: verify ASS subtitles render with language selection | N/A |
| PLAY-04 | Skip buttons appear at correct timestamps | manual-only | Manual: seek to intro/outro timestamps, verify skip button | N/A |
| AUTH-01 | Deep link registration and callback | unit | `npx vitest run tests/auth/deep-link.test.ts` | No -- Wave 0 |
| AUTH-04 | Header rewriting applies correct rules | unit | `npx vitest run tests/network/header-rewriter.test.ts` | No -- Wave 0 |
| NET-01 | Ad blocker parses EasyList and blocks URLs | unit | `npx vitest run tests/network/ad-blocker.test.ts` | No -- Wave 0 |
| INTG-02 | Discord RPC updates on state change | unit | `npx vitest run tests/integrations/discord-rpc.test.ts` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd animecix-v2 && npx vitest run --reporter=dot`
- **Per wave merge:** `cd animecix-v2 && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/player/tau-protocol.test.ts` -- covers PLAY-01 protocol handler
- [ ] `tests/player/iframe-intercept.test.ts` -- covers PLAY-01 iframe redirect
- [ ] `tests/network/header-rewriter.test.ts` -- covers AUTH-04
- [ ] `tests/network/ad-blocker.test.ts` -- covers NET-01
- [ ] `tests/auth/deep-link.test.ts` -- covers AUTH-01
- [ ] `tests/integrations/discord-rpc.test.ts` -- covers INTG-02
- [ ] `tests/storage/subtitle-prefs.test.ts` -- covers PLAY-03 preference storage

Note: PLAY-02, PLAY-03, PLAY-04 are E2E behaviors that require a running Electron app with network access -- manual UAT only for v1.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Deep link callback validates URL structure before navigating; no raw token injection |
| V3 Session Management | No | Handled by animecix.tv's own session (Chromium cookie store) |
| V4 Access Control | Yes | Custom protocol handler validates path stays within assets directory (path traversal prevention) |
| V5 Input Validation | Yes | Deep link URL parsing validates format before processing; header rules use static config not user input |
| V6 Cryptography | No | No custom crypto; HTTPS enforced by Chromium |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via tau-player:// protocol | Tampering | Resolve path and verify it's within assets/tau-website/ before serving |
| Deep link injection (malicious animecix:// URL) | Spoofing | Validate URL format matches expected login callback pattern before navigating webContents |
| Ad blocker bypass via crafted URLs | Tampering | Whitelist only known first-party domains; block everything else through filter lists |
| Discord RPC token exposure | Information Disclosure | Client ID is not secret (Discord app ID); RPC uses local IPC socket only |

## Sources

### Primary (HIGH confidence)
- tau-website/src/ -- Full source code read for postMessage protocol, Video types, EmbedPlayer, hooks
- animecix-desktop/modules/controllers/ -- request-controller.ts, deeplink-controller.ts, rpc-controller.ts, auth-controller.ts, player-controller.ts, window-controller.ts
- animecix-v2/src/ -- main.ts, preload.ts, StorageService.ts, schema.ts, WindowService.ts
- [Electron Protocol API](https://www.electronjs.org/docs/latest/api/protocol) -- registerSchemesAsPrivileged, protocol.handle
- [Electron Deep Links](https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app) -- setAsDefaultProtocolClient, open-url, second-instance
- [Electron WebRequest API](https://www.electronjs.org/docs/latest/api/web-request) -- onBeforeRequest, onBeforeSendHeaders
- npm registry -- @xhayper/discord-rpc 1.3.3 (2026-03-26), discord-rpc 4.0.1 (2021-06-14), abp-filter-parser 0.2.0

### Secondary (MEDIUM confidence)
- [Electron issue #32253](https://github.com/electron/electron/issues/32253) -- custom scheme redirect from intercept handler
- [Electron issue #12242](https://github.com/electron/electron/issues/12242) -- file:// as redirectUrl limitations
- [abp-filter-parser README](https://github.com/bbondy/abp-filter-parser/blob/master/README.md) -- API documentation

### Tertiary (LOW confidence)
- abp-filter-parser startup performance claim -- not benchmarked, based on general knowledge of trie-based filter parsing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries verified against npm registry, old app code confirms patterns
- Architecture: HIGH for most patterns, MEDIUM for custom protocol redirect (needs prototype validation)
- Pitfalls: HIGH -- derived from codebase analysis and Electron docs
- PostMessage protocol: HIGH -- complete enumeration from tau-website source code
- Ad blocker: MEDIUM -- abp-filter-parser is old (0.2.0, 10 years) but still functional for network rules

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (30 days -- stable domain, Electron APIs unlikely to change)
