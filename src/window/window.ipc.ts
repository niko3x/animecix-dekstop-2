import { ipcMain, BrowserWindow } from 'electron';

export function registerWindowIpc(win: BrowserWindow): void {
  // Window control handlers
  ipcMain.handle('window:minimize', () => {
    win.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.handle('window:close', () => {
    win.close();
  });

  ipcMain.handle('window:isMaximized', () => {
    return win.isMaximized();
  });

  // Fullscreen event notifications to renderer
  win.on('enter-full-screen', () => {
    win.webContents.send('window:fullscreen-changed', true);
  });

  win.on('leave-full-screen', () => {
    win.webContents.send('window:fullscreen-changed', false);
  });
}
