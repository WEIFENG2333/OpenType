import { app, globalShortcut, BrowserWindow, systemPreferences } from 'electron';
import { spawn } from 'child_process';
import readline from 'readline';
import path from 'path';
import { state, isDev, isMac } from './app-state';

function getFnMonitorPath(): string {
  if (isDev) {
    return path.join(app.getAppPath(), 'native', 'fn-monitor');
  }
  return path.join(process.resourcesPath, 'native', 'fn-monitor');
}

export function startFnMonitor(onToggle: () => void, onReregister: () => void) {
  if (state.fnMonitorProcess) return; // already running
  if (!isMac) return;

  if (!systemPreferences.isTrustedAccessibilityClient(false)) {
    console.warn('[FnMonitor] skipped — Accessibility permission not granted');
    return;
  }

  const binPath = getFnMonitorPath();
  try {
    state.fnMonitorProcess = spawn(binPath, [], { stdio: ['ignore', 'pipe', 'pipe'] });
    const rl = readline.createInterface({ input: state.fnMonitorProcess.stdout! });

    let fnHeld = false;
    const fnComboShortcuts: string[] = [];

    function registerFnCombos() {
      unregisterFnCombos();
      const hotkey = state.configStore!.get('globalHotkey') || '';
      const pttKey = state.configStore!.get('pushToTalkKey') || '';

      if (hotkey.startsWith('Fn+')) {
        const rest = hotkey.slice(3);
        try {
          globalShortcut.register(rest, onToggle);
          fnComboShortcuts.push(rest);
        } catch (e) { console.error('[FnCombo] register failed:', rest, e); }
      }
      if (pttKey.startsWith('Fn+')) {
        const rest = pttKey.slice(3);
        if (!fnComboShortcuts.includes(rest)) {
          try {
            globalShortcut.register(rest, () => {
              const inputMode = state.configStore!.get('inputMode') || 'toggle';
              if (inputMode === 'pushToTalk') onToggle();
            });
            fnComboShortcuts.push(rest);
          } catch (e) { console.error('[FnCombo] register failed:', rest, e); }
        }
      }
    }

    function unregisterFnCombos() {
      for (const key of fnComboShortcuts) {
        try { globalShortcut.unregister(key); } catch (_) {}
      }
      fnComboShortcuts.length = 0;
    }

    rl.on('line', (line: string) => {
      const trimmed = line.trim();

      if (trimmed === 'fn-down' || trimmed === 'fn-up') {
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('fn-key-event', trimmed);
        }
      }

      if (trimmed === 'fn-down') fnHeld = true;
      if (trimmed === 'fn-up') fnHeld = false;

      if (state.shortcutsSuspended) return;

      const hotkey = state.configStore!.get('globalHotkey') || '';
      const pttKey = state.configStore!.get('pushToTalkKey') || '';
      const inputMode = state.configStore!.get('inputMode') || 'toggle';

      if (trimmed === 'fn-down') {
        if (hotkey === 'Fn') onToggle();
        if (inputMode === 'pushToTalk' && pttKey === 'Fn' && !state.isRecording) onToggle();

        const hasFnCombo = [hotkey, pttKey].some((k) => k.startsWith('Fn+'));
        if (hasFnCombo) registerFnCombos();
      }

      if (trimmed === 'fn-up') {
        if (inputMode === 'pushToTalk' && pttKey === 'Fn' && state.isRecording) onToggle();

        unregisterFnCombos();
        onReregister();
      }
    });

    state.fnMonitorProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[FnMonitor]', data.toString().trim());
    });

    state.fnMonitorProcess.on('exit', (code) => {
      console.log('[FnMonitor] exited with code', code);
      state.fnMonitorProcess = null;
    });

    console.log('[FnMonitor] started');
  } catch (e) {
    console.error('[FnMonitor] failed to start:', e);
  }
}

export function restartFnMonitor(onToggle: () => void, onReregister: () => void) {
  stopFnMonitor();
  startFnMonitor(onToggle, onReregister);
}

export function stopFnMonitor() {
  if (state.fnMonitorProcess) {
    state.fnMonitorProcess.kill();
    state.fnMonitorProcess = null;
  }
}

export function needsFnMonitor(): boolean {
  if (!isMac) return false;
  const hotkey = state.configStore!.get('globalHotkey') || '';
  const pttKey = state.configStore!.get('pushToTalkKey') || '';
  const pasteKey = state.configStore!.get('pasteLastKey') || '';
  return [hotkey, pttKey, pasteKey].some((k) => k === 'Fn' || k.startsWith('Fn+'));
}
