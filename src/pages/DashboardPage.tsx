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
  const hasStats = config.totalWordsThisWeek > 0 || savedMinutes > 0 || (config.averageWPM || 0) > 0;

  // Language display
  const inputLang = config.inputLanguage === 'auto' ? t('dashboard.autoDetect') : config.inputLanguage;
  const outputLang = config.outputLanguage === 'auto'
    ? t('dashboard.outputSameAsInput')
    : t('dashboard.outputLang', { lang: config.outputLanguage });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
      />

      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Recording Card — main focus */}
        <div className="px-6 pt-4">
          <div className="bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-800 rounded-xl overflow-hidden">
            <RecordButton
              status={recorder.status}
              audioLevel={recorder.audioLevel}
              duration={recorder.duration}
              onClick={recorder.toggleRecording}
            />
            {/* Language info bar */}
            <div className="flex items-center justify-center gap-4 px-4 py-2.5 border-t border-surface-200 dark:border-surface-800/60">
              <div className="flex items-center gap-1.5 text-xs text-surface-400">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                <span>{inputLang}</span>
              </div>
              <div className="w-px h-3 bg-surface-200 dark:bg-surface-700" />
              <div className="flex items-center gap-1.5 text-xs text-surface-400">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                <span>{outputLang}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Result panel */}
        <div className="px-6 pt-4">
          <ResultPanel
            rawText={recorder.rawText}
            processedText={recorder.processedText}
            error={recorder.error}
          />
        </div>

        {/* Stats — compact, hidden when all zero */}
        {hasStats && (
          <div className="flex items-center gap-3 px-6 pt-4">
            <StatBadge label={t('dashboard.thisWeek')} value={config.totalWordsThisWeek} unit={t('dashboard.wordsUnit')} />
            <StatBadge label={t('dashboard.timeSaved')} value={savedMinutes} unit={t('dashboard.minUnit')} />
            <StatBadge label={t('dashboard.avgSpeed')} value={config.averageWPM || 0} unit="WPM" />
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer: version + links */}
        <div className="px-6 py-3 border-t border-surface-100 dark:border-surface-800/30 flex items-center justify-between text-[11px] text-surface-400 dark:text-surface-600 flex-shrink-0">
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
    </div>
  );
}

function StatBadge({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-800 rounded-lg">
      <span className="text-[11px] text-surface-400 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-semibold text-surface-700 dark:text-surface-300">{value}</span>
      <span className="text-[11px] text-surface-400">{unit}</span>
    </div>
  );
}
