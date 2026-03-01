interface SettingRowProps {
  label: string;
  description?: string;
  wide?: boolean;
  children: React.ReactNode;
}

/** Two-column settings row: label + description on left, control on right. */
export function SettingRow({ label, description, wide, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-6 py-0.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{label}</p>
        {description && <p className="text-xs text-surface-500 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className={`shrink-0 ${wide || !description ? 'w-60' : 'w-48'}`}>
        {children}
      </div>
    </div>
  );
}
