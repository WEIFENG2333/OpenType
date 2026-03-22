import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n';

interface HotkeyCaptureProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
  usedKeys?: string[];
}

const isMac = typeof navigator !== 'undefined' && navigator.platform.startsWith('Mac');

// ─── Blocked combinations ────────────────────────────────────────────────────
const BLOCKED_ACCELS = new Set([
  'CommandOrControl+C', 'CommandOrControl+V', 'CommandOrControl+X',
  'CommandOrControl+Z', 'CommandOrControl+Y', 'CommandOrControl+A',
  'CommandOrControl+S', 'CommandOrControl+Q', 'CommandOrControl+W',
  'CommandOrControl+N', 'CommandOrControl+T', 'CommandOrControl+R',
  'CommandOrControl+H', 'CommandOrControl+M', 'CommandOrControl+F',
  'CommandOrControl+P', 'Alt+F4',
]);

// ─── Key mapping ─────────────────────────────────────────────────────────────
const KEY_MAP: Record<string, string> = {
  ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Escape: 'Escape', Enter: 'Return', Backspace: 'Backspace', Delete: 'Delete',
  Tab: 'Tab', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
  Insert: 'Insert', PrintScreen: 'PrintScreen',
  F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', F5: 'F5', F6: 'F6',
  F7: 'F7', F8: 'F8', F9: 'F9', F10: 'F10', F11: 'F11', F12: 'F12',
  F13: 'F13', F14: 'F14', F15: 'F15', F16: 'F16', F17: 'F17', F18: 'F18',
  F19: 'F19', F20: 'F20', MediaPlayPause: 'MediaPlayPause',
  MediaStop: 'MediaStop', MediaNextTrack: 'MediaNextTrack',
  MediaPreviousTrack: 'MediaPreviousTrack',
  VolumeUp: 'VolumeUp', VolumeDown: 'VolumeDown', VolumeMute: 'VolumeMute',
};

const MODIFIER_KEYS = new Set(['Control', 'Meta', 'Alt', 'Shift', 'OS', 'Win']);
const F_KEY_RE = /^F\d+$/;
const SINGLE_LETTER_RE = /^[A-Z0-9]$/;

function toAccelerator(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  const normalized = KEY_MAP[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key);
  parts.push(normalized);
  return parts.join('+');
}

function isAllowed(accel: string): { ok: boolean; reason?: string } {
  if (BLOCKED_ACCELS.has(accel)) return { ok: false, reason: 'system' };
  const parts = accel.split('+');
  const key = parts[parts.length - 1];
  const hasModifier = parts.length > 1;
  // Bare single letter/digit is too risky
  if (!hasModifier && SINGLE_LETTER_RE.test(key))
    return { ok: false, reason: 'single' };
  // Bare common control keys without modifier
  if (!hasModifier && ['Backspace', 'Delete', 'Tab', 'Return', 'Escape', 'Space'].includes(key))
    return { ok: false, reason: 'single' };
  // F-keys alone are fine
  if (!hasModifier && F_KEY_RE.test(key)) return { ok: true };
  // Needs modifier otherwise
  if (!hasModifier) return { ok: false, reason: 'single' };
  return { ok: true };
}

// ─── Display helpers ──────────────────────────────────────────────────────────

function formatKeyPart(part: string): string {
  if (part === 'CommandOrControl') return isMac ? '⌘' : 'Ctrl';
  if (part === 'Alt') return isMac ? '⌥' : 'Alt';
  if (part === 'Shift') return isMac ? '⇧' : 'Shift';
  if (part === 'Control') return isMac ? '⌃' : 'Ctrl';
  if (part === 'Fn') return 'Fn';
  if (part === 'Return') return '↵';
  if (part === 'Backspace') return '⌫';
  if (part === 'Delete') return 'Del';
  if (part === 'Up') return '↑';
  if (part === 'Down') return '↓';
  if (part === 'Left') return '←';
  if (part === 'Right') return '→';
  return part;
}

function KeyBadge({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-[22px] px-1.5 rounded-md
      border border-surface-300 dark:border-surface-600
      bg-surface-100 dark:bg-surface-800
      text-[11px] font-medium text-surface-700 dark:text-surface-200
      shadow-[0_1px_0_0] shadow-surface-300 dark:shadow-surface-700">
      {children}
    </kbd>
  );
}

function HotkeyBadges({ accel }: { accel: string }) {
  if (!accel) return null;
  const parts = accel.split('+').map(formatKeyPart);
  return (
    <span className="flex items-center gap-1 flex-wrap">
      {parts.map((p, i) => <KeyBadge key={i}>{p}</KeyBadge>)}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function HotkeyCapture({ value, onChange, label, hint, usedKeys }: HotkeyCaptureProps) {
  const { t } = useTranslation();
  const [capturing, setCapturing] = useState(false);
  const [pendingParts, setPendingParts] = useState<string[]>([]);
  const [blocked, setBlocked] = useState(false);
  const fnHeldRef = useRef(false);
  const fnUsedInComboRef = useRef(false);

  // Listen for Fn key from native monitor (macOS)
  useEffect(() => {
    if (!capturing || !window.electronAPI?.onFnKeyEvent) return;
    const unsub = window.electronAPI.onFnKeyEvent((event) => {
      if (event === 'fn-down') {
        fnHeldRef.current = true;
        fnUsedInComboRef.current = false;
        setPendingParts(['Fn']);
      } else if (event === 'fn-up') {
        const wasHeld = fnHeldRef.current;
        const usedInCombo = fnUsedInComboRef.current;
        fnHeldRef.current = false;
        fnUsedInComboRef.current = false;
        if (wasHeld && !usedInCombo) {
          // Fn released alone — register as solo Fn
          acceptAccel('Fn');
        }
      }
    });
    return unsub;
  }, [capturing, onChange, usedKeys]);

  const acceptAccel = (accel: string) => {
    if (usedKeys?.includes(accel)) {
      const display = accel.split('+').map(formatKeyPart);
      setPendingParts(display);
      setBlocked(true);
      setTimeout(() => { setBlocked(false); setPendingParts([]); }, 1200);
      return;
    }
    window.electronAPI?.resumeShortcuts();
    onChange(accel);
    setCapturing(false);
    setPendingParts([]);
    setBlocked(false);
    fnHeldRef.current = false;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!capturing) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      window.electronAPI?.resumeShortcuts();
      setCapturing(false);
      setPendingParts([]);
      fnHeldRef.current = false;
      return;
    }

    const hasFn = fnHeldRef.current;

    // Always build the current modifier display
    const mods: string[] = [];
    if (hasFn) mods.push('Fn');
    if (e.ctrlKey || e.metaKey) mods.push('CommandOrControl');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey) mods.push('Shift');

    if (MODIFIER_KEYS.has(e.key)) {
      setPendingParts(mods);
      setBlocked(false);
      return;
    }

    // Full combo: build accelerator and validate
    const accel = toAccelerator(e.nativeEvent);
    if (!accel) return;

    // Prepend Fn if held
    const finalAccel = hasFn ? 'Fn+' + accel : accel;
    if (hasFn) {
      fnUsedInComboRef.current = true;
      fnHeldRef.current = false;
    }

    // Fn as modifier makes otherwise-blocked single keys acceptable
    const { ok } = isAllowed(accel);
    if (!ok && !hasFn) {
      const key = accel.split('+').pop()!;
      const display = [...mods, key].map(formatKeyPart);
      setPendingParts(display);
      setBlocked(true);
      setTimeout(() => { setBlocked(false); setPendingParts([]); }, 1200);
      return;
    }

    acceptAccel(finalAccel);
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (!capturing) return;
    // When all modifiers are released without a main key, clear pending
    if (MODIFIER_KEYS.has(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      if (!blocked) setPendingParts([]);
    }
  };

  const startCapturing = () => {
    window.electronAPI?.suspendShortcuts();
    setCapturing(true);
    setPendingParts([]);
    setBlocked(false);
    fnHeldRef.current = false;
    fnUsedInComboRef.current = false;
  };

  const stopCapturing = () => {
    window.electronAPI?.resumeShortcuts();
    setCapturing(false);
    setPendingParts([]);
    setBlocked(false);
    fnHeldRef.current = false;
    fnUsedInComboRef.current = false;
  };

  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-surface-600 dark:text-surface-400">{label}</label>}
      <div
        tabIndex={0}
        onClick={startCapturing}
        onBlur={stopCapturing}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        className={`w-full bg-white dark:bg-surface-850 border rounded-lg px-3.5 py-2 text-sm cursor-pointer
          transition-colors select-none flex items-center justify-between min-h-[38px]
          ${blocked
            ? 'border-red-400 ring-1 ring-red-400/30'
            : capturing
              ? 'border-brand-500 ring-1 ring-brand-500/30'
              : 'border-surface-300 dark:border-surface-700 hover:border-surface-400 dark:hover:border-surface-600'
          }`}
      >
        {capturing ? (
          <span className="flex items-center gap-2 min-h-[22px]">
            {pendingParts.length > 0 ? (
              <>
                <span className="flex items-center gap-1">
                  {pendingParts.map((p, i) => (
                    <KeyBadge key={i}>{p}</KeyBadge>
                  ))}
                </span>
                {blocked && (
                  <span className="text-xs text-red-500 dark:text-red-400">{t('hotkey.blocked')}</span>
                )}
              </>
            ) : (
              <span className="text-xs text-brand-400">{t('hotkey.pressNow')}</span>
            )}
          </span>
        ) : value ? (
          <HotkeyBadges accel={value} />
        ) : (
          <span className="text-sm text-surface-400 dark:text-surface-500">{t('common.clickToSet')}</span>
        )}

        {!capturing && value && (
          <button
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="ml-2 text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-400 flex-shrink-0"
            tabIndex={-1}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-surface-400 dark:text-surface-500">{hint}</p>}
    </div>
  );
}
