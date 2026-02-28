import { useState } from 'react';
import { useRecorder } from '../hooks/useRecorder';
import { ResultPanel } from '../components/recording/ResultPanel';
import { useConfigStore } from '../stores/configStore';
import { useTranslation } from '../i18n';
import type { HistoryItem } from '../types/config';

export function DictationPage() {
  const recorder = useRecorder();
  const config = useConfigStore((s) => s.config);
  const { t } = useTranslation();
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

  // Hotkey
  const hotkey = (config.globalHotkey || 'CommandOrControl+Shift+Space')
    .replace('CommandOrControl', 'Ctrl')
    .replace(/\+/g, ' + ');

  // Format duration
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // Stats
  const totalSeconds = config.totalTimeSavedSeconds || 0;
  const totalMin = Math.round(totalSeconds / 60);
  const totalWords = config.totalWordsThisWeek || 0;
  const historyCount = (config.history || []).length;

  // Recent items
  const recentItems: HistoryItem[] = (config.history || []).slice(0, 5);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-6 space-y-5 max-w-[720px]">

          {/* ── Recording Hero ── */}
          <div className="flex items-center gap-5">
            {/* Mic button */}
            <div className="relative flex items-center justify-center flex-shrink-0">
              {recorder.status === 'recording' && (
                <div className="absolute w-[64px] h-[64px] rounded-full bg-red-500/12 animate-pulse" />
              )}
              {recorder.status === 'processing' && (
                <div className="absolute w-[64px] h-[64px] rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin" />
              )}
              <button
                onClick={recorder.toggleRecording}
                disabled={recorder.status === 'processing'}
                className={`relative z-10 w-[52px] h-[52px] rounded-full flex items-center justify-center transition-all duration-200 shadow-md
                  ${recorder.status === 'recording'
                    ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                    : recorder.status === 'processing'
                    ? 'bg-surface-200 dark:bg-surface-700 cursor-wait'
                    : 'bg-brand-500 hover:bg-brand-600 shadow-brand-500/20 hover:scale-105 active:scale-95'
                  }`}
              >
                {recorder.status === 'recording' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                ) : recorder.status === 'processing' ? (
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-surface-500 dark:bg-white animate-bounce" style={{ animationDelay: '0s' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-surface-500 dark:bg-white animate-bounce" style={{ animationDelay: '0.15s' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-surface-500 dark:bg-white animate-bounce" style={{ animationDelay: '0.3s' }} />
                  </div>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="22"/>
                  </svg>
                )}
              </button>
            </div>

            {/* Status + info */}
            <div className="flex-1 min-w-0">
              {recorder.status === 'recording' ? (
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-red-500 dark:text-red-400 text-[15px] font-semibold">{t('dashboard.recording')}</span>
                    <span className="text-xl font-mono text-surface-700 dark:text-surface-300 tracking-wider ml-1">{fmt(recorder.duration)}</span>
                  </div>
                  {/* Waveform */}
                  <div className="flex items-end gap-[2px] h-4 mt-2">
                    {Array.from({ length: 32 }).map((_, i) => {
                      const barH = Math.max(2, (Math.sin(Date.now() / 200 + i * 0.5) * 0.5 + 0.5) * recorder.audioLevel * 16);
                      return (
                        <div key={i} className="w-[2px] rounded-full bg-red-400/60 transition-all duration-75" style={{ height: `${barH}px` }} />
                      );
                    })}
                  </div>
                </div>
              ) : recorder.status === 'processing' ? (
                <div>
                  <span className="text-brand-500 dark:text-brand-400 text-[15px] font-semibold">{t('dashboard.processing')}</span>
                  <p className="text-[12px] text-surface-400 mt-0.5">{t('dashboard.transcribing')}</p>
                </div>
              ) : (
                <div>
                  <h1 className="text-[18px] font-bold text-surface-900 dark:text-surface-100 tracking-tight">
                    {t('dictation.title')}
                  </h1>
                  <p className="text-[13px] text-surface-400 dark:text-surface-500 mt-0.5">
                    {t('dictation.clickOrPress')}{' '}
                    <kbd className="inline-block px-1.5 py-0.5 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded text-[11px] text-surface-500 dark:text-surface-400 font-mono">
                      {hotkey}
                    </kbd>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Result Panel ── */}
          <ResultPanel
            rawText={recorder.rawText}
            processedText={recorder.processedText}
            error={recorder.error}
          />

          {/* ── Quick Stats ── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-800 rounded-xl px-4 py-3">
              <div className="text-[20px] font-bold text-surface-800 dark:text-surface-200">{historyCount}</div>
              <div className="text-[11px] text-surface-400 mt-0.5">{t('dictation.statTranscriptions')}</div>
            </div>
            <div className="bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-800 rounded-xl px-4 py-3">
              <div className="text-[20px] font-bold text-surface-800 dark:text-surface-200">
                {totalWords >= 1000 ? `${(totalWords / 1000).toFixed(1)}K` : totalWords}
              </div>
              <div className="text-[11px] text-surface-400 mt-0.5">{t('dictation.statWords')}</div>
            </div>
            <div className="bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-800 rounded-xl px-4 py-3">
              <div className="text-[20px] font-bold text-surface-800 dark:text-surface-200">
                {totalMin > 60 ? `${Math.floor(totalMin / 60)}h${totalMin % 60}m` : `${totalMin}m`}
              </div>
              <div className="text-[11px] text-surface-400 mt-0.5">{t('dictation.statTimeSaved')}</div>
            </div>
          </div>

          {/* ── Recent Transcriptions ── */}
          {recentItems.length > 0 && (
            <div>
              <h2 className="text-[14px] font-semibold text-surface-700 dark:text-surface-300 mb-2">{t('dictation.recent')}</h2>
              <div className="border border-surface-200 dark:border-surface-800 rounded-xl overflow-hidden">
                {recentItems.map((item, idx) => {
                  const text = item.processedText || item.rawText || item.error || '';
                  const ago = formatTimeAgo(item.timestamp, t);
                  const dur = item.durationMs ? formatDuration(item.durationMs) : '';

                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-50 dark:hover:bg-surface-850
                        ${idx !== recentItems.length - 1 ? 'border-b border-surface-100 dark:border-surface-800/50' : ''}`}
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-surface-400">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                          <line x1="12" y1="19" x2="12" y2="22"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] truncate ${item.error ? 'text-red-500' : 'text-surface-700 dark:text-surface-300'}`}>
                          {text}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-surface-400">
                          {item.sourceApp && <span>{item.sourceApp}</span>}
                          {item.sourceApp && <span>·</span>}
                          <span>{ago}</span>
                        </div>
                      </div>
                      {dur && <span className="flex-shrink-0 text-[12px] text-surface-400 font-mono">{dur}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail modal ── */}
      {selectedItem && (
        <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}

/* ── Detail modal ── */
function DetailModal({ item, onClose }: { item: HistoryItem; onClose: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      if (window.electronAPI) await window.electronAPI.writeClipboard(text);
      else await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const text = item.processedText || item.rawText || '';
  const ago = formatTimeAgo(item.timestamp, t);
  const dur = item.durationMs ? formatDuration(item.durationMs) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-surface-900 rounded-2xl shadow-2xl w-[440px] max-h-[70vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100 dark:border-surface-800">
          <div>
            <div className="text-sm font-medium text-surface-800 dark:text-surface-200">
              {item.sourceApp || t('history.detailTitle')}
            </div>
            <div className="text-[11px] text-surface-400">{ago}{dur ? ` · ${dur}` : ''}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 flex items-center justify-center text-surface-400 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {item.processedText && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-surface-400 mb-2">{t('history.finalOutput')}</div>
              <p className="text-[14px] text-surface-800 dark:text-surface-200 leading-relaxed whitespace-pre-wrap">{item.processedText}</p>
            </div>
          )}
          {item.rawText && item.processedText && item.rawText !== item.processedText && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-surface-400 mb-2">{t('history.rawTranscription')}</div>
              <p className="text-[13px] text-surface-500 leading-relaxed whitespace-pre-wrap">{item.rawText}</p>
            </div>
          )}
          {item.error && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-red-400 mb-2">{t('history.error')}</div>
              <p className="text-[13px] text-red-500">{item.error}</p>
            </div>
          )}
        </div>

        {text && (
          <div className="px-6 py-3 border-t border-surface-100 dark:border-surface-800 flex justify-end">
            <button
              onClick={() => handleCopy(text)}
              className="px-4 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 text-[13px] text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
            >
              {copied ? t('recording.copied') : t('recording.copy')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Helpers ── */
function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTimeAgo(ts: number, t: (key: string, params?: Record<string, any>) => string): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('history.justNow');
  if (mins < 60) return t('history.mAgo', { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('history.hAgo', { n: hrs });
  const days = Math.floor(hrs / 24);
  if (days === 1) return t('history.yesterday');
  return `${days}d`;
}
