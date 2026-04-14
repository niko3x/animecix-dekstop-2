import { Tray, Menu, app, BrowserWindow, nativeImage } from 'electron';
import path from 'node:path';
import { DownloadQueue } from './DownloadQueue';
import type { UpdaterService } from '../updater/UpdaterService.js';

export class TrayManager {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow;
  private queue: DownloadQueue;
  private updater: UpdaterService | null = null;

  constructor(mainWindow: BrowserWindow, queue: DownloadQueue) {
    this.mainWindow = mainWindow;
    this.queue = queue;
  }

  setUpdaterService(service: UpdaterService): void {
    this.updater = service;
    // Re-build menu now that updater is available (enables the menu item)
    this.rebuildMenu();
  }

  hasActiveDownloads(): boolean {
    const q = this.queue.getQueue();
    return q.some(item => item.status === 'downloading' || item.status === 'queued');
  }

  createTray(): void {
    if (this.tray) return;
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'tray-icon.png')
      : path.join(app.getAppPath(), 'assets', 'tray-icon.png');
    let icon: Electron.NativeImage;
    try {
      icon = nativeImage.createFromPath(iconPath);
      if (icon.isEmpty()) throw new Error('empty');
    } catch {
      icon = nativeImage.createEmpty();
    }
    this.tray = new Tray(icon);
    this.tray.setToolTip('AnimeciX - Indirme devam ediyor');
    this.tray.on('double-click', () => this.showWindow());
    this.rebuildMenu();
  }

  rebuildMenu(): void {
    if (!this.tray) return;
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Goster', click: () => this.showWindow() },
      { type: 'separator' },
      { label: 'Tumunu Duraklat', click: () => this.queue.pauseAll() },
      { label: 'Tumunu Iptal Et', click: () => this.queue.cancelAll() },
      { type: 'separator' },
      {
        label: 'Güncellemeleri kontrol et', // D-18 EXACT STRING
        click: () => { this.updater?.manualCheck(); },
        enabled: this.updater !== null,
      },
      { type: 'separator' },
      { label: 'Cikis', click: () => app.quit() },
    ]);
    this.tray.setContextMenu(contextMenu);
  }

  showWindow(): void {
    this.mainWindow.show();
    if (this.mainWindow.isMinimized()) this.mainWindow.restore();
    this.mainWindow.focus();
    this.destroyTray();
  }

  destroyTray(): void {
    this.tray?.destroy();
    this.tray = null;
  }

  isActive(): boolean {
    return this.tray !== null && !this.tray.isDestroyed();
  }
}
