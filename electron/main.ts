import {
  app, BrowserWindow, globalShortcut,
  session, systemPreferences, Menu,
} from 'electron';
import { state, isDev, isMac } from './app-state';
import { ConfigStore } from './config-store';
import { STTService } from './stt-service';
import { LLMService } from './llm-service';
import { createMainWindow, createOverlayWindow } from './window-manager';
import { createTray } from './tray-manager';
import { registerShortcuts, toggleRecording } from './shortcut-manager';
import { setupIPC } from './ipc-handlers';
import { setupAutoUpdater } from './auto-updater';
import { stopFnMonitor } from './fn-monitor';

// ─── Microphone Permissions ─────────────────────────────────────────────────

function setupPermissions() {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'mediaKeySystem'];
    callback(allowed.includes(permission));
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    if (permission === 'media') return true;
    return false;
  });
}

// ─── App Menu ────────────────────────────────────────────────────────────────

function setupAppMenu() {
  const devTools = isDev ? [
    { type: 'separator' as const },
    { role: 'toggleDevTools' as const },
    { role: 'forceReload' as const },
  ] : [];

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        ...devTools,
      ],
    },
    {
      role: 'editMenu' as const,
    },
    {
      role: 'windowMenu' as const,
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  if (isDev) {
    globalShortcut.register('CommandOrControl+Option+I', () => {
      const win = BrowserWindow.getFocusedWindow();
      win?.webContents.toggleDevTools();
    });
  }
}

// ─── App Lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(() => {
  state.configStore = new ConfigStore();
  state.sttService = new STTService();
  state.llmService = new LLMService();

  setupPermissions();

  if (isMac) {
    systemPreferences.isTrustedAccessibilityClient(true);
  }

  createMainWindow();
  createOverlayWindow();
  createTray(toggleRecording);
  registerShortcuts();
  setupIPC();
  if (!isDev) setupAutoUpdater();
  setupAppMenu();

  // macOS Dock menu
  if (isMac && app.dock) {
    const dockMenu = Menu.buildFromTemplate([
      { label: 'Start Dictation', click: toggleRecording },
      { type: 'separator' },
      { label: 'Settings', click: () => { state.mainWindow?.show(); state.mainWindow?.focus(); state.mainWindow?.webContents.send('navigate', 'settings'); } },
    ]);
    app.dock.setMenu(dockMenu);
  }

  app.on('activate', () => {
    if (state.isRecording || (state.overlayWindow?.getOpacity() ?? 0) > 0 || Date.now() < state.suppressActivateUntil) return;
    state.mainWindow?.show();
  });
});

app.on('will-quit', () => { globalShortcut.unregisterAll(); stopFnMonitor(); });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
