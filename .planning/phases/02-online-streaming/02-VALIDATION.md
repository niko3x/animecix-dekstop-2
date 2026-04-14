---
phase: 02
slug: online-streaming
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.4 |
| **Config file** | animecix-v2/vitest.config.ts |
| **Quick run command** | `cd animecix-v2 && npx vitest run --reporter=dot` |
| **Full suite command** | `cd animecix-v2 && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd animecix-v2 && npx vitest run --reporter=dot`
- **After every plan wave:** Run `cd animecix-v2 && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | PLAY-01 | T-02-01 | Path traversal prevention in tau-player:// handler | unit | `npx vitest run tests/player/tau-protocol.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 0 | PLAY-01 | — | N/A | unit | `npx vitest run tests/player/iframe-intercept.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | AUTH-04 | — | N/A | unit | `npx vitest run tests/network/header-rewriter.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | NET-01 | — | N/A | unit | `npx vitest run tests/network/ad-blocker.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 1 | AUTH-01 | T-02-02 | Validate deep link URL format before navigating | unit | `npx vitest run tests/auth/deep-link.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 1 | INTG-02 | — | N/A | unit | `npx vitest run tests/integrations/discord-rpc.test.ts` | ❌ W0 | ⬜ pending |
| 02-05-01 | 01 | 0 | PLAY-03 | — | N/A | unit | `npx vitest run tests/storage/subtitle-prefs.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/player/tau-protocol.test.ts` — stubs for PLAY-01 protocol handler
- [ ] `tests/player/iframe-intercept.test.ts` — stubs for PLAY-01 iframe redirect
- [ ] `tests/network/header-rewriter.test.ts` — stubs for AUTH-04
- [ ] `tests/network/ad-blocker.test.ts` — stubs for NET-01
- [ ] `tests/auth/deep-link.test.ts` — stubs for AUTH-01
- [ ] `tests/integrations/discord-rpc.test.ts` — stubs for INTG-02
- [ ] `tests/storage/subtitle-prefs.test.ts` — stubs for PLAY-03 preference storage

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| HLS + MP4 source handling | PLAY-02 | Requires running Electron with network access to real CDN | Play video with HLS source, then switch to MP4 multi-quality |
| JASSUB subtitle rendering | PLAY-03 | Visual rendering verification in actual player | Verify ASS subtitles render, toggle language selection |
| Skip intro/outro buttons | PLAY-04 | Timing-dependent UI behavior in Vidstack player | Seek to intro/outro timestamps, verify skip button appears |
| Full Google OAuth flow | AUTH-01 | Requires real Google OAuth consent + redirect | Click login, complete Google flow, verify animecix:// callback lands |
| Discord RPC display | INTG-02 | Requires running Discord client | Play episode, check Discord profile shows anime title + episode |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
