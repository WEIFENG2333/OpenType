import {
  app, BrowserWindow, globalShortcut, ipcMain,
  Tray, Menu, nativeImage, clipboard,
} from 'electron';
import path from 'path';
import { ConfigStore } from './config-store';
import { STTService } from './stt-service';
import { LLMService } from './llm-service';

// ─── State ──────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;

let configStore: ConfigStore;
let sttService: STTService;
let llmService: LLMService;

const isDev = !app.isPackaged;

// ─── Window Creation ────────────────────────────────────────────────────────

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 820,
    minHeight: 560,
    frame: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 380,
    height: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    focusable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  const url = isDev ? 'http://localhost:5173/#/overlay' : undefined;
  if (url) {
    overlayWindow.loadURL(url);
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/overlay' });
  }

  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
}

// ─── System Tray ────────────────────────────────────────────────────────────

function createTray() {
  const iconPath = isDev
    ? path.join(__dirname, '../public/icon.svg')
    : path.join(__dirname, '../dist/icon.svg');

  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('OpenType — Voice Dictation');

  const menu = Menu.buildFromTemplate([
    { label: 'Show OpenType', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: 'Start Dictation', accelerator: 'CmdOrCtrl+Shift+Space', click: toggleRecording },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]);

  tray.setContextMenu(menu);
  tray.on('click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

// ─── Global Shortcut ────────────────────────────────────────────────────────

function registerShortcuts() {
  const key = configStore.get('globalHotkey') || 'CommandOrControl+Shift+Space';
  try {
    globalShortcut.register(key, toggleRecording);
  } catch (e) {
    console.error('[Shortcut] register failed:', e);
  }
}

function toggleRecording() {
  mainWindow?.webContents.send('toggle-recording');
  if (overlayWindow) {
    if (overlayWindow.isVisible()) overlayWindow.hide();
    else overlayWindow.show();
    overlayWindow.webContents.send('toggle-recording');
  }
}

// ─── IPC Handlers ───────────────────────────────────────────────────────────

function setupIPC() {
  // Config
  ipcMain.handle('config:get', (_e, key: string) => configStore.get(key));
  ipcMain.handle('config:set', (_e, key: string, val: any) => { configStore.set(key, val); return true; });
  ipcMain.handle('config:getAll', () => configStore.getAll());

  // STT
  ipcMain.handle('stt:transcribe', async (_e, buf: ArrayBuffer, opts: any) => {
    try {
      const text = await sttService.transcribe(Buffer.from(buf), configStore.getAll(), opts);
      console.log('[STT] result:', text.slice(0, 100));
      return { success: true, text };
    } catch (e: any) {
      console.error('[STT] error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // LLM
  ipcMain.handle('llm:process', async (_e, text: string, ctx: any) => {
    try {
      const result = await llmService.process(text, configStore.getAll(), ctx);
      return { success: true, text: result };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  // Pipeline
  ipcMain.handle('pipeline:process', async (_e, buf: ArrayBuffer, ctx: any) => {
    const cfg = configStore.getAll();
    try {
      console.log('[Pipeline] STT...');
      const raw = await sttService.transcribe(Buffer.from(buf), cfg, ctx);
      console.log('[Pipeline] raw:', raw.slice(0, 100));

      if (!raw.trim()) return { success: true, rawText: '', processedText: '', skipped: true };

      console.log('[Pipeline] LLM...');
      const processed = await llmService.process(raw, cfg, ctx);
      console.log('[Pipeline] final:', processed.slice(0, 100));

      return { success: true, rawText: raw, processedText: processed };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  // Rewrite (Voice Superpowers)
  ipcMain.handle('llm:rewrite', async (_e, text: string, instruction: string) => {
    try {
      const result = await llmService.rewrite(text, instruction, configStore.getAll());
      return { success: true, text: result };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  // Clipboard
  ipcMain.handle('clipboard:write', (_e, text: string) => { clipboard.writeText(text); return true; });

  // Window controls
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.hide());
  ipcMain.handle('window:hideOverlay', () => overlayWindow?.hide());

  // API test
  ipcMain.handle('api:test', async (_e, provider: string) => {
    try {
      const msg = await llmService.testConnection(configStore.getAll(), provider);
      return { success: true, message: msg };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });
}

// ─── App Lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(() => {
  configStore = new ConfigStore();
  sttService = new STTService();
  llmService = new LLMService();

  createMainWindow();
  createOverlayWindow();
  createTray();
  registerShortcuts();
  setupIPC();

  app.on('activate', () => mainWindow?.show());
});

app.on('will-quit', () => globalShortcut.unregisterAll());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
