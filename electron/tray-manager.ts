import { Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { state, isDev } from './app-state';

export function createTray(onToggleRecording: () => void) {
  const iconPath = isDev
    ? path.join(__dirname, '../public/icon.svg')
    : path.join(__dirname, '../dist/icon.svg');

  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
  } catch {
    icon = nativeImage.createEmpty();
  }

  state.tray = new Tray(icon);
  state.tray.setToolTip('OpenType — Voice Dictation');

  const menu = Menu.buildFromTemplate([
    { label: 'Show OpenType', click: () => { state.mainWindow?.show(); state.mainWindow?.focus(); } },
    { type: 'separator' },
    { label: 'Start Dictation', accelerator: 'CmdOrCtrl+Shift+Space', click: onToggleRecording },
    { type: 'separator' },
    { label: 'Quit', click: () => { state.quitting = true; require('electron').app.quit(); } },
  ]);

  state.tray.setContextMenu(menu);
  state.tray.on('click', () => { state.mainWindow?.show(); state.mainWindow?.focus(); });
}
