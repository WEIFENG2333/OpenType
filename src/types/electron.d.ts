/**
 * Type declarations for the Electron preload bridge (contextBridge).
 * These APIs are exposed on window.electronAPI in the renderer process.
 */

import type { AppConfig, HistoryItem, LLMProviderID } from './config';
import type { HistoryContext } from './config';

// Mirrors electron/context-capture.ts CapturedContext (subset used by renderer)
interface CapturedContext {
  appName?: string;
  windowTitle?: string;
  bundleId?: string;
  url?: string;
  selectedText?: string;
  fieldText?: string;
  fieldRole?: string;
  fieldRoleDescription?: string;
  fieldLabel?: string;
  fieldPlaceholder?: string;
  cursorPosition?: number;
  selectionRange?: { location: number; length: number };
  numberOfCharacters?: number;
  insertionLineNumber?: number;
  clipboardText?: string;
  recentTranscriptions?: string[];
  screenContext?: string;
  screenshotDataUrl?: string;
  ocrDurationMs?: number;
}

export interface PipelineResult {
  success: boolean;
  rawText: string;
  processedText: string;
  skipped?: boolean;
  error?: string;
  systemPrompt?: string;
  sttProvider?: string;
  llmProvider?: string;
  sttModel?: string;
  llmModel?: string;
  sttDurationMs?: number;
  llmDurationMs?: number;
  autoLearnedTerms?: string[];
}

export interface APITestResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ElectronAPI {
  // ─── Platform (sync) ────────────────────────────────────
  platform: string; // 'darwin' | 'win32' | 'linux'

  // ─── Config ───────────────────────────────────────────
  getConfig: <K extends keyof AppConfig>(key: K) => Promise<AppConfig[K]>;
  setConfig: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => Promise<boolean>;
  getAllConfig: () => Promise<AppConfig>;

  // ─── Media Files ────────────────────────────────────────
  saveMedia: (filename: string, base64: string) => Promise<string>;
  readMedia: (filePath: string) => Promise<string | null>;
  deleteMedia: (filePath: string) => Promise<boolean>;

  // ─── Microphone Permission ──────────────────────────────
  checkMicPermission: () => Promise<string>;
  requestMicPermission: () => Promise<boolean>;

  // ─── Shortcuts ──────────────────────────────────────────
  reregisterShortcuts: () => Promise<boolean>;
  suspendShortcuts: () => Promise<boolean>;
  resumeShortcuts: () => Promise<boolean>;

  // ─── STT ──────────────────────────────────────────────
  transcribe: (audioBuffer: ArrayBuffer, options?: { language?: string }) => Promise<{
    success: boolean;
    text?: string;
    error?: string;
  }>;

  // ─── LLM ──────────────────────────────────────────────
  processText: (rawText: string, context?: any) => Promise<{
    success: boolean;
    text?: string;
    error?: string;
  }>;

  // ─── Full Pipeline (STT + LLM) ───────────────────────
  processPipeline: (audioBuffer: ArrayBuffer) => Promise<PipelineResult>;

  // ─── Voice Superpowers (rewrite selected text) ────────
  rewriteText: (selectedText: string, instruction: string) => Promise<{
    success: boolean;
    text?: string;
    error?: string;
  }>;

  // ─── Clipboard ────────────────────────────────────────
  writeClipboard: (text: string) => Promise<boolean>;

  // ─── Type at cursor ──────────────────────────────────
  typeAtCursor: (text: string) => Promise<{ success: boolean; error?: string }>;

  // ─── Window controls ─────────────────────────────────
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  hideOverlay: () => Promise<void>;
  resizeOverlay: (w: number, h: number) => Promise<void>;

  // ─── API testing ──────────────────────────────────────
  testAPI: (provider: LLMProviderID) => Promise<APITestResult>;
  testVLM: () => Promise<APITestResult>;

  // ─── Auto Updater ───────────────────────────────────────
  checkForUpdates: () => Promise<any>;
  downloadUpdate: () => Promise<any>;
  installUpdate: () => Promise<void>;
  getVersion: () => Promise<string>;
  onUpdateAvailable: (callback: (info: { version: string; releaseNotes?: string }) => void) => () => void;
  onUpdateNotAvailable: (callback: () => void) => () => void;
  onDownloadProgress: (callback: (progress: { percent: number }) => void) => () => void;
  onUpdateDownloaded: (callback: () => void) => () => void;
  onUpdateError: (callback: (message: string) => void) => () => void;

  // ─── Context Awareness ──────────────────────────────────
  getLastContext: () => Promise<CapturedContext>;
  checkAccessibility: () => Promise<'granted' | 'not-determined'>;
  requestAccessibility: () => Promise<boolean>;
  checkScreenPermission: () => Promise<string>;
  openScreenPrefs: () => Promise<boolean>;
  captureAndOcr: () => Promise<string | null>;

  // ─── STT test ────────────────────────────────────────────
  testSTTConnection: () => Promise<{ success: boolean; text?: string; error?: string }>;

  // ─── Realtime STT ──────────────────────────────────────
  startRealtimeSTT: () => Promise<{ success: boolean; sampleRate?: number; error?: string }>;
  sendAudioChunk: (pcm16Base64: string) => Promise<void>;
  cancelRealtimeSTT: () => Promise<void>;

  // ─── Pipeline streaming events ────────────────────────
  onSttDelta: (callback: (data: { delta: string; accumulated: string }) => void) => () => void;
  onPipelinePhase: (callback: (phase: string) => void) => () => void;

  // ─── Events from main process ─────────────────────────
  onToggleRecording: (callback: () => void) => () => void;
  onRecordingState: (callback: (state: string) => void) => () => void;
  onNavigate: (callback: (page: string) => void) => () => void;
  onDictionaryAutoAdded: (callback: (words: string[]) => void) => () => void;
  onFnKeyEvent: (callback: (event: string) => void) => () => void;
  onHistoryUpdated: (callback: (history: HistoryItem[]) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
