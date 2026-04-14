---
phase: 02-online-streaming
reviewed: 2026-04-12T12:00:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - animecix-v2/src/auth/deep-link.ts
  - animecix-v2/src/integrations/discord-rpc.ts
  - animecix-v2/src/main.ts
  - animecix-v2/src/network/ad-blocker.ts
  - animecix-v2/src/network/header-rewriter.ts
  - animecix-v2/src/network/header-rules.ts
  - animecix-v2/src/network/request-handler.ts
  - animecix-v2/src/player-page/App.tsx
  - animecix-v2/src/player-page/components/EmbedPlayer.tsx
  - animecix-v2/src/player-page/components/EmbedPlayer.css
  - animecix-v2/src/player-page/components/NavigationButtons.tsx
  - animecix-v2/src/player-page/components/SkipButton.tsx
  - animecix-v2/src/player-page/components/translations.ts
  - animecix-v2/src/player-page/hooks/useColorExtraction.ts
  - animecix-v2/src/player-page/hooks/useParentMessages.ts
  - animecix-v2/src/player-page/hooks/useVideoData.ts
  - animecix-v2/src/player-page/main.tsx
  - animecix-v2/src/player-page/types.ts
  - animecix-v2/src/player/tau-protocol.ts
  - animecix-v2/src/preload.ts
  - animecix-v2/src/storage/StorageService.ts
  - animecix-v2/src/storage/schema.ts
  - animecix-v2/src/types/abp-filter-parser.d.ts
  - animecix-v2/src/types/animecix-api.d.ts
  - animecix-v2/vite.player.config.mts
  - animecix-v2/forge.config.ts
  - animecix-v2/tests/auth/deep-link.test.ts
  - animecix-v2/tests/integrations/discord-rpc.test.ts
  - animecix-v2/tests/network/ad-blocker.test.ts
  - animecix-v2/tests/network/header-rewriter.test.ts
  - animecix-v2/tests/player/iframe-intercept.test.ts
  - animecix-v2/tests/player/tau-protocol.test.ts
  - animecix-v2/tests/storage/subtitle-prefs.test.ts
findings:
  critical: 1
  warning: 5
  info: 2
  total: 8
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-04-12T12:00:00Z
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

The Phase 2 online streaming implementation covers deep linking, Discord RPC, ad blocking, CDN header rewriting, iframe-to-custom-protocol redirection, a built-in video player (React + Vidstack), subtitle preference persistence (SQLite), and the preload/IPC bridge. The codebase is well-structured with good separation of concerns, solid path traversal protection in `tau-protocol.ts`, and proper use of `contextBridge` for Electron security. Test coverage is present for all major pure-function modules.

One critical security issue was found: the player's `postMessage` handler does not validate the message origin, which could allow a malicious page loaded in the same renderer to send arbitrary commands to the player. Five warnings cover missing null checks, unvalidated API responses, and a non-null assertion race condition. Two informational items note minor code quality improvements.

## Critical Issues

### CR-01: Missing origin validation on postMessage handler

**File:** `animecix-v2/src/player-page/hooks/useParentMessages.ts:26-96`
**Issue:** The `handleMessage` function listens for `window.addEventListener('message', handleMessage)` but never checks `event.origin`. Any origin -- not just `https://animecix.tv/` -- can send messages that will be processed by the player. This allows a malicious iframe sibling or injected content to control playback (seek, play, pause), toggle fullscreen, change subtitles, or trigger navigation to arbitrary embed URLs via `changeVideo`.

The outgoing `postToParent` correctly restricts the target origin to `SITE_URL`, but the incoming handler has no such check. Since the player runs inside a privileged `tau-player://` scheme with `bypassCSP: true`, this is especially important.

**Fix:**
```typescript
function handleMessage(event: MessageEvent) {
  // Only accept messages from the parent animecix.tv origin
  if (event.origin !== 'https://animecix.tv') return;

  const data = event.data;
  const player = playerRef.current;
  // ... rest of handler
}
```

## Warnings

### WR-01: Possible null/undefined in subtitle track label

**File:** `animecix-v2/src/player-page/components/EmbedPlayer.tsx:73`
**Issue:** `regionNamesInTurkish.of(sub.language)` returns `string | undefined` per the `Intl.DisplayNames` spec. If `sub.language` contains an unrecognized code, the label becomes `"undefined - SubName"`, which is confusing for users.
**Fix:**
```typescript
label: (regionNamesInTurkish.of(sub.language) ?? sub.language) + ' - ' + sub.name,
```

### WR-02: No HTTP response status check on video data fetch

**File:** `animecix-v2/src/player-page/hooks/useVideoData.ts:23-29`
**Issue:** The `fetch` call does not check `res.ok` or `res.status` before calling `res.json()`. A 4xx/5xx response may return an HTML error page or unexpected JSON, causing the player to silently display incorrect state or throw a JSON parse error that is caught as a generic failure.
**Fix:**
```typescript
const res = await fetch(url);
if (!res.ok) {
  throw new Error(`Video fetch failed: ${res.status}`);
}
const videoData: Video = await res.json();
```
Apply the same pattern to the skip markers fetch on line 42-49.

### WR-03: Non-null assertion race on mainWindow in did-finish-load callback

**File:** `animecix-v2/src/main.ts:92`
**Issue:** `mainWindow!.webContents` uses a non-null assertion inside a `did-finish-load` callback. Although `mainWindow` is checked before the callback is registered (line 89), it could be set to `null` by the `window-all-closed` handler (line 143-148) before `did-finish-load` fires -- for example if the user closes the window during initial page load.
**Fix:**
```typescript
mainWindow.webContents.once('did-finish-load', () => {
  if (mainWindow) {
    handleDeepLink(bufferedUrl, mainWindow.webContents);
  }
});
```

### WR-04: Unvalidated message data types from postMessage

**File:** `animecix-v2/src/player-page/hooks/useParentMessages.ts:32-95`
**Issue:** Properties like `data.time`, `data.index`, `data.seconds`, `data.step`, `data.url`, `data.title`, `data.enabled`, `data.hasNext`, `data.hasPrev` are accessed from `event.data` without any type checking. If a message has `data.time` set to a string or object instead of a number, `player.currentTime = seekTime` could produce unexpected behavior. This is partially mitigated by the origin check fix (CR-01) but defense-in-depth applies.
**Fix:** Add basic type guards for numeric and string fields before using them, or define a schema validator:
```typescript
} else if (data.action === 'seek' && player) {
  const seekTime = typeof data.time === 'number' ? data.time : 0.01;
  // ...
}
```

### WR-05: Floating promise from DiscordService constructor

**File:** `animecix-v2/src/integrations/discord-rpc.ts:35`
**Issue:** `this.connect()` is called in the constructor and returns a Promise, but it is neither awaited nor has a `.catch()` attached at the call site. While the `connect()` method itself catches errors internally, if the `once('ready')` handler or `login()` call throws synchronously before the try/catch engages, it would produce an unhandled promise rejection. The current implementation works because `login()` is awaited inside `connect()`, but this pattern is fragile -- any future refactoring that changes the error handling in `connect()` could cause silent failures.
**Fix:** Attach a no-op catch at the call site to make the intent explicit:
```typescript
constructor() {
  this.client = new Client({ clientId: CLIENT_ID });
  this.connect().catch(() => {
    // Handled inside connect(); this catch prevents unhandled rejection
  });
}
```

## Info

### IN-01: ColorThief instantiated on every interval tick

**File:** `animecix-v2/src/player-page/hooks/useColorExtraction.ts:38`
**Issue:** `new ColorThief!()` creates a new instance every 1000ms inside the interval callback. The `!` non-null assertion is redundant since `ColorThief` is already checked for null on line 29. The instance could be created once after the dynamic import resolves.
**Fix:**
```typescript
let colorThief: { getPalette: (canvas: HTMLCanvasElement, count: number) => number[][] } | null = null;

import('colorthief').then((mod) => {
  const CT = mod.default;
  colorThief = new CT();
});

const interval = setInterval(() => {
  if (!colorThief) return;
  // use colorThief.getPalette(...) directly
});
```

### IN-02: Deep link data validation does not reject backslash

**File:** `animecix-v2/src/auth/deep-link.ts:72`
**Issue:** `parseDeepLinkUrl` and `buildCallbackUrl` reject `..` and `/` in data but do not reject `\`. On Windows, backslash is a path separator and could theoretically be used in path traversal. In practice this is low risk because `buildCallbackUrl` only constructs an HTTPS URL (where `\` is not a path separator), but rejecting `\` would strengthen defense-in-depth.
**Fix:**
```typescript
if (data.includes('..') || data.includes('/') || data.includes('\\')) {
  return null;
}
```

---

_Reviewed: 2026-04-12T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
