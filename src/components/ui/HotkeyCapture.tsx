import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../../i18n';

interface HotkeyCaptureProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
}

/** Map browser KeyboardEvent to Electron accelerator format */
function toElectronAccelerator(e: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  const key = e.key;
  // Ignore bare modifier presses
  if (['Control', 'Meta', 'Alt', 'Shift'].includes(key)) return null;

  const keyMap: Record<string, string> = {
    ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down',
    ArrowLeft: 'Left', ArrowRight: 'Right',
    Escape: 'Escape', Enter: 'Return', Backspace: 'Backspace',
    Delete: 'Delete', Tab: 'Tab',
  };
  const normalized = keyMap[key] || (key.length === 1 ? key.toUpperCase() : key);
  parts.push(normalized);

  // Require at least one modifier + one key
  if (parts.length < 2) return null;
  return parts.join('+');
}

export function HotkeyCapture({ value, onChange, label, hint }: HotkeyCaptureProps) {
  const { t } = useTranslation();
  const [capturing, setCapturing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!capturing) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setCapturing(false); return; }
      const accel = toElectronAccelerator(e);
      if (accel) {
        onChange(accel);
        setCapturing(false);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [capturing, onChange]);

  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-surface-600 dark:text-surface-400">{label}</label>}
      <div
        ref={ref}
        tabIndex={0}
        onClick={() => setCapturing(true)}
        onBlur={() => setCapturing(false)}
        className={`w-full bg-white dark:bg-surface-850 border rounded-lg px-3.5 py-2.5 text-sm cursor-pointer
          transition-colors select-none flex items-center justify-between
          ${capturing
            ? 'border-brand-500 ring-1 ring-brand-500/30 text-brand-400'
            : 'border-surface-300 dark:border-surface-700 text-surface-800 dark:text-surface-200 hover:border-surface-400 dark:hover:border-surface-600'}`}
      >
        <span className="font-mono text-sm">
          {capturing ? t('common.pressKeyCombination') : (value || t('common.clickToSet'))}
        </span>
        {!capturing && value && (
          <button
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="text-surface-400 dark:text-surface-600 hover:text-surface-600 dark:hover:text-surface-400 ml-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-surface-400 dark:text-surface-600">{hint}</p>}
    </div>
  );
}
