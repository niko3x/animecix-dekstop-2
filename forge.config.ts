import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import * as fs from 'node:fs';
import * as path from 'node:path';

// External-to-Vite native deps that must remain in the packaged app's
// node_modules/ so require() resolves them at runtime. plugin-vite
// clears package.json.dependencies in its afterCopy hook; the subsequent
// prune step then removes every node_module. We re-add these entries so
// prune keeps them (and transitively their own deps like `bindings`).
const EXTERNAL_NATIVE_DEPS = ['better-sqlite3', 'bufferutil', 'utf-8-validate'];

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: 'com.onmuapps.animecix',              // D-26
    asar: true,
    icon: 'assets/icon',                                // Forge appends .icns/.ico per platform
    extraResource: ['assets/player', 'resources/app-update.yml'],
    osxUniversal: {
      x64ArchFiles: '**/*.node',                        // D-05 + Pitfall 3 — prevent double-lipo of better-sqlite3
    },
    osxSign: {
      optionsForFile: (_filePath: string) => ({
        entitlements: 'build/entitlements.mac.plist',   // D-06 — hardened runtime entitlements
        hardenedRuntime: true,
      }),
    },
    // D-08 — notarize gate:
    //  skip locally (no APPLE_API_KEY), or
    //  skip temporarily when SKIP_NOTARIZE=true (Apple team config issue — support ticket pending).
    //  To re-enable, remove SKIP_NOTARIZE from the workflow env.
    osxNotarize: (process.env.APPLE_API_KEY && process.env.SKIP_NOTARIZE !== 'true') ? {
      appleApiKey: process.env.APPLE_API_KEY,           // FILE PATH to .p8 (Pitfall 4 — not base64 content)
      appleApiKeyId: process.env.APPLE_API_KEY_ID!,     // 10-char ASC key ID
      appleApiIssuer: process.env.APPLE_API_ISSUER!,    // ASC issuer UUID
    } : undefined,
    // Runs AFTER @electron-forge/plugin-vite's afterCopy (which clears
    // package.json.dependencies). We re-add Vite-external native deps so
    // the following prune step keeps them in node_modules/.
    afterCopy: [
      (buildPath, _electronVersion, _platform, _arch, callback) => {
        try {
          const buildPkgPath = path.join(buildPath, 'package.json');
          const projectPkg = JSON.parse(
            fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'),
          );
          const buildPkg = JSON.parse(fs.readFileSync(buildPkgPath, 'utf8'));
          buildPkg.dependencies = buildPkg.dependencies || {};
          for (const dep of EXTERNAL_NATIVE_DEPS) {
            if (projectPkg.dependencies?.[dep]) {
              buildPkg.dependencies[dep] = projectPkg.dependencies[dep];
            }
          }
          fs.writeFileSync(buildPkgPath, JSON.stringify(buildPkg, null, 2));
          callback();
        } catch (err) {
          callback(err as Error);
        }
      },
    ],
  },
  // Defaults let Forge auto-detect native deps and use prebuilt binaries
  // when available. better-sqlite3 publishes prebuilts for darwin-x64,
  // darwin-arm64, win32-x64 matching Electron's ABI — no need for
  // buildFromSource. The previous config (force + buildFromSource +
  // onlyModules) caused silent failure on the arm64 slice of universal
  // builds, after which prune removed the module entirely.
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'AnimeciX',                                 // D-27 — installer name
      setupIcon: 'assets/icon.ico',
      iconUrl: 'https://raw.githubusercontent.com/CaptainSP/animecix-dekstop-2/main/assets/icon.ico',
    }),
    new MakerZIP({}, ['darwin']),                       // D-03 — update channel
    new MakerDMG({
      icon: 'assets/icon.icns',
      name: 'AnimeciX',
    }, ['darwin']),                                     // D-04 — first-install UX
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'CaptainSP',
          name: 'animecix-dekstop-2',
        },
        draft: true,                                     // D-21 — manual "Publish release" gate; no accidental ships
        prerelease: false,                               // D-12 — single stable channel
        generateReleaseNotes: true,                      // D-22 — GitHub auto-populates changelog
        tagPrefix: 'v',                                  // D-24 — semver tags are vMAJOR.MINOR.PATCH
        authToken: process.env.GITHUB_TOKEN,
      },
    },
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
