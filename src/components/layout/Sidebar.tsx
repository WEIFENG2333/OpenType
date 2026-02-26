import { Badge } from '../ui';

export type PageID = 'dashboard' | 'history' | 'dictionary' | 'settings' | 'feedback';

interface SidebarProps {
  current: PageID;
  onNavigate: (page: PageID) => void;
  weeklyWords?: number;
}

const navItems: Array<{ id: PageID; label: string; icon: JSX.Element }> = [
  {
    id: 'dashboard',
    label: 'Dictation',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>,
  },
  {
    id: 'history',
    label: 'History',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  },
  {
    id: 'dictionary',
    label: 'Dictionary',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  },
  {
    id: 'feedback',
    label: 'Feedback',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  },
];

export function Sidebar({ current, onNavigate, weeklyWords = 0 }: SidebarProps) {
  return (
    <div className="w-[68px] bg-surface-950 border-r border-surface-800/60 flex flex-col items-center py-3 gap-1">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 relative group
            ${current === item.id
              ? 'bg-brand-600/15 text-brand-400'
              : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/60'}`}
          title={item.label}
        >
          {item.icon}

          {/* Active indicator */}
          {current === item.id && (
            <div className="absolute left-0 w-[3px] h-6 bg-brand-500 rounded-r-full" />
          )}

          {/* Tooltip */}
          <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-surface-800 border border-surface-700 text-surface-200 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
            {item.label}
          </div>
        </button>
      ))}

      {/* Bottom stats */}
      <div className="mt-auto flex flex-col items-center gap-2 mb-1">
        <div className="w-10 h-px bg-surface-800" />
        <div className="text-center">
          <p className="text-[10px] font-mono text-surface-600">{weeklyWords}</p>
          <p className="text-[9px] text-surface-700">words</p>
        </div>
      </div>
    </div>
  );
}
