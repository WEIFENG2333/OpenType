interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-5 flex-shrink-0">
      <div>
        <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">{title}</h1>
        {subtitle && <p className="text-[13px] text-surface-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
