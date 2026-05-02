/**
 * LibraryManager -- BrowserView overlay that displays the offline library page
 * as a full-window overlay in the main window.
 *
 * Architecture choice: BrowserView overlay (not iframe) because:
 * - The library must display on offline launch BEFORE the Angular website has
 *   bootstrapped (there is no website to host an iframe when offline).
 * - BrowserView is main-process-controlled and survives navigation.
 * - Follows the UpdaterBanner pattern already established in the codebase.
 *
 * Key differences from UpdaterBanner:
 * 1) Full-window bounds (x:0, y:0, full width+height) instead of bottom strip.
 * 2) Public show/hide methods (UpdaterBanner's were private).
 * 3) No service dependency in constructor.
 * 4) Loads animecix-library://bundle/ URL via custom protocol.
 * 5) Exposes getMainWindow() for use by playEpisode IPC.
 */

import { BrowserView, BrowserWindow, app } from 'electron';
import path from 'node:path';
import log from 'electron-log';

export class LibraryManager {
  private view: BrowserView | null = null;
  private resizeHandler: (() => void) | null = null;
  private mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  show(): void {
    if (this.view) return; // already visible -- T-07-06 guard

    const preloadPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app', '.vite', 'build', 'preload.js')
      : path.join(app.getAppPath(), '.vite', 'build', 'preload.js');

    this.view = new BrowserView({
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, // REQUIRED for contextBridge to work
      },
    });

    this.mainWindow.addBrowserView(this.view);
    this.updateBounds();

    this.resizeHandler = () => this.updateBounds();
    this.mainWindow.on('resize', this.resizeHandler);

    void this.view.webContents.loadURL('animecix-library://bundle/');
    log.info('[library] Library BrowserView shown');
  }

  hide(): void {
    if (!this.view) return;

    if (this.resizeHandler) {
      this.mainWindow.removeListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    this.mainWindow.removeBrowserView(this.view);
    (this.view.webContents as Electron.WebContents).destroy?.();
    this.view = null;
    log.info('[library] Library BrowserView hidden');
  }

  isVisible(): boolean {
    return this.view !== null;
  }

  getMainWindow(): BrowserWindow {
    return this.mainWindow;
  }

  private updateBounds(): void {
    if (!this.view) return;
    const [width, height] = this.mainWindow.getContentSize();
    this.view.setBounds({ x: 0, y: 0, width, height });
  }

  dispose(): void {
    this.hide();
  }
}
