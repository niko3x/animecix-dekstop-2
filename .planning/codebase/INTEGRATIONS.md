# External Integrations

**Analysis Date:** 2026-04-11

## APIs & External Services

**Website:**
- animecix.tv - Core website that the desktop app wraps and interacts with
  - SDK/Client: Direct navigation via `BrowserWindow.loadURL()`
  - Auth: Cookie-based authentication via Electron session
  - Implementation: `modules/controllers/auth-controller.ts`

**Discord Rich Presence:**
- Discord - Game activity status display on user profiles
  - SDK/Client: @xhayper/discord-rpc v1.2.0
  - Client ID: `921684324141641728` (hardcoded in `modules/controllers/rpc-controller.ts`)
  - Features: Idle status and anime watching activity tracking
  - Implementation: `modules/controllers/rpc-controller.ts`

**Video Hosting/Streaming:**
- SibNet (video.sibnet.ru) - Video streaming service
  - Purpose: Extract and stream video content
  - Implementation: `modules/helpers/sibnet.ts`
  - Method: URL parsing and video redirect handling

**Ad/Tracking Services (Blocked):**
- Disqus - Blocked in request filtering
- Google services - Partially blocked (excluded from Referer header injection)
- Implementation: `modules/controllers/request-controller.ts`

**Other Domains Detected:**
- stape.fun - Video hosting domain, excluded from ad blocking

## Data Storage

**Databases:**
- Not detected - Application uses web-based data storage via animecix.tv

**File Storage:**
- Local filesystem only
  - Downloads directory: `{app.getPath('downloads')}/AnimeciX/`
  - Implementation: `modules/controllers/download-controller.ts`
  - Used for: Video file storage after download

**Caching:**
- Electron session cache clearing
  - Cleared on updates: `session.defaultSession.clearCache()`
  - Implementation: `modules/updater.ts`

## Authentication & Identity

**Auth Provider:**
- Custom with deeplink protocol
  - Implementation: `modules/controllers/auth-controller.ts`, `modules/controllers/deeplink-controller.ts`
  - Auth Flow: 
    - Deep link from website: `animecix://login?{status}|{data}`
    - Decoded and sent to: `process.env.APP_URL + "/secure/short-login/" + data`
  - Cookie Storage: Managed by Electron session
  - CSRF Token: Set via `X-CSRF-TOKEN` header for animecix.tv requests
    - Implementation: `modules/controllers/request-controller.ts`

## Monitoring & Observability

**Error Tracking:**
- Not detected

**Logs:**
- Console logging only (console.error, console.log)
- No external log aggregation service

## CI/CD & Deployment

**Hosting:**
- GitHub Releases (auto-update mechanism)
  - Provider: GitHub
  - Configuration: `electron-builder.yml` with publish settings
  - Auto-updates: electron-updater checks for new releases

**Update Channel:**
- Update notification page: `https://animecix.tv/windows-update-page/{version}`
  - Implementation: `modules/updater.ts`
  - Triggers automatic download and installation

**CI Pipeline:**
- Not detected - Manual build scripts in package.json for Windows, macOS, and Linux

## Environment Configuration

**Required env vars:**
- `APP_URL` - Set to `https://animecix.tv` (hardcoded in `main.ts`)
- `dir` - Application directory path (set at runtime)

**GitHub Token:**
- Present in `electron-builder.yml` for publishing releases
- Note: Contains a GitHub personal access token in build config

## Webhooks & Callbacks

**Incoming:**
- Custom protocol handler: `animecix://` scheme
  - Handler: `modules/controllers/deeplink-controller.ts`
  - Routes:
    - `animecix://login?...` → Authentication flow
    - `animecix://[path]` → Navigation to `https://animecix.tv/[path]`

**Outgoing:**
- Discord RPC updates
  - Implementation: `modules/controllers/rpc-controller.ts`
  - Events: Idle status, anime watching activity

## Network Configuration

**User-Agent:**
- Custom User-Agent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:70.0) Gecko/20100101 Firefox/70.0`
  - Applied to all requests in `modules/controllers/request-controller.ts`

**Request Headers:**
- Referer: Dynamically set to `currentFrameUrl` for animecix.tv and stape.fun
  - Filtered: Disqus and Google requests excluded
  - Implementation: `modules/controllers/request-controller.ts`

**Request Filtering:**
- Ad/tracker blocking via @cliqz/adblocker-electron
  - Excludes: animecix.tv, stape.fun domains
  - Implementation: `modules/controllers/request-controller.ts`

**Video Streaming:**
- Content-Range header injection for tau-video files
  - Changes status code to 206 (Partial Content) for streaming support
  - Implementation: `modules/controllers/request-controller.ts`

## Download Management

**Multi-threaded Downloading:**
- Library: node-downloader-helper
- Purpose: Download video files with multiple parallel connections
- Implementation: `modules/downloader.ts`
- Features:
  - Configurable thread count
  - Progress tracking
  - Error handling and cancellation

---

*Integration audit: 2026-04-11*
