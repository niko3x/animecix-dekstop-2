---
phase: 02-online-streaming
plan: 04
subsystem: integrations
tags: [discord, rpc, discord-rpc, electron, typescript, vitest, tdd]

requires:
  - phase: 02-online-streaming
    provides: project structure and test infrastructure established in 02-01

provides:
  - DiscordService class with updateActivity, setIdle, and destroy methods
  - formatEpisodeState pure function (S##E## format)
  - CLIENT_ID constant (921684324141641728)
  - EpisodeData interface
  - Silent no-op behavior when Discord is not running

affects: [02-online-streaming, any feature that tracks watch state]

tech-stack:
  added: ["@xhayper/discord-rpc@^1.3.3"]
  patterns:
    - "Silent no-op pattern: async connect() swallows all exceptions, connected flag gates all activity calls"
    - "Pure function extraction: formatEpisodeState isolated for unit testability without mocking"
    - "TDD with vi.mock class factory: mock @xhayper/discord-rpc using class syntax inside vi.mock factory to avoid hoisting TDZ errors"

key-files:
  created:
    - animecix-v2/src/integrations/discord-rpc.ts
  modified:
    - animecix-v2/tests/integrations/discord-rpc.test.ts
    - animecix-v2/package.json
    - animecix-v2/package-lock.json

key-decisions:
  - "vi.mock factory must use class syntax (not vi.fn().mockImplementation with arrow function) for mocks used as constructors — arrow functions cannot be called with `new`"
  - "DiscordService.connected flag is set only after 'ready' event fires, not immediately after login() resolves — ensures accurate connection state"
  - "updateActivity catches setActivity rejections and resets connected=false — guards against mid-session Discord disconnects"

patterns-established:
  - "Silent integration pattern: all Discord IPC errors are caught and suppressed, never shown to user"
  - "Turkish locale labels: Izleniyor (playing), Duraklatildi (paused), Bakiniyor (idle)"

requirements-completed: [INTG-02]

duration: 8min
completed: 2026-04-12
---

# Phase 02 Plan 04: Discord RPC Integration Summary

**DiscordService with silent @xhayper/discord-rpc integration showing anime title, S##E## episode state, and Izleniyor/Duraklatildi play state in Turkish**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-12T10:36:00Z
- **Completed:** 2026-04-12T10:38:02Z
- **Tasks:** 1 (TDD: 2 commits — test + implementation)
- **Files modified:** 4

## Accomplishments

- Installed @xhayper/discord-rpc@^1.3.3 and created DiscordService class
- Implemented silent no-op pattern — all Discord errors caught, user never sees Discord-related errors
- formatEpisodeState pure function tested independently: pads to S##E## with optional translator suffix
- 7 vitest tests pass covering CLIENT_ID, formatEpisodeState edge cases, constructor resilience, and updateActivity no-op behavior

## Task Commits

1. **Task 1 RED: Failing tests for DiscordService** - `7bd8410` (test)
2. **Task 1 GREEN: DiscordService implementation + dependency** - `cc94ec8` (feat)

## Files Created/Modified

- `animecix-v2/src/integrations/discord-rpc.ts` — DiscordService, CLIENT_ID, formatEpisodeState, EpisodeData
- `animecix-v2/tests/integrations/discord-rpc.test.ts` — 7 tests covering all behaviors
- `animecix-v2/package.json` — added @xhayper/discord-rpc@^1.3.3
- `animecix-v2/package-lock.json` — lockfile updated

## Decisions Made

- Used class syntax inside `vi.mock()` factory (not `vi.fn().mockImplementation`) because arrow-function mocks cannot be called with `new` — vitest hoists the factory and arrow functions lack a prototype chain for constructor calls.
- `connected` flag gates all activity calls rather than try/catching in each method — single responsibility for connection state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Vitest mock hoisting: arrow-function mock not usable as constructor**
- **Found during:** Task 1 GREEN (test execution)
- **Issue:** `vi.fn().mockImplementation(() => ({...}))` throws "is not a constructor" when the mocked class is instantiated with `new Client(...)`. Vitest hoists `vi.mock` but arrow functions have no prototype, making them invalid constructors.
- **Fix:** Rewrote the mock factory to use a real `class Client { ... }` with `vi.fn()` instance properties.
- **Files modified:** animecix-v2/tests/integrations/discord-rpc.test.ts
- **Verification:** All 7 tests pass after fix.
- **Committed in:** cc94ec8 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — Bug)
**Impact on plan:** Minor test infrastructure fix. No scope creep. Implementation unchanged.

## Issues Encountered

- vi.mock hoisting prevents referencing module-level variables inside the factory (TDZ). Resolved by inlining all mock setup inside the factory using a class definition.

## Known Stubs

None — DiscordService is fully wired. Integration is gated by the `connected` flag which is set only when Discord is actually running.

## User Setup Required

None — no external service configuration required. The CLIENT_ID `921684324141641728` is a public Discord Application ID.

## Next Phase Readiness

- DiscordService is ready to be imported and wired into the video player's play/pause event handlers in a future plan.
- The service requires a caller to instantiate it (e.g., in main process or IPC handler) and call `updateActivity()` when episode state changes.
- No blockers.

---
*Phase: 02-online-streaming*
*Completed: 2026-04-12*

## Self-Check: PASSED

- FOUND: animecix-v2/src/integrations/discord-rpc.ts
- FOUND: animecix-v2/tests/integrations/discord-rpc.test.ts
- FOUND commit: 7bd8410 (test RED phase)
- FOUND commit: cc94ec8 (feat GREEN phase)
- Tests: 7 passed (7)
