import { useState } from 'react';

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const isElectron = !!window.electronAPI;

  // In web mode, render a simple header instead
  if (!isElectron) {
    return (
      <div className="flex items-center h-12 bg-surface-950 border-b border-surface-800/60 px-4">
        <Logo />
        <span className="text-sm font-semibold text-surface-300 ml-2">OpenType</span>
      </div>
    );
  }

  return (
    <div className="drag-region flex items-center h-10 bg-surface-950 border-b border-surface-800/60 select-none">
      <div className="flex items-center gap-2 px-4 flex-1">
        <Logo />
        <span className="text-xs font-semibold text-surface-500 tracking-wide uppercase">OpenType</span>
      </div>

      <div className="no-drag flex">
        <WinBtn onClick={() => window.electronAPI?.minimize()}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </WinBtn>
        <WinBtn onClick={() => { window.electronAPI?.maximize(); setMaximized(!maximized); }}>
          {maximized
            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="9" width="10" height="10" rx="1"/><path d="M9 9V6a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3"/></svg>
            : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
          }
        </WinBtn>
        <WinBtn onClick={() => window.electronAPI?.close()} hoverClass="hover:bg-red-600 hover:text-white">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
        </WinBtn>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="w-5 h-5 rounded-md bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center flex-shrink-0">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="22"/>
      </svg>
    </div>
  );
}

function WinBtn({ children, onClick, hoverClass }: {
  children: React.ReactNode;
  onClick: () => void;
  hoverClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-10 h-10 flex items-center justify-center text-surface-500 transition-colors
        ${hoverClass ?? 'hover:bg-surface-800 hover:text-surface-300'}`}
    >
      {children}
    </button>
  );
}
