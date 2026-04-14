# Codebase Concerns

**Analysis Date:** 2026-04-11

## Tech Debt

**SSL Certificate Validation Disabled:**
- Issue: HTTPS connections disable certificate validation (`rejectUnauthorized: false`)
- Files: `modules/downloader.ts` (lines 67, 186), `modules/controllers/request-controller.ts` (indirect through DownloaderHelper)
- Impact: Vulnerable to man-in-the-middle attacks. Any network connection could be intercepted and compromised. This is a critical security bypass.
- Fix approach: Enable proper certificate validation in production. Use environment-based configuration to disable only in development if necessary.

**Weak Type Safety with `any` Type:**
- Issue: Excessive use of `any` type throughout codebase bypasses TypeScript strict checking
- Files: `modules/downloader.ts` (lines 12, 83, 171), `modules/controllers/window-controller.ts` (line 34), `modules/main.ts` (line 16, `constructor` parameter), `modules/controllers/request-controller.ts` (line 38 callback details), `modules/controllers/download-controller.ts` (line 9)
- Impact: Type errors at runtime not caught at compile time. Refactoring becomes risky. IDE cannot provide accurate suggestions.
- Fix approach: Define proper interfaces for all data structures. Create type definitions for event payloads, response objects, and configuration.

**String Parsing with No Error Handling:**
- Issue: Critical auth data parsing uses simple string split operations without validation
- Files: `modules/controllers/auth-controller.ts` (lines 15-16)
  ```typescript
  const status = link.split("{")[1].split("|")[0];
  const data = link.split("|")[1].split("}")[0];
  ```
- Impact: If link format is unexpected, code silently fails or crashes. No bounds checking before array access.
- Fix approach: Use regex with validation or URL parsing library. Wrap in try-catch with proper error reporting.

**Hardcoded Configuration Values:**
- Issue: Magic strings scattered throughout codebase instead of centralized config
- Files: 
  - `main.ts` (line 3: `process.env.APP_URL = 'https://animecix.tv'`)
  - `modules/controllers/request-controller.ts` (lines 40-41: hardcoded domain checks for "disqus", "google")
  - `modules/controllers/request-controller.ts` (lines 89: hardcoded "/file/tau-video" endpoint)
  - `modules/controllers/window-controller.ts` (lines 154-155: more hardcoded domain checks)
  - `modules/controllers/rpc-controller.ts` (line 11: Discord client ID hardcoded)
  - `modules/downloader.ts` (line 56: hardcoded filename sanitization regex)
- Impact: Changes require code modifications and recompilation. Cannot switch environments without rebuilding.
- Fix approach: Create centralized config file. Load from `.env` for secrets and settings. Use config constants for domain lists.

**Missing Error Recovery in Download System:**
- Issue: Download failures have limited recovery mechanisms
- Files: `modules/downloader.ts` (lines 207-217), `modules/controllers/download-controller.ts` (lines 222-228)
- Impact: Single thread failure stops entire download. User must manually retry. Partial downloads not resume.
- Fix approach: Implement per-thread retry logic. Support resume from last completed chunk. Add exponential backoff for failed requests.

**Unbounded Event Listeners:**
- Issue: IPC event listeners registered multiple times without deregistration
- Files: `modules/controllers/download-controller.ts` (lines 36-39 duplicate `setPaused` listener)
- Impact: Memory leak. Events processed multiple times. State becomes inconsistent.
- Fix approach: Use `ipcMain.removeAllListeners()` on shutdown. Register listeners once during initialization.

**No Cleanup on Application Exit:**
- Issue: Active downloads not cancelled when app closes
- Files: `modules/controllers/window-controller.ts` (lines 82-89), `modules/downloader.ts`
- Impact: Incomplete files left in download folder. Running downloads not terminated cleanly.
- Fix approach: Implement graceful shutdown. Cancel all downloads in `app.on('quit')` handler.

**Silent Exception Swallowing:**
- Issue: Broad try-catch blocks that log but don't handle errors properly
- Files: 
  - `modules/downloader.ts` (lines 229-250: empty catch `catch(e) {}`)
  - `modules/controllers/auth-controller.ts` (lines 20-22: `console.log(e)` in catch)
  - `modules/controllers/request-controller.ts` (lines 87-117: generic error handler)
  - `modules/controllers/player-controller.ts` (lines 173-179: silent catch blocks)
- Impact: Errors disappear from logs. Debugging becomes extremely difficult. Root causes never identified.
- Fix approach: Log stack traces with context. Propagate errors to UI with user-friendly messages.

## Known Bugs

**Duplicate IPC Event Handler:**
- Issue: `setPaused` event registered twice in same file
- Files: `modules/controllers/download-controller.ts` (lines 19-34 and lines 36-39)
- Trigger: Multiple pause state changes will trigger both handlers
- Workaround: Currently works by coincidence (both handlers do same thing), but fragile
- Risk: If handlers diverge in future, state becomes corrupted

**URL Parsing in Auth Link:**
- Issue: Auth controller assumes specific link format without validation
- Files: `modules/controllers/auth-controller.ts` (lines 11-23)
- Trigger: Malformed or unexpected login link format
- Symptoms: App may crash or silently fail to authenticate
- Workaround: None. User must retry login.

**No Handling for Missing Sibnet Video:**
- Issue: Sibnet parser assumes `player.src` exists in HTML response
- Files: `modules/helpers/sibnet.ts` (lines 8-10)
- Trigger: When Sibnet changes HTML structure or if page loads without video
- Symptoms: Exception in parse chain, video source not loaded
- Workaround: User cannot play video from that source

**Window Reference in Destroyed State:**
- Issue: Code checks `this.win.isDestroyed` but window can be destroyed between check and use
- Files: `modules/controllers/player-controller.ts` (line 66-67: checks `isDestroyed` but doesn't prevent immediate destruction)
- Trigger: Rapid window close during active IPC message
- Symptoms: Runtime error when trying to access destroyed window
- Workaround: None guaranteed

## Security Considerations

**Disabled HTTPS Certificate Validation:**
- Risk: Man-in-the-middle attacks possible. Attacker can intercept all downloads and video sources.
- Files: `modules/downloader.ts` (lines 67, 186)
- Current mitigation: None
- Recommendations: Remove `rejectUnauthorized: false`. Use proper certificate chains. If needed for testing, use environment variable to control.

**User-Agent Spoofing:**
- Risk: Impersonating Firefox browser may bypass server-side detection, but also hides true client identity
- Files: `modules/downloader.ts` (line 87), `modules/controllers/request-controller.ts` (line 48), `modules/controllers/window-controller.ts` (line 125)
- Current mitigation: Consistent user agent across requests
- Recommendations: Consider implementing proper user agent for desktop app instead of mimicking browser. Add transparency about client identity.

**No CSRF Token Validation:**
- Risk: Requests may be vulnerable to CSRF if token handling is incomplete
- Files: `modules/controllers/request-controller.ts` (lines 50-54: token replacement logic)
- Current mitigation: Custom token header handling
- Recommendations: Review CSRF protection on backend. Ensure token rotation after login. Document security model.

**Hardcoded Discord Client ID:**
- Risk: Public exposure of Discord app credentials
- Files: `modules/controllers/rpc-controller.ts` (line 11)
- Current mitigation: ID appears to be public app ID (not secret), but still sensitive
- Recommendations: Move to environment configuration. Rotate if ID is ever used with secret.

**Link Parsing Without Validation:**
- Risk: Crafted links could cause unexpected behavior or injection attacks
- Files: `modules/controllers/auth-controller.ts` (lines 15-16)
- Current mitigation: None - direct string parsing
- Recommendations: Use URL/URI validation library. Whitelist expected formats. Log suspicious patterns.

## Performance Bottlenecks

**Progress Calculation on Every Chunk:**
- Problem: `calculateProgress()` called for each downloaded byte chunk
- Files: `modules/downloader.ts` (lines 141-156), called on line 196
- Cause: No debouncing or throttling. Every thread chunk triggers calculation.
- Improvement path: Throttle progress updates to 100-200ms intervals. Batch multiple updates.

**Synchronous File Operations in Download Loop:**
- Problem: `checkWrite()` called repeatedly in synchronous loop, performing file I/O
- Files: `modules/downloader.ts` (lines 223-252)
- Cause: Recursive calls to `checkWrite()` until all writes finish
- Improvement path: Use event-driven architecture. Only write when new data available. Use Promise-based APIs.

**Inefficient String Parsing:**
- Problem: Multiple regex operations and string splits for video quality mapping
- Files: `modules/controllers/player-controller.ts` (lines 152-164)
- Cause: Chain of `.replace()` calls for each video item
- Improvement path: Create mapping object. Use single regex or lookup table.

**No Connection Pooling for Downloads:**
- Problem: Each thread creates new HTTP connection instead of reusing
- Files: `modules/downloader.ts` (lines 181-189)
- Cause: New DownloaderHelper instance per thread
- Improvement path: Implement keep-alive. Use connection pool. Reduce connection overhead.

## Fragile Areas

**Download State Management:**
- Files: `modules/downloader.ts` (entire class), `modules/controllers/download-controller.ts`
- Why fragile: Multiple boolean flags (`canceled`, `error`, `downloading`, `completed`) must be kept in sync. No single source of truth.
- Safe modification: Add comprehensive state machine. Transition only through valid states. Log state changes.
- Test coverage: No unit tests visible. Only end-to-end testing possible.

**IPC Message Handling:**
- Files: `modules/controllers/download-controller.ts` (lines 15-87), `modules/controllers/player-controller.ts` (lines 13-50)
- Why fragile: Event listeners expect specific message format. No schema validation. Easy to break with renderer changes.
- Safe modification: Define TypeScript interfaces for all IPC messages. Validate on receipt. Add migration layer for format changes.
- Test coverage: Not testable without actual renderer. Needs mock renderer tests.

**Auth Link Parsing:**
- Files: `modules/controllers/auth-controller.ts` (lines 11-23)
- Why fragile: String parsing with array access has no bounds checking. Assumes exact format.
- Safe modification: Use regex with named groups or URL parsing. Add unit tests with various input formats. Document expected format.
- Test coverage: No validation tests. Single string split logic untested.

**HTML Parsing for Video Sources:**
- Files: `modules/controllers/player-controller.ts` (lines 114-182), `modules/helpers/sibnet.ts` (lines 5-11)
- Why fragile: Direct string parsing assumes HTML structure never changes. Brittle to site updates.
- Safe modification: Use proper HTML parser (node-html-parser already imported). Add fallback mechanisms. Log parsing failures.
- Test coverage: No tests for format changes. Real site structure must be tested manually.

**Window Controller Lifecycle:**
- Files: `modules/controllers/window-controller.ts` (entire class)
- Why fragile: Window can be destroyed while methods are executing. Multiple race conditions possible.
- Safe modification: Add guards before every window operation. Use optional chaining consistently. Check `isDestroyed()` right before use.
- Test coverage: No lifecycle tests. Difficult to test without real Electron window.

## Scaling Limits

**Single-Instance Download Queue:**
- Current capacity: Queue stores all downloads in memory as Map
- Limit: No pagination/pagination support. Very large download lists cause memory issues.
- Scaling path: Implement persistent queue (local SQLite). Implement pagination in UI. Add cleanup for old entries.

**Hardcoded Thread Count for Downloads:**
- Current capacity: User specifies thread count per download
- Limit: No global limit. Could spawn hundreds of concurrent connections.
- Scaling path: Add configurable max threads globally. Implement per-source bandwidth limiting. Add queue prioritization.

**Progress Update Frequency:**
- Current capacity: Progress sent for every single downloaded chunk
- Limit: With many concurrent downloads, IPC message queue could overflow.
- Scaling path: Batch progress updates. Use separate progress reporting channel. Implement backpressure.

**Cache Clearing on Startup:**
- Current capacity: Clears entire session cache synchronously
- Limit: Large cache causes app startup delay
- Scaling path: Use async clearing. Implement selective cache invalidation. Move to background task.

## Dependencies at Risk

**axios 0.21.1 (Outdated):**
- Risk: Multiple security vulnerabilities in this version
- Files: `modules/downloader.ts` (line 1), `modules/controllers/player-controller.ts` (line 1)
- Current version: Latest is 1.6.5+
- Impact: Vulnerable HTTP requests. Known CVEs in dependency chain.
- Migration plan: Update to latest axios. Verify all request patterns still work. Test with real endpoints.

**node-downloader-helper 1.0.18:**
- Risk: Unmaintained package. Last update appears to be 2019-2020.
- Files: `modules/downloader.ts` (line 4)
- Impact: No security updates. No compatibility fixes for newer Node versions.
- Migration plan: Consider switching to built-in WHATWG fetch or axios with custom Range request handling.

**electron 34.2.0:**
- Risk: Rapid release cycle. Security updates may not be tracked properly. Consider using ESR version.
- Files: `package.json` (devDependencies)
- Impact: Security vulnerabilities lag behind Node.js. Compatibility issues in minor versions.
- Migration plan: Switch to Electron ESR (LTS) releases. Implement auto-update mechanism (already in place).

**@cliqz/adblocker-electron 1.22.2:**
- Risk: Ad blocker lists may become outdated. No guarantee of maintenance.
- Files: `modules/controllers/request-controller.ts` (line 1)
- Impact: Ads not blocked effectively. Lists no longer updated for new ad domains.
- Migration plan: Switch to maintained fork or uBlock Origin lists. Implement custom rule system.

**typescript 4.5.4 (Outdated):**
- Risk: Current stable is 5.4+. Missing language features and bug fixes.
- Files: `package.json` (devDependencies), `tsconfig.json`
- Impact: Cannot use modern TypeScript features. Some type narrowing issues.
- Migration plan: Update to TypeScript 5.4+. Verify no breaking changes in compilation. Test type checking.

## Test Coverage Gaps

**No Unit Tests for Download Logic:**
- What's not tested: Downloader2 class thread management, progress calculation, error recovery
- Files: `modules/downloader.ts` (entire class - no corresponding .test.ts file)
- Risk: Multi-threaded download logic could have race conditions not caught until production
- Priority: **High** - Core functionality, affects data integrity

**No Tests for IPC Message Handling:**
- What's not tested: Event listener logic, message validation, error propagation through IPC
- Files: `modules/controllers/download-controller.ts`, `modules/controllers/player-controller.ts` (all ipcMain handlers)
- Risk: Message format changes break without detection. Silent failures possible.
- Priority: **High** - Critical integration points

**No Tests for Auth Controller:**
- What's not tested: Link parsing, URL construction, error cases
- Files: `modules/controllers/auth-controller.ts` (entire class)
- Risk: Malformed links cause silent failures or crashes during login flow
- Priority: **High** - User-facing feature, breaks core functionality

**No Tests for HTML/String Parsing:**
- What's not tested: Video source extraction from HTML, Sibnet parser, quality label mapping
- Files: `modules/helpers/sibnet.ts`, `modules/controllers/player-controller.ts` (lines 114-182)
- Risk: Site structure changes break video playback without warning
- Priority: **High** - Core feature, no fallback

**No Tests for Request Controller:**
- What's not tested: Header manipulation, CSRF token handling, status code rewriting
- Files: `modules/controllers/request-controller.ts`
- Risk: Header changes break downloads or authentication. Status code rewriting could mask errors.
- Priority: **Medium** - Important but not frequently changed

**No Integration Tests:**
- What's not tested: Full download flow, multi-threaded scenarios, error recovery paths
- Files: All files in `modules/` directory
- Risk: Integration bugs only found in production
- Priority: **Medium** - Would require test infrastructure

**No Type Definition Tests:**
- What's not tested: Type safety validation, interface correctness
- Files: All TypeScript files
- Risk: Type system not catching errors due to use of `any`
- Priority: **Medium** - Improvement to code quality

---

*Concerns audit: 2026-04-11*
