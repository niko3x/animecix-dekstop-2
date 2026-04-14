---
phase: 03-downloads-and-offline
plan: 02
subsystem: offline-protocol
tags: [electron, custom-protocol, security, offline-playback, path-traversal]
dependency_graph:
  requires:
    - 03-01 (StorageService download/cache methods — OfflineStorageService interface)
  provides:
    - animecix-offline:// protocol handler for renderer/player use
  affects:
    - animecix-v2/src/main.ts (must call registerOfflineProtocol after app.ready)
tech_stack:
  added: []
  patterns:
    - Custom Electron protocol with stream privilege (mirrors tau-protocol.ts)
    - Pure function extraction for testability without Electron
    - Interface segregation: OfflineStorageService decouples from concrete StorageService
key_files:
  created:
    - animecix-v2/src/offline/offline-protocol.ts
    - animecix-v2/tests/offline/offline-protocol.test.ts
  modified: []
decisions:
  - Used OfflineStorageService interface instead of importing StorageService directly — allows plan 02 to compile/test independently of plan 01's changes
  - File paths come from the database (outputPath/mp4Path), never from URL — database is the primary security gate, path check is defense in depth
  - Sub-URL convention for downloads: {mp4-basename}.{lang}.ass alongside the MP4 file
metrics:
  duration_minutes: 15
  completed_date: "2026-04-13"
  tasks_completed: 1
  files_created: 2
  files_modified: 0
---

# Phase 3 Plan 02: animecix-offline:// Protocol Handler Summary

**One-liner:** animecix-offline:// Electron custom protocol with stream privilege, path traversal protection, and dual-source lookup (downloads + cache) for offline video and subtitle playback.

## What Was Built

A custom Electron protocol handler that enables the tau-website player to load locally stored video and subtitle files via the `animecix-offline://` scheme.

### Key Components

**`animecix-v2/src/offline/offline-protocol.ts`**

- Top-level scheme registration (runs at import time, before `app.ready`) with `stream: true` privilege required for video streaming
- `parseOfflineUrl(url)` — parses `animecix-offline://episode/{id}/video` and `animecix-offline://episode/{id}/sub/{lang}` URL patterns; returns null for invalid patterns
- `resolveOfflinePath(relativePath, basePath)` — path traversal protection (decodes URI, resolves to absolute, checks prefix against basePath + sep); mirrors `resolveAssetPath` from `tau-protocol.ts`
- `getOfflineMimeType(ext)` — MIME types for `.mp4`, `.ts`, `.ass`, `.srt`, `.vtt`, `.json`
- `registerOfflineProtocol(downloadsDir, cacheDir, storage)` — Electron `protocol.handle` that:
  1. Looks up completed downloads first (via `storage.getDownloadById`)
  2. Falls back to cache entries (via `storage.getCacheEntry`)
  3. Returns 404 if episode not found in either store
  4. Validates resolved file path is within `downloadsDir` or `cacheDir` (defense in depth)
  5. Serves file via `net.fetch(fileUrl)` with correct Content-Type

**`animecix-v2/tests/offline/offline-protocol.test.ts`**

21 unit tests covering all pure functions:
- `resolveOfflinePath`: valid paths, unencoded traversal, URL-encoded traversal (`%2e%2e%2f`), invalid URI
- `parseOfflineUrl`: video URL, subtitle URL with language, missing segments, invalid host
- `getOfflineMimeType`: all 6 MIME types + unknown fallback
- `registerOfflineProtocol`: exported as function (Electron-free check)

## Threat Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-03-06: Path traversal via URL | `parseOfflineUrl` rejects non-episode patterns; `resolveOfflinePath` blocks `../` and `%2e%2e%2f` |
| T-03-07: Protocol serving arbitrary files | Double validation: episodeId lookup in SQLite + resolved path must start with downloadsDir or cacheDir |
| T-03-08: Malicious episodeId with path components | episodeId used as SQLite lookup key only; file path comes from stored `outputPath`/`mp4Path` columns |

## Deviations from Plan

**1. [Rule 2 - Missing Critical Functionality] Added OfflineStorageService interface**

- **Found during:** Task 1 implementation
- **Issue:** Plan specified importing from `StorageService` directly, but plan 02 runs in wave 1 alongside plan 01 (which adds download/cache methods). Direct import would cause compile failure before plan 01 runs.
- **Fix:** Introduced `OfflineStorageService` interface with just the two methods needed (`getDownloadById`, `getCacheEntry`). `StorageService` will satisfy this interface structurally when plan 01 completes. No changes to any other files.
- **Files modified:** `animecix-v2/src/offline/offline-protocol.ts` (interface added inline)

## Known Stubs

None — all functions are fully implemented. The `registerOfflineProtocol` function depends on `StorageService` methods added by plan 01; that dependency is typed via the `OfflineStorageService` interface.

## Self-Check: PASSED

- `animecix-v2/src/offline/offline-protocol.ts` — FOUND
- `animecix-v2/tests/offline/offline-protocol.test.ts` — FOUND
- Commit `363942e` — FOUND
- All 21 tests pass
- All 7 acceptance criteria verified
