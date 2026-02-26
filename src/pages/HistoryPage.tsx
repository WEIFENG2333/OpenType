import { useState, useMemo } from 'react';
import { useConfigStore } from '../stores/configStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Button, Badge } from '../components/ui';
import { HistoryItem } from '../types/config';

export function HistoryPage() {
  const config = useConfigStore((s) => s.config);
  const clearHistory = useConfigStore((s) => s.clearHistory);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const history = config.history || [];
  const filtered = useMemo(() => {
    if (!search.trim()) return history;
    const q = search.toLowerCase();
    return history.filter(
      (h) => h.processedText.toLowerCase().includes(q) || h.rawText.toLowerCase().includes(q),
    );
  }, [history, search]);

  const handleCopy = async (text: string, id: string) => {
    try {
      if (window.electronAPI) await window.electronAPI.writeClipboard(text);
      else await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title="History"
        subtitle={`${history.length} transcription${history.length !== 1 ? 's' : ''}`}
        actions={
          history.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={clearHistory}>Clear all</Button>
          ) : undefined
        }
      />

      {/* Search bar */}
      {history.length > 0 && (
        <div className="px-6 pt-4 pb-2">
          <div className="relative">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transcriptions..."
              className="w-full bg-surface-850 border border-surface-800 rounded-lg pl-10 pr-4 py-2 text-sm text-surface-200 placeholder-surface-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
            />
          </div>
        </div>
      )}

      {/* History list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-surface-600 px-6">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 opacity-40"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <p className="text-base">{search ? 'No matches found' : 'No history yet'}</p>
            <p className="text-sm mt-1 text-surface-700">{search ? 'Try a different search term' : 'Your transcriptions will appear here'}</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-800/40">
            {filtered.map((item) => (
              <HistoryRow
                key={item.id}
                item={item}
                expanded={expandedId === item.id}
                copied={copiedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                onCopy={(text) => handleCopy(text, item.id)}
                formatTime={formatTime}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryRow({ item, expanded, copied, onToggle, onCopy, formatTime }: {
  item: HistoryItem;
  expanded: boolean;
  copied: boolean;
  onToggle: () => void;
  onCopy: (text: string) => void;
  formatTime: (ts: number) => string;
}) {
  return (
    <div className="px-6 py-3.5 hover:bg-surface-850/50 transition-colors cursor-pointer" onClick={onToggle}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-surface-200 truncate">{item.processedText || item.rawText}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[11px] text-surface-600">{formatTime(item.timestamp)}</span>
            <span className="text-[11px] text-surface-700">{item.wordCount} words</span>
            {item.sourceApp && <Badge>{item.sourceApp}</Badge>}
          </div>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onCopy(item.processedText || item.rawText); }}
          className="text-surface-600 hover:text-surface-300 transition-colors flex-shrink-0 mt-0.5"
        >
          {copied ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          )}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 animate-fade-in">
          <div className="bg-surface-800/50 rounded-lg p-3">
            <p className="text-[11px] text-surface-500 font-medium mb-1">Polished</p>
            <p className="text-sm text-surface-200 leading-relaxed">{item.processedText}</p>
          </div>
          {item.rawText && item.rawText !== item.processedText && (
            <div className="bg-surface-800/30 rounded-lg p-3">
              <p className="text-[11px] text-surface-500 font-medium mb-1">Raw transcription</p>
              <p className="text-sm text-surface-400 leading-relaxed">{item.rawText}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
