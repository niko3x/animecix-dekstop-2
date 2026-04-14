---
phase: 02-online-streaming
plan: "02"
subsystem: network
tags: [network, ad-blocking, header-rewriting, iframe-redirect, electron]
dependency_graph:
  requires: [02-01]
  provides: [network-interception-layer]
  affects: [main-process-setup, online-streaming-flow]
tech_stack:
  added: [abp-filter-parser@0.2.x, bundled-easylist, bundled-easyprivacy]
  patterns: [electron-web-request-api, abp-filter-parsing, pure-function-testability]
key_files:
  created:
    - animecix-v2/src/network/header-rules.ts
    - animecix-v2/src/network/header-rewriter.ts
    - animecix-v2/src/network/ad-blocker.ts
    - animecix-v2/src/network/request-handler.ts
    - animecix-v2/src/network/filter-lists/easylist.txt
    - animecix-v2/src/network/filter-lists/easyprivacy.txt
  modified:
    - animecix-v2/tests/network/header-rewriter.test.ts
    - animecix-v2/tests/network/ad-blocker.test.ts
    - animecix-v2/tests/player/iframe-intercept.test.ts
    - animecix-v2/package.json
    - animecix-v2/package-lock.json
decisions:
  - "abp-filter-parser used for ABP/EasyList filter parsing (already in locked decisions)"
  - "matchesHeaderRule regex conversion uses placeholder approach to avoid escaping the scheme wildcard"
  - "AdBlocker.loadTestFilters() added to enable unit testing without bundled filter files"
  - "isWhitelisted and isIframeRedirect/buildRedirectUrl exported as pure functions for testability"
metrics:
  duration_seconds: 218
  completed_date: "2026-04-12"
  tasks_completed: 2
  files_created: 6
  files_modified: 5
---

# Phase 2 Plan 02: Network Interception Layer Summary

**One-liner:** Network layer with combined onBeforeRequest handler (iframe redirect to tau-player://, ad blocking via EasyList/EasyPrivacy), CDN header rewriting via onBeforeSendHeaders, and bundled filter lists.

## What Was Built

### Task 1: Header Rules, Header Rewriter, Ad Blocker

**`src/network/header-rules.ts`** — Static header rule definitions:
- `HEADER_RULES`: two rules for tau-video.xyz CDN — `/file/*` gets Referer + Firefox UA, `/api/*` gets Referer only
- `matchesHeaderRule(url, rules)`: pure function converting Electron URL patterns to regex for URL matching
- `FIREFOX_UA`: hardcoded Firefox 70 user-agent string required by the CDN

**`src/network/header-rewriter.ts`** — CDN header injection via `onBeforeSendHeaders`:
- `setupHeaderRewriter()`: registers handler on `session.defaultSession` with pattern filter covering all tau-video.xyz CDN paths
- Applies Referer and User-Agent headers for matched rules; passes through all other requests unchanged
- Guards against non-Electron environments (tests/Node.js)

**`src/network/ad-blocker.ts`** — ABP filter parser wrapper:
- `AdBlocker` class with `loadFilterLists()` (reads bundled easylist.txt + easyprivacy.txt), `loadTestFilters(text)` (for unit tests), and `shouldBlock(url)`
- `isWhitelisted(url)`: pure function — always returns true for animecix.tv and tau-video.xyz
- `shouldBlock()` returns false for whitelisted URLs, false when no filters loaded, otherwise delegates to `ABPFilterParser.matches()`

**`src/network/filter-lists/`** — Bundled filter lists:
- `easylist.txt`: ~90,000 lines (downloaded from easylist.to)
- `easyprivacy.txt`: ~56,000 lines (downloaded from easylist.to)

### Task 2: Combined Request Handler + Iframe Intercept Tests

**`src/network/request-handler.ts`** — Single combined `onBeforeRequest` handler:
- `isIframeRedirect(url)`: pure function returning true for `https://tau-video.xyz/embed/*` and `https://tau-video.xyz/embed-2/*`
- `buildRedirectUrl(url)`: pure function converting embed URL to `tau-player://bundle{pathname}{search}`
- `setupRequestInterception(adBlocker)`: registers the single `onBeforeRequest` handler with correct priority order:
  1. Iframe redirect (tau-video.xyz embed -> tau-player://)
  2. First-party whitelist pass-through (animecix.tv, tau-video.xyz)
  3. Ad blocker cancel
  4. Default pass-through

## Test Results

- `tests/network/header-rewriter.test.ts`: 9 tests passed
- `tests/network/ad-blocker.test.ts`: 8 tests passed
- `tests/player/iframe-intercept.test.ts`: 7 tests passed
- **Total: 24 tests, all passing**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed regex pattern conversion in matchesHeaderRule**
- **Found during:** Task 1 GREEN phase
- **Issue:** The plan's regex conversion approach (escape special chars first, then un-escape `\*`) produced an invalid regex `*://` because `*` at the start has no quantifier target. The `replace(/\\\*/g, '.*').replace('.*://', '[a-z]+://')` ordering in the plan also had a logic flaw — `.*://` could match middle occurrences in longer strings.
- **Fix:** Use a placeholder approach: replace all `*` with `___STAR___` first, then escape special chars, then replace scheme wildcard placeholder `___STAR___://` with `[a-z]+://`, then replace remaining `___STAR___` with `.*`
- **Files modified:** `animecix-v2/src/network/header-rules.ts`
- **Commit:** part of `a0a2f91`

**2. [Rule 2 - Missing functionality] Added `loadTestFilters()` method to AdBlocker**
- **Found during:** Task 1 design
- **Issue:** The plan's `AdBlocker` constructor auto-calls `loadFilterLists()` which reads from `path.join(__dirname, 'filter-lists')`. In the test environment (vitest/Node.js), `__dirname` points to the source file location, not a compiled output, making filter loading unreliable in tests. The plan's test guidance says "create a small test filter string rather than loading full EasyList" but provides no mechanism to inject it.
- **Fix:** Constructor does NOT auto-load (no side-effects on construction). Added `loadTestFilters(text: string)` for unit tests, `loadFilterLists()` for production use called explicitly from main process setup.
- **Files modified:** `animecix-v2/src/network/ad-blocker.ts`
- **Commit:** part of `a0a2f91`

## Known Stubs

None — all exported functions are fully implemented with real behavior.

## Threat Flags

No new security surface beyond what the threat model covers. All network endpoints handled are pre-existing (tau-video.xyz CDN, animecix.tv).

## Self-Check: PASSED

Files verified:
- `animecix-v2/src/network/header-rules.ts` — FOUND
- `animecix-v2/src/network/header-rewriter.ts` — FOUND
- `animecix-v2/src/network/ad-blocker.ts` — FOUND
- `animecix-v2/src/network/request-handler.ts` — FOUND
- `animecix-v2/src/network/filter-lists/easylist.txt` — FOUND (89988 lines)
- `animecix-v2/src/network/filter-lists/easyprivacy.txt` — FOUND (56052 lines)

Commits verified: `948837f`, `a0a2f91`, `7db9fa9`, `b5c3345`
