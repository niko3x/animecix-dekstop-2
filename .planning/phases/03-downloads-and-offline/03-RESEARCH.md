# Phase 3: Downloads and Offline - Research

**Researched:** 2026-04-13
**Domain:** Electron download engine, streaming cache proxy, offline protocol handler, HLS-to-MP4 muxing, system tray, SQLite schema, IPC bridge extensions
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Native HTTP Range-based multi-threaded downloads — rewrite old Downloader2 using native Node.js `http`/`https` modules. No external download library. 4 parallel Range chunks, merge on completion.
- **D-02:** Download queue persists in SQLite via StorageService — store queue items, per-chunk byte progress, state (queued/downloading/paused/completed/failed). Restart resumes from last byte position.
- **D-03:** Sequential download queue — 1 active download at a time, rest queued.
- **D-04:** 4 threads (parallel Range chunks) per download.
- **D-05:** Transparent proxy cache — intercept HLS `.ts` / MP4 byte ranges in `session.webRequest`, save to disk transparently. No player changes.
- **D-06:** Fixed cache cap with LRU eviction — default 10 GB. User can adjust in settings.
- **D-07:** Separate storage dirs — `Downloads/AnimeciX/` for permanent downloads, `userData/cache/` for evictable streaming cache.
- **D-08:** Custom `animecix-offline://` protocol handler for offline video + subtitle serving. Player receives `animecix-offline://episode-id` URLs via dual source interface.
- **D-09:** Download all available ASS subtitle tracks alongside video — store alongside video file. Player resolves subtitle URLs to local files via same offline protocol.
- **D-10:** HLS streams reassembled into single MP4 for offline — concatenate `.ts` segments after caching. Offline playback uses MP4 via `animecix-offline://`. Simpler than reconstructing HLS playlists.
- **D-11:** Download progress via IPC to website + OS taskbar — send via `window.animecix` IPC bridge + `BrowserWindow.setProgressBar()`.
- **D-12:** System tray on active downloads only — contextual tray: appears when downloads active and user closes window. Tray right-click menu: Show window, Pause all, Cancel all, Quit.
- **D-13:** Desktop notification on download completion — native Electron `Notification` API, Turkish text.
- **D-14:** Storage management via IPC API — total downloads size, total cache size, per-episode sizes, delete operations via `window.animecix` bridge. Website renders storage management UI.

### Claude's Discretion

- SQLite schema design for download queue and cache metadata tables
- Exact chunk merge strategy (sequential write vs temp file assembly)
- Cache index structure and eviction implementation details
- HLS-to-MP4 concatenation approach (ffmpeg binary vs manual TS muxing)
- Protocol handler URL structure for `animecix-offline://`
- Tray icon design and menu wording
- Error handling and retry strategy for failed chunks
- IPC channel naming for download-related events

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DL-01 | User can download videos to disk with multi-threaded download and progress tracking | Native Node.js http/https Range requests, 4 parallel chunks, SQLite progress persistence |
| DL-02 | User can queue multiple downloads with configurable concurrency | Sequential queue in SQLite, 1 active at a time per D-03 |
| DL-03 | Download queue persists across app restarts (SQLite storage) | better-sqlite3 download_queue table, chunk progress columns |
| DL-04 | User can pause and resume downloads (HTTP Range-based) | Persist bytes_downloaded per chunk in SQLite; on resume send Range: bytes=N- |
| DL-05 | User can play downloaded videos offline using tau-website player | animecix-offline:// protocol handler, dual-source PlayerSource interface already scaffolded |
| DL-06 | Offline playback includes ASS subtitle support (subtitles downloaded alongside video) | Subtitle fetch from tau-video.xyz subs[] array, store as .ass files alongside MP4 |
| DL-07 | User receives desktop notifications on download completion | Electron Notification API, pattern in NotificationHelper |
| PLAY-05 | Videos automatically cache to disk as user streams, available for offline rewatch | session.webRequest onBeforeRequest proxy cache with SQLite cache_index |
| INTG-03 | App minimizes to system tray for background downloads | Electron Tray API, contextual tray lifecycle tied to active download state |
| INTG-04 | User can view download storage usage and delete downloaded episodes | IPC API: storageInfo + deleteDownload channels, fs.stat for size computation |
</phase_requirements>

---

## Summary

Phase 3 builds four interconnected systems on top of the existing Electron infrastructure: (1) a native multi-threaded download engine backed by SQLite-persisted state, (2) a transparent streaming cache that captures HLS segments via `session.webRequest` interception and muxes them to MP4, (3) an `animecix-offline://` custom protocol handler that serves local files to the player, and (4) native OS integrations — system tray, taskbar progress, and desktop notifications.

All major decisions are locked in CONTEXT.md. The research phase confirms technical viability: Electron 41 supports the required APIs (`protocol.handle`, `session.webRequest`, `Tray`, `Notification`, `BrowserWindow.setProgressBar`), `ffmpeg` v7.1.1 is available on the host machine, and `better-sqlite3` (already installed, v12.8.0) is sufficient for all persistence needs. No new production dependencies are required beyond an optional `ffmpeg-static` package if a binary bundling strategy is chosen.

The main areas of discretion that need design decisions before implementation are: (a) the SQLite schema for `download_queue` and `cache_index`, (b) the `animecix-offline://` URL format, (c) the HLS-to-MP4 concatenation strategy (system ffmpeg vs bundled binary), and (d) the chunk merge strategy.

**Primary recommendation:** Implement the download engine and offline protocol handler first (DL-01 through DL-06, PLAY-05), then layer the tray/notifications/storage-management UI (DL-07, INTG-03, INTG-04) as later waves within the phase.

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `better-sqlite3` | 12.8.0 [VERIFIED: npm view] | Download queue + cache index persistence | Already used in StorageService; synchronous API simplifies queue state machine |
| `electron` | 41.2.0 [VERIFIED: package.json] | `protocol.handle`, `session.webRequest`, `Tray`, `Notification`, `setProgressBar` | Core platform |
| Node.js `http`/`https` | built-in (Node 22.20.0) [VERIFIED: node --version] | Range-based chunk downloads | No external dependency per D-01 |
| Node.js `fs` / `fs/promises` | built-in | Chunk temp files, merge, subtitle storage, cache files | Standard; Streams API handles large file assembly |
| `ffmpeg` (system binary) | 7.1.1 [VERIFIED: ffmpeg -version] | HLS `.ts` → MP4 concatenation | Available on dev machine; discretion item — bundling strategy TBD |

### Supporting (discretion — may add)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ffmpeg-static` | ~5.2.0 | Bundles ffmpeg binary in packaged app | If team decides to bundle instead of requiring system ffmpeg |
| `electron-log` | ~5.x | Structured logging for download engine | If download debugging becomes complex — not required |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `http`/`https` for downloads | `node-downloader-helper` (used in old app) | Decision D-01 locks native; avoids unmaintained external dep with rejectUnauthorized bypass |
| System ffmpeg (or bundled) | Manual TS concatenation (no ffmpeg) | Manual TS byte-concatenation works for MPEG-TS container but may fail on segment boundary alignment; ffmpeg is safer |
| `session.webRequest` proxy cache | Service Worker cache | Service Workers cannot intercept `tau-player://` custom protocol requests; `webRequest` runs in main process — correct approach |

**Installation — nothing new required for MVP:**
```bash
# Only add if bundling ffmpeg:
npm install ffmpeg-static
# No other new prod dependencies
```

---

## Architecture Patterns

### Recommended Project Structure

```
animecix-v2/src/
├── download/
│   ├── Downloader.ts          # Native Range-based multi-threaded downloader
│   ├── DownloadQueue.ts       # Sequential queue + SQLite state machine
│   ├── download.ipc.ts        # ipcMain handlers for download:* channels
│   └── download.types.ts      # DownloadQueueItem, ChunkState interfaces
├── cache/
│   ├── StreamCache.ts         # session.webRequest intercept, disk write, cache_index
│   ├── CacheEvictor.ts        # LRU eviction against D-06 cap
│   └── HlsMuxer.ts            # ffmpeg-based TS → MP4 assembly
├── offline/
│   └── offline-protocol.ts    # animecix-offline:// handler (mirrors tau-protocol.ts pattern)
├── storage/
│   ├── StorageService.ts      # EXTEND: add download/cache table methods
│   └── schema.ts              # EXTEND: download_queue, cache_index tables
├── preload.ts                 # EXTEND: expose download/cache/storage channels
└── types/
    └── animecix-api.d.ts      # EXTEND: AnimecixAPI download/cache/storage methods
```

### Pattern 1: Native Range-Based Chunked Downloader

**What:** Split file into N byte ranges, issue parallel `https.get` requests with `Range: bytes=start-end` header, write each chunk to a temp file, then sequentially append to final output file.

**When to use:** Always for downloads per D-01/D-04.

**Resumability:** On restart, read `bytes_downloaded` for each chunk from SQLite. If chunk is incomplete, send `Range: bytes=bytes_downloaded-end`. If complete, skip download and go straight to merge.

**Example pattern (adapted from old Downloader2 with native http):**
```typescript
// Source: animecix-desktop/modules/downloader.ts (ported to native https)
import https from 'node:https';
import fs from 'node:fs';

interface ChunkState {
  id: number;
  start: number;
  end: number;
  bytesDownloaded: number; // persisted in SQLite
  tempPath: string;
}

async function downloadChunk(url: string, chunk: ChunkState, onProgress: (bytes: number) => void): Promise<void> {
  const resumeFrom = chunk.start + chunk.bytesDownloaded;
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { Range: `bytes=${resumeFrom}-${chunk.end}` }
    }, (res) => {
      const stream = fs.createWriteStream(chunk.tempPath, { flags: 'a' });
      res.on('data', (buf: Buffer) => {
        chunk.bytesDownloaded += buf.length;
        onProgress(buf.length);
        // persist to SQLite every N bytes for crash safety
      });
      res.pipe(stream);
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
    req.on('error', reject);
  });
}
```

**Key difference from old app:** Persists `bytes_downloaded` per chunk to SQLite every ~1 MB (configurable) so a crash mid-chunk means at most 1 MB of re-download, not the entire chunk.

### Pattern 2: SQLite Schema — Download Queue and Cache Index

**Design (Claude's Discretion — recommended):**

```sql
-- download_queue: one row per download item
CREATE TABLE IF NOT EXISTS download_queue (
  id          TEXT PRIMARY KEY NOT NULL,   -- episode_id or guid
  episode_id  TEXT NOT NULL,
  title       TEXT NOT NULL,               -- display name
  url         TEXT NOT NULL,               -- source URL (MP4 or HLS playlist)
  sub_urls    TEXT NOT NULL DEFAULT '[]',  -- JSON array of {language, url}
  output_path TEXT NOT NULL,               -- final merged file path
  total_bytes INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'queued', -- queued|downloading|paused|completed|failed
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- download_chunks: 4 rows per download item (one per Range chunk)
CREATE TABLE IF NOT EXISTS download_chunks (
  download_id      TEXT NOT NULL REFERENCES download_queue(id) ON DELETE CASCADE,
  chunk_index      INTEGER NOT NULL,
  byte_start       INTEGER NOT NULL,
  byte_end         INTEGER NOT NULL,
  bytes_downloaded INTEGER NOT NULL DEFAULT 0,
  temp_path        TEXT NOT NULL,
  completed        INTEGER NOT NULL DEFAULT 0,  -- boolean
  PRIMARY KEY (download_id, chunk_index)
);

-- cache_index: one row per cached episode
CREATE TABLE IF NOT EXISTS cache_index (
  episode_id    TEXT PRIMARY KEY NOT NULL,
  mp4_path      TEXT NOT NULL,
  sub_paths     TEXT NOT NULL DEFAULT '[]',  -- JSON: [{language, path}]
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  last_accessed INTEGER NOT NULL DEFAULT (unixepoch()),
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
```

**LRU eviction:** ORDER BY `last_accessed ASC` until total bytes under cap. Update `last_accessed` on every offline playback start.

### Pattern 3: animecix-offline:// Protocol Handler

**What:** Mirrors `tau-protocol.ts` exactly but resolves to the downloads or cache directory instead of the player assets directory.

**URL format (recommended):**
```
animecix-offline://episode/{episode_id}/video        → MP4 file
animecix-offline://episode/{episode_id}/sub/{lang}   → .ass subtitle file
```

**Registration** (must happen at module top-level before `app.ready`, same as `tau-protocol.ts`):
```typescript
// Source: animecix-v2/src/player/tau-protocol.ts — mirror this pattern exactly
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'animecix-offline',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,   // REQUIRED for video streaming
      bypassCSP: true,
    },
  },
]);
```

**Handler** returns `net.fetch(pathToFileURL(resolvedPath).toString())` — same as `tau-protocol.ts`.

**Path traversal protection:** Apply same `resolveAssetPath`-style validation — resolved path must start with the storage root.

### Pattern 4: session.webRequest Streaming Cache

**What:** Extend `setupRequestInterception` in `request-handler.ts` to add a 5th check before the pass-through: detect HLS segment (.ts) and MP4 byte-range requests for tau-video.xyz, tee the response body to disk, and record in `cache_index`.

**Critical constraint:** Electron's `onBeforeRequest` only allows redirect or cancel, NOT response body interception. To tee response bodies, use `session.webRequest.onCompleted` (fires after response) paired with downloading the segment separately — **or** use `protocol.registerStreamProtocol` for the tau-player domain to proxy the request and tee in-flight.

**Recommended approach (simpler):** Use `session.webRequest.onCompleted` to detect when a video segment has been served to the renderer. On completion, trigger a background fetch in the main process to re-download the same segment to disk. This is "lazy caching" — slightly less efficient (2x bandwidth for first watch) but avoids complex response body tapping.

**Alternative (correct streaming tee):** Use `session.webRequest.onHeadersReceived` to detect segment requests, then in a separate `net.fetch` call within the handler, stream to disk and to a local pipe simultaneously. More complex but only fetches once. [ASSUMED] — needs prototype to confirm feasibility within Electron's `webRequest` API surface.

**Simpler fallback per D-10:** Since offline requires single MP4 anyway, the cache strategy can be: when the player finishes an episode (detected via IPC playback-complete event), trigger a background full-download of that episode to `userData/cache/`. This avoids segment interception entirely. Website sends `episode:watched` IPC → main process queues background MP4 download → adds to `cache_index` on completion.

### Pattern 5: HLS-to-MP4 Concatenation (ffmpeg)

**What:** After all HLS `.ts` segments are saved, run ffmpeg to concatenate into MP4.

**ffmpeg command (concat demuxer — no re-encode):**
```bash
# Create concat file list
echo "file 'seg0.ts'\nfile 'seg1.ts'\n..." > concat.txt
# Remux to MP4 (fast, no re-encode)
ffmpeg -f concat -safe 0 -i concat.txt -c copy -movflags faststart output.mp4
```

**From Node.js (using child_process):**
```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);

await execFileAsync(ffmpegPath, [
  '-f', 'concat', '-safe', '0', '-i', concatListPath,
  '-c', 'copy', '-movflags', 'faststart',
  outputMp4Path
]);
```

**ffmpeg binary path:** In dev, use system `ffmpeg` (confirmed available at `/opt/homebrew/bin/ffmpeg`). In packaged app, either require ffmpeg-static or document that users need ffmpeg. [ASSUMED] — final bundling strategy is Claude's discretion.

**Manual TS concatenation (no ffmpeg fallback):** For MPEG-TS, simple byte concatenation works IF all segments are from the same stream. `fs.createWriteStream` with `flags: 'a'` appending each `.ts` in order. Simpler but less reliable for malformed segments. [ASSUMED] — viability depends on actual HLS stream structure from tau-video.xyz.

### Pattern 6: System Tray (Electron Tray API)

**What:** Contextual tray — created when downloads become active and user closes window. Destroyed when downloads complete/all cancelled and window is shown again.

```typescript
// Source: Electron docs [CITED: electronjs.org/docs/latest/api/tray]
import { Tray, Menu, app } from 'electron';

let tray: Tray | null = null;

function createTray(iconPath: string, mainWindow: BrowserWindow): void {
  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Göster', click: () => { mainWindow.show(); destroyTray(); } },
    { label: 'Tümünü Duraklat', click: () => pauseAllDownloads() },
    { label: 'Tümünü İptal Et', click: () => cancelAllDownloads() },
    { type: 'separator' },
    { label: 'Çıkış', click: () => app.quit() },
  ]);
  tray.setToolTip('AnimeciX — İndirme devam ediyor');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { mainWindow.show(); destroyTray(); });
}

function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
```

**Window close intercept:** In `WindowService.ts`, add `win.on('close', ...)` handler that calls `event.preventDefault()` and minimizes to tray when downloads are active. The `DownloadQueue` singleton must be accessible from `WindowService` (dependency injection via constructor or module-level singleton).

### Anti-Patterns to Avoid

- **rejectUnauthorized: false** — The old `Downloader2` used this. NEVER do this in v2 (AUTH-02 is locked). All `https.get` calls must use default TLS validation.
- **In-memory queue only** — Old app had no persistence. Phase 3 requires every queue mutation to be written to SQLite synchronously (better-sqlite3 is sync, so no async batching risk).
- **Replacing `onBeforeRequest` handler** — The existing handler is the single registration point (see comment in `request-handler.ts`). Phase 3 MUST extend it in-place, not call `onBeforeRequest` again (Electron replaces on each call).
- **Tray icon always present** — Tray must be contextual (D-12). Creating it at app startup and hiding it is wrong; create and destroy dynamically.
- **HLS playlist URLs in cache_index** — Cache should store the final MP4 path, not the HLS playlist URL. The HLS playlist is ephemeral; only the assembled MP4 matters for offline.
- **ffmpeg blocking the main process** — Run ffmpeg via `child_process.execFile` in a background worker or with `spawn` and non-blocking stdio. Never `execFileSync` for large files.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TLS/HTTPS | Custom HTTP client | Node.js built-in `https` module | Correct TLS, no `rejectUnauthorized: false` |
| SQLite | Custom file-based queue | `better-sqlite3` (already installed) | ACID, crash-safe, already used |
| HLS→MP4 muxing | TS segment byte-concatenation | ffmpeg (available on system) | Handles segment boundary issues, metadata, moov atom placement |
| Path traversal protection | Custom regex | Port `resolveAssetPath` from `tau-protocol.ts` | Already correct and tested |
| OS notifications | Custom tray balloon / toast | Electron `Notification` API | Cross-platform, uses native OS notification center |
| File size computation | Recursive custom walker | `fs.stat` + SQLite `size_bytes` column | Size tracked at write time; no scan needed |

**Key insight:** The old codebase (`Downloader2`) used three external dependencies (axios, node-downloader-helper, and disabled TLS). Phase 3 replaces all three with zero new production dependencies, using only Node.js built-ins + already-installed `better-sqlite3` + system ffmpeg.

---

## Common Pitfalls

### Pitfall 1: Electron onBeforeRequest Replacement

**What goes wrong:** Calling `session.defaultSession.webRequest.onBeforeRequest(...)` a second time silently replaces the first handler. Phase 2 already registers one handler in `request-handler.ts`.

**Why it happens:** Electron's `webRequest` API is not additive — each call to `onBeforeRequest` replaces the previous listener.

**How to avoid:** Phase 3 must extend `setupRequestInterception` in `request-handler.ts` with cache-check logic, not register a new handler in a separate module.

**Warning signs:** Video segments stop being cached AND ad blocking stops working simultaneously — both symptoms of handler replacement.

### Pitfall 2: Chunk Merge Order (Old App Bug)

**What goes wrong:** The old `Downloader2.checkWrite()` used a `createWriteStream` with `flags: 'a'` (append) and relied on sequential chaining (`thread.id == 0 || this.threads[thread.id - 1].writeFinished`). If any chunk's "close" event fires late, the append order can corrupt the file.

**Why it happens:** Async event timing; multiple WriteStream appends are not guaranteed to complete in order unless explicitly serialized.

**How to avoid:** Write all chunks to separate temp files (e.g., `episode__0.part`, `episode__1.part`), then merge in a single sequential pass: open final output stream once, pipe chunk 0 → chunk 1 → chunk 2 → chunk 3 in a promise chain, then close.

**Implementation:**
```typescript
async function mergeChunks(chunks: ChunkState[], outputPath: string): Promise<void> {
  const output = fs.createWriteStream(outputPath);
  for (const chunk of chunks.sort((a, b) => a.id - b.id)) {
    await new Promise<void>((resolve, reject) => {
      const input = fs.createReadStream(chunk.tempPath);
      input.pipe(output, { end: false });
      input.on('end', resolve);
      input.on('error', reject);
    });
    fs.unlinkSync(chunk.tempPath);
  }
  output.end();
}
```

### Pitfall 3: animecix-offline:// scheme not registered before app.ready

**What goes wrong:** `protocol.registerSchemesAsPrivileged` must be called before `app.ready`. If the offline protocol module is imported lazily (after `app.whenReady()` resolves), the scheme won't have `stream: true` privilege and video will not stream.

**Why it happens:** Electron enforces scheme privilege registration at startup.

**How to avoid:** Import `./offline/offline-protocol` as a side-effect import in `main.ts` BEFORE `app.whenReady()`, exactly as `tau-protocol.ts` is already imported. The `registerOfflineProtocol()` function call itself can be inside `whenReady`, but the `registerSchemesAsPrivileged` call must run at module load time.

### Pitfall 4: SQLite better-sqlite3 is Synchronous — Don't Call from Renderer

**What goes wrong:** `better-sqlite3` is intentionally synchronous. It cannot be called from a renderer process (web context). All StorageService calls must be in the main process only, accessed by renderer via IPC.

**Why it happens:** This is already enforced in Phase 1/2, but Phase 3 adds many new IPC channels. Any attempt to import StorageService in preload.ts directly would fail.

**How to avoid:** All download/cache/storage IPC handlers are registered in `main.ts` (or a `download.ipc.ts` module imported by main). Preload only wraps `ipcRenderer.invoke/send`.

### Pitfall 5: HLS Segment URL Pattern Matching

**What goes wrong:** The cache proxy in `session.webRequest` needs to identify HLS `.ts` segments vs. other requests. tau-video.xyz CDN segment URLs may not follow a predictable pattern.

**Why it happens:** HLS CDN URLs often have tokens, timestamps, and non-obvious paths.

**How to avoid:** Inspect actual tau-video.xyz HLS URLs during Phase 3 implementation. Pattern-match on content-type (`video/mp2t` or `video/MP2T`) from `onCompleted` details rather than URL extension. Also consider matching the HLS playlist URL domain + `.ts` extension as a heuristic.

### Pitfall 6: ffmpeg Not Available in Packaged App

**What goes wrong:** System ffmpeg works in dev but packaged `.app` / `.exe` doesn't bundle it, so HLS→MP4 muxing fails silently for end users.

**Why it happens:** `extraResources` in Forge config is required to bundle system binaries.

**How to avoid (two options):**
1. Add `ffmpeg-static` npm package — provides a pre-built binary, reference via `require('ffmpeg-static')` for the path.
2. Add system ffmpeg as `extraResource` in `forge.config.ts` — copies from local system (not portable across machines).

**Recommendation:** Use `ffmpeg-static` for portability. [ASSUMED]

### Pitfall 7: Tray Icon Path in Packaged App

**What goes wrong:** Tray icon path resolved via `__dirname` or `app.getAppPath()` in dev breaks in packaged mode because asar changes the virtual filesystem structure.

**How to avoid:** Use `process.resourcesPath` for packaged mode, same pattern already used in `registerTauProtocol()`:
```typescript
const iconPath = app.isPackaged
  ? path.join(process.resourcesPath, 'tray-icon.png')
  : path.join(app.getAppPath(), 'assets', 'tray-icon.png');
```

---

## Code Examples

### Extending AnimecixAPI (animecix-api.d.ts additions)

```typescript
// Source: existing pattern in animecix-v2/src/types/animecix-api.d.ts

export interface DownloadQueueItem {
  id: string;
  episodeId: string;
  title: string;
  status: 'queued' | 'downloading' | 'paused' | 'completed' | 'failed';
  progressPercent: number;
  speedBps: number;
  totalBytes: number;
}

export interface StorageInfo {
  downloadsBytes: number;
  cacheBytes: number;
  episodes: { episodeId: string; title: string; sizeBytes: number; isDownload: boolean }[];
}

// Add to AnimecixAPI interface:
// download:* channels
downloadVideo: (episodeId: string, url: string, title: string, subUrls: {language: string; url: string}[]) => Promise<void>;
pauseDownload: (episodeId: string) => Promise<void>;
resumeDownload: (episodeId: string) => Promise<void>;
cancelDownload: (episodeId: string) => Promise<void>;
getDownloadQueue: () => Promise<DownloadQueueItem[]>;
onDownloadProgress: (cb: (item: DownloadQueueItem) => void) => () => void;

// storage:* channels
getStorageInfo: () => Promise<StorageInfo>;
deleteDownload: (episodeId: string) => Promise<void>;
deleteCache: (episodeId: string) => Promise<void>;

// offline:* channels
isAvailableOffline: (episodeId: string) => Promise<boolean>;
getOfflineUrl: (episodeId: string) => Promise<string | null>;  // returns animecix-offline:// URL
```

### Extending preload.ts (IPC wiring pattern)

```typescript
// Source: existing pattern in animecix-v2/src/preload.ts
// Event subscription with unsubscribe — mirrors onFullscreenChange pattern
onDownloadProgress: (cb: (item: DownloadQueueItem) => void) => {
  const handler = (_event: Electron.IpcRendererEvent, item: DownloadQueueItem) => cb(item);
  ipcRenderer.on('download:progress', handler);
  return () => ipcRenderer.removeListener('download:progress', handler);
},

// invoke pattern for async operations
downloadVideo: (episodeId, url, title, subUrls) =>
  ipcRenderer.invoke('download:start', episodeId, url, title, subUrls),
```

### SQLite access pattern for new tables (StorageService extensions)

```typescript
// Source: existing pattern in animecix-v2/src/storage/StorageService.ts
enqueueDownload(item: { id: string; episodeId: string; title: string; url: string; subUrls: string; outputPath: string; totalBytes: number }): void {
  this.db
    .prepare('INSERT OR IGNORE INTO download_queue (id, episode_id, title, url, sub_urls, output_path, total_bytes) VALUES (?,?,?,?,?,?,?)')
    .run(item.id, item.episodeId, item.title, item.url, item.subUrls, item.outputPath, item.totalBytes);
}

updateChunkProgress(downloadId: string, chunkIndex: number, bytesDownloaded: number): void {
  this.db
    .prepare('UPDATE download_chunks SET bytes_downloaded=? WHERE download_id=? AND chunk_index=?')
    .run(bytesDownloaded, downloadId, chunkIndex);
}
```

---

## Runtime State Inventory

> Phase 3 is greenfield feature addition, not a rename/refactor. The relevant inventory is:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | No existing download_queue or cache_index tables in SQLite | CREATE TABLE IF NOT EXISTS in schema.ts extension — idempotent |
| Live service config | None | None |
| OS-registered state | No tray, no notifications registered yet | New Tray instance + Notification created at runtime |
| Secrets/env vars | None related to downloads | None |
| Build artifacts | No stale artifacts | None |

**Phase 3 adds to SQLite schema — must use `CREATE TABLE IF NOT EXISTS` to stay idempotent with the existing `INIT_SCHEMA` initialization pattern.**

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Download engine (native http/https) | Yes | v22.20.0 | — |
| better-sqlite3 | Queue + cache persistence | Yes | 12.8.0 | — |
| Electron | Tray, Notification, protocol.handle, webRequest | Yes | 41.2.0 | — |
| ffmpeg | HLS→MP4 muxing (D-10) | Yes (system) | 7.1.1 | Manual TS concat (less reliable) |
| ffmpeg-static (npm) | Bundled ffmpeg for packaged app | Not installed | — | System ffmpeg (dev only) |

**Missing dependencies with no fallback:**
- `ffmpeg-static` is not installed. System ffmpeg works for development. For the packaged app, a bundling decision must be made before the Wave that implements HLS muxing (DL-05/PLAY-05).

**Missing dependencies with fallback:**
- System ffmpeg is available — can use for all development work. Production bundling is deferred until packaging is relevant (Phase 4).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.4 |
| Config file | `animecix-v2/vitest.config.ts` |
| Quick run command | `npm test` (runs `vitest run --reporter=dot`) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DL-01 | Downloader splits file into 4 Range chunks | unit | `npm test -- tests/download/Downloader.test.ts` | No — Wave 0 |
| DL-02 | DownloadQueue sequences items, only 1 active | unit | `npm test -- tests/download/DownloadQueue.test.ts` | No — Wave 0 |
| DL-03 | Queue survives in-memory reset (SQLite round-trip) | unit | `npm test -- tests/download/DownloadQueue.test.ts` | No — Wave 0 |
| DL-04 | Resume sets Range header to bytes_downloaded, not 0 | unit | `npm test -- tests/download/Downloader.test.ts` | No — Wave 0 |
| DL-05 | animecix-offline:// resolves episode_id to MP4 path | unit | `npm test -- tests/offline/offline-protocol.test.ts` | No — Wave 0 |
| DL-06 | Subtitle paths stored and served via offline protocol | unit | `npm test -- tests/offline/offline-protocol.test.ts` | No — Wave 0 |
| DL-07 | Notification fired on download completion | manual | N/A — Electron Notification API not testable in Node vitest | manual only |
| PLAY-05 | cache_index updated after episode watch | unit | `npm test -- tests/cache/StreamCache.test.ts` | No — Wave 0 |
| INTG-03 | Window close with active downloads creates Tray | manual | N/A — requires live Electron window | manual only |
| INTG-04 | getStorageInfo returns correct size, deleteDownload removes file | unit | `npm test -- tests/storage/StorageService.test.ts` | Partial — extend existing |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/download/Downloader.test.ts` — covers DL-01, DL-04 (Range header logic, testable without network using `http` module mocks)
- [ ] `tests/download/DownloadQueue.test.ts` — covers DL-02, DL-03 (in-memory SQLite via `new Database(':memory:')`, same pattern as `tests/storage/subtitle-prefs.test.ts`)
- [ ] `tests/cache/StreamCache.test.ts` — covers PLAY-05 (cache_index write, eviction logic, testable with in-memory SQLite + tmp files)
- [ ] `tests/offline/offline-protocol.test.ts` — covers DL-05, DL-06 (path resolution logic; mirror `tests/player/tau-protocol.test.ts` pattern exactly)
- [ ] Schema extension test in `tests/storage/StorageService.test.ts` — add assertions for `download_queue`, `download_chunks`, `cache_index` tables existing after `INIT_SCHEMA`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | Path traversal protection on animecix-offline:// (port resolveAssetPath) |
| V5 Input Validation | yes | Validate episode_id format before constructing file paths |
| V6 Cryptography | no | — |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `animecix-offline://episode/../../../etc/passwd` | Tampering | Port `resolveAssetPath` from `tau-protocol.ts` — already tested |
| Malicious download URL (custom protocol injection) | Tampering | Validate URL scheme is `https://` before starting download; reject `file://`, `data://` |
| IPC channel abuse (renderer sends arbitrary file path to delete) | Elevation of privilege | `deleteDownload` IPC handler must validate episode_id exists in SQLite before constructing delete path; never accept raw file paths from renderer |
| ffmpeg argument injection | Tampering | Use `execFile` (not `exec`) — array args prevent shell injection |
| Oversized download eating disk | DoS | Enforce per-download size limit; respect D-06 cache cap |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Lazy cache strategy (re-download after watch) is viable because bandwidth is not constrained | Architecture Pattern 4 | If users have metered connections, background re-download is wasteful — would need response body tee approach |
| A2 | tau-video.xyz HLS segment URLs end in `.ts` and can be matched by extension | Pitfall 5 | If CDN uses extension-less segment URLs, pattern match by domain + content-type instead |
| A3 | Manual TS byte-concatenation (no ffmpeg) works for tau-video.xyz HLS | Standard Stack / HLS muxing | If segments use discontinuous timestamps or codec changes, ffmpeg is required |
| A4 | ffmpeg-static is the right bundling approach for packaged app | Standard Stack | If ffmpeg-static binary size (~50 MB) is unacceptable for distributable size, alternative needed (Electron extraResources pointing to user-installed ffmpeg, or require users to install ffmpeg) |
| A5 | `session.webRequest.onCompleted` provides enough info to identify video segments | Architecture Pattern 4 | If content-type is not reliable in onCompleted, may need to intercept differently |

---

## Open Questions (RESOLVED)

1. **HLS segment URL pattern on tau-video.xyz** — RESOLVED: Will inspect actual segment URLs during Wave 1 implementation via debug logging. Cache intercept filter designed after inspection.

2. **ffmpeg bundling strategy for packaged app** — RESOLVED: Use system ffmpeg in Phase 3; defer bundling to Phase 4 packaging.

3. **Streaming cache: lazy re-download vs. response body tee** — RESOLVED: User chose "both" — implement transparent `session.webRequest.onCompleted` + background re-fetch for auto-caching (D-05 as locked), PLUS explicit `cache:episode` IPC for user-initiated caching.

---

## Sources

### Primary (HIGH confidence)
- `animecix-v2/src/player/tau-protocol.ts` — Protocol handler pattern, scheme registration, path traversal protection, MIME types [VERIFIED: file read]
- `animecix-v2/src/network/request-handler.ts` — `onBeforeRequest` single-handler constraint, existing interception chain [VERIFIED: file read]
- `animecix-v2/src/storage/StorageService.ts` + `schema.ts` — better-sqlite3 usage pattern, in-memory test strategy [VERIFIED: file read]
- `animecix-v2/src/preload.ts` + `types/animecix-api.d.ts` — IPC bridge pattern, event subscription with unsubscribe [VERIFIED: file read]
- `animecix-desktop/modules/downloader.ts` — Reference Range-based chunk logic (to port, not copy) [VERIFIED: file read]
- `animecix-desktop/modules/controllers/download-controller.ts` — Sequential queue pattern [VERIFIED: file read]
- `animecix-desktop/modules/helpers/notification-helper.ts` — Notification API usage [VERIFIED: file read]
- `animecix-v2/package.json` — Confirmed: better-sqlite3 12.8.0, electron 41.2.0, vitest ^4.1.4 installed [VERIFIED: file read]
- ffmpeg 7.1.1 available at `/opt/homebrew/bin/ffmpeg` [VERIFIED: bash probe]

### Secondary (MEDIUM confidence)
- Electron Tray API: contextual tray lifecycle pattern [CITED: electronjs.org/docs/latest/api/tray — ASSUMED based on training, not fetched this session]
- `protocol.registerSchemesAsPrivileged` must precede `app.ready` [CITED: confirmed by existing tau-protocol.ts which enforces this pattern]
- Electron `BrowserWindow.setProgressBar()` for taskbar progress [CITED: electronjs.org/docs/latest/api/browser-window — ASSUMED]

### Tertiary (LOW confidence)
- Lazy re-download caching approach (response body tee not confirmed feasible in webRequest) [ASSUMED — needs prototype]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json, no new deps required
- Architecture: HIGH for download engine and protocol handler (direct ports of existing code); MEDIUM for streaming cache (tee approach needs prototype)
- Pitfalls: HIGH — most derived from direct code reading of existing implementations
- SQLite schema: HIGH — discretion area but follows established patterns

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable domain — Electron API, SQLite, Node.js built-ins)
