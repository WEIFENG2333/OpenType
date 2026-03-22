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
  updateTrayMenu(onToggleRecording);
  state.tray.on('click', () => { state.mainWindow?.show(); state.mainWindow?.focus(); });
}

/** Rebuild tray menu (call after hotkey config changes) */
export function updateTrayMenu(onToggleRecording: () => void) {
  if (!state.tray) return;
  const hotkey = state.configStore?.get('globalHotkey') || 'CmdOrCtrl+Shift+Space';
  // Electron Menu accelerator doesn't support Fn key — omit it to avoid silent failure
  const accelerator = hotkey === 'Fn' || hotkey.startsWith('Fn+') ? undefined : hotkey;
  const menu = Menu.buildFromTemplate([
    { label: 'Show OpenType', click: () => { state.mainWindow?.show(); state.mainWindow?.focus(); } },
    { type: 'separator' },
    { label: 'Start Dictation', accelerator, click: onToggleRecording },
    { type: 'separator' },
    { label: 'Quit', click: () => { state.quitting = true; require('electron').app.quit(); } },
  ]);
  state.tray.setContextMenu(menu);
}
