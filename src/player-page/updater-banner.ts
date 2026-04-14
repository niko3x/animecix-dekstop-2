// Banner renderer script — wired to animecixAPI.updater via contextBridge (same preload as main window)
// The BrowserView uses the same preload.ts as the main window, so animecixAPI is available.

declare global {
  interface Window {
    animecixAPI: {
      updater: import('../types/updater.js').UpdaterApi;
    };
  }
}

const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el;
};

$('install').addEventListener('click', () => {
  window.animecixAPI.updater.install();
});

$('dismiss').addEventListener('click', () => {
  window.animecixAPI.updater.dismissBanner();
  // Ask Electron to close/hide this BrowserView by closing the window
  window.close();
});
