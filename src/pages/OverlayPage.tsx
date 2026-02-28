import { useEffect, useState } from 'react';
import { useRecorder } from '../hooks/useRecorder';
import { useTranslation } from '../i18n';

export function OverlayPage() {
  const rec = useRecorder();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

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

  const handleCopy = async () => {
    if (!rec.processedText) return;
    try {
      if (window.electronAPI) await window.electronAPI.writeClipboard(rec.processedText);
      else await navigator.clipboard.writeText(rec.processedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleDismiss = () => {
    window.electronAPI?.hideOverlay();
  };

  // Auto-hide after successful output (no fallback needed)
  useEffect(() => {
    if (rec.status === 'idle' && rec.processedText && !rec.outputFailed) {
      const timer = setTimeout(() => window.electronAPI?.hideOverlay(), 1200);
      return () => clearTimeout(timer);
    }
    if (rec.status === 'idle' && rec.error) {
      const timer = setTimeout(() => window.electronAPI?.hideOverlay(), 3000);
      return () => clearTimeout(timer);
    }
  }, [rec.status, rec.processedText, rec.error, rec.outputFailed]);

  // Reset copied state on new recording
  useEffect(() => {
    if (rec.status === 'recording') setCopied(false);
  }, [rec.status]);

  const level = rec.audioLevel;

  // Show expanded fallback when output failed (text + copy button)
  const showFallback = rec.status === 'idle' && rec.processedText && rec.outputFailed;

  // Resize overlay window for fallback display
  useEffect(() => {
    if (showFallback) {
      window.electronAPI?.resizeOverlay(320, 100);
    }
  }, [showFallback]);

  return (
    <div className="w-full h-full flex items-end justify-center select-none">
      {showFallback ? (
        /* ── Expanded fallback: show text + copy button ── */
        <div
          className="w-full mx-1 mb-1 rounded-2xl flex flex-col gap-2 px-3 py-2.5"
          style={{ background: 'rgba(20, 20, 20, 0.75)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
        >
          <p className="text-[11px] text-white/90 leading-relaxed line-clamp-3">
            {rec.processedText}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40">
              {t('overlay.copiedToClipboard')}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopy}
                className="px-2.5 py-1 rounded-md text-[10px] font-medium bg-white/15 hover:bg-white/25 text-white transition-colors"
              >
                {copied ? t('recording.copied') : t('recording.copy')}
              </button>
              <button
                onClick={handleDismiss}
                className="px-2 py-1 rounded-md text-[10px] text-white/50 hover:text-white/80 transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Normal pill: recording / processing / result ── */
        <div
          className="w-full h-full rounded-[24px] flex items-center gap-1.5 px-2"
          style={{ background: 'rgba(20, 20, 20, 0.7)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
        >
          {/* Left: Cancel button */}
          <button
            onClick={handleCancel}
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center
              bg-white/[0.08] hover:bg-white/15 active:bg-white/20 transition-colors group"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              className="text-white/80 group-hover:text-white transition-colors">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          {/* Center: Waveform / status */}
          <div className="flex-1 flex items-center justify-center min-w-0">
            {rec.status === 'recording' ? (
              <div className="flex items-center justify-center gap-[3px] h-6">
                {Array.from({ length: 7 }).map((_, i) => {
                  const center = 3;
                  const dist = Math.abs(i - center);
                  // Static shape: center tall, edges short
                  const shape = [4, 8, 12, 16, 12, 8, 4];
                  const base = shape[i];
                  // Audio level adds dynamic variation
                  const dynamic = level * 8 * (1 - dist * 0.12);
                  const h = Math.min(22, base + dynamic);
                  return (
                    <div
                      key={i}
                      className="w-[3px] rounded-full bg-white/80 transition-all duration-75"
                      style={{ height: `${h}px` }}
                    />
                  );
                })}
              </div>
            ) : rec.status === 'processing' ? (
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-[1.5px] border-white/60 border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] text-white/50 font-medium">{t('overlay.processing')}</span>
              </div>
            ) : rec.processedText ? (
              <span className="text-[11px] text-green-400 font-medium truncate max-w-[160px]">
                ✓
              </span>
            ) : rec.error ? (
              <span className="text-[10px] text-red-400 font-medium truncate max-w-[160px]">
                {rec.error}
              </span>
            ) : null}
          </div>

          {/* Right: Confirm button */}
          <button
            onClick={handleConfirm}
            disabled={rec.status !== 'recording'}
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center
              bg-white/[0.08] hover:bg-white/15 active:bg-white/20
              transition-colors group disabled:opacity-20 disabled:cursor-default"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className="text-white/80 group-hover:text-white transition-colors">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
