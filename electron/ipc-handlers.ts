import { app, ipcMain, clipboard, globalShortcut, systemPreferences, screen } from 'electron';
import { exec, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { autoUpdater } from 'electron-updater';
import { state, isMac } from './app-state';
import { registerShortcuts, toggleRecording } from './shortcut-manager';
import { captureScreenAndOcr } from './context-capture';
import { restartFnMonitor } from './fn-monitor';
import { schedulePostPipelineExtraction, recordTypedText } from './auto-dict';
import { restoreSystemAudio } from './audio-control';
import type { IRealtimeSession } from './stt-service';
import { AppConfig, getSTTProviderOpts, getLLMProviderOpts, LLMProviderID } from '../src/types/config';

// ─── Module state ───────────────────────────────────────────────────────────

let pipelineRunning = false;
let pipelineStartedAt = 0;
let realtimeSession: IRealtimeSession | null = null;
let audioChunkCount = 0;
const PIPELINE_TIMEOUT_MS = 60_000; // 60s safety valve

export function setupIPC() {
  // Config
  ipcMain.handle('config:get', (_e, key: keyof AppConfig) => state.configStore!.get(key));
  ipcMain.handle('config:set', (event, key: keyof AppConfig, val: any) => {
    state.configStore!.set(key, val);
    // Broadcast history changes to all OTHER windows so they stay in sync
    if (key === 'history') {
      const senderId = event.sender.id;
      for (const win of [state.mainWindow, state.overlayWindow]) {
        if (win && !win.isDestroyed() && win.webContents.id !== senderId) {
          win.webContents.send('config:history-updated', val);
        }
      }
    }
    return true;
  });
  ipcMain.handle('config:getAll', () => state.configStore!.getAll());

  // Media file storage (audio / screenshots)
  const mediaDir = path.join(app.getPath('userData'), 'media');
  if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

  // Security: validate all file paths are under mediaDir to prevent directory traversal
  const mediaDirResolved = path.resolve(mediaDir);
  function assertMediaPath(filePath: string): string {
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(mediaDirResolved + path.sep) && resolved !== mediaDirResolved) {
      throw new Error('Access denied: path outside media directory');
    }
    return resolved;
  }

  ipcMain.handle('media:save', (_e, filename: string, base64: string) => {
    const safeName = path.basename(filename); // strip any path components
    const filePath = path.join(mediaDir, safeName);
    assertMediaPath(filePath);
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
    return filePath;
  });

  ipcMain.handle('media:read', (_e, filePath: string) => {
    try {
      assertMediaPath(filePath);
      if (!fs.existsSync(filePath)) return null;
      return fs.readFileSync(filePath).toString('base64');
    } catch { return null; }
  });

  ipcMain.handle('media:delete', (_e, filePath: string) => {
    try { assertMediaPath(filePath); if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
    return true;
  });

  // Microphone permission
  ipcMain.handle('mic:checkPermission', async () => {
    if (isMac) {
      return systemPreferences.getMediaAccessStatus('microphone');
    }
    return 'granted';
  });

  ipcMain.handle('mic:requestPermission', async () => {
    if (isMac) {
      return systemPreferences.askForMediaAccess('microphone');
    }
    return true;
  });

  // Shortcuts re-registration (hotkey config changed — force restart fn monitor)
  ipcMain.handle('shortcuts:reregister', () => {
    restartFnMonitor(toggleRecording, registerShortcuts);
    registerShortcuts();
    return true;
  });

  ipcMain.handle('shortcuts:suspend', () => {
    globalShortcut.unregisterAll();
    state.shortcutsSuspended = true;
    return true;
  });

  ipcMain.handle('shortcuts:resume', () => {
    state.shortcutsSuspended = false;
    registerShortcuts();
    return true;
  });

  // STT
  ipcMain.handle('stt:transcribe', async (_e, buf: ArrayBuffer, opts: any) => {
    try {
      const text = await state.sttService!.transcribe(Buffer.from(buf), state.configStore!.getAll(), opts);
      console.log('[STT] result:', text.slice(0, 100));
      return { success: true, text };
    } catch (e: any) {
      console.error('[STT] error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // STT test connection (works for all providers including DashScope WebSocket)
  ipcMain.handle('stt:testConnection', async () => {
    try {
      const cfg = state.configStore!.getAll();
      return await state.sttService!.testConnection(cfg);
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  // Realtime STT
  ipcMain.handle('stt:startRealtime', async () => {
    try {
      const cfg = state.configStore!.getAll();
      if (!state.sttService!.supportsStreaming(cfg)) {
        const model = getSTTProviderOpts(cfg).model;
        console.log(`[RealtimeSTT] skipped — model "${model}" is non-streaming, will use batch`);
        return { success: false, error: 'non-streaming' };
      }
      // Close any existing session
      if (realtimeSession) {
        realtimeSession.close();
        realtimeSession = null;
      }
      audioChunkCount = 0;
      // Create + connect in a local variable to avoid race with cancelRealtime
      const session = state.sttService!.createRealtimeSession(cfg);
      const sampleRate = session.sampleRate;
      const overlayWC = state.overlayWindow?.webContents;
      session.onDelta = (delta, accumulated) => {
        if (overlayWC && !overlayWC.isDestroyed()) {
          overlayWC.send('pipeline:stt-delta', { delta, accumulated });
        }
      };
      session.onError = (error) => {
        console.error('[RealtimeSTT] error:', error);
        if (overlayWC && !overlayWC.isDestroyed()) {
          overlayWC.send('pipeline:phase', 'error');
        }
      };
      await session.connect();
      // If user cancelled during connect, don't publish the session
      if (!state.isRecording) {
        session.close();
        return { success: false, error: 'cancelled' };
      }
      realtimeSession = session;
      return { success: true, sampleRate };
    } catch (e: any) {
      console.error('[RealtimeSTT] start failed:', e.message);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('stt:sendAudio', (_e, pcm16Base64: string) => {
    if (!realtimeSession) return;
    audioChunkCount++;
    if (audioChunkCount === 1) {
      console.log(`[RealtimeSTT] first audio chunk, len=${pcm16Base64.length}`);
    }
    realtimeSession.sendAudio(pcm16Base64);
  });

  ipcMain.handle('stt:cancelRealtime', () => {
    if (realtimeSession) {
      realtimeSession.close();
      realtimeSession = null;
    }
    // Ensure system audio is restored when recording is cancelled (e.g. overlay X button)
    if (state.isRecording) {
      state.isRecording = false;
      const cfg = state.configStore!.getAll();
      if (cfg.muteSystemAudio) {
        restoreSystemAudio();
      }
    }
  });

  // LLM
  ipcMain.handle('llm:process', async (_e, text: string, ctx: any) => {
    try {
      const result = await state.llmService!.process(text, state.configStore!.getAll(), ctx);
      return { success: true, text: result.text };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  // Resolve context: wait for contextPromise + ocrPromise, merge OCR results
  async function resolveContext() {
    if (state.contextPromise) {
      try { await state.contextPromise; } catch {}
      state.contextPromise = null;
    }
    if (state.ocrPromise) {
      try {
        const ocrResult = await state.ocrPromise;
        if (ocrResult) {
          state.lastCapturedContext.screenContext = ocrResult.text;
          state.lastCapturedContext.screenshotDataUrl = ocrResult.screenshot;
          state.lastCapturedContext.ocrDurationMs = ocrResult.durationMs;
        }
      } catch (e: any) {
        console.error('[OCR] await error:', e.message);
      }
      state.ocrPromise = null;
    }
    return state.lastCapturedContext;
  }

  // Helper: send phase updates to overlay
  function sendPhase(phase: string) {
    const wc = state.overlayWindow?.webContents;
    if (wc && !wc.isDestroyed()) wc.send('pipeline:phase', phase);
  }

  // Pipeline: STT runs in parallel with context/OCR resolution
  ipcMain.handle('pipeline:process', async (_e, buf: ArrayBuffer) => {
    // Safety valve: if previous pipeline has been stuck for too long, force unlock
    if (pipelineRunning && Date.now() - pipelineStartedAt > PIPELINE_TIMEOUT_MS) {
      console.warn('[Pipeline] force-unlocking stale pipeline lock after', Math.round((Date.now() - pipelineStartedAt) / 1000), 's');
      pipelineRunning = false;
    }
    if (pipelineRunning) return { success: false, rawText: '', processedText: '', error: 'Pipeline busy' };
    pipelineRunning = true;
    pipelineStartedAt = Date.now();
    const cfg = state.configStore!.getAll();
    const sttProvider = cfg.sttProvider;
    const llmProvider = cfg.llmProvider;
    const sttModel = getSTTProviderOpts(cfg).model;
    const llmModel = getLLMProviderOpts(cfg).model;

    let sttDurationMs = 0;
    let llmDurationMs = 0;
    const overlayWC = state.overlayWindow?.webContents;

    try {
      let raw: string;
      let ctx: any;

      if (realtimeSession) {
        // ── Realtime streaming mode ──
        // STT already happened via WebSocket during recording.
        // Commit and wait for final transcript.
        console.log('[Pipeline] Realtime STT commit + context resolve');
        sendPhase('stt');
        const sttStart = Date.now();
        const [sttText, resolvedCtx] = await Promise.all([
          realtimeSession.commit(),
          resolveContext(),
        ]);
        raw = sttText;
        ctx = resolvedCtx;
        sttDurationMs = Date.now() - sttStart;
        realtimeSession.close();
        realtimeSession = null;
        console.log('[Pipeline] Realtime STT final in', sttDurationMs, 'ms:', raw.slice(0, 100));
      } else {
        // ── Batch mode (non-streaming) ──
        sendPhase('stt');
        console.log('[Pipeline] STT via', sttProvider, sttModel);
        const sttStart = Date.now();
        const [sttText, resolvedCtx] = await Promise.all([
          state.sttService!.transcribe(Buffer.from(buf), cfg),
          resolveContext(),
        ]);
        raw = sttText;
        ctx = resolvedCtx;
        sttDurationMs = Date.now() - sttStart;
        console.log('[Pipeline] STT done in', sttDurationMs, 'ms:', raw.slice(0, 100));

        // For non-streaming: send the full STT text so overlay can display it
        if (overlayWC && !overlayWC.isDestroyed() && raw.trim()) {
          overlayWC.send('pipeline:stt-delta', { delta: raw, accumulated: raw });
        }
      }

      if (!raw.trim()) {
        sendPhase('done');
        return { success: true, rawText: '', processedText: '', skipped: true, sttProvider, llmProvider, sttModel, llmModel, sttDurationMs, llmDurationMs };
      }

      let processedText = raw;
      let systemPromptUsed = '';

      if (cfg.llmPostProcessing) {
        sendPhase('llm');
        console.log('[Pipeline] LLM via', llmProvider, llmModel);
        const llmStart = Date.now();
        const llmResult = await state.llmService!.process(raw, cfg, ctx);
        llmDurationMs = Date.now() - llmStart;
        console.log('[Pipeline] LLM done in', llmDurationMs, 'ms:', llmResult.text.slice(0, 100));
        processedText = llmResult.text;
        systemPromptUsed = llmResult.systemPrompt;
        schedulePostPipelineExtraction(raw, processedText, cfg);
      } else {
        console.log('[Pipeline] LLM post-processing disabled, using raw STT output');
      }

      state.isRecording = false;
      sendPhase('done');

      return {
        success: true,
        rawText: raw,
        processedText: processedText,
        systemPrompt: systemPromptUsed,
        sttProvider, llmProvider, sttModel, llmModel,
        sttDurationMs, llmDurationMs,
      };
    } catch (e: any) {
      state.isRecording = false;
      sendPhase('done');
      // Clean up realtime session if it was in use
      if (realtimeSession) {
        realtimeSession.close();
        realtimeSession = null;
      }
      return { success: false, rawText: '', processedText: '', error: e.message, sttProvider, llmProvider, sttModel, llmModel, sttDurationMs, llmDurationMs };
    } finally {
      pipelineRunning = false;
    }
  });

  // Rewrite (Voice Superpowers)
  ipcMain.handle('llm:rewrite', async (_e, text: string, instruction: string) => {
    try {
      const result = await state.llmService!.rewrite(text, instruction, state.configStore!.getAll());
      return { success: true, text: result };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  // Clipboard
  ipcMain.handle('clipboard:write', (_e, text: string) => { clipboard.writeText(text); return true; });

  // Type text at cursor
  ipcMain.handle('text:typeAtCursor', async (_e, text: string) => {
    try {
      const prevClipboard = clipboard.readText();
      clipboard.writeText(text);
      await new Promise((r) => setTimeout(r, 50));

      if (isMac) {
        // Sanitize to prevent shell injection — bundle IDs and app names should only contain safe chars
        const bid = (state.lastCapturedContext?.bundleId || '').replace(/[^a-zA-Z0-9._-]/g, '');
        const targetApp = (state.lastCapturedContext?.appName || '').replace(/[^a-zA-Z0-9 ._-]/g, '');
        if (bid) {
          try {
            execSync(`osascript -e 'tell application id "${bid}" to activate'`, { timeout: 1500 });
            await new Promise((r) => setTimeout(r, 120));
          } catch {
            if (targetApp) {
              try {
                execSync(`osascript -e 'tell application "${targetApp}" to activate'`, { timeout: 1500 });
                await new Promise((r) => setTimeout(r, 120));
              } catch {}
            }
          }
        }
      }

      if (isMac) {
        execSync(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`);
      } else if (process.platform === 'win32') {
        execSync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`);
      } else {
        try {
          execSync('xdotool key ctrl+v');
        } catch {
          execSync('xsel --clipboard --output | xargs -0 xdotool type --');
        }
      }

      setTimeout(() => {
        try { clipboard.writeText(prevClipboard); } catch {}
      }, 500);

      recordTypedText(text);

      return { success: true };
    } catch (e: any) {
      console.error('[TypeText] error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // Window controls
  ipcMain.handle('window:minimize', () => state.mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    state.mainWindow?.isMaximized() ? state.mainWindow.unmaximize() : state.mainWindow?.maximize();
  });
  ipcMain.handle('window:close', () => state.mainWindow?.hide());
  ipcMain.handle('window:hideOverlay', () => {
    if (state.isRecording) state.isRecording = false;
    const ACTIVATE_SUPPRESS_MS = 600; // prevent macOS activate from showing main window after overlay hides
    state.suppressActivateUntil = Date.now() + ACTIVATE_SUPPRESS_MS;
    if (!state.overlayWindow) return;
    state.overlayWindow.setOpacity(0);
    if (isMac) app.hide();
    const display = screen.getPrimaryDisplay();
    const { x: dX, y: dY, width: dW, height: dH } = display.workArea;
    const pillW = 140, pillH = 40;
    state.overlayWindow.setBounds({
      width: pillW, height: pillH,
      x: dX + Math.round((dW - pillW) / 2),
      y: dY + dH - pillH - 8,
    });
  });
  ipcMain.handle('window:resizeOverlay', (_e, w: number, h: number) => {
    if (!state.overlayWindow) return;
    const overlayBounds = state.overlayWindow.getBounds();
    const display = screen.getDisplayNearestPoint({ x: overlayBounds.x, y: overlayBounds.y });
    const { x: dX, y: dY, width: dW, height: dH } = display.workArea;
    state.overlayWindow.setBounds({
      width: w, height: h,
      x: dX + Math.round((dW - w) / 2),
      y: dY + dH - h - 8,
    });
  });

  // Auto updater
  ipcMain.handle('updater:check', () => autoUpdater.checkForUpdates().catch(() => null));
  ipcMain.handle('updater:download', () => autoUpdater.downloadUpdate().catch(() => null));
  ipcMain.handle('updater:install', () => {
    state.quitting = true;
    autoUpdater.quitAndInstall();
  });
  ipcMain.handle('updater:getVersion', () => app.getVersion());

  // Context awareness
  ipcMain.handle('context:getLastContext', () => resolveContext());

  ipcMain.handle('context:checkAccessibility', () => {
    if (!isMac) return 'granted';
    return systemPreferences.isTrustedAccessibilityClient(false) ? 'granted' : 'not-determined';
  });

  ipcMain.handle('context:requestAccessibility', () => {
    if (!isMac) return true;
    return systemPreferences.isTrustedAccessibilityClient(true);
  });

  ipcMain.handle('context:checkScreenPermission', () => {
    if (!isMac) return 'granted';
    const tmpPath = path.join(app.getPath('temp'), `opentype-perm-test-${Date.now()}.jpg`);
    try {
      execSync(`screencapture -x -t jpg "${tmpPath}"`, { timeout: 2000 });
      const size = fs.existsSync(tmpPath) ? fs.statSync(tmpPath).size : 0;
      return size > 100 ? 'granted' : 'denied';
    } catch {
      return 'denied';
    } finally {
      try { fs.unlinkSync(tmpPath); } catch {}
    }
  });

  ipcMain.handle('context:openScreenPrefs', () => {
    if (isMac) {
      exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"');
    }
    return true;
  });

  ipcMain.handle('context:captureAndOcr', async () => {
    const cfg = state.configStore!.getAll();
    if (!cfg.contextOcrEnabled) return null;
    try {
      const result = await captureScreenAndOcr(cfg);
      return result?.text || null;
    } catch (e: any) {
      console.error('[Context OCR] error:', e.message);
      return null;
    }
  });

  // API test
  ipcMain.handle('api:test', async (_e, provider: LLMProviderID) => {
    try {
      const msg = await state.llmService!.testConnection(state.configStore!.getAll(), provider);
      return { success: true, message: msg };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('api:testVLM', async () => {
    try {
      const msg = await state.llmService!.testVLMConnection(state.configStore!.getAll());
      return { success: true, message: msg };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

}
