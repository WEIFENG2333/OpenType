import { useTranslation } from '../../i18n';

export type PageID = 'dashboard' | 'history' | 'dictionary' | 'feedback';

interface SidebarProps {
  current: PageID;
  onNavigate: (page: PageID) => void;
  onOpenSettings: () => void;
}

const navItems: Array<{ id: PageID; i18nKey: string; icon: JSX.Element }> = [
  {
    id: 'dashboard',
    i18nKey: 'sidebar.dictation',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>,
  },
  {
    id: 'history',
    i18nKey: 'sidebar.history',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  },
  {
    id: 'dictionary',
    i18nKey: 'sidebar.dictionary',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>,
  },
  {
    id: 'feedback',
    i18nKey: 'sidebar.feedback',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  },
];

export function Sidebar({ current, onNavigate, onOpenSettings }: SidebarProps) {
  const { t } = useTranslation();

  return (
    <div className="w-[200px] bg-surface-50 dark:bg-surface-950 border-r border-surface-200 dark:border-surface-800/60 flex flex-col">
      {/* Brand */}
      <div className="px-5 pt-5 pb-4">
        <span className="text-[17px] font-bold text-surface-900 dark:text-surface-100 tracking-tight">
          OpenType
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => {
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-150
                ${active
                  ? 'bg-surface-200/80 dark:bg-surface-800 text-surface-900 dark:text-surface-100 font-semibold'
                  : 'text-surface-500 hover:text-surface-800 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-850'
                }`}
            >
              {item.icon}
              <span>{t(item.i18nKey)}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom icons */}
      <div className="px-3 py-3 border-t border-surface-200 dark:border-surface-800/40 flex items-center gap-1">
        <button
          onClick={onOpenSettings}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800/60 transition-colors"
          title={t('sidebar.settings')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
        </button>
      </div>
    </div>
  );
}
