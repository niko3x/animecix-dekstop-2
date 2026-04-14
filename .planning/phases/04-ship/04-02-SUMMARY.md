---
phase: 04-ship
plan: 02
subsystem: forge-config
tags: [code-signing, notarization, macos, publisher-github, electron-forge]
dependency_graph:
  requires: [04-01]
  provides: [signed-notarized-macos-build, github-draft-publish]
  affects: [animecix-v2/forge.config.ts]
tech_stack:
  added: []
  patterns:
    - osxSign with optionsForFile callback (entitlements + hardenedRuntime)
    - Conditional osxNotarize via ternary on APPLE_API_KEY env var (safe local dev)
    - publisher-github with draft:true gate (no accidental public ship)
key_files:
  created: []
  modified:
    - animecix-v2/forge.config.ts
decisions:
  - "osxNotarize guarded by process.env.APPLE_API_KEY ternary — local npm run make without creds works cleanly"
  - "All Apple and GitHub credentials flow in via process.env only — no secrets in source"
  - "publishers[0].config.draft:true implements the D-21 accidental-ship safety gate"
  - "tagPrefix:'v' aligns with D-24 semver tag convention (vMAJOR.MINOR.PATCH)"
metrics:
  duration: 8m
  completed: 2026-04-14
  tasks_completed: 1
  files_modified: 1
---

# Phase 04 Plan 02: Code Signing, Notarization, and GitHub Publisher Summary

**One-liner:** Added `osxSign` + `osxNotarize` (conditionally gated) + `@electron-forge/publisher-github` (draft:true) to forge.config.ts so `npm run publish` produces a signed and notarized macOS Universal build uploaded to a DRAFT GitHub Release.

---

## What Was Built

Three configuration blocks were added to `animecix-v2/forge.config.ts` inside the existing `ForgeConfig` object. No runtime code was changed.

### osxSign block (inside packagerConfig)

```typescript
osxSign: {
  optionsForFile: (_filePath: string) => ({
    entitlements: 'build/entitlements.mac.plist',
    hardenedRuntime: true,
  }),
},
```

- Entitlements file path: `build/entitlements.mac.plist` (already existed from 04-01).
- `hardenedRuntime: true` satisfies Apple's Gatekeeper requirement for notarization (D-06).
- Forge discovers the Developer ID Application cert automatically via `security find-identity` — no identity string needs to be hardcoded here; the CI job imports the cert before Forge runs (Plan 04-04).

### osxNotarize block (inside packagerConfig, conditionally defined)

```typescript
osxNotarize: process.env.APPLE_API_KEY ? {
  appleApiKey: process.env.APPLE_API_KEY,      // FILE PATH to .p8 (not base64 content)
  appleApiKeyId: process.env.APPLE_API_KEY_ID!,
  appleApiIssuer: process.env.APPLE_API_ISSUER!,
} : undefined,
```

**Key design choices:**
- The `process.env.APPLE_API_KEY ?` ternary means the entire notarize block is `undefined` when the env var is absent. Forge skips notarization cleanly. Developers can run `npm run make` locally without any Apple credentials.
- `APPLE_API_KEY` is an **absolute filesystem path** to a decoded `.p8` file — NOT the base64-encoded contents (Pitfall 4 from RESEARCH.md). The CI job (Plan 04-04) decodes the base64 secret to disk and exports the path.
- `!` assertions on `APPLE_API_KEY_ID` and `APPLE_API_ISSUER` are intentional: if `APPLE_API_KEY` is set but these are missing, it is a CI configuration bug and should throw loudly at sign time.
- Uses the ASC API key method (D-08) — `notarytool`, not legacy `altool`.

### publishers array (top-level ForgeConfig sibling to makers/plugins)

```typescript
publishers: [
  {
    name: '@electron-forge/publisher-github',
    config: {
      repository: { owner: 'CaptainSP', name: 'AnimeciX-Desktop-Apps' },
      draft: true,
      prerelease: false,
      generateReleaseNotes: true,
      tagPrefix: 'v',
      authToken: process.env.GITHUB_TOKEN,
    },
  },
],
```

- `draft: true` implements the D-21 safety gate: artifacts are uploaded to a GitHub Draft Release. No user receives an update until someone manually clicks "Publish release" in the GitHub UI.
- `prerelease: false` enforces the D-12 single stable channel — no accidental beta tagging.
- `generateReleaseNotes: true` populates the release body with GitHub's auto-generated changelog (D-22). User can edit the draft before publishing.
- `tagPrefix: 'v'` aligns with D-24 semver tag convention (`vMAJOR.MINOR.PATCH`).
- `authToken` flows from `process.env.GITHUB_TOKEN` — no hardcoded PAT (contrast with the legacy `animecix-desktop/electron-builder.yml` which had a hardcoded token that must be revoked per CONTEXT.md).

---

## Env Var Contract

| Variable | Source in CI | Used by |
|----------|-------------|---------|
| `APPLE_API_KEY` | Decoded `.p8` file path (Plan 04-04 writes it) | osxNotarize.appleApiKey |
| `APPLE_API_KEY_ID` | GitHub Secret `APPLE_API_KEY_ID` | osxNotarize.appleApiKeyId |
| `APPLE_API_ISSUER` | GitHub Secret `APPLE_API_ISSUER` | osxNotarize.appleApiIssuer |
| `APPLE_TEAM_ID` | GitHub Secret `APPLE_TEAM_ID` | Keychain import (Plan 04-04, not forge.config.ts) |
| `GITHUB_TOKEN` | GitHub Actions built-in | publishers[0].config.authToken |

Variables NOT used in forge.config.ts but consumed by the CI workflow (Plan 04-04):
- `APPLE_DEVELOPER_ID_APPLICATION_CERT` (base64 .p12)
- `APPLE_DEVELOPER_ID_APPLICATION_CERT_PASSWORD`

---

## Local Dev Behavior

Without any Apple/GitHub env vars:
- `osxNotarize` evaluates to `undefined` → Forge skips the notarize step entirely.
- `npm run make` produces an **unsigned** `.app` — normal for local development.
- No errors or warnings from missing env vars.

With full CI credentials:
- Forge signs → notarizes → uploads artifacts to DRAFT GitHub Release.
- `npm run publish` is the single CI command (D-25).

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Threat Surface

All T-4-XX mitigations implemented as specified in the plan threat model:

| Flag | Status |
|------|--------|
| T-4-01: No secrets in source | Enforced — all values from process.env |
| T-4-03: Unsigned update risk | Mitigated — osxSign + osxNotarize active in CI |
| T-4-06: Accidental public release | Mitigated — draft:true gate |
| T-4-10: Repository mismatch | Mitigated — owner/name hardcoded to CaptainSP/AnimeciX-Desktop-Apps |

---

## Self-Check

**Files modified:**
- `animecix-v2/forge.config.ts` — verified present and contains all required blocks

**Commit:** `dee6956` — `feat(04-02): add osxSign, osxNotarize, and publisher-github to forge.config.ts`

**Pattern verification (all passed):**
- `osxSign` present
- `osxNotarize` present with ternary guard
- `build/entitlements.mac.plist` referenced
- `hardenedRuntime: true` set
- `@electron-forge/publisher-github` name present
- `draft: true` present
- `prerelease: false` present
- `tagPrefix: 'v'` present
- `process.env.APPLE_API_KEY` referenced (not hardcoded value)
- `process.env.GITHUB_TOKEN` referenced
- No hardcoded secret strings detected

## Self-Check: PASSED
