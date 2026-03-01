import { BrowserWindow, Tray } from 'electron';
import { ChildProcess } from 'child_process';
import { ConfigStore } from './config-store';
import { STTService } from './stt-service';
import { LLMService } from './llm-service';
import { CapturedContext } from './context-capture';

export const state = {
  mainWindow: null as BrowserWindow | null,
  overlayWindow: null as BrowserWindow | null,
  tray: null as Tray | null,
  quitting: false,

  configStore: null as ConfigStore | null,
  sttService: null as STTService | null,
  llmService: null as LLMService | null,

  isRecording: false,
  shortcutsSuspended: false,
  suppressActivateUntil: 0,
  savedSystemVolume: null as number | null,
  savedSystemMuted: false,

  lastCapturedContext: {} as CapturedContext,
  ocrPromise: null as Promise<{ text: string; screenshot?: string; durationMs: number } | null> | null,
  ocrGeneration: 0,
  contextPromise: null as Promise<void> | null,

  fnMonitorProcess: null as ChildProcess | null,

  lastTypedText: null as string | null,
  lastTypedContext: null as { appName?: string; bundleId?: string; fieldRole?: string } | null,
  lastTypedAt: 0,
};

export const isDev = !require('electron').app.isPackaged;
export const isMac = process.platform === 'darwin';
export const isWin = process.platform === 'win32';
