import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  hint?: string;
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  options: SelectOption[];
  className?: string;
  disabled?: boolean;
}

export function Select({ label, hint, value, onChange, options, className = '', disabled }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label || value || '';

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropUp = spaceBelow < 200 && rect.top > spaceBelow;
    setStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      ...(dropUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
      maxHeight: Math.min(dropUp ? rect.top - 8 : spaceBelow - 8, 300),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onClickOutside = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) &&
          !dropdownRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onClickOutside);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, updatePos]);

  const handleSelect = (v: string) => {
    onChange?.({ target: { value: v } });
    setOpen(false);
  };

  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-surface-600 dark:text-surface-400">{label}</label>}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`w-full bg-white dark:bg-surface-850 border border-surface-300 dark:border-surface-700 rounded-lg px-3.5 py-2 text-sm
          text-surface-800 dark:text-surface-200 text-left flex items-center justify-between
          focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30
          transition-colors cursor-pointer disabled:opacity-50 ${className}`}
      >
        <span className="truncate">{selectedLabel}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`flex-shrink-0 text-surface-400 dark:text-surface-500 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={style}
          className="z-[9999] overflow-y-auto bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-700 rounded-lg shadow-xl py-1 animate-fade-in"
        >
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => handleSelect(o.value)}
              className={`w-full text-left px-3.5 py-2 text-sm transition-colors
                ${o.value === value
                  ? 'bg-brand-50 dark:bg-brand-600/15 text-brand-600 dark:text-brand-400'
                  : 'text-surface-800 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-800'}`}
            >
              {o.label}
            </button>
          ))}
        </div>,
        document.body,
      )}

      {hint && <p className="text-xs text-surface-400 dark:text-surface-600">{hint}</p>}
    </div>
  );
}

Select.displayName = 'Select';
