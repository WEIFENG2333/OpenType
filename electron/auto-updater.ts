import { autoUpdater } from 'electron-updater';
import { state } from './app-state';

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
      notes = info.releaseNotes.map((n: any) => n.note || n).join('\n');
    }
    state.mainWindow?.webContents.send('updater:update-available', { version: info.version, releaseNotes: notes });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] no update available');
    state.mainWindow?.webContents.send('updater:update-not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    state.mainWindow?.webContents.send('updater:download-progress', {
      percent: Math.round(progress.percent),
    });
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('[Updater] update downloaded');
    state.mainWindow?.webContents.send('updater:update-downloaded');
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater] error:', err.message);
    state.mainWindow?.webContents.send('updater:error', err.message);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 3000);
}
