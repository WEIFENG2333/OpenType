import { globalShortcut, screen } from 'electron';
import { state, isMac } from './app-state';
import { muteSystemAudio, restoreSystemAudio } from './audio-control';
import { captureFullContext, captureScreenAndOcr } from './context-capture';
import { startFnMonitor } from './fn-monitor';
import { prepareEditDetection, runEditDetection } from './auto-dict';
import { updateTrayMenu } from './tray-manager';

let lastToggleTime = 0;
const DEBOUNCE_MS = 300;

export function registerShortcuts() {
  globalShortcut.unregisterAll();

  const key = state.configStore!.get('globalHotkey') || 'CommandOrControl+Shift+Space';

  if (key !== 'Fn' && !key.startsWith('Fn+')) {
    try {
      globalShortcut.register(key, toggleRecording);
      console.log('[Shortcut] registered:', key);
    } catch (e) {
      console.error('[Shortcut] register failed:', key, e);
    }
  }

  // Sync tray menu accelerator with current hotkey
  updateTrayMenu(toggleRecording);

  // startFnMonitor is idempotent — won't restart if already running
  if (isMac) {
    startFnMonitor(toggleRecording, registerShortcuts);
  }
}

export function toggleRecording() {
  const now = Date.now();
  if (now - lastToggleTime < DEBOUNCE_MS) {
    console.log('[Toggle] debounced');
    return;
  }
  lastToggleTime = now;

  if (state.shortcutsSuspended) {
    console.log('[Toggle] suspended, ignoring');
    return;
  }

  const t0 = now;
  const cfg = state.configStore!.getAll();

  state.isRecording = !state.isRecording;

  // Snapshot edit detection params only when starting recording
  // (will run after context capture to detect user edits since last output)
  const editDetectionParams = state.isRecording ? prepareEditDetection(cfg) : null;
  if (state.overlayWindow) {
    const activeDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const { x: dX, y: dY, width: dW, height: dH } = activeDisplay.workArea;
    const pillW = 140, pillH = 40;
    state.overlayWindow.setBounds({
      width: pillW, height: pillH,
      x: dX + Math.round((dW - pillW) / 2),
      y: dY + dH - pillH - 8,
    });
    state.overlayWindow.setOpacity(1);
    state.overlayWindow.webContents.send('toggle-recording');
  }

  if (state.isRecording && cfg.muteSystemAudio) {
    muteSystemAudio();
  } else if (!state.isRecording && cfg.muteSystemAudio) {
    restoreSystemAudio();
  }

  console.log(`[Toggle] isRecording=${state.isRecording} +${Date.now() - t0}ms`);

  if (state.isRecording) {
    // Clear stale data from previous recording
    state.contextPromise = null;
    state.ocrPromise = null;
    state.lastCapturedContext = {};

    setTimeout(() => {
      state.contextPromise = (async () => {
        const ctxStart = Date.now();
        const ctx = await captureFullContext(cfg);
        state.lastCapturedContext = ctx;
        const ctxMs = Date.now() - ctxStart;

        // Run edit detection using the just-captured context (no extra osascript call)
        if (editDetectionParams) {
          runEditDetection(editDetectionParams, ctx, cfg);
        }

        console.log(`[Context] ${ctxMs}ms app=${ctx.appName || '—'} field=${ctx.fieldText ? ctx.fieldText.length + 'c' : '—'} clipboard=${ctx.clipboardText ? ctx.clipboardText.length + 'c' : '—'}`);

        if (cfg.contextOcrEnabled) {
          const gen = ++state.ocrGeneration;
          state.ocrPromise = captureScreenAndOcr(cfg).then((result) => {
            if (state.ocrGeneration !== gen) {
              console.log('[OCR] stale generation, discarding');
              return null;
            }
            return result;
          });
        } else {
          state.ocrPromise = null;
        }
      })();
    }, 50);
  }
}
