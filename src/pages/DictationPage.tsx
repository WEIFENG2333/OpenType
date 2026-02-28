import { useRecorder } from '../hooks/useRecorder';
import { ResultPanel } from '../components/recording/ResultPanel';
import { useConfigStore } from '../stores/configStore';
import { useTranslation } from '../i18n';

export function DictationPage() {
  const recorder = useRecorder();
  const config = useConfigStore((s) => s.config);
  const { t } = useTranslation();

  const hotkey = (config.globalHotkey || 'CommandOrControl+Shift+Space')
    .replace('CommandOrControl', 'Ctrl')
    .replace(/\+/g, ' + ');

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const hasResult = !!(recorder.rawText || recorder.processedText || recorder.error);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto flex flex-col">

        {/* ── Recording Zone ── vertically centered when no result, pushed up when result appears */}
        <div className={`flex flex-col items-center justify-center px-8 transition-all duration-300 ${hasResult ? 'pt-10 pb-6' : 'flex-1'}`}>

          {/* Mic button — large, prominent */}
          <div className="relative flex items-center justify-center mb-5">
            {/* Pulse rings for recording */}
            {recorder.status === 'recording' && (
              <>
                <div className="absolute w-[120px] h-[120px] rounded-full bg-red-500/5 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute w-[96px] h-[96px] rounded-full bg-red-500/10 animate-pulse" />
              </>
            )}
            {recorder.status === 'processing' && (
              <div className="absolute w-[96px] h-[96px] rounded-full border-2 border-brand-500/15 border-t-brand-500 animate-spin" />
            )}

            <button
              onClick={recorder.toggleRecording}
              disabled={recorder.status === 'processing'}
              className={`relative z-10 w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all duration-200
                ${recorder.status === 'recording'
                  ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/25'
                  : recorder.status === 'processing'
                  ? 'bg-surface-200 dark:bg-surface-700 cursor-wait shadow-md'
                  : 'bg-brand-500 hover:bg-brand-600 shadow-lg shadow-brand-500/25 hover:scale-105 active:scale-95'
                }`}
            >
              {recorder.status === 'recording' ? (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
              ) : recorder.status === 'processing' ? (
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-surface-500 dark:bg-white animate-bounce" style={{ animationDelay: '0s' }} />
                  <div className="w-2 h-2 rounded-full bg-surface-500 dark:bg-white animate-bounce" style={{ animationDelay: '0.15s' }} />
                  <div className="w-2 h-2 rounded-full bg-surface-500 dark:bg-white animate-bounce" style={{ animationDelay: '0.3s' }} />
                </div>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="22"/>
                </svg>
              )}
            </button>
          </div>

          {/* Status area */}
          <div className="text-center mb-4">
            {recorder.status === 'recording' ? (
              <div>
                <div className="flex items-center justify-center gap-2.5 mb-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-500 dark:text-red-400 text-[15px] font-semibold">{t('dashboard.recording')}</span>
                </div>
                <span className="text-[32px] font-mono font-light text-surface-800 dark:text-surface-200 tracking-widest">{fmt(recorder.duration)}</span>
                {/* Waveform */}
                <div className="flex items-end justify-center gap-[2.5px] h-6 mt-4">
                  {Array.from({ length: 40 }).map((_, i) => {
                    const barH = Math.max(2, (Math.sin(Date.now() / 180 + i * 0.4) * 0.5 + 0.5) * recorder.audioLevel * 24);
                    return (
                      <div key={i} className="w-[2px] rounded-full bg-red-400/50 transition-all duration-75" style={{ height: `${barH}px` }} />
                    );
                  })}
                </div>
              </div>
            ) : recorder.status === 'processing' ? (
              <div>
                <span className="text-brand-500 dark:text-brand-400 text-[15px] font-semibold">{t('dashboard.processing')}</span>
                <p className="text-[12px] text-surface-400 mt-1">{t('dashboard.transcribing')}</p>
              </div>
            ) : (
              <div>
                <h1 className="text-[20px] font-bold text-surface-900 dark:text-surface-100 tracking-tight mb-1.5">
                  {t('dictation.title')}
                </h1>
                <p className="text-[13px] text-surface-400 dark:text-surface-500">
                  {t('dictation.clickOrPress')}{' '}
                  <kbd className="inline-block px-1.5 py-0.5 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded text-[11px] text-surface-500 dark:text-surface-400 font-mono">
                    {hotkey}
                  </kbd>
                </p>
              </div>
            )}
          </div>

          {/* Idle state: subtle visual decoration */}
          {recorder.status === 'idle' && !hasResult && (
            <div className="flex items-end justify-center gap-[3px] h-4 mt-2 opacity-30">
              {[3, 5, 8, 12, 16, 20, 16, 12, 8, 5, 3].map((h, i) => (
                <div key={i} className="w-[2.5px] rounded-full bg-surface-400 dark:bg-surface-600" style={{ height: `${h}px` }} />
              ))}
            </div>
          )}
        </div>

        {/* ── Result Panel ── appears below after recording */}
        {hasResult && (
          <div className="px-8 pb-8 max-w-[600px] mx-auto w-full">
            <ResultPanel
              rawText={recorder.rawText}
              processedText={recorder.processedText}
              error={recorder.error}
            />
          </div>
        )}
      </div>
    </div>
  );
}
