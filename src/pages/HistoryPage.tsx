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
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const { t } = useTranslation();

  const history = config.history || [];
  const filtered = useMemo(() => {
    if (!search.trim()) return history;
    const q = search.toLowerCase();
    return history.filter(
      (h) => h.processedText?.toLowerCase().includes(q) || h.rawText?.toLowerCase().includes(q),
    );
  }, [history, search]);

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

  const handleRetry = async (item: HistoryItem) => {
    if (!item.audioBase64 || !window.electronAPI) return;
    // Decode base64 to ArrayBuffer
    const binary = atob(item.audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    try {
      const result = await window.electronAPI.processPipeline(bytes.buffer);
      if (result?.success && result.processedText) {
        await handleCopy(result.processedText, item.id);
      }
    } catch {}
  };

  const handleDownloadAudio = (item: HistoryItem) => {
    if (!item.audioBase64) return;
    const binary = atob(item.audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `opentype-${new Date(item.timestamp).toISOString().slice(0, 19).replace(/:/g, '-')}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Detail panel
  if (selectedItem) {
    return <DetailView item={selectedItem} onBack={() => setSelectedItem(null)} t={t} />;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title={t('history.title')}
        actions={
          <div className="flex items-center gap-2">
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
              <div className="px-6 py-2 text-[11px] font-semibold text-surface-400 dark:text-surface-600 uppercase tracking-wider sticky top-0 bg-surface-50/95 dark:bg-surface-900/95 backdrop-blur-sm border-b border-surface-100 dark:border-surface-800/30">
                {dateLabel}
              </div>

              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="group flex gap-4 px-6 py-3.5 hover:bg-white dark:hover:bg-surface-850/50 transition-colors cursor-pointer border-b border-surface-100 dark:border-surface-800/20"
                >
                  <span className="text-[11px] text-surface-400 dark:text-surface-600 w-14 flex-shrink-0 pt-0.5 font-mono tabular-nums">
                    {formatTime(item.timestamp)}
                  </span>

                  <div className="flex-1 min-w-0">
                    {item.error ? (
                      <p className="text-sm text-red-400 italic">{item.error}</p>
                    ) : (
                      <p className="text-sm text-surface-800 dark:text-surface-200 leading-relaxed line-clamp-2">
                        {item.processedText || item.rawText}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      {item.sourceApp && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-500">
                          {item.sourceApp}
                        </span>
                      )}
                      {item.context && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400">
                          {t('history.hasContext')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {item.audioBase64 && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRetry(item); }}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-surface-400 hover:text-brand-500 hover:bg-brand-500/5 transition-colors"
                          title={t('history.retry')}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownloadAudio(item); }}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                          title={t('history.downloadAudio')}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </button>
                      </>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopy(item.processedText || item.rawText, item.id); }}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                      title="Copy"
                    >
                      {copiedId === item.id ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id); }}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-surface-400 hover:text-red-500 hover:bg-red-500/5 transition-colors"
                      title="Delete"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DetailView({ item, onBack, t }: { item: HistoryItem; onBack: () => void; t: (key: string) => string }) {
  const ctx = item.context;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-surface-200 dark:border-surface-800/40 flex-shrink-0">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div>
          <h2 className="text-sm font-semibold text-surface-800 dark:text-surface-200">{t('history.detailTitle')}</h2>
          <p className="text-[11px] text-surface-400">
            {new Date(item.timestamp).toLocaleString()} {item.sourceApp && `· ${item.sourceApp}`}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Final output */}
        <Section title={t('history.finalOutput')} icon="output">
          <p className="text-sm text-surface-800 dark:text-surface-200 leading-relaxed whitespace-pre-wrap">
            {item.processedText || <span className="italic text-surface-400">{t('history.noOutput')}</span>}
          </p>
        </Section>

        {/* Raw transcription */}
        <Section title={t('history.rawTranscription')} icon="mic">
          <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed whitespace-pre-wrap">
            {item.rawText || <span className="italic text-surface-400">{t('history.noOutput')}</span>}
          </p>
        </Section>

        {/* Error if any */}
        {item.error && (
          <Section title={t('history.error')} icon="error">
            <p className="text-sm text-red-400">{item.error}</p>
          </Section>
        )}

        {/* Context pipeline */}
        {ctx && (
          <Section title={t('history.contextPipeline')} icon="context">
            <div className="space-y-3">
              <ContextRow
                label="L0 — Active Window"
                enabled={ctx.contextL0Enabled}
                value={ctx.appName ? `${ctx.appName}${ctx.windowTitle ? ` — ${ctx.windowTitle}` : ''}` : undefined}
              />
              <ContextRow
                label="L1 — Selected Text"
                enabled={ctx.contextL1Enabled}
                value={ctx.selectedText}
              />
              <ContextRow
                label="OCR — Screen Context"
                enabled={ctx.contextOcrEnabled}
                value={ctx.screenContext}
              />
              {ctx.screenshotDataUrl && (
                <div className="mt-2">
                  <p className="text-[11px] text-surface-500 mb-1">Screenshot</p>
                  <img src={ctx.screenshotDataUrl} alt="Screen capture" className="rounded-lg border border-surface-200 dark:border-surface-800 max-h-48 object-contain" />
                </div>
              )}
            </div>
          </Section>
        )}

        {/* System prompt sent to LLM */}
        {ctx?.systemPrompt && (
          <Section title={t('history.systemPrompt')} icon="prompt">
            <pre className="text-[11px] text-surface-500 dark:text-surface-400 leading-relaxed whitespace-pre-wrap font-mono bg-surface-50 dark:bg-surface-900 rounded-lg p-3 border border-surface-200 dark:border-surface-800 max-h-48 overflow-y-auto">
              {ctx.systemPrompt}
            </pre>
          </Section>
        )}

        {/* Audio */}
        {item.audioBase64 && (
          <Section title={t('history.audio')} icon="audio">
            <p className="text-xs text-surface-500">{t('history.audioAvailable')}</p>
          </Section>
        )}

        {/* Stats */}
        <div className="flex gap-4 text-[11px] text-surface-400 pt-2">
          <span>{item.wordCount} {t('dashboard.wordsUnit')}</span>
          <span>{(item.durationMs / 1000).toFixed(1)}s</span>
          {item.language && <span>{item.language}</span>}
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  const iconMap: Record<string, JSX.Element> = {
    output: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    mic: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>,
    error: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
    context: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
    prompt: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
    audio: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>,
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-surface-400">{iconMap[icon]}</span>
        <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="pl-6">{children}</div>
    </div>
  );
}

function ContextRow({ label, enabled, value }: { label: string; enabled?: boolean; value?: string }) {
  return (
    <div className="flex items-start gap-2">
      {enabled === false || enabled === undefined ? (
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-surface-300"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        </span>
      ) : value ? (
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
      ) : (
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-surface-500">{label}</p>
        {value && (
          <p className="text-xs text-surface-700 dark:text-surface-300 mt-0.5 break-words">{value}</p>
        )}
        {enabled && !value && (
          <p className="text-[11px] text-surface-400 italic mt-0.5">No data captured</p>
        )}
      </div>
    </div>
  );
}
