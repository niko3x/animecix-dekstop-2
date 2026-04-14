---
phase: 04-ship
plan: 01
subsystem: build-pipeline
tags: [electron-forge, packaging, macos-universal, icons, wave-0, entitlements, electron-updater]
one_liner: "Wave 0 build assets + Forge config foundation: entitlements, icons, app-update.yml, MakerDMG, osxUniversal, productName AnimeciX, @electron/universal override"

dependency_graph:
  requires: []
  provides:
    - animecix-v2/build/entitlements.mac.plist
    - animecix-v2/assets/icon.icns
    - animecix-v2/assets/icon.ico
    - animecix-v2/resources/app-update.yml
    - animecix-v2/forge.config.ts (MakerDMG + osxUniversal + appBundleId)
    - animecix-v2/package.json (productName AnimeciX, repository, build.publish, overrides, electron-updater)
  affects:
    - 04-02 (signing/notarization blocks will be added to the forge.config.ts structure laid here)
    - 04-03 (electron-updater dep + app-update.yml + dev-app-update.yml consumed here)

tech_stack:
  added:
    - electron-updater ^6.8.3
    - electron-log ^5.2.0
    - "@electron-forge/maker-dmg ^7.11.1"
    - "@electron-forge/publisher-github ^7.11.1"
    - "@electron/universal >=2.0.3 (overrides)"
  patterns:
    - sips + iconutil pipeline for .icns generation (macOS native tooling)
    - png-to-ico for Windows multi-resolution .ico
    - app-update.yml embedded via extraResource for electron-updater feed discovery

key_files:
  created:
    - animecix-v2/build/entitlements.mac.plist
    - animecix-v2/assets/icon.icns
    - animecix-v2/assets/icon.ico
    - animecix-v2/resources/app-update.yml
    - animecix-v2/dev-app-update.yml
  modified:
    - animecix-v2/forge.config.ts
    - animecix-v2/package.json
    - animecix-v2/package-lock.json
    - animecix-v2/.gitignore

decisions:
  - D-01 applied: Removed MakerDeb + MakerRpm from forge.config.ts and package.json devDependencies
  - D-04 applied: Added MakerDMG for darwin first-install UX
  - D-05 applied: osxUniversal.x64ArchFiles=**/*.node to avoid double-lipo of better-sqlite3
  - D-11 applied: package.json.repository field added for electron-updater GitHub provider inference
  - D-26 applied: appBundleId com.onmuapps.animecix in packagerConfig
  - D-27 applied: productName AnimeciX (was animecix-v2)
  - T-4-09 mitigated: dev-app-update.yml added to .gitignore (not tracked in git)
  - Pitfall 1 mitigated: build.publish block added to package.json for electron-updater auto-detection
  - Pitfall 3 mitigated: @electron/universal overridden to >=2.0.3 to fix known native-module universal binary bug

metrics:
  duration: "~25 minutes"
  completed_date: "2026-04-14"
  tasks_completed: 3
  tasks_total: 3
  files_created: 5
  files_modified: 4
---

# Phase 4 Plan 1: Wave 0 Assets + Forge Config Foundation Summary

## What Was Built

Established all prerequisite build-time assets and configuration for the ship phase. Plans 04-02 (signing/notarization) and 04-03 (electron-updater integration) depend on every artifact produced here.

**forge.config.ts final shape:**
- Removed: MakerDeb, MakerRpm
- Added: MakerDMG (darwin), osxUniversal.x64ArchFiles
- Updated packagerConfig: appBundleId=com.onmuapps.animecix, icon=assets/icon, extraResource includes resources/app-update.yml

**package.json changes:**
- productName: animecix-v2 → AnimeciX
- Added: repository, build.publish, overrides[@electron/universal], electron-updater, electron-log, @electron-forge/maker-dmg, @electron-forge/publisher-github
- Removed: @electron-forge/maker-deb, @electron-forge/maker-rpm

**Wave 0 assets:**
| File | Method | Size |
|------|--------|------|
| animecix-v2/build/entitlements.mac.plist | Written verbatim from 04-RESEARCH.md Pattern 5 | ~800 bytes |
| animecix-v2/assets/icon.icns | sips (10 sizes) + iconutil from animecix-desktop/files/icon.png | 328 KB |
| animecix-v2/assets/icon.ico | png-to-ico from same source PNG | 279 KB |
| animecix-v2/resources/app-update.yml | Written; provider=github, owner=CaptainSP, repo=AnimeciX-Desktop-Apps | ~80 bytes |
| animecix-v2/dev-app-update.yml | Same without updaterCacheDirName; gitignored (T-4-09) | ~60 bytes |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 — Wave 0 assets | 18db350 | chore(04-01): generate Wave 0 build assets |
| 2 — forge.config.ts | fd5c549 | feat(04-01): rewrite forge.config.ts — remove Linux makers, add DMG + universal |
| 3 — package.json | d05fc00 | feat(04-01): update package.json — AnimeciX identity, deps, overrides |

## Deviations from Plan

### Pre-existing TypeScript Errors (out of scope)

The plan's success criterion states `npx tsc --noEmit` should exit 0. However, the codebase already had pre-existing TypeScript errors before this plan executed:
- `src/network/header-rewriter.ts` and `src/network/request-handler.ts`: Electron API type mismatches (Electron.CrossProcessExports.Session, Response type)
- `src/player-page/**/*.tsx`: JSX transform errors (tsconfig.json missing `jsx` compiler option)
- `vite.player.config.mts`: moduleResolution mismatch for @vitejs/plugin-react

These errors were confirmed present on the base commit (`cb1e99b`) before any changes. The forge.config.ts file itself compiles cleanly in isolation (`npx tsc forge.config.ts --noEmit` exits 0). These pre-existing errors are deferred to the appropriate plan that owns those files.

**Deviation type:** Out-of-scope pre-existing issue — not caused by this plan's changes.

### No git remote configured

The plan instructed to confirm the repo slug via `git remote get-url origin`. The repository has no remote configured. Used the GitHub user (`CaptainSP`) from package.json author field and project directory name (`AnimeciX Desktop Apps`) converted to kebab-case `AnimeciX-Desktop-Apps` for the repo name — matching the existing `animecix-desktop/electron-builder.yml` pattern and the git user in STATE.md.

### dev-app-update.yml not committed (correct behavior)

The file was added to .gitignore per T-4-09 before staging. Git refused to stage it as expected. The file exists on disk for local dev use but is intentionally absent from the repository.

## Known Stubs

None. All files contain production-ready content — no placeholder values remain.

## Threat Flags

None. All files stay within the threat model defined in the plan. dev-app-update.yml is gitignored (T-4-09). Repository URL is pinned to CaptainSP/AnimeciX-Desktop-Apps (T-4-05). Entitlements contain only the minimum required keys (T-4-08).

## Self-Check: PASSED

- animecix-v2/build/entitlements.mac.plist: FOUND
- animecix-v2/assets/icon.icns: FOUND (328 KB, magic bytes `icns`)
- animecix-v2/assets/icon.ico: FOUND (279 KB)
- animecix-v2/resources/app-update.yml: FOUND
- animecix-v2/dev-app-update.yml: FOUND on disk, gitignored (correct)
- forge.config.ts: MakerDMG present, MakerDeb/MakerRpm absent, appBundleId + osxUniversal wired
- package.json: productName=AnimeciX, repository, build.publish, overrides, electron-updater, electron-log all present; maker-deb/rpm absent
- Commits 18db350, fd5c549, d05fc00: all in git log
