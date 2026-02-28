import { useEffect, useState } from 'react';
import { useConfigStore } from '../stores/configStore';
import { useRecorder } from '../hooks/useRecorder';
import { RecordButton } from '../components/recording/RecordButton';
import { ResultPanel } from '../components/recording/ResultPanel';
import { useTranslation } from '../i18n';
import type { HistoryItem } from '../types/config';

const GITHUB_URL = 'https://github.com/WEIFENG2333/OpenType';

export function DashboardPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const config = useConfigStore((s) => s.config);
  const recorder = useRecorder();
  const { t } = useTranslation();
  const [version, setVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'latest'>('idle');

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

  // Recent transcriptions (last 5)
  const recentItems: HistoryItem[] = (config.history || []).slice(0, 5);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Hero section */}
        <div className="px-8 pt-8 pb-2">
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 tracking-tight">
            {t('dashboard.heroTitle')}
          </h1>
          <p className="mt-2 text-sm text-surface-500 dark:text-surface-400 leading-relaxed">
            {t('dashboard.heroSubtitle')}
          </p>
        </div>

        {/* Recording area */}
        <div className="px-8 pt-4">
          <div className="bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-800 rounded-2xl overflow-hidden">
            <RecordButton
              status={recorder.status}
              audioLevel={recorder.audioLevel}
              duration={recorder.duration}
              onClick={recorder.toggleRecording}
            />
          </div>
        </div>

        {/* Result panel */}
        <div className="px-8 pt-4">
          <ResultPanel
            rawText={recorder.rawText}
            processedText={recorder.processedText}
            error={recorder.error}
          />
        </div>

        {/* Stats card — only show when there's data */}
        {hasStats && (
          <div className="px-8 pt-6">
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
                label={t('dashboard.totalTime')}
                value={totalHr > 0 ? `${totalHr} ${t('dashboard.hr')} ${totalMin} ${t('dashboard.min')}` : `${totalMin} ${t('dashboard.min')}`}
              />
              <StatCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>}
                label={t('dashboard.totalWords')}
                value={totalWords >= 1000 ? `${(totalWords / 1000).toFixed(1)}K` : `${totalWords}`}
                unit={t('dashboard.wordsUnit')}
              />
              <StatCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>}
                label={t('dashboard.avgSpeed')}
                value={`${avgWPM}`}
                unit="WPM"
              />
              <StatCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
                label={t('dashboard.timeSaved')}
                value={savedMinutes > 60 ? `${Math.floor(savedMinutes / 60)} ${t('dashboard.hr')} ${savedMinutes % 60} ${t('dashboard.min')}` : `${savedMinutes} ${t('dashboard.min')}`}
              />
            </div>
          </div>
        )}

        {/* Recent transcriptions */}
        <div className="px-8 pt-6 pb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300">{t('dashboard.recent')}</h3>
            {recentItems.length > 0 && onNavigate && (
              <button
                onClick={() => onNavigate('history')}
                className="text-xs text-brand-500 hover:text-brand-600 transition-colors"
              >
                {t('dashboard.viewAll')} →
              </button>
            )}
          </div>
          {recentItems.length > 0 ? (
            <div className="space-y-1">
              {recentItems.map((item) => (
                <RecentItem key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-surface-400 dark:text-surface-500">
              {t('dashboard.noRecent')}
            </div>
          )}
        </div>
      </div>

      {/* Footer: version + links — pinned to bottom */}
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
          <a
            href={`${GITHUB_URL}/issues`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-surface-600 dark:hover:text-surface-400 transition-colors flex items-center gap-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {t('dashboard.feedback')}
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-surface-600 dark:hover:text-surface-400 transition-colors flex items-center gap-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
}

/* ── Stat card ── */
function StatCard({ icon, label, value, unit }: { icon: JSX.Element; label: string; value: string; unit?: string }) {
  return (
    <div className="bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-800 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 text-surface-400 mb-1.5">
        {icon}
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-surface-800 dark:text-surface-200">{value}</span>
        {unit && <span className="text-xs text-surface-400">{unit}</span>}
      </div>
    </div>
  );
}

/* ── Recent transcription item ── */
function RecentItem({ item }: { item: HistoryItem }) {
  const { t } = useTranslation();
  const text = item.processedText || item.rawText || item.error || '';
  const ago = formatTimeAgo(item.timestamp, t);
  const dur = item.durationMs ? `${Math.round(item.durationMs / 1000)}s` : '';

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-850 transition-colors group">
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${item.error ? 'text-red-500' : 'text-surface-700 dark:text-surface-300'}`}>
          {text}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 text-[11px] text-surface-400">
        {item.sourceApp && (
          <span className="px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400">
            {item.sourceApp}
          </span>
        )}
        {dur && <span>{dur}</span>}
        <span>{ago}</span>
      </div>
    </div>
  );
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
