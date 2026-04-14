---
phase: 3
slug: downloads-and-offline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | animecix-v2/vitest.config.ts or "none — Wave 0 installs" |
| **Quick run command** | `cd animecix-v2 && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd animecix-v2 && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd animecix-v2 && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd animecix-v2 && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | DL-01 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | DL-02 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | DL-03 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | DL-04 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | DL-05 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | DL-06 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | DL-07, PLAY-05 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | INTG-03, INTG-04 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test framework setup (vitest) if not already configured
- [ ] Test stubs for download engine (DL-01 through DL-04)
- [ ] Test stubs for cache and offline playback (DL-05, DL-06, PLAY-05)
- [ ] Test stubs for tray, notifications, storage management (DL-07, INTG-03, INTG-04)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| System tray appears on window close during download | INTG-03 | Requires Electron runtime + OS tray | Close window while download active, verify tray icon appears |
| Desktop notification on download complete | DL-07 | Requires OS notification system | Complete a download, verify native notification fires |
| OS taskbar progress bar | DL-04 | Requires Electron runtime + OS integration | Start download, check taskbar shows progress |
| Offline playback end-to-end | PLAY-05 | Requires full Electron + player stack | Download episode, disconnect network, play from library |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
