# Phase 4: Ship - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a publicly distributable build of animecix-v2: signed, notarized macOS Universal installers (DMG + ZIP) and Windows Squirrel installers produced by a CI pipeline on tag push, with in-app auto-update from GitHub Releases via electron-updater. No new product features — this phase only ships what Phases 1–3 built. Linux targets are out of scope for v1.

</domain>

<decisions>
## Implementation Decisions

### Maker configuration
- **D-01:** Remove `MakerDeb` and `MakerRpm` from `animecix-v2/forge.config.ts` — Linux is out of scope for v1 per PROJECT.md.
- **D-02:** Keep `MakerSquirrel` for Windows x64. Squirrel `.nupkg` + `RELEASES` file is required for electron-updater's Windows update flow.
- **D-03:** Keep `MakerZIP` for darwin — electron-updater requires a `.zip` artifact for macOS auto-updates (delta ZIP is what the updater downloads and swaps in).
- **D-04:** Add `MakerDMG` for darwin — this is the user-facing first-install experience (drag-to-Applications). Both DMG and ZIP are produced per macOS build; ZIP is the update channel, DMG is the install channel.

### macOS architecture
- **D-05:** Single **Universal** binary (x64 + arm64 in one `.app`) via `packagerConfig.osxUniversal` / `arch: 'universal'`. One notarization, one signing pass, one DMG, one ZIP. Download size ~2× an arch-specific build — acceptable tradeoff for CI simplicity and zero arch-mismatch bugs.

### Code signing & notarization
- **D-06:** **macOS is fully signed + notarized** from day one. Identity: Developer ID Application cert (not Mac App Store). Hardened runtime enabled; entitlements file committed in `animecix-v2/build/entitlements.mac.plist`.
- **D-07:** **Windows ships unsigned for v1.** Users will see a SmartScreen "unknown publisher" warning on first install and can bypass via "More info → Run anyway". Windows code-signing cert acquisition is tracked as a follow-up milestone (not a phase 4 blocker).
- **D-08:** Notarization uses the **App Store Connect API key** method (3 GitHub secrets: `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`). Modern `notarytool` (not legacy `altool`). No Apple-ID/app-specific-password path.
- **D-09:** Signing happens AFTER `FusesPlugin` runs — Electron Forge's default sequencing already guarantees this (fuses mutate the binary during the package step, signing happens in the subsequent sign step). Do not reorder.

### Auto-update (electron-updater)
- **D-10:** Use **`electron-updater`** (not Forge's built-in `autoUpdater`) for both platforms. Reason: single API across win/mac, mature GitHub Releases provider, handles Squirrel on Windows and ZIP delta on macOS transparently.
- **D-11:** Provider: **GitHub Releases**, repo owner/name inferred from package.json `repository` field. No `update.electronjs.org` proxy.
- **D-12:** **Single `stable` channel** for v1. No beta channel. Semver tags (`vMAJOR.MINOR.PATCH`) drive releases. A pre-release channel can be added in a later milestone if needed.
- **D-13:** App calls `autoUpdater.checkForUpdates()` on launch (after 30s delay to avoid first-run jank) and every 4 hours while running. Failures are logged silently — never interrupt the user with "update check failed" dialogs.
- **D-14:** Download happens in the background automatically (`autoDownload: true` — default). User does not have to approve the download.

### Update UX
- **D-15:** When an update is ready to install, show a **non-blocking in-app banner** (HTML/CSS, rendered inside the main window above/overlaying the animecix.tv webview) with message "Yeni sürüm hazır" + "Şimdi yeniden başlat" / "Sonra" buttons. Turkish copy (primary audience).
- **D-16:** "Sonra" dismisses the banner for this session; banner re-appears on next launch if the update is still pending. No "skip this version" option for v1.
- **D-17:** Restart flow calls `autoUpdater.quitAndInstall()`. On Windows this invokes Squirrel's Update.exe; on macOS electron-updater handles the `.app` swap.
- **D-18:** Also add a "Güncellemeleri kontrol et" item in the tray menu (TrayManager exists from Phase 3-04) for manual checks. Shows same banner flow on success.

### CI pipeline
- **D-19:** **GitHub Actions**, single workflow file `.github/workflows/release.yml`. Trigger: `push` on tags matching `v*.*.*`. No `workflow_dispatch` for v1 — keep one trigger path.
- **D-20:** Matrix: `macos-14` (Apple Silicon runner, required for universal builds that include arm64 slice) + `windows-latest`. Each runner builds its own platform — no cross-compilation.
- **D-21:** Publisher: **`@electron-forge/publisher-github`** with `draft: true`, `prerelease: false`. CI uploads artifacts to a GitHub Release marked as DRAFT. User manually reviews artifacts and clicks "Publish release" in the GitHub UI to make it live and trigger user auto-updates. No accidental ships.
- **D-22:** Release notes: auto-populated from the GitHub-generated changelog (commits since previous tag). User can edit them in the draft before publishing. No Release-Please / conventional-commits automation for v1.
- **D-23:** Secrets: `APPLE_API_KEY` (base64-encoded .p8 file contents), `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `APPLE_TEAM_ID`, `APPLE_DEVELOPER_ID_APPLICATION_CERT` (base64 .p12), `APPLE_DEVELOPER_ID_APPLICATION_CERT_PASSWORD`, `GITHUB_TOKEN` (provided by Actions). No Windows cert secrets (D-07).
- **D-24:** Version source of truth: `animecix-v2/package.json` `version` field. The workflow verifies the pushed tag matches `v${package.json.version}` and fails early on mismatch — prevents tag/version drift.
- **D-25:** Builds run `npm ci && npm test && npm run make && npm run publish`. Test failure blocks the release. `electron-rebuild` for `better-sqlite3` (already wired in `postinstall`) runs automatically.

### App identity (carried forward from old app)
- **D-26:** appId: `com.onmuapps.animecix` (matches `animecix-desktop/electron-builder.yml:1` — keeps update continuity if migrating old users; also the bundle identifier Apple will notarize).
- **D-27:** productName in package.json: `AnimeciX` (display name). Current `animecix-v2/package.json:3` has `"animecix-v2"` — will be updated to `AnimeciX` as part of this phase.

### Claude's Discretion
- Exact banner visual design (colors, animation, icon) — keep minimal and consistent with current app styling.
- Log file location for update errors (follow Electron conventions: `app.getPath('logs')`).
- Whether to gzip-compress the notarization API key .p8 before base64-encoding (either works).
- Retry/backoff policy for failed update checks — electron-updater defaults are fine.
- How to structure the GitHub Actions workflow (single job with matrix vs separate jobs per OS) — whichever is cleaner.
- Icon generation pipeline (`.icns` for mac, `.ico` for Windows) if `animecix-v2/assets/` doesn't already have platform icons.

</decisions>

<specifics>
## Specific Ideas

- Keep the release flow boring and reversible. A broken release should be fixable by deleting the draft and re-tagging — not by a hotfix race.
- The draft-release gate is deliberate: user-facing updates should never be a surprise of a `git push --tags`.
- In-app update banner copy is Turkish because that is the primary audience (per PROJECT.md). English fallback only if a language system gets added later.
- Prefer electron-updater's built-in GitHub provider over any custom update server — GH Releases is the source of truth.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing project files (must read)
- `animecix-v2/forge.config.ts` — Current Forge config. Will be modified: remove Linux makers, add MakerDMG, add `osxSign`/`osxNotarize` to `packagerConfig`, add `publishers` section.
- `animecix-v2/package.json` — Name, version, main, scripts. Will be modified: productName, add `repository` field for electron-updater, add `electron-updater` dependency.
- `.planning/PROJECT.md` — Platform constraints (Windows + macOS only for v1); Key Decisions table.
- `.planning/REQUIREMENTS.md` — INTG-01 is the only requirement for this phase.
- `.planning/ROADMAP.md` §"Phase 4: Ship" — Phase goal + success criteria.

### Prior phase contexts (establish patterns)
- `.planning/phases/01-foundation/01-CONTEXT.md` — IPC naming conventions (camelCase verbs), session persistence (electron-updater must not break SHELL-04).
- `.planning/phases/03-downloads-and-offline/03-CONTEXT.md` §"Tray / notifications" — TrayManager surface where the "Check for updates" menu item will hook in.

### External documentation (read during research)
- Electron Forge publisher-github: https://www.electronforge.io/config/publishers/github
- Electron Forge code signing (macOS): https://www.electronforge.io/guides/code-signing/code-signing-macos
- electron-updater GitHub provider: https://www.electron.build/auto-update (applies even when using Forge)
- Apple notarytool + ASC API key: https://developer.apple.com/documentation/security/customizing-the-notarization-workflow
- Fuses and signing order: https://www.electronjs.org/docs/latest/tutorial/fuses

### Legacy app (reference only, do not copy tokens)
- `animecix-desktop/electron-builder.yml` — Old publish config. **SECURITY:** Contains a hardcoded GitHub PAT (line 9) — must be revoked before public release; do not reuse. Useful only for appId (`com.onmuapps.animecix`) and protocol scheme inheritance.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `animecix-v2/forge.config.ts:22` — `MakerSquirrel` already configured (empty options). Ready to wire icon + iconUrl.
- `animecix-v2/forge.config.ts:23` — `MakerZIP({}, ['darwin'])` already scoped to darwin — good, stays as-is.
- `animecix-v2/forge.config.ts:52-60` — `FusesPlugin` already running. Signing must follow fuses — Forge handles this ordering automatically; do not interfere.
- Phase 3 `TrayManager` — already constructs a tray menu; adding "Check for updates" is one menu item insertion.

### Established Patterns
- IPC channels use camelCase verbs (from Phase 1). New updater IPC (if any) should follow: `checkForUpdates`, `installUpdate`, `updateAvailable` (event).
- `better-sqlite3` native module handled by `auto-unpack-natives` plugin (`forge.config.ts:28`) and `rebuildConfig.onlyModules` — signing/notarization must cover the unpacked `.node` file. This is automatic with Forge's sign step but needs verification in CI.
- No existing GitHub Actions workflows (`.github/workflows/` contains only README files). Clean slate.

### Integration Points
- `animecix-v2/src/main.ts` — electron-updater bootstrap goes here (after app.whenReady, before window creation is fine). Wire to TrayManager for menu item.
- `animecix-v2/src/preload.ts` — add updater event bridge (`onUpdateAvailable`, `onUpdateDownloaded`) if the in-app banner is rendered in the webview (vs native). For v1, a main-process-rendered BrowserView overlay may be simpler — planner to decide.
- `animecix-v2/package.json:scripts` — `publish` script already present (`electron-forge publish`); CI will call it directly.
- Repo root — needs `.github/workflows/release.yml` created.

</code_context>

<deferred>
## Deferred Ideas

- **Windows code signing** — Acquire EV or OV cert, add MS Azure Trusted Signing or cert-based signing to CI. Separate milestone post-v1.
- **Beta update channel** — Pre-release tags (`v1.2.0-beta.1`) + in-app opt-in. Added only if beta testing pressure exists post-launch.
- **Delta updates on Windows** — Squirrel already supports delta `.nupkg`s; verify they're being produced and served. If not, a small follow-up plan.
- **"Skip this version" option on update banner** — User research first; many apps regret adding it.
- **Auto-generated changelog from conventional commits** — Release-Please or similar. Overkill for solo-dev v1; revisit if the project adds contributors.
- **Linux builds (deb, AppImage)** — v2 milestone per REQUIREMENTS.md (PLAT-01).
- **Mandatory updates** (force restart below a minimum version) — Don't add without a concrete reason; user trust cost is high.
- **Code-signing cert rotation automation** — Manual rotation is fine at v1 scale.

</deferred>

---

*Phase: 04-ship*
*Context gathered: 2026-04-14*
