interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  formatValue?: (v: number) => string;
}

export function Slider({
  value, onChange, min = 0, max = 100, step = 1,
  label, showValue = true, formatValue,
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && <span className="text-sm font-medium text-surface-600 dark:text-surface-400">{label}</span>}
          {showValue && (
            <span className="text-xs text-surface-500 font-mono">
              {formatValue ? formatValue(value) : value}
            </span>
          )}
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${pct}%, var(--slider-track) ${pct}%, var(--slider-track) 100%)`,
        }}
      />
    </div>
  );
}
