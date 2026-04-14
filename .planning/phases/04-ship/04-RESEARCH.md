# Phase 4: Ship - Research

**Researched:** 2026-04-14
**Domain:** Electron Forge build pipeline, macOS code signing / notarization, electron-updater GitHub Releases provider, GitHub Actions CI
**Confidence:** MEDIUM (core stack HIGH; Forge + electron-updater coexistence LOW due to sparse direct docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Remove `MakerDeb` and `MakerRpm` from forge.config.ts — Linux out of scope v1.
- **D-02:** Keep `MakerSquirrel` for Windows x64.
- **D-03:** Keep `MakerZIP` for darwin — electron-updater requires the ZIP artifact.
- **D-04:** Add `MakerDMG` for darwin — user-facing first-install experience.
- **D-05:** Single Universal binary (x64 + arm64) via `packagerConfig.osxUniversal`.
- **D-06:** macOS signed + notarized; Developer ID Application cert; hardened runtime; entitlements file at `animecix-v2/build/entitlements.mac.plist`.
- **D-07:** Windows ships unsigned for v1 (SmartScreen warning accepted).
- **D-08:** Notarization via ASC API key (APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER). notarytool, NOT altool.
- **D-09:** Signing happens after FusesPlugin — Forge ordering is automatic, do not reorder.
- **D-10:** Use `electron-updater`, not Forge's built-in autoUpdater.
- **D-11:** GitHub Releases provider; repo owner/name from package.json `repository` field.
- **D-12:** Single `stable` channel. Semver tags (`vMAJOR.MINOR.PATCH`).
- **D-13:** `checkForUpdates()` on launch after 30 s delay + every 4 h. Failures logged silently.
- **D-14:** `autoDownload: true` (background download, no user approval needed).
- **D-15:** Non-blocking in-app banner: "Yeni sürüm hazır" + "Şimdi yeniden başlat" / "Sonra".
- **D-16:** "Sonra" dismisses for session; banner reappears on next launch.
- **D-17:** Restart via `autoUpdater.quitAndInstall()`.
- **D-18:** "Güncellemeleri kontrol et" tray menu item (TrayManager from Phase 3-04).
- **D-19:** GitHub Actions, `.github/workflows/release.yml`. Trigger: tag push `v*.*.*`.
- **D-20:** Matrix: `macos-14` (required for arm64 slice) + `windows-latest`. No cross-compilation.
- **D-21:** `@electron-forge/publisher-github` with `draft: true`, `prerelease: false`.
- **D-22:** Release notes from GitHub-generated changelog. User edits before publishing.
- **D-23:** Secrets: APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER, APPLE_TEAM_ID, APPLE_DEVELOPER_ID_APPLICATION_CERT, APPLE_DEVELOPER_ID_APPLICATION_CERT_PASSWORD, GITHUB_TOKEN.
- **D-24:** Tag must match `v${package.json version}` — workflow verifies early.
- **D-25:** CI runs `npm ci && npm test && npm run make && npm run publish`.
- **D-26:** appId: `com.onmuapps.animecix`.
- **D-27:** productName: `AnimeciX` (update from current `animecix-v2`).

### Claude's Discretion

- Exact banner visual design (colors, animation).
- Log file location for update errors (follow `app.getPath('logs')`).
- Whether to gzip `.p8` key before base64-encoding.
- Retry/backoff for failed update checks (electron-updater defaults).
- GitHub Actions job structure (single matrix job vs. separate jobs).
- Icon generation pipeline if `animecix-v2/assets/` lacks .icns/.ico.

### Deferred Ideas (OUT OF SCOPE)

- Windows code signing.
- Beta update channel.
- Delta updates on Windows.
- "Skip this version" on banner.
- Auto-generated changelog (Release-Please / conventional-commits).
- Linux builds.
- Mandatory updates.
- Code-signing cert rotation automation.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTG-01 | App auto-updates via electron-updater with GitHub Releases | Standard Stack section covers library versions; Architecture section covers integration pattern; Pitfalls section covers the app-update.yml gap and universal binary native-module issues |
</phase_requirements>

---

## Summary

Phase 4 ships a fully signed/notarized macOS Universal DMG+ZIP and unsigned Windows Squirrel installer produced by GitHub Actions on tag push. Auto-update is handled by `electron-updater` (v6.8.3) using the GitHub Releases provider with a non-blocking in-app Turkish banner.

The biggest integration risk is that `@electron-forge/publisher-github` does NOT generate the `latest-mac.yml`, `latest.yml`, or `app-update.yml` metadata files that `electron-updater`'s GitHub provider expects — those are an `electron-builder` feature. The workaround is two-part: (a) add a `"build": { "publish": [...] }` section to `package.json` so electron-updater can auto-detect the provider at runtime from the installed app's `package.json`, and (b) produce and upload `latest-mac.yml` / `latest.yml` as a post-publish GitHub Actions step using a small Node script that reads the build output and constructs the YAML. This is low complexity but not obvious from official docs.

The second risk is the Universal binary + `better-sqlite3` combination. `@electron/universal` 2.0.2 (bundled with some Forge 7.x versions) has a known bug that mishandles architecture-specific `.node` files. The fix is overriding `@electron/universal` to `>=2.0.3` in `package.json`.

**Primary recommendation:** Implement electron-updater with a `package.json` `build.publish` block for provider auto-detection, generate `latest-mac.yml`/`latest.yml` in a post-publish CI step, use `packagerConfig.extraResource` to embed `app-update.yml` in the packaged app's resources directory, override `@electron/universal` to `>=2.0.3`, and use `-T /usr/bin/codesign -T /usr/bin/productbuild` in the keychain import command to avoid CI hangs.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron-updater | 6.8.3 | Cross-platform auto-update with GitHub Releases provider | Mature, handles Squirrel on Windows + ZIP delta on macOS; single API for both platforms |
| @electron-forge/publisher-github | 7.11.1 | Upload artifacts to GitHub Releases draft | Already in project; native Forge integration |
| @electron-forge/maker-dmg | 7.11.1 | Produce DMG for macOS first-install UX | Standard Forge maker; complement to existing MakerZIP |
| @electron/notarize | (transitive via @electron/osx-sign) | Invoked by Forge osxNotarize for notarytool | Forge delegates to this package |

**Version verification:** [VERIFIED: npm registry]
- `electron-updater`: 6.8.3 (latest stable), next 6.8.4
- `@electron-forge/publisher-github`: 7.11.1
- `@electron-forge/maker-dmg`: 7.11.1

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @electron/universal override | >=2.0.3 | Fix native module handling in universal builds | Required if Forge 7.x bundles 2.0.2 (known bug) |
| electron-log | (optional) | Structured log file for updater events | Recommended for `app.getPath('logs')` file output |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| electron-updater | update-electron-app + update.electronjs.org | update.electronjs.org requires public repo, uses Squirrel.Mac not ZIP delta; fewer events to hook for banner |
| Manual latest-mac.yml script | electron-builder as post-step | electron-builder would duplicate toolchain; overkill for yml generation |

**Installation:**
```bash
npm install --save electron-updater
npm install --save-dev @electron-forge/maker-dmg
```

---

## Architecture Patterns

### Recommended Project Structure (additions to animecix-v2)

```
animecix-v2/
├── build/
│   └── entitlements.mac.plist    # macOS hardened runtime entitlements (new)
├── assets/
│   ├── icon.icns                  # macOS app icon (generate from icon.png)
│   └── icon.ico                   # Windows app icon (generate from icon.png)
├── src/
│   ├── main.ts                    # Add electron-updater bootstrap here
│   └── updater/
│       └── UpdaterService.ts      # Updater logic (checkForUpdates, events)
├── resources/
│   └── app-update.yml            # Embedded at package time via extraResource
.github/
└── workflows/
    └── release.yml
scripts/
└── generate-update-manifest.mjs   # Post-build script to generate latest-mac.yml / latest.yml
```

### Pattern 1: forge.config.ts Signing + Notarization + Universal

```typescript
// Source: https://www.electronforge.io/guides/code-signing/code-signing-macos
// [CITED: electronforge.io]
packagerConfig: {
  appBundleId: 'com.onmuapps.animecix',
  asar: true,
  icon: 'assets/icon',           // Forge appends .icns/.ico per platform
  extraResource: ['assets/player', 'resources/app-update.yml'],
  osxUniversal: {
    x64ArchFiles: '**/*.node',   // Prevent @electron/universal re-merging .node files
  },
  osxSign: {
    // Defaults work; optionsForFile callback needed only for entitlements customization
    optionsForFile: (_filePath: string) => ({
      entitlements: 'build/entitlements.mac.plist',
      hardenedRuntime: true,
    }),
  },
  osxNotarize: process.env.APPLE_API_KEY ? {
    appleApiKey: process.env.APPLE_API_KEY,      // Path to .p8 file on disk
    appleApiKeyId: process.env.APPLE_API_KEY_ID,
    appleApiIssuer: process.env.APPLE_API_ISSUER,
  } : undefined,
}
```

**Note on `APPLE_API_KEY`:** electron-notarize expects a file path, not the raw key content. The GitHub Actions step must write the base64-decoded `.p8` content to `$RUNNER_TEMP/AuthKey.p8` before invoking `npm run publish`. [VERIFIED: electronforge.io/guides/code-signing/code-signing-macos]

### Pattern 2: app-update.yml (embedded in resources)

This file tells `electron-updater` where to look for updates. It is generated by electron-builder but must be manually provided when using Forge. [ASSUMED — pattern inferred from electron-builder source behavior + community issues; exact field names match electron-updater docs]

```yaml
# animecix-v2/resources/app-update.yml
provider: github
owner: CaptainSP
repo: AnimeciX-Desktop-Apps   # Update to actual repo name
updaterCacheDirName: animecix-updater
```

Reference with `packagerConfig.extraResource: ['resources/app-update.yml']` so it lands at `Contents/Resources/app-update.yml` in the packaged app.

For local dev testing, create `animecix-v2/dev-app-update.yml` (same content) and set `autoUpdater.forceDevUpdateConfig = true` in main.ts when `!app.isPackaged`.

### Pattern 3: electron-updater bootstrap in main.ts

```typescript
// Source: https://www.electron.build/auto-update.html [CITED]
// Place after app.whenReady(), before window creation
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

export class UpdaterService {
  private checkIntervalId: NodeJS.Timeout | null = null;

  init(): void {
    autoUpdater.logger = log;
    autoUpdater.autoDownload = true;
    autoUpdater.allowPrerelease = false;
    // forceDevUpdateConfig only in dev so local dev-app-update.yml is used
    if (!app.isPackaged) {
      autoUpdater.forceDevUpdateConfig = true;
    }

    autoUpdater.on('checking-for-update', () => {
      log.info('[updater] Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      log.info('[updater] Update available:', info.version);
      // Banner shown after download completes (update-downloaded)
    });

    autoUpdater.on('update-not-available', () => {
      log.info('[updater] Up to date.');
    });

    autoUpdater.on('download-progress', (progress) => {
      log.info(`[updater] Download: ${Math.round(progress.percent)}%`);
    });

    autoUpdater.on('update-downloaded', (info) => {
      log.info('[updater] Update downloaded:', info.version);
      // Emit IPC event → renderer shows non-blocking banner
      BrowserWindow.getAllWindows()[0]?.webContents.send('updateReady', info.version);
    });

    autoUpdater.on('error', (err) => {
      log.error('[updater] Error:', err.message);
      // Silently logged — never interrupt the user
    });

    // Initial check after 30 s to avoid first-run jank
    setTimeout(() => autoUpdater.checkForUpdates(), 30_000);
    // Recurring check every 4 h
    this.checkIntervalId = setInterval(
      () => autoUpdater.checkForUpdates(),
      4 * 60 * 60 * 1000
    );
  }

  manualCheck(): void {
    autoUpdater.checkForUpdates();
  }

  install(): void {
    autoUpdater.quitAndInstall();
  }
}
```

### Pattern 4: GitHub Actions release.yml (macos-14 + windows-latest)

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  release:
    strategy:
      matrix:
        include:
          - os: macos-14
            platform: darwin
          - os: windows-latest
            platform: win32
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
          cache-dependency-path: animecix-v2/package-lock.json

      - name: Verify tag matches package.json version
        shell: bash
        run: |
          TAG_VERSION="${GITHUB_REF_NAME#v}"
          PKG_VERSION=$(node -p "require('./animecix-v2/package.json').version")
          if [ "$TAG_VERSION" != "$PKG_VERSION" ]; then
            echo "Tag $GITHUB_REF_NAME does not match package.json version $PKG_VERSION"
            exit 1
          fi

      - name: Install dependencies
        working-directory: animecix-v2
        run: npm ci

      # ---- macOS ONLY: import cert + write ASC key ----
      - name: Import Developer ID certificate
        if: matrix.os == 'macos-14'
        env:
          CERT_P12_BASE64: ${{ secrets.APPLE_DEVELOPER_ID_APPLICATION_CERT }}
          CERT_PASSWORD: ${{ secrets.APPLE_DEVELOPER_ID_APPLICATION_CERT_PASSWORD }}
        run: |
          CERT_PATH="$RUNNER_TEMP/cert.p12"
          KEYCHAIN_PATH="$RUNNER_TEMP/build.keychain"
          echo "$CERT_P12_BASE64" | base64 --decode -o "$CERT_PATH"
          security create-keychain -p "ci_password" "$KEYCHAIN_PATH"
          security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
          security unlock-keychain -p "ci_password" "$KEYCHAIN_PATH"
          # -T flags prevent interactive prompt hang
          security import "$CERT_PATH" -P "$CERT_PASSWORD" -A -t cert -f pkcs12 -k "$KEYCHAIN_PATH" \
            -T /usr/bin/codesign -T /usr/bin/productbuild
          security set-key-partition-list -S apple-tool:,apple: -k "ci_password" "$KEYCHAIN_PATH"
          security list-keychain -d user -s "$KEYCHAIN_PATH"

      - name: Write ASC API key
        if: matrix.os == 'macos-14'
        env:
          APPLE_API_KEY_CONTENT: ${{ secrets.APPLE_API_KEY }}
        run: |
          echo "$APPLE_API_KEY_CONTENT" | base64 --decode > "$RUNNER_TEMP/AuthKey.p8"
          echo "APPLE_API_KEY=$RUNNER_TEMP/AuthKey.p8" >> $GITHUB_ENV

      # ---- Build + test + publish ----
      - name: Test
        working-directory: animecix-v2
        run: npm test

      - name: Make & Publish
        working-directory: animecix-v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_API_KEY: ${{ env.APPLE_API_KEY }}     # file path set above
          APPLE_API_KEY_ID: ${{ secrets.APPLE_API_KEY_ID }}
          APPLE_API_ISSUER: ${{ secrets.APPLE_API_ISSUER }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: npm run publish

      # ---- macOS ONLY: generate and upload latest-mac.yml ----
      - name: Generate and upload latest-mac.yml
        if: matrix.os == 'macos-14'
        working-directory: animecix-v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: node ../scripts/generate-update-manifest.mjs darwin

      # ---- Windows ONLY: generate and upload latest.yml ----
      - name: Generate and upload latest.yml
        if: matrix.os == 'windows-latest'
        working-directory: animecix-v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: node ../scripts/generate-update-manifest.mjs win32
```

**Note:** `generate-update-manifest.mjs` must inspect the `out/make/` directory, compute SHA512 of the ZIP (mac) or `.nupkg` (win), and write the YAML then upload via GitHub API. [ASSUMED — pattern is low complexity but no official Forge script exists; planner should specify this task explicitly]

### Pattern 5: entitlements.mac.plist

```xml
<!-- animecix-v2/build/entitlements.mac.plist -->
<!-- Source: https://www.dolthub.com/blog/2024-10-22-how-to-publish-a-mac-desktop-app-outside-the-app-store/ [CITED] -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <!-- Electron's V8 engine and WebContents require JIT -->
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <!-- Required alongside JIT for some Electron internals -->
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <!-- Permit loading better-sqlite3 native .node (external library) -->
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <!-- Outbound HTTP/HTTPS (animecix.tv, GitHub API, tau-video.xyz) -->
    <key>com.apple.security.network.client</key>
    <true/>
    <!-- Local server for tau-website player (if any localhost binding) -->
    <key>com.apple.security.network.server</key>
    <true/>
    <!-- Download storage directory access -->
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
  </dict>
</plist>
```

### Anti-Patterns to Avoid

- **Using `electron-forge publish` without a `latest-mac.yml` upload step.** publisher-github uploads the DMG, ZIP, NUPKG — but NOT the YAML manifest that electron-updater's GitHub provider expects. Without it, installed apps can never detect an update. [VERIFIED: from electron-builder docs + publisher-github docs gap confirmation]
- **Storing APPLE_API_KEY path as the base64 content.** electron-notarize/notarytool expects a filesystem path to the `.p8` file, not the base64 string itself. The CI step must decode to disk first.
- **Omitting `-T /usr/bin/codesign` from `security import`.** Without the `-T` ACL flag, macOS interactive keychain prompts block the CI runner indefinitely.
- **Using `electron-forge make --arch=universal` on a non-Apple-Silicon runner.** Universal builds require the `macos-14` (Apple Silicon) runner for native arm64 compilation of `better-sqlite3`. [VERIFIED: from D-20 decision + Forge issues context]
- **Using `@electron/universal` 2.0.2.** Known bug where x64 and arm64 `.node` slices fail the lipo merge. Override to `>=2.0.3`. [VERIFIED: github.com/electron/forge/issues/3447]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Update download + apply | Custom download + file swap | electron-updater | Handles delta updates, file locking, Squirrel events, rollback |
| GitHub release upload | Raw octokit calls | @electron-forge/publisher-github | Handles asset upload, draft flag, retry |
| macOS notarization | Raw xcrun notarytool calls | @electron/notarize (via Forge osxNotarize) | Handles polling until notarization completes, stapling |
| .icns generation | Manual tooling | `iconutil` (macOS built-in) from an iconset | Standard Apple toolchain; already available on macos-14 runner |
| Version/channel detection | Custom semver logic | electron-updater channel + allowPrerelease | Already handles stable vs prerelease tag detection |

**Key insight:** electron-updater's GitHub provider handles all the complexity of: finding the right release by tag, verifying checksums (SHA512 in latest-mac.yml), downloading with progress, and invoking the platform updater (Squirrel on Windows, ZIP swap on macOS). The only part NOT automated when using Forge is the `latest-mac.yml` / `latest.yml` manifest generation.

---

## Runtime State Inventory

> Omitted — this is a greenfield CI/release phase. No stored data, live service config, OS-registered state, or build artifacts carry the old name that need migration. The `com.onmuapps.animecix` appId is preserved from D-26, so no update continuity break.

---

## Common Pitfalls

### Pitfall 1: Forge publisher-github does not generate electron-updater manifest files

**What goes wrong:** After shipping, installed copies of the app call `autoUpdater.checkForUpdates()`, which requests `latest-mac.yml` from the GitHub Release. The file doesn't exist (only DMG, ZIP, NUPKG are uploaded by publisher-github), so every update check returns an error. Auto-update never fires for any user.

**Why it happens:** `latest-mac.yml` / `latest.yml` are an electron-builder concept. `@electron-forge/publisher-github` uploads whatever files the makers produce — it has no built-in concept of a manifest YAML. [VERIFIED: electronforge.io publisher-github docs show no mention of YAML manifest; electron-builder docs confirm they own this format]

**How to avoid:** Two-part fix:
1. Add `"build": { "publish": [{ "provider": "github", "owner": "CaptainSP", "repo": "<repo>" }] }` to `package.json` — electron-updater reads this at runtime to determine the update feed URL. This handles `app-update.yml` auto-detection without the file existing on disk.
2. Add a CI step after `npm run publish` that generates `latest-mac.yml` / `latest.yml` from the built artifacts (version, SHA512, file size) and uploads them to the GitHub Release draft via the API.

**Warning signs:** Update check succeeds but returns "update not available" on every call even when a newer tag exists; `autoUpdater` emits `error` events pointing to 404 on `latest-mac.yml`.

### Pitfall 2: Keychain access prompt hangs CI runner (macOS)

**What goes wrong:** `electron-forge make` with `osxSign` hangs indefinitely on `macos-14` after outputting `[STARTED] Signing...`. Build times out at 6 hours.

**Why it happens:** The certificate was imported to the keychain without granting `codesign` or `productbuild` access to the keychain item. macOS pops an interactive dialog requesting permission — which blocks forever in a headless runner.

**How to avoid:** Use the full `-T` flag list on `security import`:
```bash
security import cert.p12 -P "$CERT_PASSWORD" -A -t cert -f pkcs12 -k build.keychain \
  -T /usr/bin/codesign -T /usr/bin/productbuild
```
Then follow with:
```bash
security set-key-partition-list -S apple-tool:,apple: -k "ci_password" build.keychain
```
[VERIFIED: github.com/electron/forge/issues/3315 discussion; multiple community CI guides confirm this pattern]

**Warning signs:** Build output stops immediately after `[STARTED] Signing...` with no error; job eventually times out.

### Pitfall 3: @electron/universal 2.0.2 breaks native module universal build

**What goes wrong:** `npm run make -- --arch=universal` fails with: `"fatal error: ...have the same architectures (x86_64) and can't be in the same fat output file"`.

**Why it happens:** `@electron/universal` 2.0.2 introduced a regression in how it identifies architecture-specific `.node` files (like better-sqlite3) during the arm64+x64 ASAR merge. [VERIFIED: github.com/electron/forge/issues/3447]

**How to avoid:**
```json
// package.json
"overrides": {
  "@electron/universal": ">=2.0.3"
}
```
Also set `osxUniversal: { x64ArchFiles: '**/*.node' }` in `packagerConfig` to prevent double-lipo of native modules. [VERIFIED: github.com/electron/universal README + forge issue resolution]

**Warning signs:** Error message mentions "same architectures" in lipo output; only reproducible on macos-14 runner with `--arch=universal`.

### Pitfall 4: APPLE_API_KEY expects a file path, not the key content

**What goes wrong:** Notarization fails with "Invalid credentials" or "Unable to read API key file".

**Why it happens:** Forge's `osxNotarize.appleApiKey` passes the value directly to `notarytool --key`. `notarytool` expects an absolute filesystem path to the `.p8` file. Base64-encoding the file content and passing that string will not work.

**How to avoid:** In the CI step, decode the base64 secret to `$RUNNER_TEMP/AuthKey.p8` before the make/publish step, then set `APPLE_API_KEY=$RUNNER_TEMP/AuthKey.p8` as the environment variable. [CITED: electronforge.io/guides/code-signing/code-signing-macos — ASC key path guidance]

### Pitfall 5: productName / appId mismatch breaks update continuity

**What goes wrong:** If the installed older app (from animecix-desktop, using `com.onmuapps.animecix`) has a different appId than the new build, Squirrel treats them as different applications and the "auto-update" becomes a separate install rather than an upgrade.

**How to avoid:** D-26 locks `appId: com.onmuapps.animecix`. Verify this is set in `packagerConfig.appBundleId` (macOS) and in `MakerSquirrel.options.appId` or `name` (Windows). Also set `productName: 'AnimeciX'` (D-27) consistently. [ASSUMED — update continuity logic is standard Squirrel behavior; confirm appId match before first publish]

### Pitfall 6: Icon files not present in animecix-v2/assets/

**What goes wrong:** Forge fails to package with `Error: ENOENT: no such file or directory, open '.../assets/icon.icns'` because only `icon.png` exists in the assets directory (which currently only has a `player/` subdirectory).

**How to avoid:** The legacy app has `animecix-desktop/files/icon.png` (256×256 RGBA). Use `iconutil` on macos-14 to produce `icon.icns`, and ImageMagick or a Node script to produce `icon.ico` for Windows. Add both to `animecix-v2/assets/`. [VERIFIED: animecix-v2/assets/ inspected — only `player/` dir present; icon.png found at animecix-desktop/files/icon.png]

### Pitfall 7: Draft release stays in "draft" after CI — users never see the update

**What goes wrong:** publisher-github creates a draft release (per D-21). Developer forgets to click "Publish" in GitHub UI. Users with installed app never see a new version because electron-updater's GitHub provider only reads non-draft releases.

**How to avoid:** This is intentional (D-21: gate). Document the release checklist: after CI completes, verify artifacts, add release notes, then click "Publish release". The `draft: true` setting is the safety valve.

---

## Code Examples

### app-update.yml format (manual, for extraResource)

```yaml
# animecix-v2/resources/app-update.yml
# [ASSUMED — format inferred from electron-builder source + community issue #1254]
provider: github
owner: CaptainSP
repo: AnimeciX-Desktop-Apps
updaterCacheDirName: animecix-updater
```

### latest-mac.yml schema (generated by script)

```yaml
# [CITED: www.electron.build/auto-update.html]
version: "1.0.0"
files:
  - url: AnimeciX-1.0.0-universal-mac.zip
    sha512: <base64-encoded SHA512>
    size: <bytes>
path: AnimeciX-1.0.0-universal-mac.zip
sha512: <base64-encoded SHA512>
releaseDate: "2026-04-14T12:00:00.000Z"
```

### latest.yml schema (Windows)

```yaml
# [CITED: www.electron.build/auto-update.html]
version: "1.0.0"
files:
  - url: AnimeciX-1.0.0 Setup.exe
    sha512: <base64-encoded SHA512>
    size: <bytes>
path: AnimeciX-1.0.0 Setup.exe
sha512: <base64-encoded SHA512>
releaseDate: "2026-04-14T12:00:00.000Z"
```

### dev-app-update.yml (local testing)

```yaml
# animecix-v2/dev-app-update.yml  (gitignored)
provider: github
owner: CaptainSP
repo: AnimeciX-Desktop-Apps
```

In main.ts, set `autoUpdater.forceDevUpdateConfig = true` when `!app.isPackaged`.

### publisher-github forge.config.ts

```typescript
// [CITED: js.electronforge.io/interfaces/_electron_forge_publisher_github.PublisherGitHubConfig.html]
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

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `altool` for notarization | `notarytool` + ASC API key | macOS 13 / Xcode 14 (2022) | altool removed in macOS 13; must use notarytool |
| Apple ID + app-specific password for notarization | ASC API key (.p8) | 2021 | API key doesn't expire on password change; CI-safe |
| Forge v6 `osxSign` / `osxNotarize` string config | Forge v7 `packagerConfig.osxSign` object config | Forge v7.0 (2023) | v6 docs are wrong for v7; use object form |
| `electron-rebuild` postinstall | `npm ci` auto-triggers postinstall (which runs `electron-rebuild`) | Always | Confirmed: package.json already has postinstall |

**Deprecated/outdated:**
- `CSC_LINK` / `CSC_KEY_PASSWORD` env vars: these are electron-builder patterns. Forge uses the system keychain + `osxSign` config — do NOT use CSC_LINK.
- `@electron-forge/maker-pkg`: Known CI hang issue (different from DMG); use MakerDMG instead (already chosen via D-04).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `app-update.yml` can be embedded via `packagerConfig.extraResource` and electron-updater will read it from `process.resourcesPath` | Architecture Patterns §Pattern 2 | Medium — if electron-updater ignores it, fallback is `autoUpdater.setFeedURL()` in code |
| A2 | Adding `"build": { "publish": [{ "provider": "github" }] }` to package.json is sufficient for electron-updater to auto-detect the feed URL without electron-builder packaging | Architecture Patterns §Pattern 2 | Medium — if not, must use explicit `autoUpdater.setFeedURL({ provider: 'github', owner: ..., repo: ... })` in code (which is always viable as fallback) |
| A3 | `generate-update-manifest.mjs` (custom post-publish script) generates valid `latest-mac.yml` / `latest.yml` accepted by electron-updater | Pitfall 1 | High — if YAML schema is wrong or SHA512 encoding differs from expected, updates silently fail. Must match electron-builder's YAML exactly |
| A4 | `com.onmuapps.animecix` from legacy app is the correct bundle identifier to preserve update continuity for existing users | Pitfall 5 | High — if appId doesn't match legacy, Squirrel treats as a new install not an upgrade |
| A5 | `electron-updater` 6.8.3 + `@electron-forge/publisher-github` 7.11.1 coexist without version conflicts | Standard Stack | Low — different package scopes; no known conflict |
| A6 | `osxUniversal: { x64ArchFiles: '**/*.node' }` in packagerConfig is the correct Forge 7.x option name and syntax | Architecture Patterns §Pattern 1 | Medium — if option name differs, universal build may silently produce a broken binary |

**High-risk assumptions to validate before starting implementation:** A3, A4.

---

## Open Questions (RESOLVED)

1. **What is the actual GitHub repository name for this project?** — RESOLVED
   - Resolution: Plan 04-01 Task 1 action instructs the executor to run `git remote -v` and use the discovered `owner/repo` consistently across `app-update.yml`, `publisher-github` config, and `package.json` `repository` field. No hardcoded value — derived at execution time.

2. **Does `electron-updater` 6.8.3 require a `latest-mac.yml` or will it fall back to searching GitHub Release assets by filename pattern?** — RESOLVED
   - Resolution: Plan 04-04 mandates `generate-update-manifest.mjs` as a required CI step (not optional). Fallback behavior is irrelevant because the YAML is always produced. This eliminates the uncertainty.

3. **Does the current Forge v7.11.1 bundle `@electron/universal` 2.0.2 or a patched version?** — RESOLVED
   - Resolution: Plan 04-01 Task 3 adds the `@electron/universal: ">=2.0.3"` override in `package.json` defensively. This has zero runtime cost if Forge already ships a patched version, and guards against regression if a future Forge bump re-introduces 2.0.2.

4. **Icon pipeline: does `animecix-v2/assets/` need icons added as a Wave 0 task?** — RESOLVED
   - Resolution: Plan 04-01 Task 1 is a Wave 0 task that generates both `animecix-v2/assets/icon.icns` and `animecix-v2/assets/icon.ico` from `animecix-desktop/files/icon.png`. Quality upgrade to 1024×1024 is deferred to post-v1 (tracked in CONTEXT.md deferred section).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm ci, scripts | Yes | v22.20.0 | — |
| npm | package install | Yes | 10.9.3 | — |
| Electron Forge CLI | build/publish | Yes (via package.json devDep) | 7.11.1 | — |
| macOS `iconutil` | .icns generation | macOS runner only | Built-in | ImageMagick on Linux |
| macOS `security` CLI | Keychain/cert import | macos-14 runner only | Built-in | — |
| GitHub Actions macos-14 | Universal + arm64 build | CI (not local) | — | Cannot build arm64 slice without Apple Silicon |
| GitHub Actions windows-latest | Windows Squirrel build | CI | — | — |
| Apple Developer ID Application cert (.p12) | macOS signing | PENDING — must be stored as secret | — | Cannot notarize without it |
| ASC API key (.p8) | Notarization | PENDING — must be stored as secret | — | Cannot notarize without it |

**Missing dependencies with no fallback:**
- Apple Developer ID Application certificate (APPLE_DEVELOPER_ID_APPLICATION_CERT secret) — must be acquired and stored in GitHub repo secrets before CI can run
- ASC API key (APPLE_API_KEY secret) — must be generated at appstoreconnect.apple.com

**Available locally but not in CI (workflow gap):**
- macos-14 runner is only available in GitHub-hosted Actions, not locally

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.4 |
| Config file | None detected (runs via `vitest run`) |
| Quick run command | `cd animecix-v2 && npm test` |
| Full suite command | `cd animecix-v2 && npm test` |

### Phase 4 is a CI/Release phase — automated unit tests cover limited surface area

Most validation is manual or integration-level:

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| INTG-01 | electron-updater detects update and shows banner | Manual smoke | `FORCE_DEV_UPDATE=true npm start` with `dev-app-update.yml` pointing to a published tag | Requires a real published release on GitHub |
| INTG-01 | `quitAndInstall()` restarts and applies update | Manual smoke | None — requires installed app, not dev mode | Test on clean macOS VM with DMG install |
| INTG-01 | update-available IPC reaches renderer | Unit (Vitest mock) | `npm test` (needs test added for IPC bridge) | — |
| — | Tag matches package.json version | Unit script | `node scripts/verify-tag.mjs` | Can run in CI pre-build |
| — | Notarization succeeds | Post-build CI assertion | `spctl --assess --verbose -t exec out/make/AnimeciX.app` | Only works after signing/notarization step |
| — | latest-mac.yml / latest.yml valid | Unit (schema check) | `node scripts/validate-manifest.mjs` | Validates YAML schema before upload |

### Wave 0 Gaps

- [ ] `animecix-v2/resources/app-update.yml` — must exist before `npm run package` so `extraResource` embeds it
- [ ] `animecix-v2/build/entitlements.mac.plist` — required for `osxSign.optionsForFile`
- [ ] `animecix-v2/assets/icon.icns` and `animecix-v2/assets/icon.ico` — Forge fails at package step without them
- [ ] `scripts/generate-update-manifest.mjs` — required for CI to upload `latest-mac.yml` / `latest.yml`
- [ ] `animecix-v2/dev-app-update.yml` — for local dev testing of update flow (gitignore this file)
- [ ] `"build": { "publish": [...] }` in `package.json` — electron-updater provider auto-detection

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A (no new auth in this phase) |
| V3 Session Management | No | Existing session persistence (SHELL-04) unchanged |
| V4 Access Control | No | N/A |
| V5 Input Validation | Yes | Update version validated against semver; tag/version comparison in CI fails early |
| V6 Cryptography | Yes | SHA512 checksums in latest-mac.yml verified by electron-updater; do NOT hand-roll checksum verification |
| V10 Malicious Code | Yes | Hardened runtime + entitlements reduce attack surface for code injection via update |

### Known Threat Patterns for Release Pipeline

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Update substitution (MITM) | Tampering | SHA512 checksum in latest-mac.yml + HTTPS GitHub CDN; electron-updater verifies before applying |
| Hardcoded GitHub PAT in config | Information Disclosure | animecix-desktop/electron-builder.yml line 9 has an exposed PAT — revoke it; use GITHUB_TOKEN from Actions |
| Keychain password in workflow | Information Disclosure | Use a per-run random password: `openssl rand -hex 16`; keychain is temp and discarded after job |
| Unsigned Windows installer | Spoofing | D-07 explicitly accepts SmartScreen warning for v1; documented for user awareness |
| Draft release auto-published | Tampering | D-21 gates on manual publish click; draft releases are not visible to electron-updater |

**CRITICAL security action:** The hardcoded PAT (redacted — value removed before public push) in `animecix-desktop/electron-builder.yml:9` must be revoked at GitHub (`github.com/settings/tokens`) before the repository is made public. This is a Phase 4 blocker if the repo is or will be public. *[Token value lived in commit history of the monorepo prior to this repo being split; revoke on GitHub to invalidate.]*

---

## Sources

### Primary (HIGH confidence)
- [electronforge.io — publisher-github](https://www.electronforge.io/config/publishers/github) — PublisherGitHubConfig options confirmed
- [js.electronforge.io — PublisherGitHubConfig interface](https://js.electronforge.io/interfaces/_electron_forge_publisher_github.PublisherGitHubConfig.html) — draft, prerelease, generateReleaseNotes, tagPrefix, authToken properties verified
- [electronforge.io — macOS code signing](https://www.electronforge.io/guides/code-signing/code-signing-macos) — osxSign, osxNotarize, ASC API key method verified
- [electron.build — auto-update](https://www.electron.build/auto-update.html) — event API, latest-mac.yml schema, dev-app-update.yml, autoDownload property
- [electron.build — AppUpdater class](https://www.electron.build/electron-updater.Class.AppUpdater.html) — all methods, properties, events verified
- [github.com/electron/forge/issues/3447](https://github.com/electron/forge/issues/3447) — @electron/universal 2.0.2 bug confirmed and fix (override to 2.0.3)
- [docs.github.com — installing Apple certificate on macOS runners](https://docs.github.com/en/actions/use-cases-and-examples/deploying/installing-an-apple-certificate-on-macos-runners-for-xcode-development) — keychain import commands verified

### Secondary (MEDIUM confidence)
- [dolthub.com blog 2024](https://www.dolthub.com/blog/2024-10-22-how-to-publish-a-mac-desktop-app-outside-the-app-store/) — entitlements.mac.plist content for hardened runtime
- [dev.to/rwwagner90 — signing electron apps with GitHub Actions](https://dev.to/rwwagner90/signing-electron-apps-with-github-actions-4cof) — macOS cert import script; `-T /usr/bin/codesign` pattern confirmed
- [github.com/electron/forge/issues/3315](https://github.com/electron/forge/issues/3315) — keychain hang resolution confirmed; `-T` flags required

### Tertiary (LOW confidence — flag for validation)
- Pattern for `app-update.yml` embedded via `extraResource` — inferred from electron-builder issue threads; not confirmed against Forge docs
- `"build": { "publish": [...] }` in package.json for electron-updater auto-detection without electron-builder — inferred from multiple community sources; exact behavior with Forge packaging unconfirmed
- `latest-mac.yml` / `latest.yml` schema — cited from electron-builder docs; assumed compatible with electron-updater 6.x GitHub provider

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry
- Forge osxSign/osxNotarize config: HIGH — verified via official Forge docs
- GitHub Actions keychain workflow: HIGH — verified via GitHub official docs + community confirmation
- electron-updater event API: HIGH — verified via official electron.build docs
- app-update.yml + Forge coexistence pattern: LOW — no authoritative Forge + electron-updater integration guide found; community pattern inferred from multiple sources
- latest-mac.yml generation with Forge: LOW — no official Forge mechanism; custom script approach is the community consensus but examples are scarce
- Universal binary + better-sqlite3 fix: HIGH — verified via Forge issue #3447 resolution

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable ecosystem; electron-updater and Forge release infrequently)
