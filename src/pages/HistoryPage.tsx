import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useConfigStore } from '../stores/configStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui';
import { HistoryItem } from '../types/config';
import { useTranslation } from '../i18n';

// ─── Audio helpers ───────────────────────────────────────────────────────────

/** Convert a local media file path to a media:// URL for direct streaming. */
function mediaUrl(filePath: string): string {
  return `media://${encodeURI(filePath)}`;
}

/** Parse WAV header to get duration in seconds. WAV files always have a known size. */
async function getWavDuration(url: string): Promise<number> {
  try {
    const resp = await fetch(url, { headers: { Range: 'bytes=0-43' } });
    const buf = await resp.arrayBuffer();
    const view = new DataView(buf);
    // WAV header: bytes 24-27 = sampleRate (uint32 LE), bytes 34-35 = bitsPerSample (uint16 LE)
    // bytes 40-43 = data chunk size (uint32 LE), bytes 22-23 = numChannels (uint16 LE)
    const sampleRate = view.getUint32(24, true);
    const bitsPerSample = view.getUint16(34, true);
    const numChannels = view.getUint16(22, true);
    const dataSize = view.getUint32(40, true);
    if (sampleRate && bitsPerSample && numChannels) {
      return dataSize / (sampleRate * numChannels * (bitsPerSample / 8));
    }
  } catch { /* fall through */ }
  return 0;
}

/** Compact inline audio player for detail modal. Stops on unmount. */
function AudioPlayerBar({ audioPath }: { audioPath: string }) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const src = mediaUrl(audioPath);
    const a = new Audio(src);
    audioRef.current = a;

    // WAV over streaming protocol often yields Infinity duration.
    // Parse WAV header ourselves for reliable duration.
    getWavDuration(src).then((d) => { if (!cancelled && d > 0) setDuration(d); });

    // Also listen for browser-provided duration as fallback
    const onDurationChange = () => {
      if (!cancelled && isFinite(a.duration) && a.duration > 0) setDuration(a.duration);
    };
    const onTimeUpdate = () => { if (!cancelled) setCurrent(a.currentTime); };
    const onEnded = () => { if (!cancelled) { setPlaying(false); setCurrent(0); } };

    a.addEventListener('durationchange', onDurationChange);
    a.addEventListener('loadedmetadata', onDurationChange);
    a.addEventListener('timeupdate', onTimeUpdate);
    a.addEventListener('ended', onEnded);

    return () => {
      cancelled = true;
      a.pause();
      a.removeEventListener('durationchange', onDurationChange);
      a.removeEventListener('loadedmetadata', onDurationChange);
      a.removeEventListener('timeupdate', onTimeUpdate);
      a.removeEventListener('ended', onEnded);
      a.src = '';
    };
  }, [audioPath]);

  const toggle = useCallback(() => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  }, [playing]);

  const seek = useCallback((e: React.MouseEvent) => {
    if (!audioRef.current || !barRef.current || !duration || !isFinite(duration)) return;
    const rect = barRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = pct * duration;
    audioRef.current.currentTime = t;
    setCurrent(t);
  }, [duration]);

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const safeDuration = isFinite(duration) && duration > 0 ? duration : 0;
  const pct = safeDuration > 0 ? (current / safeDuration) * 100 : 0;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggle}
        className="w-6 h-6 flex items-center justify-center rounded-md text-surface-500 hover:text-brand-500 transition-colors flex-shrink-0"
      >
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
        )}
      </button>
      <span className="text-[10px] font-mono tabular-nums text-surface-400 w-8 flex-shrink-0">
        {fmt(current)}
      </span>
      <div
        ref={barRef}
        onClick={seek}
        className="flex-1 h-1 rounded-full bg-surface-200 dark:bg-surface-700 cursor-pointer relative group"
      >
        <div
          className="absolute inset-y-0 left-0 bg-brand-500 rounded-full transition-[width] duration-75"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono tabular-nums text-surface-400 w-8 flex-shrink-0 text-right">
        {safeDuration > 0 ? fmt(safeDuration) : '--:--'}
      </span>
    </div>
  );
}

function ScreenshotThumbnail({ path: imgPath }: { path: string }) {
  return <img src={mediaUrl(imgPath)} alt="Screenshot" className="w-full max-h-40 object-contain rounded border border-surface-200 dark:border-surface-800 mb-1.5" />;
}

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

  /** Fetch audio ArrayBuffer via media:// protocol */
  const fetchAudioBuffer = async (audioPath: string): Promise<ArrayBuffer | null> => {
    try {
      const resp = await fetch(mediaUrl(audioPath));
      if (!resp.ok) return null;
      return resp.arrayBuffer();
    } catch { return null; }
  };

  const handleRetry = async (item: HistoryItem) => {
    if (!item.audioPath || !window.electronAPI) return;
    const buf = await fetchAudioBuffer(item.audioPath);
    if (!buf) return;
    try {
      const result = await window.electronAPI.processPipeline(buf);
      if (result?.success && result.processedText) {
        await handleCopy(result.processedText, item.id);
      }
    } catch {}
  };

  const handleDownloadAudio = async (item: HistoryItem) => {
    if (!item.audioPath) return;
    const buf = await fetchAudioBuffer(item.audioPath);
    if (!buf) return;
    const blob = new Blob([buf], { type: 'audio/wav' });
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Detail modal overlay */}
      {selectedItem && (
        <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} t={t} onDownloadAudio={handleDownloadAudio} />
      )}

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
              <div className="px-6 py-2.5 text-[11px] font-bold text-surface-600 dark:text-surface-300 uppercase tracking-wider sticky top-0 z-10 bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700">
                {dateLabel}
              </div>

              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="group flex gap-4 px-6 py-3.5 hover:bg-white dark:hover:bg-surface-850/50 transition-colors cursor-pointer border-b border-surface-200/80 dark:border-surface-700/50"
                >
                  <span className="text-[11px] text-surface-400 dark:text-surface-500 w-14 flex-shrink-0 self-center font-mono tabular-nums">
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
                    <div className="flex items-center gap-1.5 mt-1.5 text-[10px]">
                      {item.durationMs > 0 && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 font-mono tabular-nums">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-50"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          {(item.durationMs / 1000).toFixed(1)}s
                        </span>
                      )}
                      {item.sourceApp && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-50"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                          {item.sourceApp}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 flex-shrink-0">
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
                    {item.error && item.audioPath && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRetry(item); }}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-surface-400 hover:text-brand-500 hover:bg-brand-500/5 transition-colors"
                        title={t('history.retry')}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                      </button>
                    )}
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

function DetailModal({ item, onClose, t, onDownloadAudio }: { item: HistoryItem; onClose: () => void; t: (key: string) => string; onDownloadAudio: (item: HistoryItem) => void }) {
  const ctx = item.context;
  const isError = !!item.error;
  const [expandedPrompt, setExpandedPrompt] = useState(false);
  const [expandedField, setExpandedField] = useState(false);

  const hasAnyContext = ctx && (ctx.appName || ctx.selectedText || ctx.fieldText || ctx.screenContext || ctx.url || ctx.clipboardText || ctx.recentTranscriptions?.length);
  const contextStatus = ctx ? (hasAnyContext ? 'success' : 'partial') : 'skipped';

  const formatDuration = (ms?: number) => {
    if (!ms) return null;
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[85vh] mx-4 bg-surface-50 dark:bg-surface-900 rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-200 dark:border-surface-800/40 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-surface-800 dark:text-surface-200">{t('history.detailTitle')}</h2>
              {isError && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">
                  {t('history.error')}
                </span>
              )}
            </div>
            <p className="text-[11px] text-surface-400">
              {new Date(item.timestamp).toLocaleString()}
              {item.sourceApp && ` · ${item.sourceApp}`}
              {item.windowTitle && ` · ${item.windowTitle}`}
            </p>
          </div>
          {/* Stats badges */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] px-2 py-1 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-500">
              {item.wordCount} {t('dashboard.wordsUnit')}
            </span>
            <span className="text-[10px] px-2 py-1 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-500">
              {(item.durationMs / 1000).toFixed(1)}s
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Audio Player — compact strip */}
        {item.audioPath && (
          <div className="flex items-center gap-1.5 px-5 py-2 border-b border-surface-200 dark:border-surface-800/40 flex-shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-surface-400 flex-shrink-0"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            <div className="flex-1 min-w-0"><AudioPlayerBar audioPath={item.audioPath} /></div>
            <button
              onClick={() => onDownloadAudio(item)}
              className="w-6 h-6 flex items-center justify-center rounded-md text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors flex-shrink-0"
              title={t('history.downloadAudio')}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-0">
          {/* ═══ Step 1: Context Capture ═══ */}
          <PipelineStep number={1} title={t('history.contextCapture')} status={contextStatus} isLast={false}>
            {ctx ? (
              <div className="space-y-3">
                <ContextSection title={t('history.activeWindow')} enabled={ctx.contextL0Enabled} hasData={!!ctx.appName} t={t}>
                  {ctx.appName && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-surface-700 dark:text-surface-300">
                        <span className="font-medium">{ctx.appName}</span>
                        {ctx.bundleId && <span className="text-[10px] text-surface-400 font-mono">({ctx.bundleId})</span>}
                      </div>
                      {ctx.windowTitle && <p className="text-[11px] text-surface-500 truncate">{ctx.windowTitle}</p>}
                      {ctx.url && <p className="text-[11px] text-brand-500 truncate">{ctx.url}</p>}
                    </div>
                  )}
                </ContextSection>

                <ContextSection title={t('history.focusedField')} enabled={ctx.contextL1Enabled} hasData={!!(ctx.selectedText || ctx.fieldText)} t={t}>
                  {/* Field metadata badges */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                    {(ctx.fieldRoleDescription || ctx.fieldRole) && (
                      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-500">{ctx.fieldRoleDescription || ctx.fieldRole}</span>
                    )}
                    {ctx.fieldLabel && (
                      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400">{ctx.fieldLabel}</span>
                    )}
                    {ctx.fieldPlaceholder && (
                      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-400 italic">&ldquo;{ctx.fieldPlaceholder}&rdquo;</span>
                    )}
                  </div>
                  {/* Cursor / selection position info */}
                  {ctx.cursorPosition !== undefined && (
                    <p className="text-[10px] text-surface-400 mb-1">
                      {t('history.cursorAt')} {ctx.cursorPosition}
                      {ctx.insertionLineNumber !== undefined && ` (${t('history.line')} ${ctx.insertionLineNumber})`}
                      {ctx.numberOfCharacters !== undefined && ` / ${ctx.numberOfCharacters} ${t('history.chars')}`}
                    </p>
                  )}
                  {ctx.selectionRange && ctx.selectionRange.length > 0 && (
                    <p className="text-[10px] text-surface-400 mb-1">
                      {t('history.selectedRange')}: {ctx.selectionRange.location}..{ctx.selectionRange.location + ctx.selectionRange.length} ({ctx.selectionRange.length} {t('history.chars')})
                    </p>
                  )}
                  {ctx.selectedText && (
                    <div className="mb-1.5">
                      <p className="text-[10px] font-medium text-surface-400 mb-0.5">{t('history.selectedText')}</p>
                      <p className="text-xs text-surface-700 dark:text-surface-300 bg-brand-500/5 border border-brand-500/10 rounded px-2 py-1.5 whitespace-pre-wrap break-words">{ctx.selectedText}</p>
                    </div>
                  )}
                  {ctx.fieldText && ctx.fieldText !== ctx.selectedText && (
                    <div>
                      <p className="text-[10px] font-medium text-surface-400 mb-0.5">{t('history.fieldContent')}</p>
                      <div className="text-xs text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded px-2 py-1.5 whitespace-pre-wrap break-words">
                        {ctx.fieldText.length > 300 && !expandedField
                          ? <>{ctx.fieldText.slice(0, 300)}... <button onClick={() => setExpandedField(true)} className="text-brand-500 hover:underline">{t('history.showMore')}</button></>
                          : ctx.fieldText}
                        {expandedField && ctx.fieldText.length > 300 && (
                          <button onClick={() => setExpandedField(false)} className="block text-brand-500 hover:underline mt-1">{t('history.showLess')}</button>
                        )}
                      </div>
                    </div>
                  )}
                </ContextSection>

                <ContextSection title={t('history.screenOcr')} enabled={ctx.contextOcrEnabled} hasData={!!ctx.screenContext} t={t}>
                  {ctx.screenshotPath && <ScreenshotThumbnail path={ctx.screenshotPath} />}
                  {ctx.screenContext && (
                    <p className="text-xs text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded px-2 py-1.5">{ctx.screenContext}</p>
                  )}
                  {ctx.ocrDurationMs && (
                    <p className="text-[10px] text-surface-400 mt-1">{t('history.ocrDuration')}: {ctx.ocrDurationMs < 1000 ? `${ctx.ocrDurationMs}ms` : `${(ctx.ocrDurationMs / 1000).toFixed(1)}s`}</p>
                  )}
                </ContextSection>

                <ContextSection title={t('history.clipboard')} enabled={true} hasData={!!ctx.clipboardText} t={t}>
                  {ctx.clipboardText && (
                    <p className="text-xs text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded px-2 py-1.5 whitespace-pre-wrap break-words line-clamp-4">{ctx.clipboardText}</p>
                  )}
                </ContextSection>

                <ContextSection title={t('history.recentTranscriptions')} enabled={true} hasData={!!ctx.recentTranscriptions?.length} t={t}>
                  {ctx.recentTranscriptions && ctx.recentTranscriptions.length > 0 && (
                    <div className="space-y-1">
                      {ctx.recentTranscriptions.map((text, i) => (
                        <p key={i} className="text-xs text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded px-2 py-1.5 truncate">{text}</p>
                      ))}
                    </div>
                  )}
                </ContextSection>
              </div>
            ) : (
              <p className="text-xs text-surface-400 italic">{t('history.contextNotSaved')}</p>
            )}
          </PipelineStep>

          {/* ═══ Step 2: STT ═══ */}
          <PipelineStep
            number={2}
            title={t('history.sttStage')}
            status={item.rawText ? 'success' : (isError ? 'error' : 'skipped')}
            isLast={false}
            meta={ctx?.sttProvider ? `${ctx.sttProvider} · ${ctx.sttModel || ''}` : undefined}
            duration={formatDuration(ctx?.sttDurationMs)}
          >
            {item.rawText ? (
              <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed whitespace-pre-wrap bg-surface-50 dark:bg-surface-900 rounded-lg p-3 border border-surface-200 dark:border-surface-800">{item.rawText}</p>
            ) : (
              <p className="text-xs text-surface-400 italic">{isError ? item.error : t('history.noOutput')}</p>
            )}
          </PipelineStep>

          {/* ═══ Step 3: LLM Post-processing ═══ */}
          <PipelineStep
            number={3}
            title={t('history.llmStage')}
            status={item.processedText ? 'success' : (isError && item.rawText ? 'error' : 'skipped')}
            isLast={true}
            meta={ctx?.llmProvider ? `${ctx.llmProvider} · ${ctx.llmModel || ''}` : undefined}
            duration={formatDuration(ctx?.llmDurationMs)}
          >
            {item.processedText ? (
              <p className="text-sm text-surface-800 dark:text-surface-200 leading-relaxed whitespace-pre-wrap bg-surface-50 dark:bg-surface-900 rounded-lg p-3 border border-surface-200 dark:border-surface-800">{item.processedText}</p>
            ) : isError ? (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                <p className="text-xs text-red-400">{item.error}</p>
              </div>
            ) : (
              <p className="text-xs text-surface-400 italic">{t('history.noOutput')}</p>
            )}

            {/* Auto-learned terms */}
            {ctx?.autoLearnedTerms && ctx.autoLearnedTerms.length > 0 && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-medium text-surface-400">{t('history.autoLearnedTerms')}:</span>
                {ctx.autoLearnedTerms.map((term, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">{term}</span>
                ))}
              </div>
            )}

            {/* System prompt (collapsible) */}
            {ctx?.systemPrompt && (
              <div className="mt-3">
                <button
                  onClick={() => setExpandedPrompt(!expandedPrompt)}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${expandedPrompt ? 'rotate-90' : ''}`}>
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                  {t('history.systemPrompt')}
                </button>
                {expandedPrompt && (
                  <pre className="mt-1.5 text-[11px] text-surface-500 dark:text-surface-400 leading-relaxed whitespace-pre-wrap font-mono bg-surface-50 dark:bg-surface-900 rounded-lg p-3 border border-surface-200 dark:border-surface-800 max-h-64 overflow-y-auto">{ctx.systemPrompt}</pre>
                )}
              </div>
            )}
          </PipelineStep>
        </div>
      </div>
    </div>
  );
}

function PipelineStep({ number, title, status, isLast, meta, duration, children }: {
  number: number;
  title: string;
  status: 'success' | 'error' | 'partial' | 'skipped';
  isLast: boolean;
  meta?: string;
  duration?: string | null;
  children: React.ReactNode;
}) {
  const statusColors = {
    success: 'bg-green-500 border-green-500',
    error: 'bg-red-500 border-red-500',
    partial: 'bg-amber-500 border-amber-500',
    skipped: 'bg-surface-300 dark:bg-surface-700 border-surface-300 dark:border-surface-700',
  };

  return (
    <div className="flex gap-3">
      {/* Timeline */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold text-white ${statusColors[status]}`}>
          {status === 'success' ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
          ) : status === 'error' ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          ) : (
            <span>{number}</span>
          )}
        </div>
        {!isLast && (
          <div className="w-px flex-1 min-h-[16px] bg-surface-200 dark:bg-surface-800" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-5">
        <div className="flex items-baseline gap-2 mb-2">
          <h4 className="text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase tracking-wider">
            {title}
          </h4>
          {meta && (
            <span className="text-[10px] text-surface-400 font-mono">{meta}</span>
          )}
          {duration && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 font-mono">{duration}</span>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Renders a context data section with enable/disable status indicator */
function ContextSection({ title, enabled, hasData, t, children }: {
  title: string;
  enabled?: boolean;
  hasData: boolean;
  t: (key: string) => string;
  children: React.ReactNode;
}) {
  const isDisabled = enabled === false || enabled === undefined;

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${
      isDisabled
        ? 'border-surface-200/60 dark:border-surface-800/40 bg-surface-50/50 dark:bg-surface-900/30'
        : hasData
        ? 'border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-850'
        : 'border-amber-500/20 bg-amber-500/5'
    }`}>
      <div className="flex items-center gap-2 mb-1">
        {isDisabled ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-surface-300 dark:text-surface-600 flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        ) : hasData ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-500 flex-shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400 flex-shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/></svg>
        )}
        <span className={`text-[11px] font-medium ${isDisabled ? 'text-surface-400' : 'text-surface-600 dark:text-surface-400'}`}>
          {title}
        </span>
        {isDisabled && (
          <span className="text-[10px] text-surface-400 italic ml-auto">{t('history.disabled')}</span>
        )}
        {!isDisabled && !hasData && (
          <span className="text-[10px] text-amber-400 italic ml-auto">{t('history.noDataCaptured')}</span>
        )}
      </div>
      {!isDisabled && hasData && <div className="mt-1">{children}</div>}
    </div>
  );
}
