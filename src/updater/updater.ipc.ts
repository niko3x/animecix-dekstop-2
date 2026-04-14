import { ipcMain, BrowserWindow } from 'electron';
import { UPDATER_CHANNELS } from '../types/updater.js';
import type { UpdaterService } from './UpdaterService.js';

export function registerUpdaterIpc(
  service: UpdaterService,
  getMainWindow: () => BrowserWindow | null,
): void {
  ipcMain.handle(UPDATER_CHANNELS.CHECK_FOR_UPDATES, () => service.manualCheck());
  ipcMain.handle(UPDATER_CHANNELS.INSTALL, () => service.install());
  ipcMain.on(UPDATER_CHANNELS.DISMISS_BANNER, () => service.dismissBannerForSession());

  // Service re-emits via this helper so preload bridge can subscribe
  service.onEvent((channel, payload) => {
    const win = getMainWindow();
    win?.webContents.send(channel, payload);
  });
}
