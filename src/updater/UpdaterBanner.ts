/**
 * UpdaterBanner — BrowserView overlay that appears at the bottom of the main window
 * when an update is ready to install (UPDATER_CHANNELS.UPDATE_READY).
 *
 * Architecture choice: BrowserView overlay (not executeJavaScript injection) because:
 * - The main window loads animecix.tv (remote origin) — script injection is fragile
 *   across navigations and requires relaxed CSP.
 * - BrowserView is origin-isolated, survives navigation, and has its own preload.
 * - The same preload.ts file is reused so animecixAPI.updater is available in the banner.
 */

import { BrowserView, BrowserWindow, app, ipcMain } from 'electron';
import path from 'node:path';
import log from 'electron-log';
import { UPDATER_CHANNELS } from '../types/updater.js';
import type { UpdaterService } from './UpdaterService.js';

const BANNER_HEIGHT = 64;

export class UpdaterBanner {
  private view: BrowserView | null = null;
  private mainWindow: BrowserWindow;
  private resizeHandler: (() => void) | null = null;

  constructor(mainWindow: BrowserWindow, service: UpdaterService) {
    this.mainWindow = mainWindow;

    // Listen for UPDATE_READY via UpdaterService event bridge
    service.onEvent((channel) => {
      if (channel === UPDATER_CHANNELS.UPDATE_READY) {
        this.show();
      }
    });

    // Dismiss IPC — renderer sends this when "Sonra" is clicked
    ipcMain.on(UPDATER_CHANNELS.DISMISS_BANNER, () => {
      this.hide();
    });
  }

  private show(): void {
    if (this.view) return; // already visible

    const preloadPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app', '.vite', 'build', 'preload.js')
      : path.join(app.getAppPath(), '.vite', 'build', 'preload.js');

    this.view = new BrowserView({
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, // required for preload contextBridge
      },
    });

    this.mainWindow.addBrowserView(this.view);
    this.updateBounds();

    // Track resize so banner stays pinned to bottom
    this.resizeHandler = () => this.updateBounds();
    this.mainWindow.on('resize', this.resizeHandler);

    const bannerPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app', '.vite', 'build', 'updater-banner.html')
      : path.join(app.getAppPath(), 'src', 'player-page', 'updater-banner.html');

    this.view.webContents.loadFile(bannerPath).catch((err) => {
      log.error('[updater-banner] Failed to load banner HTML:', err?.message);
    });

    log.info('[updater-banner] Banner shown');
  }

  private hide(): void {
    if (!this.view) return;

    if (this.resizeHandler) {
      this.mainWindow.removeListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    this.mainWindow.removeBrowserView(this.view);
    (this.view.webContents as Electron.WebContents).destroy?.();
    this.view = null;
    log.info('[updater-banner] Banner hidden');
  }

  private updateBounds(): void {
    if (!this.view) return;
    const [width, height] = this.mainWindow.getContentSize();
    this.view.setBounds({
      x: 0,
      y: height - BANNER_HEIGHT,
      width,
      height: BANNER_HEIGHT,
    });
  }

  dispose(): void {
    this.hide();
  }
}
