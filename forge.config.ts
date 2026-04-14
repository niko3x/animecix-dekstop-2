import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

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
    osxNotarize: process.env.APPLE_API_KEY ? {          // D-08 — gate: skip locally if no creds
      appleApiKey: process.env.APPLE_API_KEY,           // FILE PATH to .p8 (Pitfall 4 — not base64 content)
      appleApiKeyId: process.env.APPLE_API_KEY_ID!,     // 10-char ASC key ID
      appleApiIssuer: process.env.APPLE_API_ISSUER!,    // ASC issuer UUID
    } : undefined,
  },
  rebuildConfig: {
    force: true,
    buildFromSource: true,
    onlyModules: ['better-sqlite3'],
  },
  makers: [
    new MakerSquirrel({
      name: 'AnimeciX',                                 // D-27 — installer name
      setupIcon: 'assets/icon.ico',
      iconUrl: 'https://raw.githubusercontent.com/CaptainSP/AnimeciX-Desktop-Apps/main/animecix-v2/assets/icon.ico',
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
          name: 'AnimeciX-Desktop-Apps',
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
