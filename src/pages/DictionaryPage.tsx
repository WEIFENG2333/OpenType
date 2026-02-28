import { useState, useMemo } from 'react';
import { useConfigStore } from '../stores/configStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui';
import { useTranslation } from '../i18n';
import type { DictionaryEntry } from '../types/config';

type FilterTab = 'all' | 'manual' | 'auto';

export function DictionaryPage() {
  const dict = useConfigStore((s) => s.config.personalDictionary);
  const addWord = useConfigStore((s) => s.addDictionaryWord);
  const removeWord = useConfigStore((s) => s.removeDictionaryWord);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');
  const { t } = useTranslation();

  const manualCount = dict.filter((e) => e.source === 'manual').length;
  const autoCount = dict.filter((e) => e.source === 'auto').length;

  const filtered = useMemo(() => {
    let items = dict;
    if (filter === 'manual') items = items.filter((e) => e.source === 'manual');
    if (filter === 'auto') items = items.filter((e) => e.source === 'auto');
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((e) => e.word.toLowerCase().includes(q));
    }
    return items;
  }, [dict, search, filter]);

  const handleAdd = () => {
    if (!input.trim()) return;
    input.split(',').forEach((w) => {
      const trimmed = w.trim();
      if (trimmed) addWord(trimmed, 'manual');
    });
    setInput('');
    setShowAdd(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title={t('dictionary.title')}
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowAdd(!showAdd)}>
            {t('dictionary.newWord')}
          </Button>
        }
      />

      <div className="px-6 pt-2 pb-3 space-y-3">
        {/* Add form */}
        {showAdd && (
          <div className="flex gap-2 animate-fade-in">
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') setShowAdd(false);
              }}
              placeholder={t('dictionary.addPlaceholder')}
              className="flex-1 bg-white dark:bg-surface-850 border border-surface-300 dark:border-surface-700 rounded-lg px-3.5 py-2 text-sm text-surface-800 dark:text-surface-200 placeholder-surface-400 dark:placeholder-surface-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
            />
            <Button variant="primary" onClick={handleAdd} disabled={!input.trim()}>{t('dictionary.add')}</Button>
          </div>
        )}

        {/* Filter chips */}
        <div className="flex items-center gap-1">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label={t('dictionary.filterAll')} count={dict.length} />
          <FilterChip active={filter === 'manual'} onClick={() => setFilter('manual')} label={t('dictionary.filterManual')} count={manualCount} />
          <FilterChip active={filter === 'auto'} onClick={() => setFilter('auto')} label={t('dictionary.filterAuto')} count={autoCount} />
        </div>

        {/* Search */}
        {dict.length > 3 && (
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('dictionary.search')}
              className="w-full bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-surface-800 dark:text-surface-200 placeholder-surface-400 dark:placeholder-surface-600 focus:outline-none focus:border-brand-500"
            />
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-surface-400 dark:text-surface-600">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 opacity-40">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
            </svg>
            <p className="text-base">{search ? t('history.noMatches') : t('dictionary.noTerms')}</p>
            <p className="text-sm mt-1 text-surface-500 dark:text-surface-700">{!search && t('dictionary.noTermsHint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {filtered.map((entry) => (
              <div
                key={entry.word}
                className="group flex items-center gap-2 bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-800 rounded-lg px-3 py-2.5 hover:border-surface-300 dark:hover:border-surface-700 transition-colors"
              >
                {/* Source icon */}
                {entry.source === 'auto' ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 flex-shrink-0">
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-surface-400 flex-shrink-0">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                  </svg>
                )}
                <span className="flex-1 text-sm text-surface-700 dark:text-surface-300 truncate">{entry.word}</span>
                <button
                  onClick={() => removeWord(entry.word)}
                  className="text-surface-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Filter chip ── */
function FilterChip({ active, onClick, label, count }: {
  active: boolean; onClick: () => void; label: string; count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5
        ${active
          ? 'bg-brand-500/10 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300'
          : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800/60'
        }`}
    >
      {label}
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full min-w-[20px] text-center
        ${active
          ? 'bg-brand-500/15 text-brand-500 dark:text-brand-300'
          : 'bg-surface-200 dark:bg-surface-800 text-surface-400'
        }`}>
        {count}
      </span>
    </button>
  );
}
