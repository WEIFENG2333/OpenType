import { useEffect, useState } from 'react';
import { useConfigStore } from '../stores/configStore';
import { useRecorder } from '../hooks/useRecorder';
import { PageHeader } from '../components/layout/PageHeader';
import { RecordButton } from '../components/recording/RecordButton';
import { ResultPanel } from '../components/recording/ResultPanel';
import { useTranslation } from '../i18n';

const GITHUB_URL = 'https://github.com/WEIFENG2333/OpenType';

export function DashboardPage() {
  const config = useConfigStore((s) => s.config);
  const recorder = useRecorder();
  const { t } = useTranslation();
  const [version, setVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'latest'>('idle');

  useEffect(() => {
    if (!window.electronAPI) return;
    return window.electronAPI.onToggleRecording(() => recorder.toggleRecording());
  }, [recorder.toggleRecording]);

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

  const savedMinutes = Math.round(config.totalTimeSavedSeconds / 60);
  const recentHistory = (config.history || []).slice(0, 5);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
      />

      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-4 px-6 pt-4">
          <StatCard
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
            label={t('dashboard.thisWeek')}
            value={`${config.totalWordsThisWeek}`}
            unit={t('dashboard.wordsUnit')}
          />
          <StatCard
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>}
            label={t('dashboard.timeSaved')}
            value={`${savedMinutes}`}
            unit={t('dashboard.minUnit')}
          />
          <StatCard
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>}
            label={t('dashboard.avgSpeed')}
            value={`${config.averageWPM || 0}`}
            unit="WPM"
          />
        </div>

        {/* Main recording area — fixed height, no layout shift */}
        <div className="flex items-center justify-center px-6 py-4">
          <RecordButton
            status={recorder.status}
            audioLevel={recorder.audioLevel}
            duration={recorder.duration}
            onClick={recorder.toggleRecording}
          />
        </div>

        {/* Result panel */}
        <div className="px-6 pb-4">
          <ResultPanel
            rawText={recorder.rawText}
            processedText={recorder.processedText}
            error={recorder.error}
          />
        </div>

        {/* Recent transcriptions */}
        {recentHistory.length > 0 && (
          <div className="px-6 pb-4">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
              {t('dashboard.recent')}
            </h3>
            <div className="space-y-1.5">
              {recentHistory.map((item) => (
                <div key={item.id} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-800/60">
                  <span className="text-[10px] text-surface-400 font-mono w-12 flex-shrink-0 pt-0.5">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <p className="text-xs text-surface-700 dark:text-surface-300 leading-relaxed line-clamp-2">
                    {item.processedText || item.rawText || item.error || '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer: version + links */}
        <div className="px-6 py-3 border-t border-surface-100 dark:border-surface-800/30 flex items-center justify-between text-[11px] text-surface-400 dark:text-surface-600 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span>OpenType {version || 'v1.2.0'}</span>
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
    </div>
  );
}

function StatCard({ icon, label, value, unit }: { icon: JSX.Element; label: string; value: string; unit?: string }) {
  return (
    <div className="bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-800/60 rounded-xl px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-surface-400">{icon}</span>
        <p className="text-[11px] text-surface-500 font-medium uppercase tracking-wider">{label}</p>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-surface-800 dark:text-surface-200">{value}</span>
        {unit && <span className="text-xs text-surface-500">{unit}</span>}
      </div>
    </div>
  );
}
