---
phase: 04-ship
plan: "05"
subsystem: release-ops
tags: [release-runbook, security-checklist, dry-run, checkpoint, manual-verification]
one_liner: "Release runbook + pre-ship security checklist covering PAT revocation, entitlements audit, 7-artifact verification, and end-to-end update smoke test procedure"

dependency_graph:
  requires: [04-01, 04-02, 04-03, 04-04]
  provides:
    - .planning/phases/04-ship/RELEASE-RUNBOOK.md
    - .planning/phases/04-ship/PRE-SHIP-SECURITY-CHECKLIST.md
  affects:
    - First public v1.0.0 release (blocked until dry-run checkpoint passes)

tech_stack:
  added: []
  patterns:
    - git tag -a / git push origin v* release flow
    - spctl --assess Gatekeeper verification pattern
    - SmartScreen bypass documentation for unsigned Windows binary

key_files:
  created:
    - .planning/phases/04-ship/PRE-SHIP-SECURITY-CHECKLIST.md
    - .planning/phases/04-ship/RELEASE-RUNBOOK.md
  modified: []

decisions:
  - "RELEASE-RUNBOOK.md is the single source of truth for all future releases — no tribal knowledge required"
  - "PRE-SHIP-SECURITY-CHECKLIST.md blocks the first public release until the legacy PAT (T-4-02) is revoked"
  - "Dry-run uses a throwaway branch (release-dry-run) and rc-tagged releases so main is never contaminated"
  - "Rollback strategy: patch-forward only — no mechanism to force users back to an older version"

metrics:
  duration: "~10 minutes"
  completed_date: "2026-04-14"
  tasks_completed: 2
  tasks_total: 3
  files_created: 2
  files_modified: 0
---

# Phase 4 Plan 5: Release Runbook + Security Checklist Summary

## What Was Built

Two documentation artifacts that serve as the final quality gate before the first public v1.0.0 release.

### PRE-SHIP-SECURITY-CHECKLIST.md

Blocking-items checklist that MUST be fully checked before clicking "Publish release" on the first non-draft GitHub Release. Sections:

- **Blocking Items (12 checks):**
  - Legacy GitHub PAT revocation (T-4-02) — exact procedure with `animecix-desktop/electron-builder.yml:9` reference
  - Apple Developer ID cert + ASC API key in GitHub Secrets only (T-4-01)
  - All six Apple secret names enumerated
  - Draft-release gate confirmation (T-4-06)
  - `publisherName` / Team Identifier match via `codesign -dvvv` (T-4-03)
  - CI log scan for unmasked secrets
  - SmartScreen expected-behavior documentation (D-07)
  - `entitlements.mac.plist` audit — required keys listed, dangerous keys listed as must-NOT-include (T-4-08)
  - Update channel integrity — owner/repo must match production repo (T-4-13)
  - Tag/version alignment via `GITHUB_REF_NAME` local verify (T-4-05)
  - Release approver sign-off section (T-4-15)
- **Non-blocking follow-ups** (tracked as issues): Windows cert, cert rotation runbook, branch protection, Squirrel delta verification

### RELEASE-RUNBOOK.md

Step-by-step procedure covering every future release. Sections:

| Step | Action |
|------|--------|
| 0 | Prerequisites (checklist + green CI) |
| 1 | Bump version (`npm version patch --no-git-tag-version`) |
| 2 | Tag the release (`git tag -a "v${VERSION}" && git push origin`) |
| 3 | Watch CI (troubleshooting table for 5 common failures) |
| 4 | Verify all 7 draft release artifacts |
| 5 | Smoke test on clean macOS 14+ and Windows 10/11 machines |
| 6 | Edit release notes (changelog + SmartScreen note) |
| 7 | Publish (click "Publish release" in GitHub UI) |
| 8 | Post-publish verification (banner + restart) |
| 9 | Monitor 24 hours |
| — | Rollback procedure (patch-forward only) |

**Key content in the runbook:**
- Literal `git tag -a "v${VERSION}" -m "Release v${VERSION}"` command
- `spctl --assess --type execute --verbose "/Applications/AnimeciX.app"` with expected output
- All 7 expected release artifacts named in a table
- Turkish UI strings: "Yeni sürüm hazır", "Şimdi yeniden başlat", "Sonra", "Güncellemeleri kontrol et"
- Troubleshooting table for CI failures
- Quick-reference tag commands including the dry-run pattern

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 — PRE-SHIP-SECURITY-CHECKLIST.md | e33f349 | docs(04-05): add pre-ship security checklist |
| 2 — RELEASE-RUNBOOK.md | 186985e | docs(04-05): add release runbook |

## Checkpoint Status

**Task 3 (checkpoint:human-verify)** — PENDING. See checkpoint details below. This plan is considered complete once the dry-run verification passes and the user types the resume signal.

## Deviations from Plan

None — both documentation files match the plan's specified content exactly. All acceptance criteria satisfied.

## Known Stubs

None. Both documents are production-ready reference material.

## Threat Flags

None. Documentation files introduce no new network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

- `.planning/phases/04-ship/PRE-SHIP-SECURITY-CHECKLIST.md`: FOUND
- `.planning/phases/04-ship/RELEASE-RUNBOOK.md`: FOUND
- Commit e33f349: in git log
- Commit 186985e: in git log
