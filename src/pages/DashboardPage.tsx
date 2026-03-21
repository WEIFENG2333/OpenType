import { useEffect, useMemo, useState } from 'react';
import { useConfigStore } from '../stores/configStore';
import { useTranslation } from '../i18n';
import type { HistoryItem } from '../types/config';

const GITHUB_URL = 'https://github.com/WEIFENG2333/OpenType';

/* ── Permission warning banner ── */
function PermissionWarnings() {
  const contextL1Enabled = useConfigStore((s) => s.config.contextL1Enabled);
  const contextOcrEnabled = useConfigStore((s) => s.config.contextOcrEnabled);
  const { t } = useTranslation();
  const [missing, setMissing] = useState<('mic' | 'accessibility' | 'screen')[]>([]);

  useEffect(() => {
    if (!window.electronAPI) return;
    const results: ('mic' | 'accessibility' | 'screen')[] = [];
    const checks: Promise<void>[] = [];

    checks.push(
      window.electronAPI.checkMicPermission().then((s) => {
        if (s !== 'granted') results.push('mic');
      })
    );
    if (contextL1Enabled) {
      checks.push(
        window.electronAPI.checkAccessibility().then((s) => {
          if (s !== 'granted') results.push('accessibility');
        })
      );
    }
    if (contextOcrEnabled) {
      checks.push(
        window.electronAPI.checkScreenPermission().then((s) => {
          if (s !== 'granted') results.push('screen');
        })
      );
    }
    Promise.all(checks).then(() => setMissing(results));
  }, [contextL1Enabled, contextOcrEnabled]);

  if (missing.length === 0) return null;

  const items: { key: string; text: string; action: string; onClick: () => void }[] = [];
  if (missing.includes('mic')) {
    items.push({ key: 'mic', text: t('dashboard.permMicNeeded'), action: t('dashboard.permMicAction'), onClick: () => window.electronAPI?.requestMicPermission() });
  }
  if (missing.includes('accessibility')) {
    items.push({ key: 'acc', text: t('dashboard.permAccessibilityNeeded'), action: t('dashboard.permAccessibilityAction'), onClick: () => window.electronAPI?.requestAccessibility() });
  }
  if (missing.includes('screen')) {
    items.push({ key: 'scr', text: t('dashboard.permScreenNeeded'), action: t('dashboard.permScreenAction'), onClick: () => window.electronAPI?.openScreenPrefs() });
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.key} className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-700/40 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-[13px]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>{item.text}</span>
          </div>
          <button onClick={item.onClick} className="flex-shrink-0 px-3 py-1 rounded-lg bg-amber-200/60 dark:bg-amber-700/40 text-amber-900 dark:text-amber-200 text-[12px] font-medium hover:bg-amber-200 dark:hover:bg-amber-700/60 transition-colors">
            {item.action}
          </button>
        </div>
      ))}
    </div>
  );
}

export function DashboardPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const config = useConfigStore((s) => s.config);
  const { t } = useTranslation();
  const [version, setVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'latest'>('idle');
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

  useEffect(() => {
    window.electronAPI?.getVersion?.().then(setVersion);
  }, []);

  const handleCheckUpdate = () => {
    setUpdateStatus('checking');
    window.electronAPI?.checkForUpdates?.().catch(() => {
      setUpdateStatus('idle');
    });
    // Status will be set by onUpdateAvailable/onUpdateNotAvailable event listeners
  };

  // Stats — computed from history (single pass)
  const stats = useMemo(() => {
    const history: HistoryItem[] = config.history || [];
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 3600 * 1000;

    let totalWords = 0;
    let totalDictationMs = 0;  // sum of recording durations
    let weekWords = 0;
    let weekDictationMs = 0;

    for (const item of history) {
      if (item.error && !item.processedText) continue; // skip pure errors
      totalWords += item.wordCount || 0;
      totalDictationMs += item.durationMs || 0;
      if (item.timestamp >= weekAgo) {
        weekWords += item.wordCount || 0;
        weekDictationMs += item.durationMs || 0;
      }
    }

    const totalDictationSec = Math.round(totalDictationMs / 1000);
    const totalDictationMin = Math.round(totalDictationSec / 60);
    const totalHr = Math.floor(totalDictationMin / 60);
    const totalMin = totalDictationMin % 60;

    // Time saved: typing at ~40 WPM vs dictation speed
    // savedTime = (totalWords / 40) minutes - actualDictationMinutes
    const typingMinutes = totalWords / 40;
    const savedMinutes = Math.max(0, Math.round(typingMinutes - totalDictationMin));

    // Average WPM based on this week's data
    const weekDictationMin = weekDictationMs / 60000;
    const avgWPM = weekDictationMin > 0.1 ? Math.round(weekWords / weekDictationMin) : 0;

    return { totalWords, totalHr, totalMin, totalDictationMin, savedMinutes, avgWPM };
  }, [config.history]);

  const hasStats = stats.totalWords > 0 || stats.totalDictationMin > 0 || stats.avgWPM > 0;

  // Recent transcriptions (last 3)
  const recentItems: HistoryItem[] = (config.history || []).slice(0, 3);

  // Hotkey display
  const hotkey = (config.globalHotkey || 'CommandOrControl+Shift+Space')
    .replace('CommandOrControl', 'Ctrl')
    .replace(/\+/g, ' + ');

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-8 space-y-6 max-w-[800px]">

          {/* ── Permission warnings ── */}
          <PermissionWarnings />

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
                value={stats.totalHr > 0 ? `${stats.totalHr} ${t('dashboard.hr')} ${stats.totalMin} ${t('dashboard.min')}` : `${stats.totalMin} ${t('dashboard.min')}`}
              />
              <StatCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>}
                label={t('dashboard.totalWords')}
                value={stats.totalWords >= 1000 ? `${(stats.totalWords / 1000).toFixed(1)}K` : `${stats.totalWords}`}
                unit={t('dashboard.wordsUnit')}
              />
              <StatCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>}
                label={t('dashboard.timeSaved')}
                value={stats.savedMinutes > 60 ? `${Math.floor(stats.savedMinutes / 60)} ${t('dashboard.hr')} ${stats.savedMinutes % 60} ${t('dashboard.min')}` : `${stats.savedMinutes} ${t('dashboard.min')}`}
              />
              <StatCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>}
                label={t('dashboard.avgSpeed')}
                value={`${stats.avgWPM}`}
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
              className="rounded-2xl p-5 flex gap-3 no-underline transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg group bg-blue-50/80 dark:bg-brand-500/10 border border-blue-100/50 dark:border-brand-500/20"
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/60 dark:bg-white/10 flex items-center justify-center shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <h3 className="text-[14px] font-semibold text-surface-800 dark:text-surface-200 mb-0.5">{t('dashboard.starProject')}</h3>
                <p className="text-[11px] text-surface-500 dark:text-surface-400 leading-relaxed flex-1">{t('dashboard.starDesc')}</p>
                <span className="mt-2 self-start inline-block px-3 py-1 bg-white/70 dark:bg-white/10 border border-surface-200/50 dark:border-surface-600/50 rounded-lg text-[11px] text-surface-600 dark:text-surface-300 group-hover:bg-white dark:group-hover:bg-white/15 transition-colors">
                  {t('dashboard.goStar')}
                </span>
              </div>
            </a>

            <a
              href={`${GITHUB_URL}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl p-5 flex gap-3 no-underline transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg group bg-orange-50/80 dark:bg-orange-500/10 border border-orange-100/50 dark:border-orange-500/20"
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/60 dark:bg-white/10 flex items-center justify-center shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <h3 className="text-[14px] font-semibold text-surface-800 dark:text-surface-200 mb-0.5">{t('dashboard.contribute')}</h3>
                <p className="text-[11px] text-surface-500 dark:text-surface-400 leading-relaxed flex-1">{t('dashboard.contributeDesc')}</p>
                <span className="mt-2 self-start inline-block px-3 py-1 bg-white/70 dark:bg-white/10 border border-surface-200/50 dark:border-surface-600/50 rounded-lg text-[11px] text-surface-600 dark:text-surface-300 group-hover:bg-white dark:group-hover:bg-white/15 transition-colors">
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
              <div className="border border-surface-200 dark:border-surface-800 rounded-2xl py-10 flex flex-col items-center gap-3">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-surface-300 dark:text-surface-600"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                <p className="text-sm text-surface-400 dark:text-surface-500">{t('dashboard.noRecent')}</p>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('dictation')}
                    className="mt-1 px-4 py-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-500/20 transition-colors"
                  >
                    {t('dashboard.startDictation')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="px-8 py-3 border-t border-surface-100 dark:border-surface-800/30 flex items-center justify-between text-[11px] text-surface-400 dark:text-surface-600 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span>OpenType {version || ''}</span>
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
