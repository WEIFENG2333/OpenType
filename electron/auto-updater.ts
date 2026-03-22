import { autoUpdater } from 'electron-updater';
import { state } from './app-state';

/** Safely send to mainWindow — avoids crash if window is destroyed */
function sendToMain(channel: string, ...args: unknown[]) {
  const wc = state.mainWindow?.webContents;
  if (wc && !wc.isDestroyed()) wc.send(channel, ...args);
}

export function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] update available:', info.version);
    // Normalize releaseNotes — can be string, array of {version, note}, or null
    let notes: string | undefined;
    if (typeof info.releaseNotes === 'string') {
      notes = info.releaseNotes;
    } else if (Array.isArray(info.releaseNotes)) {
      notes = info.releaseNotes.map((n) => n.note ?? '').join('\n');
    }
    sendToMain('updater:update-available', { version: info.version, releaseNotes: notes });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] no update available');
    sendToMain('updater:update-not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    sendToMain('updater:download-progress', {
      percent: Math.round(progress.percent),
    });
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('[Updater] update downloaded');
    sendToMain('updater:update-downloaded');
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater] error:', err.message);
    sendToMain('updater:error', err.message);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((e) => console.error('[Updater] initial check failed:', e.message));
  }, 3000);
}
