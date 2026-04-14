---
phase: 02-online-streaming
plan: 01
subsystem: player
tags: [protocol-handler, security, test-scaffolds, tdd]
dependency_graph:
  requires: []
  provides:
    - tau-player:// custom protocol handler (path-traversal-safe)
    - abp-filter-parser TypeScript type declarations
    - Wave 0 test scaffolds for Phase 2 plans 02-05
  affects:
    - animecix-v2/src/main.ts (must import tau-protocol.ts before app.ready)
tech_stack:
  added: []
  patterns:
    - Pure function extraction for testability (resolveAssetPath, getMimeType are Electron-free)
    - Lazy require('electron') guard to allow vitest to import without Electron runtime
    - TDD: RED (failing tests) -> GREEN (implementation) -> verified
key_files:
  created:
    - animecix-v2/src/player/tau-protocol.ts
    - animecix-v2/src/types/abp-filter-parser.d.ts
    - animecix-v2/tests/player/tau-protocol.test.ts
    - animecix-v2/tests/player/iframe-intercept.test.ts
    - animecix-v2/tests/network/header-rewriter.test.ts
    - animecix-v2/tests/network/ad-blocker.test.ts
    - animecix-v2/tests/auth/deep-link.test.ts
    - animecix-v2/tests/integrations/discord-rpc.test.ts
    - animecix-v2/tests/storage/subtitle-prefs.test.ts
  modified: []
decisions:
  - Electron module imported lazily via require() inside try/catch at module top-level so tests can import tau-protocol.ts without crashing on missing Electron runtime
  - node_modules symlinked from main repo into worktree (worktrees share git history but not node_modules)
metrics:
  duration_minutes: 12
  completed_date: "2026-04-12T10:32:12Z"
  tasks_completed: 2
  files_created: 9
  files_modified: 0
---

# Phase 02 Plan 01: tau-player:// Protocol Handler and Wave 0 Test Scaffolds Summary

**One-liner:** tau-player:// protocol with decodeURIComponent + path.resolve traversal guard serving local tau-website assets, plus 7 Wave 0 test scaffold files for Phase 2.

## What Was Built

### Task 1: tau-player:// Protocol Handler (TDD)

`animecix-v2/src/player/tau-protocol.ts` exports three functions:

- **`resolveAssetPath(pathname, basePath)`** — pure function (no Electron dependency). Decodes URL-encoded characters, maps `/` and empty string to `/index.html`, joins with basePath, then verifies the resolved path starts with `path.resolve(basePath)`. Returns `null` for any path traversal attempt.
- **`getMimeType(ext)`** — pure lookup returning MIME type for `.html`, `.js`, `.css`, `.json`, `.wasm`, `.woff2`, `.png`, `.ico`; defaults to `application/octet-stream`.
- **`registerTauProtocol()`** — called after `app.whenReady()`. Uses `protocol.handle('tau-player', ...)` + `net.fetch(pathToFileURL(...))` to serve files. Returns 403 for traversal attempts, 404 on file errors.

The `registerSchemesAsPrivileged` call is at module top-level (guarded by `try/catch` for non-Electron environments), satisfying Electron's requirement that it runs before `app.ready`.

### Task 2: abp-filter-parser Types and Wave 0 Test Scaffolds

- `animecix-v2/src/types/abp-filter-parser.d.ts` — declares `parse()` and `matches()` with typed `FilterData` and `MatchOptions` interfaces.
- 6 scaffold files with `it.todo()` stubs covering iframe intercept (4), header rewriter (4), ad blocker (4), deep link (4), Discord RPC (5), and subtitle prefs (4) = 25 total stubs.

## Test Results

```
Test Files  1 passed | 12 skipped (13)
     Tests  17 passed | 46 todo (63)
  Duration  ~340ms
```

All 17 tau-protocol tests pass. 46 todo stubs are pending (correct for Wave 0 scaffolds).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Electron protocol not available in vitest environment**
- **Found during:** Task 1 GREEN phase — `protocol.registerSchemesAsPrivileged` threw `TypeError: Cannot read properties of undefined` when vitest imported the module.
- **Issue:** The module-level `protocol.registerSchemesAsPrivileged([...])` call requires Electron runtime, but vitest runs in plain Node.js.
- **Fix:** Wrapped the scheme registration in `try { const { protocol } = require('electron'); if (protocol?.registerSchemesAsPrivileged) { ... } } catch {}`. Also moved the `protocol.handle` call inside `registerTauProtocol()` using the same lazy-require pattern.
- **Files modified:** `animecix-v2/src/player/tau-protocol.ts`
- **Commit:** 1253833

**2. [Rule 3 - Blocking] Worktree has no node_modules**
- **Found during:** Task 1 RED phase — vitest failed with `MODULE_NOT_FOUND` for `vitest/config`.
- **Fix:** Symlinked main repo's node_modules into the worktree: `ln -s .../animecix-v2/node_modules .../worktree/animecix-v2/node_modules`.
- **Impact:** Tests now run correctly in the worktree context.

## Known Stubs

The following stubs are intentional Wave 0 scaffolds — they define expected behaviors for future implementation plans:

| File | Stub count | Resolved by |
|------|-----------|-------------|
| tests/player/iframe-intercept.test.ts | 4 | Plan 02-02 |
| tests/network/header-rewriter.test.ts | 4 | Plan 02-03 |
| tests/network/ad-blocker.test.ts | 4 | Plan 02-03 |
| tests/auth/deep-link.test.ts | 4 | Plan 02-04 |
| tests/integrations/discord-rpc.test.ts | 5 | Plan 02-05 |
| tests/storage/subtitle-prefs.test.ts | 4 | Plan 02-05 |

These stubs are intentional and do not block this plan's goal.

## Threat Model Coverage

Both T-02-01 and T-02-02 mitigations are implemented:

- **T-02-01 (Tampering):** `resolveAssetPath` calls `decodeURIComponent` before `path.resolve`, then verifies result starts with `resolvedBase`. Returns `null` (served as 403) for any path outside `basePath`.
- **T-02-02 (Information Disclosure):** Only files within `assets/tau-website/` are served. `getMimeType` returns `application/octet-stream` for unknown extensions.

## Self-Check: PASSED

Files verified:
- animecix-v2/src/player/tau-protocol.ts: FOUND
- animecix-v2/src/types/abp-filter-parser.d.ts: FOUND
- animecix-v2/tests/player/tau-protocol.test.ts: FOUND
- animecix-v2/tests/player/iframe-intercept.test.ts: FOUND
- animecix-v2/tests/network/header-rewriter.test.ts: FOUND
- animecix-v2/tests/network/ad-blocker.test.ts: FOUND
- animecix-v2/tests/auth/deep-link.test.ts: FOUND
- animecix-v2/tests/integrations/discord-rpc.test.ts: FOUND
- animecix-v2/tests/storage/subtitle-prefs.test.ts: FOUND

Commits verified:
- 594390d (test RED): FOUND
- 1253833 (feat GREEN): FOUND
- 6bb5575 (feat Task 2): FOUND
