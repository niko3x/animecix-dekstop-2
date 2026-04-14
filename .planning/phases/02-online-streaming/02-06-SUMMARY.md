---
phase: 02-online-streaming
plan: 06
subsystem: player-page
tags: [vidstack, react, jassub, postmessage, hls, mp4, subtitles, vite]
dependency_graph:
  requires:
    - 01-foundation (StorageService, Electron Forge setup)
  provides:
    - animecix-v2/src/player-page/ (full player React app)
    - animecix-v2/assets/player/ (built output for tau-protocol.ts)
    - animecix-v2/vite.player.config.mts (secondary Vite build)
  affects:
    - 02-07 (tau-protocol.ts will serve assets/player/)
tech_stack:
  added:
    - react@19 + react-dom@19
    - "@vidstack/react@1.12.13"
    - hls.js@1.6
    - jassub@2.4.2 (ASS subtitle renderer)
    - colorthief@3.3 (dominant color extraction)
    - "@vitejs/plugin-react@5.2 (Vite 5 compatible, ESM-only — config must use .mts)"
  patterns:
    - postMessage protocol to animecix.tv (SITE_URL target origin)
    - localStorage as fast subtitle default, captionsChanged postMessage for SQLite sync via animecix.tv bridge
    - jassub externalized in rollup (IIFE format incompatible with code-splitting)
    - vite.player.config.mts (ESM extension required — @vitejs/plugin-react is ESM-only)
key_files:
  created:
    - animecix-v2/src/player-page/types.ts
    - animecix-v2/src/player-page/hooks/useParentMessages.ts
    - animecix-v2/src/player-page/hooks/useVideoData.ts
    - animecix-v2/src/player-page/hooks/useColorExtraction.ts
    - animecix-v2/src/player-page/components/translations.ts
    - animecix-v2/src/player-page/components/SkipButton.tsx
    - animecix-v2/src/player-page/components/NavigationButtons.tsx
    - animecix-v2/src/player-page/components/EmbedPlayer.tsx
    - animecix-v2/src/player-page/components/EmbedPlayer.css
    - animecix-v2/src/player-page/App.tsx
    - animecix-v2/src/player-page/main.tsx
    - animecix-v2/src/player-page/index.html
    - animecix-v2/src/player-page/public/jassub/jassub-worker.js
    - animecix-v2/src/player-page/public/jassub/jassub-worker.wasm
    - animecix-v2/src/player-page/public/jassub/default.woff2
    - animecix-v2/vite.player.config.mts
    - animecix-v2/.gitignore
  modified:
    - animecix-v2/package.json (added deps + build:player script)
    - animecix-v2/forge.config.ts (added extraResource: assets/player)
decisions:
  - "@vitejs/plugin-react@5.x is ESM-only and requires .mts config extension under Vite 5 — plan spec said .ts but .mts is required for correctness"
  - "jassub externalized from rollup bundle (its internal IIFE worker format conflicts with Vite code-splitting) — worker served from public/jassub/ static assets instead"
  - "react@19 used instead of react@18 — @vidstack/react@1.12+ supports both; tau-website uses react@18 but the built-in player is independent"
  - "useRef<(() => void) | undefined>(undefined) required over useRef<() => void>() — @types/react@19 made initial value mandatory"
metrics:
  duration: 25min
  completed_date: "2026-04-12"
  tasks_completed: 2
  files_created: 17
  files_modified: 2
---

# Phase 02 Plan 06: Built-in Vidstack Player Page Summary

Built a complete self-contained React + Vidstack player page inside `animecix-v2/src/player-page/` with full postMessage protocol parity with tau-website, JASSUB ASS subtitles, skip/navigation buttons, Turkish UI, and a secondary Vite build outputting to `assets/player/`.

## What Was Built

### Task 1: Player Page Types and Hooks

- **`types.ts`**: `Video`, `SkipMeta`, and `PlayerSource` (dual source for Phase 3 offline) interfaces
- **`useParentMessages.ts`**: Full postMessage protocol — handles all 16 incoming message types (pong, seek, play, pause, toggle, fullscreenToggle/Enter/Exit, title, changeSub, skipForward/Backward, mute, volumeUp/Down, navigationInfo, changeVideo, captions). Sends ping (5s), currentTime (5s), currentTimeQuick (1s) intervals. Exports `postToParent` helper.
- **`useVideoData.ts`**: Fetches video data from `tau-video.xyz/api/video/{id}` and skip markers from `tau-video.xyz/api/most-sought/{slug}`, with fetch cancellation via ref.
- **`useColorExtraction.ts`**: Canvas-based dominant color extraction via colorthief, gated on `deviceMemory > 4`, sends `dominantColor` postMessage to parent.

### Task 2: Components, Entry Point, and Vite Build

- **`EmbedPlayer.tsx`**: Main component with Vidstack `MediaPlayer`, HLS (`application/x-mpegurl`) and MP4 multi-quality (`video/mp4`) source building, JASSUB `LibASSTextRenderer` registration, subtitle tracks with Turkish language names, skip/nav button rendering, canvas color extraction, and all event handlers (canPlay, ended, play, pause).
- **Subtitle preference architecture**: `localStorage.getItem('prefered_language')` as fast default on first render; `changeSub` postMessage from parent applies SQLite-loaded preference and updates localStorage cache; `mode-change` event sends `captionsChanged` postMessage so animecix.tv can persist to SQLite via IPC.
- **`SkipButton.tsx`**: Shows "Bu Kısmı Atla" when `currentTime` is within a skip window.
- **`NavigationButtons.tsx`**: Prev/next buttons visible only in fullscreen.
- **`translations.ts`**: Complete Turkish UI strings for Vidstack DefaultVideoLayout.
- **`vite.player.config.mts`**: Secondary Vite build — root at `src/player-page/`, base `./` (relative URLs for tau-player:// protocol), outDir `assets/player/`, jassub externalized.
- **Build result**: `assets/player/index.html` + JS/CSS chunks + `assets/player/jassub/` worker and WASM files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @vitejs/plugin-react ESM-only requires .mts config extension**
- **Found during:** Task 2 build
- **Issue:** `@vitejs/plugin-react@5.x` is ESM-only. The Electron Forge Vite plugin loads configs via esbuild in CJS mode. Using `.ts` extension caused "ESM file cannot be loaded by require" error.
- **Fix:** Renamed config to `vite.player.config.mts` and updated `build:player` script accordingly. The `.mts` extension signals to esbuild/Node to treat the file as ESM.
- **Files modified:** `vite.player.config.mts` (renamed from `.ts`), `package.json` (script updated)
- **Commit:** c0722b4

**2. [Rule 3 - Blocking] jassub IIFE worker conflicts with Vite code-splitting**
- **Found during:** Task 2 build
- **Issue:** `jassub`'s internal bundling uses IIFE format which is incompatible with Rollup code-splitting builds.
- **Fix:** Added `external: ['jassub']` to rollup options and `optimizeDeps: { exclude: ['jassub'] }` in Vite config. The JASSUB worker and WASM are already served as static assets from `public/jassub/` — only the dynamic `import('jassub')` for the LibASSTextRenderer factory needs the package, and externalizing it means it won't be bundled.
- **Files modified:** `vite.player.config.mts`
- **Commit:** c0722b4

**3. [Rule 1 - Bug] useRef initial value required in @types/react@19**
- **Found during:** Task 1 typecheck
- **Issue:** `useRef<() => void>()` — `@types/react@19` made the initial value argument mandatory for useRef.
- **Fix:** Changed to `useRef<(() => void) | undefined>(undefined)`.
- **Files modified:** `src/player-page/hooks/useVideoData.ts`
- **Commit:** e02b1cd

**4. [Rule 2 - Missing] react@18 vs @vidstack/react peer dependency conflict**
- **Found during:** Task 1 npm install
- **Issue:** Installing `react@19` + `@vidstack/react@0.6.15` (the version tau-website uses) caused peer dependency conflict — that version only supports React 18.
- **Fix:** Upgraded `@vidstack/react` to `^1.12.13` which supports both React 18 and 19. The API surface used (MediaPlayer, MediaProvider, Track, LibASSTextRenderer, DefaultVideoLayout, hooks) is identical between versions.
- **Commits:** e02b1cd

## Known Stubs

None. All features are fully wired:
- Video data fetched from real tau-video.xyz API
- JASSUB worker served from real static files
- postMessage protocol fully implemented
- Subtitle preference properly flows through localStorage cache + captionsChanged postMessage

## Threat Flags

No new threat surface introduced beyond what the plan's threat model already covers.

## Self-Check: PASSED

All key files verified present on disk. Both task commits (e02b1cd, c0722b4) exist in git history. No useElectronIPC file created. Build output at assets/player/ confirmed.
