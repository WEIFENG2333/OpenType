import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Platform (sync)
  platform: process.platform,

  // Config
  getConfig: (key: string) => ipcRenderer.invoke('config:get', key),
  setConfig: (key: string, value: any) => ipcRenderer.invoke('config:set', key, value),
  getAllConfig: () => ipcRenderer.invoke('config:getAll'),

  // Microphone permission
  checkMicPermission: () => ipcRenderer.invoke('mic:checkPermission'),
  requestMicPermission: () => ipcRenderer.invoke('mic:requestPermission'),

  // Shortcuts
  reregisterShortcuts: () => ipcRenderer.invoke('shortcuts:reregister'),

  // STT
  transcribe: (buf: ArrayBuffer, opts?: any) => ipcRenderer.invoke('stt:transcribe', buf, opts),

  // LLM
  processText: (text: string, ctx?: any) => ipcRenderer.invoke('llm:process', text, ctx),

  // Full pipeline
  processPipeline: (buf: ArrayBuffer, ctx?: any) => ipcRenderer.invoke('pipeline:process', buf, ctx),

  // Voice Superpowers
  rewriteText: (text: string, instruction: string) => ipcRenderer.invoke('llm:rewrite', text, instruction),

  // Clipboard
  writeClipboard: (text: string) => ipcRenderer.invoke('clipboard:write', text),

  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  hideOverlay: () => ipcRenderer.invoke('window:hideOverlay'),

  // API testing
  testAPI: (provider: string) => ipcRenderer.invoke('api:test', provider),
  testSTT: (provider: string) => ipcRenderer.invoke('api:testSTT', provider),

  // Audio devices
  getAudioDevices: () => ipcRenderer.invoke('audio:devices'),

  // Auto updater
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  getVersion: () => ipcRenderer.invoke('updater:getVersion'),

  onUpdateAvailable: (cb: (info: { version: string; releaseNotes?: string }) => void) => {
    ipcRenderer.on('updater:update-available', (_e, info) => cb(info));
    return () => { ipcRenderer.removeAllListeners('updater:update-available'); };
  },
  onUpdateNotAvailable: (cb: () => void) => {
    ipcRenderer.on('updater:update-not-available', () => cb());
    return () => { ipcRenderer.removeAllListeners('updater:update-not-available'); };
  },
  onDownloadProgress: (cb: (progress: { percent: number }) => void) => {
    ipcRenderer.on('updater:download-progress', (_e, progress) => cb(progress));
    return () => { ipcRenderer.removeAllListeners('updater:download-progress'); };
  },
  onUpdateDownloaded: (cb: () => void) => {
    ipcRenderer.on('updater:update-downloaded', () => cb());
    return () => { ipcRenderer.removeAllListeners('updater:update-downloaded'); };
  },
  onUpdateError: (cb: (msg: string) => void) => {
    ipcRenderer.on('updater:error', (_e, msg) => cb(msg));
    return () => { ipcRenderer.removeAllListeners('updater:error'); };
  },

  // Events
  onToggleRecording: (cb: () => void) => {
    ipcRenderer.on('toggle-recording', () => cb());
    return () => { ipcRenderer.removeAllListeners('toggle-recording'); };
  },
  onRecordingState: (cb: (state: string) => void) => {
    ipcRenderer.on('recording-state', (_e, state) => cb(state));
    return () => { ipcRenderer.removeAllListeners('recording-state'); };
  },
});
