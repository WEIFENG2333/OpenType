import { useEffect } from 'react';
import { useConfigStore } from '../stores/configStore';
import { useRecorder } from '../hooks/useRecorder';
import { PageHeader } from '../components/layout/PageHeader';
import { RecordButton } from '../components/recording/RecordButton';
import { ResultPanel } from '../components/recording/ResultPanel';
import { useTranslation } from '../i18n';

export function DashboardPage() {
  const config = useConfigStore((s) => s.config);
  const recorder = useRecorder();
  const { t } = useTranslation();

  // Listen for global hotkey from Electron
  useEffect(() => {
    if (!window.electronAPI) return;
    return window.electronAPI.onToggleRecording(() => recorder.toggleRecording());
  }, [recorder.toggleRecording]);

  const matchPct = config.personalization.matchScore;
  const savedMinutes = Math.round(config.totalTimeSavedSeconds / 60);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
      />

      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-4 px-6 pt-4">
          <StatCard label={t('dashboard.thisWeek')} value={`${config.totalWordsThisWeek}`} unit={t('dashboard.wordsUnit')} />
          <StatCard label={t('dashboard.timeSaved')} value={`${savedMinutes}`} unit={t('dashboard.minUnit')} />
          <StatCard label={t('dashboard.styleMatch')} value={`${matchPct}%`} accent />
        </div>

        {/* Main recording area */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-6">
          <RecordButton
            status={recorder.status}
            audioLevel={recorder.audioLevel}
            duration={recorder.duration}
            onClick={recorder.toggleRecording}
          />
        </div>

        {/* Result panel */}
        <div className="px-6 pb-6">
          <ResultPanel
            rawText={recorder.rawText}
            processedText={recorder.processedText}
            error={recorder.error}
          />
        </div>
      </div>

      {/* Status bar */}
      <div className="px-6 py-2 border-t border-surface-100 dark:border-surface-800/30 flex items-center justify-between text-[11px] text-surface-400 dark:text-surface-600 flex-shrink-0">
        <span>{config.inputLanguage === 'auto' ? t('dashboard.autoDetect') : config.inputLanguage}</span>
        <span>{config.outputLanguage === 'auto' ? t('dashboard.outputSameAsInput') : t('dashboard.outputLang', { lang: config.outputLanguage })}</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <div className="bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-800/60 rounded-xl px-5 py-4">
      <p className="text-[11px] text-surface-500 font-medium uppercase tracking-wider">{label}</p>
      <div className="flex items-baseline gap-1.5 mt-1.5">
        <span className={`text-2xl font-bold ${accent ? 'text-brand-400' : 'text-surface-800 dark:text-surface-200'}`}>{value}</span>
        {unit && <span className="text-xs text-surface-500">{unit}</span>}
      </div>
    </div>
  );
}
