import { BrowserWindow, screen } from 'electron';
import path from 'path';
import { state, isDev, isMac } from './app-state';

export function createMainWindow() {
  state.mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 820,
    minHeight: 560,
    frame: false,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    ...(isMac ? { trafficLightPosition: { x: 12, y: 12 } } : {}),
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  if (isDev) {
    state.mainWindow.loadURL('http://localhost:5173');
  } else {
    state.mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  state.mainWindow.once('ready-to-show', () => state.mainWindow?.show());

  state.mainWindow.on('close', (e) => {
    if (!state.quitting) {
      e.preventDefault();
      state.mainWindow?.hide();
    }
  });
}

export function createOverlayWindow() {
  const display = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;
  const overlayW = 140;
  const overlayH = 40;

  state.overlayWindow = new BrowserWindow({
    width: overlayW,
    height: overlayH,
    x: Math.round((screenW - overlayW) / 2),
    y: screenH - overlayH - 8,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: true,
    opacity: 0,
  });

  const url = isDev ? 'http://localhost:5173/#/overlay' : undefined;
  if (url) {
    state.overlayWindow.loadURL(url);
  } else {
    state.overlayWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/overlay' });
  }

  state.overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
}
