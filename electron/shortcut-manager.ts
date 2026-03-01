import { globalShortcut, screen } from 'electron';
import { state, isMac } from './app-state';
import { muteSystemAudio, restoreSystemAudio } from './audio-control';
import { captureFullContext, captureScreenAndOcr } from './context-capture';
import { startFnMonitor } from './fn-monitor';
import { prepareEditDetection, runEditDetection } from './auto-dict';

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

  // Snapshot edit detection params before clearing (will run after context capture)
  const editDetectionParams = prepareEditDetection(cfg);

  state.isRecording = !state.isRecording;
  console.log(`[Toggle] isRecording=${state.isRecording} t=0ms`);

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
    console.log(`[Toggle] overlay shown +${Date.now() - t0}ms`);
  }

  if (state.isRecording && cfg.muteSystemAudio) {
    muteSystemAudio(); // async, won't block
    console.log(`[Toggle] mute started +${Date.now() - t0}ms`);
  } else if (!state.isRecording && cfg.muteSystemAudio) {
    restoreSystemAudio(); // async, won't block
    console.log(`[Toggle] restore started +${Date.now() - t0}ms`);
  }

  console.log(`[Toggle] total sync +${Date.now() - t0}ms`);

  if (state.isRecording) {
    setTimeout(() => {
      state.contextPromise = (async () => {
        const ctxStart = Date.now();
        const ctx = await captureFullContext(cfg);
        state.lastCapturedContext = ctx;
        console.log(`[Toggle] context capture took ${Date.now() - ctxStart}ms`);

        // Run edit detection using the just-captured context (no extra osascript call)
        if (editDetectionParams) {
          runEditDetection(editDetectionParams, ctx, cfg);
        }

        console.log(`[Context] app=${ctx.appName}${ctx.url ? ' url=' + ctx.url.slice(0, 60) : ''}`);
        console.log(`[Context] field=${ctx.fieldRole || '—'} label=${ctx.fieldLabel || '—'} cursor=${ctx.cursorPosition ?? '—'} chars=${ctx.numberOfCharacters ?? '—'}`);
        console.log(`[Context] selected=${ctx.selectedText ? `"${ctx.selectedText.slice(0, 80)}"` : '—'} | fieldText=${ctx.fieldText ? ctx.fieldText.length + 'c' : '—'} | clipboard=${ctx.clipboardText ? ctx.clipboardText.length + 'c' : '—'}`);

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
