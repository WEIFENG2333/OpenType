import { useEffect } from 'react';
import { useRecorder } from '../hooks/useRecorder';
import { useTranslation } from '../i18n';

export function OverlayPage() {
  const rec = useRecorder();
  const { t } = useTranslation();

  useEffect(() => {
    if (!window.electronAPI) return;
    return window.electronAPI.onToggleRecording(() => rec.toggleRecording());
  }, [rec.toggleRecording]);

  const handleCancel = () => {
    window.electronAPI?.hideOverlay();
  };

  const handleConfirm = () => {
    if (rec.status === 'recording') {
      rec.stopRecording();
    }
  };

  // Auto-hide after processing completes
  useEffect(() => {
    if (rec.status === 'idle' && (rec.processedText || rec.error)) {
      const timer = setTimeout(() => window.electronAPI?.hideOverlay(), 1500);
      return () => clearTimeout(timer);
    }
  }, [rec.status, rec.processedText, rec.error]);

  const level = rec.audioLevel;

  return (
    <div className="w-full h-full flex items-center justify-center select-none">
      <div className="w-full h-full rounded-[28px] bg-surface-900/90 backdrop-blur-2xl border border-white/[0.08] shadow-2xl flex items-center px-2 gap-0">

        {/* Left: Cancel button */}
        <button
          onClick={handleCancel}
          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center
            hover:bg-white/10 active:bg-white/15 transition-colors group"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className="text-surface-400 group-hover:text-white transition-colors">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Center: Waveform + status */}
        <div className="flex-1 flex flex-col items-center justify-center min-w-0 gap-0.5">
          {rec.status === 'recording' ? (
            <>
              <div className="flex items-end justify-center gap-[3px] h-5">
                {Array.from({ length: 7 }).map((_, i) => {
                  const center = 3;
                  const dist = Math.abs(i - center);
                  const base = Math.max(0.15, 1 - dist * 0.2);
                  const h = Math.max(3, level * 20 * base);
                  return (
                    <div
                      key={i}
                      className="w-[3px] rounded-full bg-brand-400 transition-all duration-100"
                      style={{
                        height: `${h}px`,
                        opacity: 0.5 + base * 0.5,
                      }}
                    />
                  );
                })}
              </div>
              <p className="text-[10px] text-surface-400 font-medium tracking-wide">
                {t('overlay.listening')}
              </p>
            </>
          ) : rec.status === 'processing' ? (
            <>
              <div className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] text-surface-400 font-medium tracking-wide">
                {t('overlay.processing')}
              </p>
            </>
          ) : rec.processedText ? (
            <p className="text-[11px] text-green-400 font-medium truncate max-w-[180px]">
              ✓ {t('common.success')}
            </p>
          ) : rec.error ? (
            <p className="text-[11px] text-red-400 font-medium truncate max-w-[180px]">
              {rec.error}
            </p>
          ) : (
            <p className="text-[11px] text-surface-500 font-medium">
              {t('overlay.pressHotkey')}
            </p>
          )}
        </div>

        {/* Right: Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={rec.status !== 'recording'}
          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center
            transition-colors group
            disabled:opacity-30 disabled:cursor-default
            hover:bg-brand-500/20 active:bg-brand-500/30"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className="text-brand-400 group-hover:text-brand-300 transition-colors">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
