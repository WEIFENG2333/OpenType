type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'brand';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const styles: Record<BadgeVariant, string> = {
  default: 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 border-surface-300 dark:border-surface-700',
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  error: 'bg-red-500/10 text-red-400 border-red-500/20',
  brand: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
};

export function Badge({ variant = 'default', children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border ${styles[variant]}`}>
      {children}
    </span>
  );
}
