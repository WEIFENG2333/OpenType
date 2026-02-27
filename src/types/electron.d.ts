/**
 * Type declarations for the Electron preload bridge (contextBridge).
 * These APIs are exposed on window.electronAPI in the renderer process.
 */

export interface PipelineResult {
  success: boolean;
  rawText?: string;
  processedText?: string;
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
  getConfig: (key: string) => Promise<any>;
  setConfig: (key: string, value: any) => Promise<boolean>;
  getAllConfig: () => Promise<any>;

  // ─── Microphone Permission ──────────────────────────────
  checkMicPermission: () => Promise<string>;
  requestMicPermission: () => Promise<boolean>;

  // ─── Shortcuts ──────────────────────────────────────────
  reregisterShortcuts: () => Promise<boolean>;

  // ─── STT ──────────────────────────────────────────────
  transcribe: (audioBuffer: ArrayBuffer, options?: any) => Promise<{
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
  processPipeline: (audioBuffer: ArrayBuffer, context?: any) => Promise<PipelineResult>;

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
  testAPI: (provider: string) => Promise<APITestResult>;
  testSTT: (provider: string) => Promise<APITestResult>;

  // ─── Audio devices ────────────────────────────────────
  getAudioDevices: () => Promise<MediaDeviceInfo[]>;

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
  getLastContext: () => Promise<{
    appName?: string;
    windowTitle?: string;
    bundleId?: string;
    url?: string;
    selectedText?: string;
    fieldText?: string;
    fieldRole?: string;
    clipboardText?: string;
    recentTranscriptions?: string[];
    screenContext?: string;
    screenshotDataUrl?: string;
  }>;
  checkAccessibility: () => Promise<'granted' | 'not-determined'>;
  requestAccessibility: () => Promise<boolean>;
  checkScreenPermission: () => Promise<string>;
  captureAndOcr: () => Promise<string | null>;

  // ─── Events from main process ─────────────────────────
  onToggleRecording: (callback: () => void) => () => void;
  onRecordingState: (callback: (state: string) => void) => () => void;
  onNavigate: (callback: (page: string) => void) => () => void;
  onDictionaryAutoAdded: (callback: (words: string[]) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
