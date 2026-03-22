import {
  app, BrowserWindow, globalShortcut,
  session, systemPreferences, Menu,
  protocol, net,
} from 'electron';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
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
import { restoreSystemAudioSync } from './audio-control';

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
}

// ─── Custom Protocol: media:// ──────────────────────────────────────────────
// Serves local media files (audio/screenshots) without base64 IPC roundtrips.
// Usage in renderer: new Audio('media:///path/to/file.wav')

protocol.registerSchemesAsPrivileged([{
  scheme: 'media',
  privileges: { secure: true, supportFetchAPI: true, stream: true, bypassCSP: true },
}]);

// ─── Single Instance Lock ──────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Focus existing window when user tries to launch a second instance
    if (state.mainWindow) {
      if (state.mainWindow.isMinimized()) state.mainWindow.restore();
      state.mainWindow.show();
      state.mainWindow.focus();
    }
  });
}

// ─── App Lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Register media:// handler — streams local files via net.fetch
  // URL format: media:///absolute/path/to/file (non-standard scheme, raw path after media://)
  const userDataDir = app.getPath('userData');
  protocol.handle('media', (req) => {
    const filePath = decodeURIComponent(req.url.replace(/^media:\/\//, ''));
    const resolved = path.resolve(filePath);
    // Security: only serve files under userData directory (case-insensitive for macOS)
    if (!resolved.toLowerCase().startsWith(userDataDir.toLowerCase())) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(resolved).toString());
  });
  state.configStore = new ConfigStore();
  state.sttService = new STTService();
  state.llmService = new LLMService();

  // Sync launch-on-startup setting with OS
  const launchOnStartup = state.configStore.get('launchOnStartup');
  app.setLoginItemSettings({ openAtLogin: launchOnStartup });

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

app.on('before-quit', () => {
  state.quitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopFnMonitor();
  restoreSystemAudioSync();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
