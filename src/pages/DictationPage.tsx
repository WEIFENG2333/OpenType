import { useRecorder } from '../hooks/useRecorder';
import { RecordButton } from '../components/recording/RecordButton';
import { ResultPanel } from '../components/recording/ResultPanel';
import { useConfigStore } from '../stores/configStore';
import { useTranslation } from '../i18n';

export function DictationPage() {
  const recorder = useRecorder();
  const config = useConfigStore((s) => s.config);
  const { t } = useTranslation();

  // Hotkey display
  const hotkey = (config.globalHotkey || 'CommandOrControl+Shift+Space')
    .replace('CommandOrControl', 'Ctrl')
    .replace(/\+/g, ' + ');

  // Language display
  const inputLang = config.inputLanguage === 'auto'
    ? t('dashboard.autoDetect')
    : config.inputLanguage;
  const outputLang = config.outputLanguage === 'auto'
    ? t('dashboard.outputSameAsInput')
    : t('dashboard.outputLang', { lang: config.outputLanguage });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[560px] mx-auto px-8 py-10 space-y-6">

          {/* ── Header ── */}
          <div className="text-center">
            <h1 className="text-[22px] font-bold text-surface-900 dark:text-surface-100 tracking-tight">
              {t('dictation.title')}
            </h1>
            <p className="mt-2 text-[13px] text-surface-400 dark:text-surface-500">
              {t('dictation.subtitle')}
            </p>
          </div>

          {/* ── Recording Card ── */}
          <div className="bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-800 rounded-2xl p-6">
            <RecordButton
              status={recorder.status}
              audioLevel={recorder.audioLevel}
              duration={recorder.duration}
              onClick={recorder.toggleRecording}
            />

            {/* Language indicators */}
            <div className="flex items-center justify-center gap-3 mt-2 text-[11px] text-surface-400">
              <span className="flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
                {inputLang}
              </span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              <span>{outputLang}</span>
            </div>
          </div>

          {/* ── Result Panel ── */}
          <ResultPanel
            rawText={recorder.rawText}
            processedText={recorder.processedText}
            error={recorder.error}
          />

          {/* ── Hotkey hint ── */}
          <div className="text-center">
            <span className="text-[12px] text-surface-400 dark:text-surface-500">
              {t('dictation.hotkeyHint')}{' '}
              <kbd className="inline-block px-2 py-0.5 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-md text-[11px] text-surface-500 dark:text-surface-400 font-mono">
                {hotkey}
              </kbd>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
