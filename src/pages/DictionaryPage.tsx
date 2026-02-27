import { useState, useMemo } from 'react';
import { useConfigStore } from '../stores/configStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui';
import { useTranslation } from '../i18n';

export function DictionaryPage() {
  const dict = useConfigStore((s) => s.config.personalDictionary);
  const addWord = useConfigStore((s) => s.addDictionaryWord);
  const removeWord = useConfigStore((s) => s.removeDictionaryWord);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const { t } = useTranslation();

  const filtered = useMemo(() => {
    if (!search.trim()) return dict;
    const q = search.toLowerCase();
    return dict.filter((w) => w.toLowerCase().includes(q));
  }, [dict, search]);

  const handleAdd = () => {
    if (!input.trim()) return;
    input.split(',').forEach((w) => {
      const trimmed = w.trim();
      if (trimmed) addWord(trimmed);
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

      {/* Search + Add inline */}
      <div className="px-6 pt-2 pb-3 space-y-3">
        {/* Add form (toggle) */}
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
            {filtered.map((word) => (
              <div
                key={word}
                className="group flex items-center gap-2 bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-800 rounded-lg px-3 py-2.5 hover:border-surface-300 dark:hover:border-surface-700 transition-colors"
              >
                <span className="text-surface-400 text-[11px] flex-shrink-0">✏️</span>
                <span className="flex-1 text-sm text-surface-700 dark:text-surface-300 truncate">{word}</span>
                <button
                  onClick={() => removeWord(word)}
                  className="text-surface-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Info box */}
        {dict.length > 0 && (
          <div className="mt-6 bg-brand-500/5 border border-brand-500/10 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-400 flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              <div>
                <p className="text-[13px] text-brand-300 font-medium">{t('dictionary.howItWorks')}</p>
                <p className="text-[13px] text-surface-600 dark:text-surface-400 mt-1 leading-relaxed">
                  {t('dictionary.howItWorksDesc')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
