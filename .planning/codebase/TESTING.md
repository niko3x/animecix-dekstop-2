# Testing Patterns

**Analysis Date:** 2026-04-11

## Test Framework

**Runner:**
- Not detected in current setup
- No test framework installed (Jest, Vitest, Mocha not present in package.json)

**Assertion Library:**
- Not detected

**Run Commands:**
- No test commands defined in `package.json`
- Current scripts: `compile`, `start`, `buildTypes`, `build`, `buildMac`, `build32`, `deploy`, `deployMac`, `deployDeb`, `deployAppImage`, `deploy32`

## Test File Organization

**Current State:**
- No test files found in repository
- No `.test.ts`, `.spec.ts`, `.test.js`, or `.spec.js` files present
- No `tests/`, `__tests__/`, or `test/` directories exist

**Testing Gap:**
- This is a critical gap: Desktop application with no automated test coverage
- Download logic (`downloader.ts`, `download-controller.ts`) is untested
- Window/UI interaction logic is untested
- Request interception and ad-blocking logic is untested

## Recommended Test Structure (Not Yet Implemented)

If testing were to be implemented, recommended patterns based on codebase structure:

**Suggested Organization:**
```
animecix-desktop/
├── modules/
│   ├── controllers/
│   │   ├── download-controller.ts
│   │   ├── download-controller.test.ts        // Co-located
│   │   ├── window-controller.ts
│   │   ├── window-controller.test.ts
│   │   └── ...
│   ├── helpers/
│   │   ├── notification-helper.ts
│   │   ├── notification-helper.test.ts
│   │   └── ...
│   └── downloader.ts
│       └── downloader.test.ts
└── ...
```

## Mocking

**Not Currently Implemented**

**Recommended Approach:**
- Mock Electron APIs: `BrowserWindow`, `ipcMain`, `session`
- Mock external dependencies: `axios`, `DownloaderHelper`
- Mock file system operations: `fs.createWriteStream()`, `fs.mkdirSync()`

## Fixtures and Factories

**Not Currently Implemented**

**What Should Exist:**
- Factory for creating test `DownloadItem` instances
- Fixtures for mock video URLs and metadata
- Mock response objects for axios calls
- Mock Electron event objects

## Coverage

**Requirements:**
- Not enforced - no coverage configuration found
- No `.nyc`, `c8`, or coverage config files

**Recommendation:**
- Critical components for testing:
  - `Downloader2` class: Multi-threaded download logic
  - `DownloadController`: Download queue management and state
  - `PlayerController`: Frame communication and video source parsing
  - `RequestController`: Request interception and header modification
  - Helper classes: `URLHelper`, `ArrayHelper`, `NotificationHelper`

## Test Types

**Unit Tests:**
- Not implemented
- Should focus on: Utility classes, helper functions, state management in controllers
- Example candidates:
  - `URLHelper.getHostname()` with valid/invalid URLs
  - `ArrayHelper.array_move()` with various index combinations
  - `Downloader2` thread calculation logic in `checkParts()`

**Integration Tests:**
- Not implemented
- Should test: IPC communication, download lifecycle, request interception
- Example scenarios:
  - Download start → progress → completion flow
  - Multiple concurrent downloads
  - Request header injection for referer and CSRF tokens

**E2E Tests:**
- Not used (typical for Electron apps - would require real app instance)

## Common Patterns to Test

**IPC Communication:**
Current pattern seen in `DownloadController.execute()`:
```typescript
ipcMain.on("downloadVideo", (event, video: {...}) => {
  this.downloadVideo(video);
});
```

Would benefit from isolated tests of IPC handler logic separated from event registration.

**Async Operations:**
Current pattern in `Updater.execute()`:
```typescript
autoUpdater.on("update-available", async (info: UpdateInfo) => {
  try {
    await session.defaultSession.clearCache();
  } catch (e) {
    console.error("Failed to clear cache", e);
  }
});
```

Tests should verify:
- Successful async completion
- Error handling and logging
- Side effects (cache clearing, notifications)

**Error Handling:**
Current pattern in `Downloader2`:
```typescript
.catch((e) => {
  this.downloading = false;
  if (!this.canceled) {
    this.error = true;
  }
  if (this.errorListener != null) {
    this.errorListener(e + "");
  }
});
```

Tests should verify:
- Error state is set correctly
- Listeners are called with proper error messages
- Canceled vs error state is distinguished

**Event Listeners and Callbacks:**
Pattern across many controllers:
```typescript
public setOnErrorListener(listener: (error: string) => void) {
  this.errorListener = listener;
}
```

Tests should verify:
- Listeners are properly stored
- Listeners are called with correct arguments
- Multiple listeners don't cause issues

## Critical Testing Gaps

**Download Logic (High Priority):**
- File: `modules/downloader.ts`
- Untested: Multi-threaded download, chunk management, file reassembly
- Risk: Data corruption, incomplete downloads, thread synchronization bugs
- Current safeguards: None except runtime logic

**Download Controller (High Priority):**
- File: `modules/controllers/download-controller.ts`
- Untested: Queue management, pause/resume, concurrent downloads
- Risk: Lost downloads, incorrect state transitions
- Current safeguards: None

**Player Controller (Medium Priority):**
- File: `modules/controllers/player-controller.ts`
- Untested: Frame communication, HTML parsing, source extraction
- Risk: Video sources not properly extracted, parsing errors
- Current safeguards: Try-catch blocks only

**Request Controller (Medium Priority):**
- File: `modules/controllers/request-controller.ts`
- Untested: Ad-blocking, header injection, CSRF token handling
- Risk: Headers not properly set, security issues
- Current safeguards: None

## Recommended Testing Framework Setup

If to be implemented, suggested configuration:

```json
{
  "devDependencies": {
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "electron-mock": "^0.0.1"
  }
}
```

**Jest Config (`jest.config.js`):**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
};
```

**Run Commands to Add:**
```json
"test": "jest",
"test:watch": "jest --watch",
"test:coverage": "jest --coverage"
```

## Notes on Current Testing Reality

- Application relies on runtime validation and logging
- Error handling via try-catch and console logging
- No automated verification of complex logic flows
- Download manager is mission-critical component with zero test coverage
- Manual testing likely the current approach
