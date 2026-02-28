import { useEffect, useState, useRef, memo } from 'react';
import { useRecorder } from '../hooks/useRecorder';
import { useTranslation } from '../i18n';

export function OverlayPage() {
  const rec = useRecorder();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  // Make overlay window fully transparent (remove white body background)
  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
  }, []);

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
    <div className="w-full h-full flex items-center justify-center select-none" style={{ background: 'transparent' }}>
      {showFallback ? (
        /* ── Expanded fallback: show text + copy button ── */
        <div
          className="w-full mx-1 rounded-2xl flex flex-col gap-2 px-3 py-2.5"
          style={{ background: '#000' }}
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
          className="w-full h-full rounded-full flex items-center gap-0.5 px-[5px]"
          style={{ background: '#000' }}
        >
          {/* Left: Cancel button */}
          <button
            onClick={handleCancel}
            className="flex-shrink-0 w-[30px] h-[30px] rounded-full flex items-center justify-center
              bg-white/[0.08] hover:bg-white/15 active:bg-white/20 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          {/* Center: Waveform / status */}
          <div className="flex-1 flex items-center justify-center min-w-0">
            {rec.status === 'recording' ? (
              <WaveformBars level={level} />
            ) : rec.status === 'processing' ? (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 border-[1.5px] border-white/50 border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] text-white/40 font-medium">{t('overlay.processing')}</span>
              </div>
            ) : rec.processedText ? (
              <span className="text-[11px] text-green-400 font-medium">✓</span>
            ) : rec.error ? (
              <span className="text-[10px] text-red-400 font-medium truncate max-w-[80px]">
                {rec.error}
              </span>
            ) : null}
          </div>

          {/* Right: Confirm button — white circle, pure black checkmark */}
          <button
            onClick={handleConfirm}
            disabled={rec.status !== 'recording'}
            className="flex-shrink-0 w-[30px] h-[30px] rounded-full flex items-center justify-center
              bg-white hover:bg-white/90 active:bg-white/80
              transition-colors disabled:opacity-20 disabled:cursor-default"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

/** Waveform bars: tiny dots when silent, smooth wave bars when speaking */
const BAR_COUNT = 15;
const WaveformBars = memo(function WaveformBars({ level }: { level: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const bars = container.children;

    let raf: number;
    const animate = () => {
      frameRef.current++;
      const t = frameRef.current * 0.06;
      const center = (BAR_COUNT - 1) / 2;

      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i] as HTMLDivElement;
        const dist = Math.abs(i - center);
        // Bell curve: taller in center, shorter at edges
        const shape = Math.exp(-(dist * dist) / 16);
        // Smooth wave motion
        const wave = Math.sin(t + i * 0.55) * 0.35 + 0.65;
        const minH = 2;
        const maxH = 18;
        const h = minH + (maxH - minH) * shape * level * wave;
        bar.style.height = `${Math.max(minH, h)}px`;
      }

      raf = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(raf);
  }, [level]);

  return (
    <div ref={containerRef} className="flex items-center justify-center gap-[2px] h-[24px]">
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div key={i} className="w-[2px] rounded-full bg-white/50" style={{ height: '2px' }} />
      ))}
    </div>
  );
});
