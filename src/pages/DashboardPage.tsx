import { useEffect } from 'react';
import { useConfigStore } from '../stores/configStore';
import { useRecorder } from '../hooks/useRecorder';
import { PageHeader } from '../components/layout/PageHeader';
import { RecordButton } from '../components/recording/RecordButton';
import { ResultPanel } from '../components/recording/ResultPanel';
import { Badge } from '../components/ui';

export function DashboardPage() {
  const config = useConfigStore((s) => s.config);
  const recorder = useRecorder();

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
        title="Voice Dictation"
        subtitle="Speak naturally, get polished text"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="brand">STT: {config.sttProvider}</Badge>
            <Badge>LLM: {config.llmProvider}</Badge>
          </div>
        }
      />

      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-3 px-6 pt-5">
          <StatCard label="This week" value={`${config.totalWordsThisWeek}`} unit="words" />
          <StatCard label="Time saved" value={`${savedMinutes}`} unit="min" />
          <StatCard label="Style match" value={`${matchPct}%`} accent />
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
      <div className="px-6 py-2 border-t border-surface-800/40 flex items-center justify-between text-[11px] text-surface-600 flex-shrink-0">
        <span>{config.inputLanguage === 'auto' ? 'Auto-detect language' : config.inputLanguage}</span>
        <span>{config.outputLanguage === 'auto' ? 'Output: same as input' : `Output: ${config.outputLanguage}`}</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <div className="bg-surface-850 border border-surface-800/60 rounded-xl px-4 py-3">
      <p className="text-[11px] text-surface-500 font-medium">{label}</p>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={`text-xl font-semibold ${accent ? 'text-brand-400' : 'text-surface-200'}`}>{value}</span>
        {unit && <span className="text-xs text-surface-500">{unit}</span>}
      </div>
    </div>
  );
}
