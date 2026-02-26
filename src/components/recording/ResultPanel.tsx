import { useState } from 'react';
import { Button } from '../ui';

interface ResultPanelProps {
  rawText: string;
  processedText: string;
  error: string | null;
}

export function ResultPanel({ rawText, processedText, error }: ResultPanelProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  if (error) {
    return (
      <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-4 animate-fade-in">
        <div className="flex items-center gap-2 text-red-400 mb-1.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <span className="text-sm font-medium">Error</span>
        </div>
        <p className="text-sm text-red-300/70 leading-relaxed">{error}</p>
      </div>
    );
  }

  if (!rawText && !processedText) return null;

  const handleCopy = async () => {
    const text = processedText || rawText;
    if (!text) return;
    try {
      if (window.electronAPI) await window.electronAPI.writeClipboard(text);
      else await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const reduction = rawText && processedText && rawText !== processedText
    ? Math.round((1 - processedText.length / rawText.length) * 100)
    : 0;

  return (
    <div className="bg-surface-850 border border-surface-800 rounded-xl overflow-hidden animate-slide-up">
      {/* Tabs + copy */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-surface-800/60">
        <div className="flex items-center gap-1">
          <TabButton active={!showRaw} onClick={() => setShowRaw(false)}>Polished</TabButton>
          <TabButton active={showRaw} onClick={() => setShowRaw(true)}>Raw</TabButton>
        </div>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          {copied ? (
            <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>Copied</>
          ) : (
            <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</>
          )}
        </Button>
      </div>

      {/* Text content */}
      <div className="p-4">
        <p className="text-surface-200 text-[15px] leading-relaxed whitespace-pre-wrap">
          {showRaw ? rawText : processedText}
        </p>
      </div>

      {/* Stats footer */}
      {reduction > 0 && (
        <div className="px-4 pb-3 flex items-center gap-2 text-[11px] text-surface-600">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
          Cleaned: {rawText.length - processedText.length} chars removed ({reduction}% reduction)
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors
        ${active ? 'bg-brand-600/15 text-brand-400' : 'text-surface-500 hover:text-surface-400 hover:bg-surface-800/60'}`}
    >
      {children}
    </button>
  );
}
