import { useTranslation } from '../../i18n';

interface RecordButtonProps {
  status: 'idle' | 'recording' | 'processing';
  audioLevel: number;
  duration: number;
  onClick: () => void;
}

export function RecordButton({ status, audioLevel, duration, onClick }: RecordButtonProps) {
  const { t } = useTranslation();
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-5 h-[200px] justify-center">
      {/* Button */}
      <div className="relative flex items-center justify-center">
        {status === 'recording' && (
          <div className="absolute w-[72px] h-[72px] rounded-full bg-red-500/15 animate-pulse" />
        )}
        {status === 'processing' && (
          <div className="absolute w-[72px] h-[72px] rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin" />
        )}

        <button
          onClick={onClick}
          disabled={status === 'processing'}
          className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-md
            ${status === 'recording'
              ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
              : status === 'processing'
              ? 'bg-surface-200 dark:bg-surface-700 cursor-wait'
              : 'bg-brand-500 hover:bg-brand-600 shadow-brand-500/20 hover:scale-105 active:scale-95'
            }`}
        >
          {status === 'recording' ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
          ) : status === 'processing' ? (
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-surface-500 dark:bg-white animate-bounce" style={{ animationDelay: '0s' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-surface-500 dark:bg-white animate-bounce" style={{ animationDelay: '0.15s' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-surface-500 dark:bg-white animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="22"/>
            </svg>
          )}
        </button>
      </div>

      {/* Status text — fixed height, content swaps without layout shift */}
      <div className="text-center h-10 flex flex-col items-center justify-center">
        {status === 'recording' && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-500 dark:text-red-400 text-sm font-medium">{t('dashboard.recording')}</span>
            </div>
            <span className="text-lg font-mono text-surface-700 dark:text-surface-300 tracking-wider">{fmt(duration)}</span>
          </div>
        )}
        {status === 'processing' && (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-brand-500 dark:text-brand-400 text-sm font-medium">{t('dashboard.processing')}</span>
            <span className="text-xs text-surface-400">{t('dashboard.transcribing')}</span>
          </div>
        )}
        {status === 'idle' && (
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-surface-500 dark:text-surface-400 text-sm">{t('dashboard.clickToStart')}</span>
            <kbd className="px-2 py-0.5 bg-surface-100 dark:bg-surface-800 rounded text-[11px] text-surface-400 border border-surface-200 dark:border-surface-700 font-mono">
              Ctrl+Shift+Space
            </kbd>
          </div>
        )}
      </div>

      {/* Waveform bar — always present, fixed height */}
      <div className="flex items-end justify-center gap-[3px] h-5 w-48">
        {Array.from({ length: 24 }).map((_, i) => {
          const isRecording = status === 'recording';
          const barHeight = isRecording
            ? Math.max(2, (Math.sin(Date.now() / 200 + i * 0.5) * 0.5 + 0.5) * audioLevel * 20)
            : 2;
          const barColor = isRecording ? 'bg-red-400/70' : 'bg-surface-300 dark:bg-surface-700';
          const barOpacity = isRecording && audioLevel > 0.05 ? 0.5 + audioLevel * 0.5 : 1;

          return (
            <div
              key={i}
              className={`w-[2.5px] rounded-full transition-all duration-75 ${barColor}`}
              style={{ height: `${barHeight}px`, opacity: barOpacity }}
            />
          );
        })}
      </div>
    </div>
  );
}
