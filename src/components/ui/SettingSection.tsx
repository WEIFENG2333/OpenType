import React from 'react';

export function SettingSection({ icon, title, children }: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-brand-500 shrink-0">{icon}</span>
        <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
