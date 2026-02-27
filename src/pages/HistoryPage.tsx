import { useState, useMemo } from 'react';
import { useConfigStore } from '../stores/configStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui';
import { HistoryItem } from '../types/config';
import { useTranslation } from '../i18n';

export function HistoryPage() {
  const config = useConfigStore((s) => s.config);
  const clearHistory = useConfigStore((s) => s.clearHistory);
  const deleteHistoryItem = useConfigStore((s) => s.deleteHistoryItem);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { t } = useTranslation();

  const history = config.history || [];
  const filtered = useMemo(() => {
    if (!search.trim()) return history;
    const q = search.toLowerCase();
    return history.filter(
      (h) => h.processedText.toLowerCase().includes(q) || h.rawText.toLowerCase().includes(q),
    );
  }, [history, search]);

  // Group by date
  const grouped = useMemo(() => {
    const groups = new Map<string, HistoryItem[]>();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;

    for (const item of filtered) {
      const itemDate = new Date(item.timestamp);
      const itemDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate()).getTime();

      let label: string;
      if (itemDay >= today) label = t('history.today');
      else if (itemDay >= yesterday) label = t('history.yesterday');
      else label = itemDate.toLocaleDateString();

      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(item);
    }
    return groups;
  }, [filtered, t]);

  const handleCopy = async (text: string, id: string) => {
    try {
      if (window.electronAPI) await window.electronAPI.writeClipboard(text);
      else await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title={t('history.title')}
        actions={
          <div className="flex items-center gap-2">
            {/* Search */}
            {history.length > 0 && (
              <div className="relative">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('history.searchPlaceholder')}
                  className="w-48 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-surface-800 dark:text-surface-200 placeholder-surface-400 dark:placeholder-surface-600 focus:outline-none focus:border-brand-500"
                />
              </div>
            )}
            {history.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearHistory}>{t('history.clearAll')}</Button>
            )}
          </div>
        }
      />

      {/* History list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-surface-400 dark:text-surface-600 px-6">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 opacity-40"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <p className="text-base">{search ? t('history.noMatches') : t('history.noHistory')}</p>
            <p className="text-sm mt-1 text-surface-500 dark:text-surface-700">{search ? t('history.tryDifferent') : t('history.willAppearHere')}</p>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              {/* Date group header */}
              <div className="px-6 py-2 text-[11px] font-semibold text-surface-400 dark:text-surface-600 uppercase tracking-wider sticky top-0 bg-surface-50/95 dark:bg-surface-900/95 backdrop-blur-sm border-b border-surface-100 dark:border-surface-800/30">
                {dateLabel}
              </div>

              {items.map((item) => (
                <HistoryRow
                  key={item.id}
                  item={item}
                  copied={copiedId === item.id}
                  onCopy={() => handleCopy(item.processedText || item.rawText, item.id)}
                  onDelete={() => deleteHistoryItem(item.id)}
                  formatTime={formatTime}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function HistoryRow({ item, copied, onCopy, onDelete, formatTime }: {
  item: HistoryItem;
  copied: boolean;
  onCopy: () => void;
  onDelete: () => void;
  formatTime: (ts: number) => string;
}) {
  return (
    <div className="group flex gap-4 px-6 py-3 hover:bg-white dark:hover:bg-surface-850/50 transition-colors">
      {/* Time column */}
      <span className="text-[11px] text-surface-400 dark:text-surface-600 w-14 flex-shrink-0 pt-0.5 font-mono tabular-nums">
        {formatTime(item.timestamp)}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-800 dark:text-surface-200 leading-relaxed">
          {item.processedText || item.rawText}
        </p>
        {item.sourceApp && (
          <span className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-500">
            {item.sourceApp}
          </span>
        )}
      </div>

      {/* Hover actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {/* Copy */}
        <button
          onClick={(e) => { e.stopPropagation(); onCopy(); }}
          className="w-7 h-7 flex items-center justify-center rounded-md text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          title="Copy"
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          )}
        </button>

        {/* Delete */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="w-7 h-7 flex items-center justify-center rounded-md text-surface-400 hover:text-red-500 hover:bg-red-500/5 transition-colors"
          title="Delete"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  );
}
