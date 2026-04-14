---
phase: 4
slug: ship
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-14
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 4 is a CI/release phase — most validation is artifact/pipeline checks and manual verification on clean machines.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | npm scripts + shell assertions (no unit-test framework for this phase; existing `npm test` from prior phases runs as a gate in CI) |
| **Config file** | `.github/workflows/release.yml` (dry-run-able via `act` locally) |
| **Quick run command** | `cd animecix-v2 && npx tsc --noEmit && npm run lint` |
| **Full suite command** | `cd animecix-v2 && npm ci && npm test && npm run make` |
| **Estimated runtime** | ~90s quick; ~8–15 min full (per platform in CI) |

---

## Sampling Rate

- **After every task commit:** Run `cd animecix-v2 && npx tsc --noEmit`
- **After every plan wave:** Run `cd animecix-v2 && npm run make` locally on macOS to confirm artifacts assemble
- **Before `/gsd-verify-work`:** A dry-run tag (`v0.0.0-rc1`) pushed to a throwaway branch must produce a draft GitHub Release with DMG+ZIP+Squirrel+update YAML artifacts, all downloaded from a clean VM install target
- **Max feedback latency:** 120s for local builds; CI dry-run ~15 min

---

## Per-Task Verification Map

> Filled in by planner. Every task must have an `<automated>` command or be flagged `manual: true` with test instructions.

| Task ID | Plan | Wave | Requirement | Threat Ref | Test Type | Automated Command | Status |
|---------|------|------|-------------|------------|-----------|-------------------|--------|
| 4-01-01 | 04-01 | 1 | INTG-01 | — | integration | `test -f animecix-v2/build/entitlements.mac.plist && test -f animecix-v2/assets/icon.icns && test -f animecix-v2/assets/icon.ico` | ⬜ pending |
| 4-01-02 | 04-01 | 1 | INTG-01 | — | integration | `cd animecix-v2 && npx tsc --noEmit && grep -q 'MakerDMG' forge.config.ts && ! grep -qE 'MakerDeb\|MakerRpm' forge.config.ts` | ⬜ pending |
| 4-01-03 | 04-01 | 1 | INTG-01 | — | integration | `cd animecix-v2 && node -e "const p=require('./package.json'); if(p.productName!=='AnimeciX')process.exit(1); if(!p.repository)process.exit(1); if(!p.overrides?.['@electron/universal'])process.exit(1)"` | ⬜ pending |
| 4-02-01 | 04-02 | 2 | INTG-01 | T-4-01 | integration | `cd animecix-v2 && npx tsc --noEmit && grep -q 'osxSign' forge.config.ts && grep -q 'osxNotarize' forge.config.ts && grep -q 'publisher-github' forge.config.ts && grep -q 'draft: true' forge.config.ts` | ⬜ pending |
| 4-03-01 | 04-03 | 2 | INTG-01 | T-4-03 | integration | `cd animecix-v2 && npx tsc --noEmit && grep -q 'electron-updater' package.json` | ⬜ pending |
| 4-03-02 | 04-03 | 2 | INTG-01 | T-4-03, T-4-04 | unit | `cd animecix-v2 && npx tsc --noEmit && npx vitest run` | ⬜ pending |
| 4-03-03 | 04-03 | 2 | INTG-01 | — | integration | `cd animecix-v2 && npx tsc --noEmit && grep -q 'Yeni sürüm hazır' src/updater/*.ts && grep -q 'Şimdi yeniden başlat' src/updater/*.ts && grep -q 'Sonra' src/updater/*.ts` | ⬜ pending |
| 4-03-04 | 04-03 | 2 | INTG-01 | — | integration | `cd animecix-v2 && grep -q 'Güncellemeleri kontrol et' src/tray/*.ts` | ⬜ pending |
| 4-04-01 | 04-04 | 3 | INTG-01 | T-4-05 | integration | `test -x animecix-v2/scripts/verify-tag.mjs && test -x animecix-v2/scripts/generate-update-manifest.mjs && node --check animecix-v2/scripts/verify-tag.mjs && node --check animecix-v2/scripts/generate-update-manifest.mjs` | ⬜ pending |
| 4-04-02 | 04-04 | 3 | INTG-01 | T-4-01, T-4-14 | integration | `test -f .github/workflows/release.yml && python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))" && grep -q -- '-T /usr/bin/codesign' .github/workflows/release.yml && grep -q 'macos-14' .github/workflows/release.yml && grep -q 'windows-latest' .github/workflows/release.yml` | ⬜ pending |
| 4-05-01 | 04-05 | 4 | INTG-01 | T-4-02 | manual | `test -f .planning/phases/04-ship/RUNBOOK.md && grep -q 'PAT' .planning/phases/04-ship/RUNBOOK.md` | ⬜ pending |
| 4-05-02 | 04-05 | 4 | INTG-01 | T-4-06 | manual | Dry-run tag checkpoint — artifacts verified on clean VMs | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `animecix-v2/build/entitlements.mac.plist` — hardened runtime entitlements file (prerequisite for signing)
- [ ] `animecix-v2/assets/icon.icns` and `animecix-v2/assets/icon.ico` — generated from source PNG (prerequisite for Forge build)
- [ ] `.github/workflows/release.yml` scaffold with placeholder secrets referenced (prerequisite for CI runs)
- [ ] `animecix-v2/scripts/verify-tag.mjs` — version/tag matcher (prerequisite for release job fail-fast)
- [ ] `animecix-v2/scripts/generate-update-manifest.mjs` — builds `latest-mac.yml` / `latest.yml` with SHA512 (prerequisite for electron-updater)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| macOS notarization accepted | INTG-01 | Requires Apple ticket, not reproducible locally without creds | Run `spctl --assess --type execute --verbose "AnimeciX.app"` — expect `accepted; source=Notarized Developer ID` |
| DMG installs cleanly on clean macOS 14+ | INTG-01 | Requires fresh OS / fresh user account | Mount DMG on a VM with no dev tools; drag to Applications; launch; verify no Gatekeeper prompt past first run |
| Windows Squirrel installs and re-launches | INTG-01 | Requires clean Windows 10/11 VM | Run `AnimeciX-Setup.exe` on fresh Windows; accept SmartScreen "Run anyway"; confirm app appears in Start menu and launches |
| Auto-update end-to-end | INTG-01 | Requires published v(N) + v(N+1) GH Releases | Install v(N); publish draft v(N+1); confirm running app downloads in background and banner appears within `checkForUpdatesInterval` |
| Windows SmartScreen warning shown and bypassable | INTG-01 (D-07) | UX validation, expected behavior | First-launch installer shows "Windows protected your PC"; user can click "More info → Run anyway" |
| Turkish banner copy renders correctly | D-15 | Visual/localization | Install update; verify "Yeni sürüm hazır" + "Şimdi yeniden başlat" / "Sonra" buttons display correctly |
| Tray "Güncellemeleri kontrol et" menu item works | D-18 | UI surface, existing TrayManager | Right-click tray → click menu item → confirm banner appears if update available, or silent no-op otherwise |
| Revoke hardcoded GitHub PAT in legacy repo | Security blocker | Out-of-band action | Regenerate token; replace or delete `animecix-desktop/electron-builder.yml:9`; confirm old token invalid via `gh auth status` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (CI workflow acts as continuous verify)
- [ ] Wave 0 covers all MISSING references (entitlements, icons, workflow scaffold, helper scripts)
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s for local loop; < 15 min for CI dry-run
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
