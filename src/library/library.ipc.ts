/**
 * library.ipc.ts -- IPC handler registration for all library channels.
 *
 * Follows the download.ipc.ts pattern: exported function registers handlers,
 * receives dependencies via parameters.
 *
 * Channels:
 *   library:getAnimes    -- returns all anime groupings from StorageService
 *   library:getEpisodes  -- returns episodes for a specific anime
 *   library:show         -- shows the library BrowserView overlay
 *   library:hide         -- hides the library BrowserView overlay
 *   library:playEpisode  -- hides library AND sends play-offline event to mainWindow
 */

import { ipcMain, BrowserWindow, net, app } from 'electron';
import { StorageService } from '../storage/StorageService';
import { LibraryManager } from './LibraryManager';
import path from 'node:path';
import fs from 'node:fs';
import log from 'electron-log';

export function registerLibraryIpc(
  mainWindow: BrowserWindow,
  storage: StorageService,
  libraryManager: LibraryManager,
): void {
  ipcMain.handle('library:getAnimes', async () => {
    return storage.getLibraryAnimes();
  });

  ipcMain.handle('library:getEpisodes', async (_event, animeTitle: string) => {
    return storage.getLibraryEpisodes(animeTitle);
  });

  ipcMain.handle('library:show', async () => {
    libraryManager.show();
  });

  ipcMain.handle('library:hide', async () => {
    libraryManager.hide();
  });

  ipcMain.handle('library:playEpisode', async (_event, episodeId: string) => {
    // CRITICAL: Hide library BrowserView AND trigger offline playback.
    // Step 1: Hide the library overlay so the main window is visible
    libraryManager.hide();

    // Step 2: Send the offline episode info to the main window's renderer.
    // Phase 5's animecix-offline:// protocol handler serves the video file.
    // The renderer (Angular website or library page) will handle opening
    // the player with this offline source.
    const offlineUrl = `animecix-offline://episode/${episodeId}/video`;

    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('library:play-offline', {
        episodeId,
        offlineUrl,
      });
      log.info(`[library] Playing offline episode: ${episodeId}`);
    }
  });
}

/**
 * downloadPoster -- Downloads a poster image to userData/posters/{episodeId}.jpg.
 *
 * Per D-08: Poster images are saved locally so the library can display them offline.
 * Per T-07-04: Only HTTPS URLs are allowed to prevent SSRF.
 *
 * @param posterUrl - The HTTPS URL of the poster image
 * @param episodeId - Used as the filename (sanitized by SQLite lookup, not user-controlled path)
 * @returns The local file path if successful, empty string on failure (non-fatal)
 */
export async function downloadPoster(
  posterUrl: string,
  episodeId: string,
): Promise<string> {
  if (!posterUrl || !posterUrl.startsWith('https://')) return '';

  const postersDir = path.join(app.getPath('userData'), 'posters');
  if (!fs.existsSync(postersDir)) {
    fs.mkdirSync(postersDir, { recursive: true });
  }

  const posterPath = path.join(postersDir, `${episodeId}.jpg`);
  if (fs.existsSync(posterPath)) return posterPath; // idempotent

  try {
    const res = await net.fetch(posterUrl);
    if (!res.ok) return '';
    const buf = await res.arrayBuffer();
    fs.writeFileSync(posterPath, Buffer.from(buf));
    return posterPath;
  } catch {
    return ''; // non-fatal -- library shows placeholder if poster missing
  }
}
