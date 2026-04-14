---
phase: 02-online-streaming
plan: 03
subsystem: auth, storage
tags: [deep-link, sqlite, subtitle-preferences, security, tdd]
dependency_graph:
  requires: [02-01]
  provides: [deep-link-protocol, subtitle-pref-storage]
  affects: [animecix-v2/src/main.ts, tau-website player integration]
tech_stack:
  added: []
  patterns: [TDD red-green, better-sqlite3 in-memory test DB, pure function security validation]
key_files:
  created:
    - animecix-v2/src/auth/deep-link.ts
  modified:
    - animecix-v2/src/storage/schema.ts
    - animecix-v2/src/storage/StorageService.ts
    - animecix-v2/tests/storage/subtitle-prefs.test.ts
    - animecix-v2/tests/auth/deep-link.test.ts
decisions:
  - "Tests use better-sqlite3 in-memory DB directly (not StorageService mock) to avoid Electron app.getPath dependency in vitest/Node environment"
  - "parseDeepLinkUrl rejects data with '..' or '/' to prevent path traversal in callback URL construction"
  - "buildCallbackUrl independently validates data — defense in depth against T-02-07"
  - "handleDeepLink is the only function that calls loadURL — all navigation goes through validated URL"
metrics:
  duration_minutes: 10
  completed_date: "2026-04-12"
  tasks_completed: 2
  files_changed: 5
---

# Phase 02 Plan 03: Deep Link Auth and Subtitle Preference Storage Summary

**One-liner:** animecix:// deep link protocol with path-traversal-safe URL parsing and per-anime subtitle preference storage in SQLite with Turkish default.

## What Was Built

### Task 1: Subtitle Preference Storage (TDD)

Extended the SQLite schema and StorageService to persist per-anime subtitle language preferences.

**Schema change** (`animecix-v2/src/storage/schema.ts`): Added `subtitle_prefs` table with `anime_id TEXT PRIMARY KEY`, `language TEXT NOT NULL DEFAULT 'tr'`, and `updated_at INTEGER`.

**StorageService methods** (`animecix-v2/src/storage/StorageService.ts`):
- `getSubtitlePref(animeId)` — SELECT with fallback to `'tr'` for unknown anime
- `setSubtitlePref(animeId, language)` — INSERT OR REPLACE with `unixepoch()` timestamp

**Tests** (`animecix-v2/tests/storage/subtitle-prefs.test.ts`): 4 tests using better-sqlite3 in-memory DB with INIT_SCHEMA — no Electron dependency. Tests verify table creation, default return, store/retrieve, and overwrite behavior.

### Task 2: Deep Link Protocol (TDD)

Created `animecix-v2/src/auth/deep-link.ts` implementing the full animecix:// protocol handler.

**Exports:**
- `registerDeepLinkProtocol()` — calls `app.setAsDefaultProtocolClient('animecix')`, dev-mode aware (passes `execPath` + `argv[1]` when `process.defaultApp` is set)
- `parseDeepLinkUrl(url)` — pure function; validates `animecix://` scheme, requires `login` path prefix, parses optional `{status}|{data}` format, rejects data with `..` or `/`
- `buildCallbackUrl(data)` — pure function; constructs `https://animecix.tv/secure/short-login/{data}`, rejects empty/traversal data
- `extractDeepLinkFromArgs(args)` — pure function; finds first `animecix://` arg in argv for cold-start buffering
- `handleDeepLink(url, webContents)` — orchestrates parse + build + `webContents.loadURL()`; returns boolean

**Tests** (`animecix-v2/tests/auth/deep-link.test.ts`): 13 tests covering all pure functions — scheme validation, status/data extraction, traversal rejection, argv scanning.

## Verification Results

```
Test Files  2 passed (2)
     Tests  17 passed (17)
```

Plan acceptance criteria checks:
- `subtitle_prefs` table in schema.ts with `anime_id TEXT PRIMARY KEY` and `DEFAULT 'tr'`: PASS
- `getSubtitlePref` and `setSubtitlePref` in StorageService.ts with `INSERT OR REPLACE INTO subtitle_prefs`: PASS
- `setAsDefaultProtocolClient('animecix')` in deep-link.ts: PASS
- `animecix.tv/secure/short-login/` in deep-link.ts: PASS
- parseDeepLinkUrl rejects non-animecix:// and path traversal: PASS
- buildCallbackUrl rejects `..`: PASS
- extractDeepLinkFromArgs locates animecix:// in argv: PASS

## Threat Model Coverage

All three threats from the plan's threat register are mitigated:

| Threat | Mitigation | Location |
|--------|-----------|----------|
| T-02-06 Spoofing via deep link input | Scheme validation + login-prefix check + data character allowlist | `parseDeepLinkUrl` |
| T-02-07 Tampering via buildCallbackUrl | Rejects `..` and `/` independently; fixed base URL to animecix.tv | `buildCallbackUrl` |
| T-02-08 Tampering via handleDeepLink navigation | Only navigates after both parse and build succeed; hardcoded HTTPS domain | `handleDeepLink` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm dependencies not installed in worktree**
- **Found during:** Task 1 RED phase (vitest run)
- **Issue:** `vitest` and `better-sqlite3` modules not installed — `Cannot find module 'vitest/config'`
- **Fix:** Ran `npm install` then `npm rebuild better-sqlite3 --build-from-source` to recompile native module for Node.js (not Electron ABI) so vitest can run tests without Electron runtime
- **Files modified:** `animecix-v2/node_modules/` (not tracked)

## Known Stubs

None — all functionality is fully implemented with real SQLite storage and pure function logic.

## Threat Flags

None — all new surface is covered by the plan's threat model.

## Self-Check: PASSED

- animecix-v2/src/auth/deep-link.ts: FOUND
- animecix-v2/src/storage/schema.ts: FOUND (subtitle_prefs table)
- animecix-v2/src/storage/StorageService.ts: FOUND (getSubtitlePref, setSubtitlePref)
- animecix-v2/tests/storage/subtitle-prefs.test.ts: FOUND (4 tests passing)
- animecix-v2/tests/auth/deep-link.test.ts: FOUND (13 tests passing)
- Commits: d446cc4, 27860dd, 621342d, 6c2bf36 — all present
