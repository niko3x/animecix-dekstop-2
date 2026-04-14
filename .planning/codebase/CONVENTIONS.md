# Coding Conventions

**Analysis Date:** 2026-04-11

## Naming Patterns

**Files:**
- PascalCase for class/controller files: `WindowController.ts`, `DownloadController.ts`, `AuthController.ts`
- camelCase for helper/utility files: `notification-helper.ts`, `url-helper.ts`, `array-helper.ts`
- kebab-case for file names with hyphens: `download-item.ts`, `site-menu-controller.ts`
- Interface files use same naming as implementations: `DownloadItem` interface in `download-item.ts`

**Classes and Exports:**
- PascalCase for class names: `Main`, `WindowController`, `DownloadItem`, `NotificationHelper`
- Static utility classes use PascalCase: `ArrayHelper`, `URLHelper`, `NotificationHelper`
- Private properties use camelCase with `private` keyword: `paused`, `isOdnok`, `blocker`
- Public properties use camelCase: `sources`, `identifier`, `standart`, `webContents`

**Functions and Methods:**
- camelCase for methods: `setProgress()`, `minimize()`, `maximize()`, `sendToWebContents()`
- camelCase for handler methods: `onDownloadProgressListener()`, `onDownloadFinishListener()`
- Getter methods use `get` prefix: `get webContents()`, `get isDestroyed()`, `get isMaximized()`
- Listener/callback setters use `setOn[Event]Listener` pattern: `setOnErrorListener()`, `setOnFinishListener()`

**Variables:**
- camelCase for all variable declarations: `fileForDownload`, `currentFrameUrl`, `isConnected`
- Boolean variables often prefixed with `is`: `isOdnok`, `isConnected`, `isMaximized`, `isDestroyed`
- Map/Collection variables: `downloads: Map<string, DownloadItem>`, `threads: {...}[]`, `downloadHelpers: Map<number, DownloaderHelper>`

**Types and Interfaces:**
- PascalCase for interfaces: `DownloadItem`, `UpdateInfo`, `ProgressInfo`
- Inline typed parameters documented in JSDoc where complex

## Code Style

**Formatting:**
- TypeScript compiled to ES5 (see `tsconfig.json` target)
- CommonJS module system: `export class X {}`, `import { Y } from './path'`
- 2-space indentation (inferred from existing code)
- Semicolons used consistently throughout

**Linting:**
- ESLint configured in `.eslintrc.js` with minimal setup
- Config targets Node.js ES6 environment
- No strict rules enabled (parserOptions: ecmaVersion 8)
- TypeScript strict mode enabled in `tsconfig.json` (`"strict": true`)
- Forces consistent casing: `forceConsistentCasingInFileNames: true`

## Import Organization

**Order:**
1. Node.js built-in modules: `import fs from "fs"`, `import path from "path"`
2. External packages: `import { BrowserWindow, app } from "electron"`, `import axios from "axios"`
3. Relative imports: `import { Main } from './modules/main'`, `import { WindowController } from "./window-controller"`

**Path Aliases:**
- No path aliases configured in tsconfig (baseUrl/paths not used)
- Relative imports use standard `./` and `../` patterns

**Module Resolution:**
- Node-style resolution (default CommonJS)
- Module type: commonjs
- Modules can reference both TypeScript and compiled JavaScript files

## Error Handling

**Patterns:**
- Try-catch blocks for risky operations: Used in `Updater`, `RequestController`, `AuthController`
- Console logging for errors: `console.error()`, `console.log()`
- Example from `window-controller.ts`:
```typescript
try {
  session.defaultSession.clearCache();
  this.win?.webContents?.session.clearCache();
} catch (e) {
  console.error("Failed to clear cache", e);
}
```
- Null/undefined checks with optional chaining: `this.win?.webContents`, `this.win?.setProgressBar()`
- Guard clauses for early returns: `if (this.canceled) return;` in download loops
- Event listener error handling: `.catch(console.error)` on async operations

## Logging

**Framework:** Console API

**Patterns:**
- `console.log()` for general information: Used heavily for debugging state changes
- `console.error()` for error conditions: Cache clearing failures, RPC connection issues
- `console.warn()` for warnings: Discord RPC disconnection state
- Logging in event handlers: `console.log("DOWNLOAD ERROR", error)` to track download lifecycle
- Conditional logging commented out for development: `//this.win?.webContents.openDevTools()`

## Comments

**When to Comment:**
- Used sparingly, code is mostly self-documenting
- Comments explain "why" rather than "what"
- Example from `window-controller.ts`: `// Do not show the window if page is not loaded`
- Controller method comments document flow: `// Register deep links (animecix://) for the app.`
- Electron event documentation: `// When the user watch an anime`

**JSDoc/TSDoc:**
- Not widely used in this codebase
- Method signatures are typed with TypeScript
- Complex parameters documented inline in code comments where needed

## Function Design

**Size:**
- Methods range from 2-50 lines typically
- Complex flows broken into private helper methods: `setupAdblock()`, `listenHeaders()`, `listenRequests()`
- Event handlers kept focused on single responsibility

**Parameters:**
- Parameters typed explicitly: `(url: string)`, `(paused: boolean)`, `(progress: number)`
- Inline object types for event data: `video: { name: string; file?: string; threads: number; referer?: string }`
- Spread operator used for variable arguments in IPC: `...data: any`

**Return Values:**
- Explicit return types on public methods: `public execute(): void`, `public getReferer(): boolean`
- Methods returning state use typed returns: `public isCanceled(): boolean`
- Private methods often use implicit return type inference
- Notification creation returns instance: `public create(title, body) { ... return notification; }`

## Module Design

**Exports:**
- Class-per-file export: `export class Main { ... }`, `export class WindowController { ... }`
- Single responsibility per module
- Controllers manage domain-specific logic: `DownloadController`, `PlayerController`, `RequestController`

**Barrel Files:**
- Not used in this codebase
- Imports are direct from source files: `import { Main } from './modules/main'`

## Architecture Patterns

**Controller Pattern:**
- Controllers encapsulate domain logic: `WindowController`, `DownloadController`, `AuthController`
- Controllers accept dependencies via constructor injection
- Controllers expose `execute()` method to set up IPC listeners and handlers

**Helper Pattern:**
- Static utility classes for shared functionality: `NotificationHelper`, `URLHelper`, `ArrayHelper`
- Used for pure functions and stateless operations

**Listener Pattern:**
- Event listeners registered via `setOn[Event]Listener()` methods
- Allows loose coupling between components
- Used in downloader for progress/completion callbacks

## Type Safety

**TypeScript Strict Mode:**
- Strict mode enabled: All type checking options active
- Type annotations required for function parameters and class properties
- Null/undefined handling enforced via strict null checks
- No implicit `any` types allowed

**Type Assertions:**
- Minimal use of `as any` - used only when necessary for external APIs
- Example: `Menu.buildFromTemplate(template as any)` for complex template building
- Event handler typing uses Electron's type definitions from `@types/electron`
