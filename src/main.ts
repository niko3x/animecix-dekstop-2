// CRITICAL: Protocol imports must be FIRST — registerSchemesAsPrivileged runs at
// module top-level and MUST execute before app.whenReady() fires.
import './player/tau-protocol'; // Side-effect: registers tau-player:// scheme privileges
import { registerTauProtocol } from './player/tau-protocol';
import './offline/offline-protocol'; // Side-effect: registers animecix-offline:// scheme privileges
import { registerOfflineProtocol } from './offline/offline-protocol';

import { app, BrowserWindow, ipcMain, net } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { StorageService } from './storage/StorageService';
import { createWindow, setupCloseIntercept } from './window/WindowService';
import { registerWindowIpc } from './window/window.ipc';
import { AdBlocker } from './network/ad-blocker';
import { setupRequestInterception } from './network/request-handler';
import { setupHeaderRewriter } from './network/header-rewriter';
import {
  registerDeepLinkProtocol,
  extractDeepLinkFromArgs,
  handleDeepLink,
} from './auth/deep-link';
import { DiscordService, EpisodeData } from './integrations/discord-rpc';
import { DownloadQueue } from './download/DownloadQueue';
import { StreamCache } from './cache/StreamCache';
import { CacheEvictor } from './cache/CacheEvictor';
import { registerDownloadIpc } from './download/download.ipc';
import { TrayManager } from './download/TrayManager';
import { UpdaterService } from './updater/UpdaterService';
import { registerUpdaterIpc } from './updater/updater.ipc';
import { UpdaterBanner } from './updater/UpdaterBanner';

// Handle Squirrel.Windows install/uninstall shortcuts
if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let storage: StorageService | null = null;
let discord: DiscordService | null = null;
let trayManager: TrayManager | null = null;
let updaterService: UpdaterService | null = null;
let updaterBanner: UpdaterBanner | null = null;

// --- Episode metadata state for Discord RPC play state updates ---
// animecix.tv is the bridge between the player iframe (postMessage) and main process (IPC).
// The player iframe (tau-player://) CANNOT access window.animecix (Electron IPC).
// animecix.tv receives currentTime + captionsChanged postMessages from the player iframe,
// then forwards episode metadata and play state to main via IPC.
let lastEpisodeData: Omit<EpisodeData, 'isPlaying' | 'startTimestamp'> | null = null;

// Register deep link protocol BEFORE app.ready (required by Electron)
registerDeepLinkProtocol();

// macOS: handle deep links sent via open-url event
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (mainWindow) {
    handleDeepLink(url, mainWindow.webContents);
  }
});

// Single instance lock (SHELL-02)
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  // Another instance is already running — quit immediately
  app.quit();
} else {
  // Focus existing window and forward deep links when a second instance is launched
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      // Forward deep link from second instance to main webContents
      const deepLinkUrl = extractDeepLinkFromArgs(argv);
      if (deepLinkUrl) {
        handleDeepLink(deepLinkUrl, mainWindow.webContents);
      }
    }
  });

  // App ready — initialize services and create window
  app.whenReady().then(() => {
    storage = new StorageService();
    mainWindow = createWindow(storage);
    registerWindowIpc(mainWindow);

    // Phase 2: Register tau-player:// protocol handler (serves assets/player/)
    registerTauProtocol();

    // Phase 2: Network layer — ad blocker + request interception + CDN header rewriter
    const adBlocker = new AdBlocker();
    adBlocker.loadFilterLists();
    setupRequestInterception(adBlocker);
    setupHeaderRewriter();

    // Phase 2: Discord Rich Presence
    discord = new DiscordService();

    // Phase 3: Download and offline infrastructure
    const downloadsDir = path.join(app.getPath('downloads'), 'AnimeciX');
    const cacheDir = path.join(app.getPath('userData'), 'cache');

    // Register animecix-offline:// protocol handler
    registerOfflineProtocol(downloadsDir, cacheDir, storage);

    // Download queue and cache
    const queue = new DownloadQueue(storage, downloadsDir);
    const cache = new StreamCache(storage, cacheDir);
    const evictor = new CacheEvictor(storage);

    // Transparent auto-caching: intercept completed video requests (PLAY-05, D-05)
    cache.setupTransparentCaching(mainWindow.webContents.session);

    // Wire episode lifecycle for transparent caching
    let currentCachingEpisodeId: string | null = null;

    ipcMain.handle('cache:setCurrentEpisode', async (_event, episodeId: string, subs: { language: string; url: string }[]) => {
      if (currentCachingEpisodeId && currentCachingEpisodeId !== episodeId) {
        cache.finalizeEpisodeCache(currentCachingEpisodeId);
      }
      currentCachingEpisodeId = episodeId;
      cache.setCurrentEpisode(episodeId, subs);
    });

    // Register download/cache/storage IPC handlers
    registerDownloadIpc(mainWindow, queue, cache, storage, evictor, downloadsDir, cacheDir);

    // System tray for background downloads
    trayManager = new TrayManager(mainWindow, queue);
    setupCloseIntercept(mainWindow, () => trayManager);

    // D-06 + D-07 (drag region) and RESEARCH.md Pitfall 5 (website-deploy lag fallback).
    //
    // Selectors:
    //   - `#appMenu` is the Angular app-bar's draggable region (rendered when website
    //     detects desktop via `window.animecix`). Already styled with `-webkit-app-region: drag`
    //     in the website's own SCSS — this injection is a redundancy / fallback.
    //   - `material-navbar:not(.transparent) .navbar-container` covers the brief moment
    //     during Angular bootstrap before `fromApp$` becomes true, AND the case where the
    //     production website hasn't yet deployed the `app-bar` styling.
    //   - `no-drag` overrides on links/buttons/inputs/[role=button]/mat-icon ensure interactive
    //     elements stay clickable inside the drag region.
    //
    // The macOS-only rule hides the website's custom min/max/close buttons (`#appMenu .col-sm-3`)
    // so users don't see them duplicated alongside the OS traffic lights while the website
    // lags behind on deploying Plan 04's Angular conditional. Plan 04 ships the matching
    // `@if (!isMac$())` template change, but production animecix.tv may serve the OLD bundle
    // for days/weeks after the desktop release. This injection is the safety net.
    //
    // RESEARCH.md "Flagged" section approves using `did-finish-load` instead of CONTEXT.md
    // D-06's `dom-ready`: both fire before Angular bootstrap (so the difference is academic
    // for our static stylesheet), AND `did-finish-load` is the established convention in
    // this file (see line 156 deep-link handler).
    //
    // RESEARCH.md Pitfall 1: `insertCSS` is cleared on every full navigation, so we use
    // `.on(...)` (recurring) and track the returned key to call `removeInsertedCSS` before
    // re-injecting — prevents stylesheet accumulation across reloads.
    //
    // RESEARCH.md Pitfall 6: `cssOrigin: 'user'` wins specificity vs the page's own
    // stylesheets per CSS cascade — guarantees the drag region works even if the website's
    // own SCSS later overrides matching selectors.
    const DRAG_REGION_CSS = process.platform === 'darwin'
      ? `
        #appMenu,
        material-navbar:not(.transparent) .navbar-container {
          -webkit-app-region: drag;
          -webkit-user-select: none;
        }
        #appMenu a, #appMenu button, #appMenu input, #appMenu [role="button"],
        material-navbar a, material-navbar button, material-navbar input,
        material-navbar [role="button"], material-navbar mat-icon {
          -webkit-app-region: no-drag;
        }
        /* macOS-only: hide the website's custom right-column min/max/close buttons.
           Pairs with Plan 04's @if (!isMac$()) template guard but ships independently
           so users don't see double controls during the website-deploy lag window. */
        #appMenu .col-sm-3 {
          display: none !important;
        }
      `
      : `
        #appMenu,
        material-navbar:not(.transparent) .navbar-container {
          -webkit-app-region: drag;
          -webkit-user-select: none;
        }
        #appMenu a, #appMenu button, #appMenu input, #appMenu [role="button"],
        material-navbar a, material-navbar button, material-navbar input,
        material-navbar [role="button"], material-navbar mat-icon {
          -webkit-app-region: no-drag;
        }
      `;

    let dragCssKey: string | null = null;
    mainWindow.webContents.on('did-finish-load', async () => {
      // Remove the previous injection (if any) to avoid accumulation across reloads.
      if (dragCssKey && mainWindow) {
        try {
          await mainWindow.webContents.removeInsertedCSS(dragCssKey);
        } catch {
          // Ignore — key may have been auto-cleared by Electron on full navigation.
        }
      }
      if (mainWindow) {
        // cssOrigin: 'user' wins specificity vs the page's own author-origin stylesheets.
        dragCssKey = await mainWindow.webContents.insertCSS(DRAG_REGION_CSS, { cssOrigin: 'user' });
      }
    });

    // Auto-destroy tray when all downloads complete
    queue.on('queueEmpty', () => {
      if (trayManager?.isActive()) {
        trayManager.showWindow();
      }
    });

    // Phase 4: Auto-update via electron-updater
    updaterService = new UpdaterService();
    updaterService.init();
    registerUpdaterIpc(updaterService, () => mainWindow);

    // Wire tray "Güncellemeleri kontrol et" menu item
    trayManager.setUpdaterService(updaterService);

    // In-app banner overlay for update-downloaded event
    updaterBanner = new UpdaterBanner(mainWindow, updaterService);

    // Phase 2: Handle buffered deep link from cold start (process.argv)
    const bufferedUrl = extractDeepLinkFromArgs(process.argv);
    if (bufferedUrl && mainWindow) {
      // Wait for the page to finish loading before navigating to callback URL
      mainWindow.webContents.once('did-finish-load', () => {
        handleDeepLink(bufferedUrl, mainWindow!.webContents);
      });
    }

    // --- Video data pre-fetch IPC ---
    // Website calls this to fetch video data via main process (no CORS, faster than renderer fetch).
    // Returns { video, meta } so the website can pass it to the player iframe via postMessage,
    // avoiding the player's own API fetch and cutting load time.
    ipcMain.handle('video:fetch', async (_event, id: string, vid?: string) => {
      try {
        const videoUrl = 'https://tau-video.xyz/api/video/' + id + (vid ? '?vid=' + vid : '');
        const videoRes = await net.fetch(videoUrl);
        const video = await videoRes.json();

        // Fetch skip markers in parallel
        let meta = null;
        if (video.title_id && video.season_number && video.episode_number) {
          const slug = video.title_id + '_' + video.season_number + '_' + video.episode_number + '_' + video.translator;
          try {
            const metaRes = await net.fetch('https://tau-video.xyz/api/most-sought/' + slug + '?tauId=' + video._id);
            meta = await metaRes.json();
          } catch {
            // Skip markers not available — non-fatal
          }
        }

        return { video, meta };
      } catch (err) {
        console.error('video:fetch failed:', err);
        return null;
      }
    });

    // --- Subtitle preference IPC (Phase 2 — BLOCKER 2 fix) ---
    // animecix.tv calls these IPC channels (not the player iframe).
    // On episode load: animecix.tv calls getSubtitlePref -> gets saved lang
    //   -> sends changeSub postMessage to player iframe to apply the preference.
    // On caption change: player iframe sends captionsChanged postMessage to animecix.tv
    //   -> animecix.tv calls setSubtitlePref to persist the new preference to SQLite.
    ipcMain.handle('subtitle:get', (_event, animeId: string) => {
      return storage?.getSubtitlePref(animeId) ?? 'tr';
    });
    ipcMain.handle('subtitle:set', (_event, animeId: string, language: string) => {
      storage?.setSubtitlePref(animeId, language);
    });

    // --- Episode metadata IPC for Discord RPC (Phase 2 — BLOCKER 1 fix) ---
    // animecix.tv is the bridge: it receives postMessages from the player iframe and
    // forwards episode metadata and play state to main process via these IPC channels.
    //
    // episode:update — sent by animecix.tv on episode change (richer than legacy 'updateCurrent')
    ipcMain.on('episode:update', (_event, data: Omit<EpisodeData, 'isPlaying' | 'startTimestamp'>) => {
      lastEpisodeData = data;
      discord?.updateActivity({ ...data, isPlaying: true, startTimestamp: Date.now() });
    });

    // episode:playState — sent by animecix.tv when it receives currentTime postMessage from
    // the player iframe (currentTime postMessage contains {time, duration, isPlaying} every 5s)
    ipcMain.on('episode:playState', (_event, isPlaying: boolean) => {
      if (lastEpisodeData) {
        discord?.updateActivity({
          ...lastEpisodeData,
          isPlaying,
          startTimestamp: isPlaying ? Date.now() : undefined,
        });
      }
    });

    // episode:idle — sent when player is closed or navigated away from
    ipcMain.on('episode:idle', () => {
      lastEpisodeData = null;
      discord?.setIdle();
    });
  }).catch((err) => {
    console.error('Failed to initialize app:', err);
    app.quit();
  });

  // Non-macOS: quit when all windows closed — but stay alive if tray is active (downloads running)
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      if (!trayManager || !trayManager.isActive()) {
        storage?.close();
        storage = null;
        app.quit();
      }
    }
  });

  // macOS: re-create window when dock icon clicked and no windows are open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && storage) {
      mainWindow = createWindow(storage);
      registerWindowIpc(mainWindow);
    }
  });

  // Clean shutdown — destroy tray, Discord RPC, close StorageService before quitting
  app.on('before-quit', () => {
    // T-4-04 mitigation: dispose updater timers before quit to avoid file-lock races
    updaterService?.dispose();
    updaterService = null;
    updaterBanner?.dispose();
    updaterBanner = null;
    trayManager?.destroyTray();
    trayManager = null;
    discord?.destroy();
    discord = null;
    storage?.close();
    storage = null;
  });
}
