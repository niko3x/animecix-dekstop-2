# Codebase Structure

**Analysis Date:** 2026-04-11

## Directory Layout

```
animecix-desktop/
├── main.ts                 # TypeScript entry point for Electron main process
├── main.js                 # Compiled JavaScript entry point
├── package.json            # Node.js dependencies and scripts
├── tsconfig.json           # TypeScript compiler configuration
├── electron-builder.yml    # Build configuration for cross-platform packaging
├── .eslintrc.js            # ESLint configuration
├── .gitignore              # Git ignore rules
├── modules/                # Core application logic (controllers, helpers, utilities)
│   ├── main.ts             # Main orchestrator class - initializes all controllers
│   ├── downloader.ts       # Multi-threaded file downloader implementation
│   ├── updater.ts          # Application update checker and installer
│   ├── controllers/        # Feature-specific controllers (IPC handlers)
│   │   ├── window-controller.ts       # BrowserWindow wrapper and lifecycle management
│   │   ├── download-controller.ts     # Download queue management and progress tracking
│   │   ├── player-controller.ts       # Video player state and frame management
│   │   ├── request-controller.ts      # HTTP request interception and ad blocking
│   │   ├── site-menu-controller.ts    # Navigation and window control
│   │   ├── auth-controller.ts         # Authentication and token handling
│   │   ├── deeplink-controller.ts     # Deep link (animecix://) protocol handling
│   │   └── rpc-controller.ts          # Discord Rich Presence integration
│   └── helpers/            # Utility functions and helpers
│       ├── notification-helper.ts     # Notification creation and display
│       ├── url-helper.ts              # URL parsing utilities
│       ├── sibnet.ts                  # Sibnet video hosting integration
│       └── array-helper.ts            # Array manipulation utilities
├── models/                 # TypeScript interfaces and type definitions
│   └── download-item.ts    # DownloadItem interface for type safety
├── listeners/              # Event listener callback definitions (mostly empty)
│   ├── on-progress-listener.ts
│   ├── on-error-listener.ts
│   └── on-finish-listener.ts
├── files/                  # Static assets and preload scripts
│   ├── preload.js          # Preload script - bridges main and renderer processes
│   ├── loader.js           # Additional loading utilities for renderer
│   ├── icon.png            # Application icon
│   ├── icon-mid.png        # Medium resolution icon
│   ├── index.html          # Minimal HTML for window creation
│   ├── downloads.html      # Downloads panel HTML
│   └── videos/             # Video player related files
│       ├── plyr.min.js     # Plyr video player library
│       └── ass.js          # Advanced SubStation Alpha subtitle support
└── node_modules/           # npm dependencies (excluded from version control)
```

## Directory Purposes

**modules/**
- Purpose: All application logic separated by concern (controllers for features, helpers for utilities)
- Contains: TypeScript source files (.ts) and their compiled JavaScript counterparts (.js)
- Key files: `main.ts` (orchestrator), controller implementations, helper utilities

**modules/controllers/**
- Purpose: IPC message handlers for specific application features
- Contains: 8 controller classes, each managing one feature area
- Key files: `window-controller.ts` (foundation for all window operations), `download-controller.ts` (complex state management)
- Pattern: Each file exports a class that subscribes to IPC events in `execute()` method and calls helper methods

**modules/helpers/**
- Purpose: Reusable utility functions with no dependencies on controllers
- Contains: Static utility classes and functions
- Key files: NotificationHelper (system notifications), URLHelper (URL parsing)

**models/**
- Purpose: TypeScript type definitions and interfaces
- Contains: Minimal interface definitions for type safety
- Key files: `download-item.ts` (interface for download queue items)

**files/**
- Purpose: Static assets and preload/bridge scripts that run in both processes
- Contains: HTML, images, JavaScript loaded into renderer process
- Key files: `preload.js` (critical for IPC setup), `icon.png` (window and notification icon)

**listeners/**
- Purpose: Callback type definitions (currently mostly empty placeholder files)
- Contains: Listener interface definitions
- Note: Actual listeners are defined inline in controllers, not used much

## Key File Locations

**Entry Points:**
- `main.ts`: Initial TypeScript source, imports Main class and sets env vars (APP_URL, dir)
- `main.js`: Compiled JavaScript that Electron executes directly
- `modules/main.ts`: Main class that initializes BrowserWindow and all controllers

**Configuration:**
- `package.json`: npm dependencies (axios, electron, electron-builder, electron-updater, etc.)
- `tsconfig.json`: TypeScript strict mode enabled, CommonJS module output
- `electron-builder.yml`: Build targets (Windows .exe, macOS .dmg, Linux .AppImage)
- `.eslintrc.js`: Linting rules (minimal configuration)

**Core Logic:**
- `modules/controllers/window-controller.ts`: Central abstraction for all window operations
- `modules/controllers/download-controller.ts`: Complex state machine for download queue
- `modules/downloader.ts`: Multi-threaded HTTP downloader with progress tracking
- `modules/updater.ts`: Electron auto-updater integration

**UI Bridge:**
- `files/preload.js`: Establishes IPC connection between main and renderer
- `files/loader.js`: Additional utilities for renderer process

## Naming Conventions

**Files:**
- Controllers: `[feature]-controller.ts` (e.g., `download-controller.ts`, `player-controller.ts`)
- Helpers: `[utility]-helper.ts` (e.g., `notification-helper.ts`, `url-helper.ts`)
- Models: `[entity].ts` (e.g., `download-item.ts`)
- Compiled: Same name as source, `.js` instead of `.ts`

**Directories:**
- Controllers: `modules/controllers/` (plural, all feature controllers together)
- Helpers: `modules/helpers/` (plural, all utilities together)
- Models: `models/` (plural, type definitions)
- Features: `modules/[feature].ts` for standalone modules (e.g., `downloader.ts`, `updater.ts`)

**Classes:**
- PascalCase: `class WindowController`, `class DownloadController`, `class NotificationHelper`
- Pattern: [Feature]Controller for controllers, [Feature]Helper for utilities

**IPC Events:**
- camelCase: `"downloadVideo"`, `"playPause"`, `"updateCurrent"`, `"downloadProgress"`
- Pattern: [Action][Object] (e.g., "downloadVideo", "playerError", "seeAll")

**Methods:**
- Private helpers: camelCase with helper suffix (e.g., `checkToStartDownload()`, `onDownloadProgressListener()`)
- Public interface: camelCase (e.g., `execute()`, `cancel()`, `start()`)
- Getters: `get[Property]()` pattern (e.g., `getReferer()`, `getDownloadingItem()`)

## Where to Add New Code

**New Feature (e.g., subtitle downloader):**
- Primary code: `modules/subtitle-downloader.ts` (module) + `modules/controllers/subtitle-controller.ts` (IPC handler)
- Tests: Would go in `tests/` directory (currently no test structure exists)
- Models: Add type definitions to `models/subtitle-item.ts`
- Entry point integration: Add controller instantiation in `modules/main.ts` after line 75

**New Component/Module:**
- Simple utility: Create in `modules/helpers/[name]-helper.ts`
- Complex logic: Create in `modules/[name].ts` as standalone module, use via controllers
- HTTP client: Add axios instance in new module (pattern from Downloader2)

**Utilities:**
- Shared helpers: `modules/helpers/` directory
- URL manipulation: Add to `modules/helpers/url-helper.ts`
- Notification variants: Add methods to `modules/helpers/notification-helper.ts`

**Integration Points:**
- Add IPC listeners in new controller's `execute()` method
- Import new controller in `modules/main.ts`
- Call `.execute()` on new controller instance in `Main.run()` method after window creation

## Special Directories

**node_modules/**
- Purpose: npm package dependencies
- Generated: Yes (npm install)
- Committed: No (.gitignore entry)

**files/videos/**
- Purpose: Video player libraries (Plyr, subtitle support)
- Generated: No
- Committed: Yes
- Contains: Pre-built JavaScript libraries, not source files

**listeners/**
- Purpose: Placeholder for event listener interfaces
- Generated: No
- Committed: Yes
- Note: Currently unused, actual listeners defined inline in controllers

**.git/**
- Purpose: Git version control repository
- Generated: Yes (git init)
- Committed: No (excluded from tracking)

**Compilation Output:**
- Pattern: .js files generated from .ts files in same directory
- Example: `modules/controllers/window-controller.js` generated from `window-controller.ts`
- Committed: Yes (compiled output tracked in git)
- Note: Unusual to track compiled output, suggests deploy-time compilation or manual compilation before commit

---

*Structure analysis: 2026-04-11*
