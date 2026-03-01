interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  badge?: React.ReactNode;
}

export function Toggle({ checked, onChange, label, description, disabled, badge }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="flex items-center justify-between gap-6 w-full text-left group disabled:opacity-50 py-0.5"
    >
      {(label || description) && (
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {label && <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{label}</p>}
            {badge}
          </div>
          {description && <p className="text-xs text-surface-500 mt-0.5 leading-relaxed">{description}</p>}
        </div>
      )}
      <div
        className={`relative w-10 h-[22px] rounded-full flex-shrink-0 transition-colors
          ${checked ? 'bg-brand-600' : 'bg-surface-300 dark:bg-surface-700'}
          ${!disabled ? 'group-hover:brightness-110' : ''}`}
      >
        <div
          className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform
            ${checked ? 'translate-x-[22px]' : 'translate-x-[3px]'}`}
        />
      </div>
    </button>
  );
}
