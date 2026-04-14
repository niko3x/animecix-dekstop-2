---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` — create in Wave 0 |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | SHELL-01 | unit | `npx vitest run tests/window/WindowService.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 0 | SHELL-02 | unit | `npx vitest run tests/main/singleInstance.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 0 | SHELL-03 | unit | `npx vitest run tests/window/WindowService.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 0 | SHELL-04 | unit | `npx vitest run tests/window/WindowService.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-05 | 01 | 0 | AUTH-02 | unit/grep | `npx vitest run tests/security/certValidation.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-06 | 01 | 0 | AUTH-03 | unit | `npx vitest run tests/security/webPreferences.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-07 | 01 | 0 | NET-02 | unit | `npx vitest run tests/preload/animecixAPI.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — base config for Vite-native test runner
- [ ] Framework install: `npm install --save-dev vitest @vitest/coverage-v8`
- [ ] `tests/window/WindowService.test.ts` — stubs for SHELL-01, SHELL-03, SHELL-04
- [ ] `tests/main/singleInstance.test.ts` — stubs for SHELL-02
- [ ] `tests/security/webPreferences.test.ts` — stubs for AUTH-03
- [ ] `tests/security/certValidation.test.ts` — stubs for AUTH-02
- [ ] `tests/preload/animecixAPI.test.ts` — stubs for NET-02
- [ ] `tests/storage/StorageService.test.ts` — stubs for StorageService schema/CRUD

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App launches to animecix.tv in frameless window | SHELL-01, SHELL-03 | Visual verification of frameless chrome + URL load | Launch app, verify no native title bar, verify animecix.tv loads |
| Session persists across restarts | SHELL-04, AUTH-02 | Requires full app lifecycle + login state | Log in, quit app, relaunch, verify still logged in |
| Second instance focuses first | SHELL-02 | Requires OS-level process management | Launch app, try launching again, verify first window focuses |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
