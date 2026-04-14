# Architecture

**Analysis Date:** 2026-04-11

## Pattern Overview

**Overall:** Layered MVC (Model-View-Controller) desktop application architecture using Electron with TypeScript

**Key Characteristics:**
- Main process (Electron) orchestrates controllers that manage specific features
- Controllers use IPC (Inter-Process Communication) to communicate with the renderer process
- Single instance lock prevents multiple app windows
- Pluggable controller system where each feature has its own controller class
- Window abstraction layer encapsulates Electron BrowserWindow operations

## Layers

**Main/Bootstrap Layer:**
- Purpose: Application entry point and window initialization
- Location: `main.ts`, `main.js`
- Contains: Single `Main` class that orchestrates all controllers
- Depends on: All controllers (Updater, RequestController, DownloadController, etc.)
- Used by: Electron runtime

**Controller Layer:**
- Purpose: Manage specific application features and coordinate between main and renderer processes
- Location: `modules/controllers/` 
- Contains: Feature-specific controllers (WindowController, DownloadController, PlayerController, etc.)
- Depends on: Helpers, models, Electron APIs
- Used by: Main orchestrator and renderer process (via IPC)

**Helper/Utility Layer:**
- Purpose: Reusable utilities and helper functions
- Location: `modules/helpers/`
- Contains: NotificationHelper, URLHelper, etc.
- Depends on: Electron APIs, third-party libraries
- Used by: Controllers and modules

**Model/Data Layer:**
- Purpose: Data structures and type definitions
- Location: `models/`
- Contains: Type definitions and interfaces (e.g., DownloadItem)
- Depends on: Other modules (for class references only)
- Used by: Controllers for type safety

**Preload/Bridge Layer:**
- Purpose: Establish bridge between main and renderer process
- Location: `files/preload.js`, `files/loader.js`
- Contains: IPC setup, API exposure to renderer
- Depends on: Electron IPC
- Used by: Both main and renderer processes

## Data Flow

**Application Startup:**

1. Electron runtime calls `main.js` (compiled from `main.ts`)
2. Main class initializes with app directory path
3. Main creates BrowserWindow with specific configuration (frameless, disabled context isolation)
4. Controllers instantiated in this order:
   - WindowController (wraps BrowserWindow, manages state)
   - Updater (checks for app updates)
   - RequestController (sets up ad blocking, header manipulation)
   - DownloadController (manages video downloads)
   - SiteMenuController (handles menu navigation)
   - PlayerController (manages video player state)
   - RpcController (Discord integration)
   - AuthController and DeeplinkController (authentication)
5. Application loads main URL from `process.env.APP_URL`

**Download Feature Flow:**

1. Renderer process sends `downloadVideo` IPC message with video metadata
2. DownloadController receives message via `ipcMain.on("downloadVideo", ...)`
3. Creates new `Downloader2` instance (multi-threaded downloader)
4. Downloader2 makes HEAD request to check file size
5. Downloads file with multiple threads to Downloads/AnimeciX/ directory
6. Calls progress listener on each chunk completion
7. DownloadController sends progress back to renderer via `sendToWebContents("downloadProgress")`
8. On completion, starts next queued download or shows notification

**Player Feature Flow:**

1. Preload script detects video player frames (sibnet.ru, ok.ru, fembed, etc.)
2. Extracts player config via jwplayer() API
3. Sends player sources via `ipcRenderer.send("Fembed", sources)`
4. PlayerController receives and stores in memory
5. Renderer requests player details via `ipcMain.on("getDetails")`
6. Controller sends back frame URL and identifier for tracking
7. Player state changes (play, pause, seek) sent via IPC to all frames

**Request Interception Flow:**

1. RequestController sets up `webRequest.onBeforeSendHeaders` filter for all URLs
2. On each request, adds/modifies headers (Referer, User-Agent, CSRF tokens)
3. Sets up ad blocker via `ElectronBlocker.fromPrebuiltAdsAndTracking()`
4. Blocks requests matching ad/tracker patterns
5. Allows specific domains (animecix, disqus, google) without blocking

**State Management:**

- WindowController maintains state: `sources[]`, `identifier`, `standart`, `currentFrameUrl`
- DownloadController maintains: `downloads Map<string, DownloadItem>`, `paused: boolean`
- PlayerController maintains: `isOdnok`, `captions[]`
- State persists only in memory (no persistence layer)

## Key Abstractions

**WindowController:**
- Purpose: Wrap BrowserWindow and provide consistent interface for all operations
- Examples: `modules/controllers/window-controller.ts`
- Pattern: Singleton wrapper with convenience methods for window operations (minimize, maximize, loadURL, setProgress)
- Responsibility: Manage window lifecycle, handle fullscreen events, register deep links, set user agent

**Downloader2:**
- Purpose: Multi-threaded file downloader with progress tracking
- Examples: `modules/downloader.ts`
- Pattern: State machine with listeners for progress/error/completion events
- Responsibility: Handle HTTP requests with custom headers, split download into threads, track progress, write to disk

**IPC Controllers (all controllers):**
- Purpose: Act as middleware between renderer and Electron APIs
- Pattern: Subscribe to IPC events in `execute()` method, call private helper methods, send results back via IPC
- Responsibility: Validate input, execute business logic, communicate results to renderer

**NotificationHelper:**
- Purpose: Centralize notification creation with consistent styling
- Examples: `modules/helpers/notification-helper.ts`
- Pattern: Static utility class with factory methods
- Responsibility: Create Notification with app icon and show to user

## Entry Points

**Application Launch:**
- Location: `main.ts` (entry point executed by Electron)
- Triggers: Electron runtime calls main.js (compiled output)
- Responsibilities: Initialize Main class, set up environment variables (APP_URL, dir), run application

**Window Initialization:**
- Location: `modules/main.ts` → `run()` method
- Triggers: `app.whenReady()` event
- Responsibilities: Create BrowserWindow, instantiate all controllers, load URL

**Background Tasks:**
- Location: Each controller's `execute()` method
- Triggers: Called sequentially after window creation
- Responsibilities: Set up IPC listeners, register event handlers, start background processes

## Error Handling

**Strategy:** Try-catch blocks in critical sections with console.error logging

**Patterns:**
- Request failures logged but not surfaced to user (silent failures in RequestController)
- Download errors trigger error listener which attempts to start next queued download
- Update check failures prevent app crash (wrapped in .catch())
- Preload script errors caught to prevent window load blocking
- Cache clearing wrapped in try-catch during startup and update

## Cross-Cutting Concerns

**Logging:** 
- console.log/console.error throughout codebase
- No centralized logging framework
- Logs include IPC messages, download progress, player state changes

**Validation:** 
- Minimal validation in controllers
- Type checking via TypeScript strict mode
- URL validation in URLHelper.getHostname() with try-catch

**Authentication:** 
- Custom token-based system via AuthController
- CSRF token management in RequestController
- Deep link authentication via animecix:// protocol
- Cookies managed by Electron session

**User Agent Spoofing:**
- Firefox user agent set in WindowController and Downloader2
- Headers set in RequestController for all outgoing requests
- Required to access video hosting services

**Ad Blocking:**
- Cliqz ad blocker integrated in RequestController
- Loaded asynchronously on app start
- Whitelist for specific domains (animecix, disqus, google)

---

*Architecture analysis: 2026-04-11*
