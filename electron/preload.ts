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
