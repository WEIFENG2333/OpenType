interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="flex items-start gap-3 w-full text-left group disabled:opacity-50"
    >
      <div
        className={`relative w-10 h-[22px] rounded-full flex-shrink-0 transition-colors mt-0.5
          ${checked ? 'bg-brand-600' : 'bg-surface-300 dark:bg-surface-700'}
          ${!disabled ? 'group-hover:brightness-110' : ''}`}
      >
        <div
          className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform
            ${checked ? 'translate-x-[22px]' : 'translate-x-[3px]'}`}
        />
      </div>
      {(label || description) && (
        <div className="min-w-0">
          {label && <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{label}</p>}
          {description && <p className="text-xs text-surface-500 mt-0.5">{description}</p>}
        </div>
      )}
    </button>
  );
}
