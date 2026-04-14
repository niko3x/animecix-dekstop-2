---
phase: 04-ship
plan: "04"
subsystem: ci-pipeline
tags: [ci, github-actions, release-pipeline, update-manifest, signing, notarization]
dependency_graph:
  requires: [04-01, 04-02]
  provides: [release-workflow, verify-tag-script, generate-update-manifest-script]
  affects: [electron-updater-manifest-delivery, github-releases]
tech_stack:
  added: []
  patterns:
    - GitHub Actions matrix build (macos-14 + windows-latest)
    - Tag-gated CI with fail-fast version guard (verify-tag.mjs)
    - Temp keychain + ACL flags pattern for headless macOS code signing
    - ASC API key decoded to file path (not content) per Forge osxNotarize contract
    - electron-updater manifest computed from artifact on disk + uploaded via GitHub Releases API
key_files:
  created:
    - .github/workflows/release.yml
    - animecix-v2/scripts/verify-tag.mjs
    - animecix-v2/scripts/generate-update-manifest.mjs
  modified:
    - animecix-v2/package.json
decisions:
  - "Manifest upload uses native fetch + GitHub Releases API (no extra npm dep); idempotent via delete-before-upload"
  - "No workflow_dispatch per D-19; single tag-push trigger path for v1"
  - "fail-fast: false so macOS/Windows legs run independently; one platform failure does not cancel the other"
  - "verify-tag runs before npm ci so a version mismatch aborts before pulling dependencies"
metrics:
  duration_minutes: 15
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 4 Plan 4: CI Release Pipeline Summary

**One-liner:** Tag-gated GitHub Actions matrix pipeline that signs+notarizes macOS Universal + Windows x64 builds via electron-forge publish and uploads electron-updater manifest YAMLs to the draft GitHub Release.

## What Was Built

### animecix-v2/scripts/verify-tag.mjs

Fail-fast guard script run as the first CI step (before `npm ci`). Reads `GITHUB_REF_NAME` (or argv[1]), strips the `v` prefix, and compares to `package.json`'s `version` field. Exits 0 on match, exits 1 with a `::error::` annotation on mismatch. This blocks the entire matrix if someone pushes a tag that diverges from the package version (D-24, threat T-4-05).

### animecix-v2/scripts/generate-update-manifest.mjs

Post-publish helper that:
1. Accepts `darwin` or `win32` as its first argument
2. Globs `animecix-v2/out/make/` to find the correct artifact (`.zip` for macOS, `Setup.exe` for Windows)
3. Computes a base64-encoded SHA512 hash per the electron-updater spec
4. Writes `out/latest-mac.yml` or `out/latest.yml` with version, files, path, sha512, releaseDate
5. Finds the matching draft release via the GitHub Releases API
6. Deletes any pre-existing asset with the same manifest name (idempotent re-runs)
7. Uploads the manifest YAML to the draft release

Requires `GITHUB_TOKEN`, `GITHUB_REPOSITORY` (owner/repo), and `GITHUB_REF_NAME` env vars. Exit codes: 0 = success, 1 = artifact not found, 2 = API error.

### .github/workflows/release.yml

Single workflow file. Key structural properties:

| Property | Value |
|----------|-------|
| Trigger | `push` on tags `v*.*.*` (no workflow_dispatch) |
| Matrix | `macos-14` (darwin, universal) + `windows-latest` (win32, x64) |
| fail-fast | false — each leg runs independently |
| permissions | `contents: write` (required by publisher-github) |
| timeout | 60 minutes per job |

**Step order per matrix leg:**

1. `actions/checkout@v4`
2. `actions/setup-node@v4` (Node 22, npm cache keyed to animecix-v2/package-lock.json)
3. **Verify tag** — `node scripts/verify-tag.mjs` (before npm ci)
4. `npm ci`
5. macOS only: **Import Developer ID cert** — creates temp keychain in `$RUNNER_TEMP`, imports `.p12` with `-T /usr/bin/codesign -T /usr/bin/productbuild` ACL flags, removes cert.p12 immediately after import
6. macOS only: **Write ASC API key** — decodes base64 secret to `$RUNNER_TEMP/AuthKey.p8`, `chmod 600`, exports `APPLE_API_KEY=$KEY_PATH` to `$GITHUB_ENV` (Forge `osxNotarize` expects a file path, not content)
7. `npm test` (test failure blocks release)
8. macOS: `npx electron-forge publish --arch=universal --platform=darwin`
9. Windows: `npx electron-forge publish --arch=x64 --platform=win32`
10. macOS: `node scripts/generate-update-manifest.mjs darwin`
11. Windows: `node scripts/generate-update-manifest.mjs win32`
12. macOS (`if: always()`): delete keychain, remove `AuthKey.p8` and `cert.p12`

## Secret Handling

| Secret | Usage | Masking |
|--------|-------|---------|
| `APPLE_DEVELOPER_ID_APPLICATION_CERT` (base64 .p12) | Decoded to `$RUNNER_TEMP/cert.p12`, imported to keychain, file deleted | `::add-mask::$CERT_P12_BASE64` |
| `APPLE_DEVELOPER_ID_APPLICATION_CERT_PASSWORD` | Used with `security import -P` | `::add-mask::$CERT_PASSWORD` |
| `APPLE_API_KEY` (base64 .p8) | Decoded to `$RUNNER_TEMP/AuthKey.p8`, path exported as `APPLE_API_KEY` env | not masked (content is a file, path is safe) |
| `APPLE_API_KEY_ID` | Passed directly to Forge as env var | no masking needed (not sensitive alone) |
| `APPLE_API_ISSUER` | Passed directly to Forge as env var | no masking needed (not sensitive alone) |
| `APPLE_TEAM_ID` | Passed directly to Forge as env var | no masking needed |
| `GITHUB_TOKEN` | publisher-github + manifest upload | provided by Actions, auto-redacted |

`printf '%s'` is used instead of `echo` for decoding to avoid shell expansion issues and potential log leakage.

## Threat Mitigations Applied

| Threat | Mitigation |
|--------|------------|
| T-4-01: Secrets leaking in CI logs | `::add-mask::` on cert password + p12 content; `rm -f` cert.p12 post-import; `if: always()` cleanup removes keychain + AuthKey.p8 |
| T-4-05: Tag spoofing (wrong version) | `verify-tag.mjs` exits 1 if tag != package.json version; blocks entire matrix |
| T-4-06: Draft accidentally published | `draft: true` in forge.config.ts publisher config (Plan 04-02); workflow never promotes to published |
| T-4-13: Manifest SHA512 mismatch | `generate-update-manifest.mjs` reads artifact from disk, computes SHA512, deletes prior manifest before re-upload |
| T-4-14: Keychain prompt blocking CI | `-T /usr/bin/codesign -T /usr/bin/productbuild` ACL flags + `security set-key-partition-list`; 60-min job timeout |

## Expected Release Artifacts

After a successful `git tag v1.0.0 && git push --tags`, the draft GitHub Release will contain:

- `AnimeciX.dmg` — macOS first-install experience
- `AnimeciX-darwin-universal-1.0.0.zip` — macOS auto-update channel artifact
- `latest-mac.yml` — electron-updater macOS manifest (SHA512 of .zip)
- `AnimeciX-1.0.0 Setup.exe` — Windows installer
- `AnimeciX-1.0.0-full.nupkg` — Windows Squirrel delta package
- `RELEASES` — Squirrel RELEASES index
- `latest.yml` — electron-updater Windows manifest (SHA512 of Setup.exe)

## Deviations from Plan

None — plan executed exactly as written. All script code and workflow YAML match the provided templates verbatim. All must_haves and acceptance criteria verified.

## Self-Check

### Files Created/Modified

- [x] `.github/workflows/release.yml` — exists
- [x] `animecix-v2/scripts/verify-tag.mjs` — exists, executable
- [x] `animecix-v2/scripts/generate-update-manifest.mjs` — exists, executable
- [x] `animecix-v2/package.json` — updated with new script entries

### Commits

- [x] `4b41fa7` — feat(04-ship-04): add verify-tag and generate-update-manifest helper scripts
- [x] `2bc7641` — feat(04-ship-04): create release.yml GitHub Actions workflow

## Self-Check: PASSED
