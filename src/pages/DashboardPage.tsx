import { useEffect, useState } from 'react';
import { useConfigStore } from '../stores/configStore';
import { useTranslation } from '../i18n';
import type { HistoryItem } from '../types/config';

const GITHUB_URL = 'https://github.com/WEIFENG2333/OpenType';

export function DashboardPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const config = useConfigStore((s) => s.config);
  const { t } = useTranslation();
  const [version, setVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'latest'>('idle');
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

  useEffect(() => {
    window.electronAPI?.getVersion?.().then(setVersion);
  }, []);

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking');
    try {
      await window.electronAPI?.checkForUpdates?.();
      setUpdateStatus('latest');
    } catch {
      setUpdateStatus('latest');
    }
    setTimeout(() => setUpdateStatus('idle'), 3000);
  };

  // Stats
  const totalSeconds = config.totalTimeSavedSeconds || 0;
  const totalHr = Math.floor(totalSeconds / 3600);
  const totalMin = Math.round((totalSeconds % 3600) / 60);
  const totalWords = config.totalWordsThisWeek || 0;
  const savedMinutes = Math.round(totalSeconds / 60);
  const avgWPM = config.averageWPM || 0;
  const hasStats = totalWords > 0 || savedMinutes > 0 || avgWPM > 0;

  // Recent transcriptions (last 3)
  const recentItems: HistoryItem[] = (config.history || []).slice(0, 3);

  // Hotkey display
  const hotkey = (config.globalHotkey || 'CommandOrControl+Shift+Space')
    .replace('CommandOrControl', 'Ctrl')
    .replace('+', ' + ');

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-8 space-y-6 max-w-[800px]">

          {/* ── Hero ── */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-bold text-surface-900 dark:text-surface-100 tracking-tight leading-tight">
                {t('dashboard.heroTitle')}
              </h1>
              <p className="mt-3 text-[14px] text-surface-500 dark:text-surface-400 leading-relaxed">
                {t('dashboard.heroSubtitle', { hotkey: '' })}
                <kbd className="inline-block mx-1 px-2 py-0.5 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-md text-[12px] text-surface-600 dark:text-surface-300 font-mono shadow-sm">
                  {hotkey}
                </kbd>
              </p>
            </div>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 px-4 py-2 border border-surface-200 dark:border-surface-700 rounded-xl text-[13px] text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-850 transition-colors whitespace-nowrap"
            >
              {t('dashboard.hotCases')} ↗
            </a>
          </div>

          {/* ── Stats ── */}
          {hasStats && (
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
                label={t('dashboard.totalTime')}
                value={totalHr > 0 ? `${totalHr} ${t('dashboard.hr')} ${totalMin} ${t('dashboard.min')}` : `${totalMin} ${t('dashboard.min')}`}
              />
              <StatCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>}
                label={t('dashboard.totalWords')}
                value={totalWords >= 1000 ? `${(totalWords / 1000).toFixed(1)}K` : `${totalWords}`}
                unit={t('dashboard.wordsUnit')}
              />
              <StatCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>}
                label={t('dashboard.timeSaved')}
                value={savedMinutes > 60 ? `${Math.floor(savedMinutes / 60)} ${t('dashboard.hr')} ${savedMinutes % 60} ${t('dashboard.min')}` : `${savedMinutes} ${t('dashboard.min')}`}
              />
              <StatCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>}
                label={t('dashboard.avgSpeed')}
                value={`${avgWPM}`}
                unit="WPM"
              />
            </div>
          )}

          {/* ── GitHub promo cards ── */}
          <div className="grid grid-cols-2 gap-4">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl p-6 flex items-start gap-4 no-underline transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg group"
              style={{
                background: 'radial-gradient(ellipse at 20% 50%, rgba(180,215,250,0.5) 0%, transparent 60%), radial-gradient(ellipse at 60% 30%, rgba(200,230,255,0.4) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(220,240,255,0.3) 0%, transparent 50%), #eef5fb',
              }}
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center shadow-sm">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-semibold text-surface-800 mb-1">{t('dashboard.starProject')}</h3>
                <p className="text-[12px] text-surface-500 leading-relaxed mb-3">{t('dashboard.starDesc')}</p>
                <span className="inline-block px-3 py-1 bg-white/70 border border-surface-200/50 rounded-lg text-[12px] text-surface-600 group-hover:bg-white transition-colors">
                  {t('dashboard.goStar')}
                </span>
              </div>
            </a>

            <a
              href={`${GITHUB_URL}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl p-6 flex items-start gap-4 no-underline transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg group"
              style={{
                background: 'radial-gradient(ellipse at 20% 50%, rgba(253,215,170,0.5) 0%, transparent 60%), radial-gradient(ellipse at 60% 30%, rgba(254,230,200,0.4) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(255,240,220,0.3) 0%, transparent 50%), #fef5eb',
              }}
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center shadow-sm">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-semibold text-surface-800 mb-1">{t('dashboard.contribute')}</h3>
                <p className="text-[12px] text-surface-500 leading-relaxed mb-3">{t('dashboard.contributeDesc')}</p>
                <span className="inline-block px-3 py-1 bg-white/70 border border-surface-200/50 rounded-lg text-[12px] text-surface-600 group-hover:bg-white transition-colors">
                  {t('dashboard.viewIssues')}
                </span>
              </div>
            </a>
          </div>

          {/* ── Recent transcriptions ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-surface-800 dark:text-surface-200">{t('dashboard.recent')}</h2>
              {recentItems.length > 0 && onNavigate && (
                <button
                  onClick={() => onNavigate('history')}
                  className="text-[13px] text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
                >
                  {t('dashboard.viewAll')} →
                </button>
              )}
            </div>

            {recentItems.length > 0 ? (
              <div className="border border-surface-200 dark:border-surface-800 rounded-2xl overflow-hidden">
                {recentItems.map((item, idx) => (
                  <RecentItem
                    key={item.id}
                    item={item}
                    expanded={idx === 0}
                    isLast={idx === recentItems.length - 1}
                    onClick={() => setSelectedItem(item)}
                  />
                ))}
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('history')}
                    className="w-full py-3 text-center text-[13px] text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-850 transition-colors border-t border-surface-100 dark:border-surface-800/50"
                  >
                    {t('dashboard.viewAll')} →
                  </button>
                )}
              </div>
            ) : (
              <div className="border border-surface-200 dark:border-surface-800 rounded-2xl py-10 text-center text-sm text-surface-400">
                {t('dashboard.noRecent')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="px-8 py-3 border-t border-surface-100 dark:border-surface-800/30 flex items-center justify-between text-[11px] text-surface-400 dark:text-surface-600 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span>OpenType {version || 'v1.3.0'}</span>
          <button
            onClick={handleCheckUpdate}
            className="text-brand-500 hover:text-brand-400 transition-colors"
            disabled={updateStatus === 'checking'}
          >
            {updateStatus === 'checking' ? t('dashboard.checking') :
             updateStatus === 'latest' ? t('dashboard.upToDate') :
             t('dashboard.checkUpdate')}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noopener noreferrer"
            className="hover:text-surface-600 dark:hover:text-surface-400 transition-colors flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {t('dashboard.feedback')}
          </a>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"
            className="hover:text-surface-600 dark:hover:text-surface-400 transition-colors flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
            GitHub
          </a>
        </div>
      </div>

      {/* ── Detail modal ── */}
      {selectedItem && (
        <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}

/* ── Stat card ── */
function StatCard({ icon, label, value, unit }: { icon: JSX.Element; label: string; value: string; unit?: string }) {
  return (
    <div className="bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-800 rounded-2xl px-5 py-4">
      <div className="flex items-center gap-2 text-surface-400 mb-2">
        {icon}
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-surface-800 dark:text-surface-200">{value}</span>
        {unit && <span className="text-xs text-surface-400">{unit}</span>}
      </div>
    </div>
  );
}

/* ── Recent transcription item ── */
function RecentItem({ item, expanded, isLast, onClick }: { item: HistoryItem; expanded: boolean; isLast: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  const text = item.processedText || item.rawText || item.error || '';
  const ago = formatTimeAgo(item.timestamp, t);
  const dur = item.durationMs ? formatDuration(item.durationMs) : '';

  // Pick icon based on source app
  const iconEl = getAppIcon(item.sourceApp);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3.5 px-5 transition-colors hover:bg-surface-50 dark:hover:bg-surface-850
        ${expanded ? 'py-5' : 'py-3.5'}
        ${!isLast ? 'border-b border-surface-100 dark:border-surface-800/50' : ''}`}
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-surface-400">
        {iconEl}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`${expanded ? 'text-[14px] line-clamp-2' : 'text-[13px] truncate'} ${item.error ? 'text-red-500' : 'text-surface-700 dark:text-surface-300'}`}>
          {text}
        </p>
        <div className="flex items-center gap-2 mt-1 text-[11px] text-surface-400">
          {item.sourceApp && <span>{item.sourceApp}</span>}
          {item.sourceApp && <span>·</span>}
          <span>{ago}</span>
        </div>
      </div>
      {dur && (
        <span className="flex-shrink-0 text-[13px] text-surface-400 font-mono">{dur}</span>
      )}
    </button>
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
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100 dark:border-surface-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-surface-400">
              {getAppIcon(item.sourceApp)}
            </div>
            <div>
              <div className="text-sm font-medium text-surface-800 dark:text-surface-200">
                {item.sourceApp || t('history.detailTitle')}
              </div>
              <div className="text-[11px] text-surface-400">{ago}{dur ? ` · ${dur}` : ''}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 flex items-center justify-center text-surface-400 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
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

        {/* Footer */}
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
function getAppIcon(sourceApp?: string): JSX.Element {
  // Return a generic mic icon — could be extended with app-specific icons
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
    </svg>
  );
}

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
