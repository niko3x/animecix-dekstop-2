import { WebContentsView, BrowserWindow, app } from 'electron';
import path from 'node:path';
import log from 'electron-log';

export class LibraryManager {
  private view: WebContentsView | null = null;
  private resizeHandler: (() => void) | null = null;
  private mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  show(): void {
    if (this.view) return;

    const preloadPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app', '.vite', 'build', 'preload.js')
      : path.join(app.getAppPath(), '.vite', 'build', 'preload.js');

    this.view = new WebContentsView({
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    this.mainWindow.contentView.addChildView(this.view);
    this.updateBounds();

    this.resizeHandler = () => this.updateBounds();
    this.mainWindow.on('resize', this.resizeHandler);

    void this.view.webContents.loadURL('animecix-library://bundle/').then(() => {
      if (this.view) {
        this.view.webContents.focus();
      }
    });
    log.info('[library] Library WebContentsView shown');
  }

  hide(): void {
    if (!this.view) return;

    if (this.resizeHandler) {
      this.mainWindow.removeListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    this.mainWindow.contentView.removeChildView(this.view);
    this.view.webContents.close();
    this.view = null;
    log.info('[library] Library WebContentsView hidden');
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
