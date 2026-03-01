import { useEffect, useState, useRef, memo } from 'react';
import { useRecorder } from '../hooks/useRecorder';
import { useTranslation } from '../i18n';

export function OverlayPage() {
  const rec = useRecorder();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;
    return window.electronAPI.onToggleRecording(() => rec.toggleRecording());
  }, [rec.toggleRecording]);

  // Cancel: stop recorder (discard audio) + reset isRecording in main
  const handleCancel = () => {
    rec.cancelRecording();
    window.electronAPI?.hideOverlay();
  };

  const handleConfirm = () => {
    if (rec.status === 'recording') rec.stopRecording();
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

  const handleDismiss = () => window.electronAPI?.hideOverlay();

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

  useEffect(() => {
    if (rec.status === 'recording') setCopied(false);
  }, [rec.status]);

  const showFallback = rec.status === 'idle' && rec.processedText && rec.outputFailed;

  useEffect(() => {
    if (showFallback) window.electronAPI?.resizeOverlay(320, 100);
  }, [showFallback]);

  return (
    <div className="w-full h-full flex items-center justify-center select-none" style={{ background: 'transparent' }}>
      <style>{`
        @keyframes pill-sweep {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(320%); }
        }
      `}</style>

      {showFallback ? (
        <div className="w-full mx-1 rounded-2xl flex flex-col gap-2 px-3 py-2.5" style={{ background: '#000' }}>
          <p className="text-[11px] text-white/90 leading-relaxed line-clamp-3">{rec.processedText}</p>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40">{t('overlay.copiedToClipboard')}</span>
            <div className="flex items-center gap-1.5">
              <button onClick={handleCopy} className="px-2.5 py-1 rounded-md text-[10px] font-medium bg-white/15 hover:bg-white/25 text-white transition-colors">
                {copied ? t('recording.copied') : t('recording.copy')}
              </button>
              <button onClick={handleDismiss} className="px-2 py-1 rounded-md text-[10px] text-white/50 hover:text-white/80 transition-colors">
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Pill: pure black, clearer border ── */
        <div
          className="w-full h-full rounded-full overflow-hidden"
          style={{
            background: '#000',
            border: '1.5px solid rgba(255,255,255,0.18)',
          }}
        >
          {rec.status === 'processing' ? (
            <ProcessingView recordingDuration={rec.duration} />
          ) : (
            <div className="w-full h-full flex items-center gap-[5px] px-[5px]">

              {/* Left: Cancel */}
              <button
                onClick={handleCancel}
                className="flex-shrink-0 w-[30px] h-[30px] rounded-full flex items-center justify-center transition-opacity active:opacity-60"
                style={{ background: 'rgb(66,66,66)' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              {/* Center */}
              <div className="flex-1 flex items-center justify-center min-w-0">
                {rec.status === 'recording' ? (
                  <WaveformBars level={rec.audioLevel} />
                ) : rec.processedText ? (
                  <span className="text-[13px] text-white/80">✓</span>
                ) : rec.error ? (
                  <span className="text-[10px] text-red-400 truncate max-w-[70px]">{rec.error}</span>
                ) : null}
              </div>

              {/* Right: Confirm */}
              <button
                onClick={handleConfirm}
                disabled={rec.status !== 'recording'}
                className="flex-shrink-0 w-[30px] h-[30px] rounded-full flex items-center justify-center transition-opacity active:opacity-80 disabled:opacity-25 disabled:cursor-default"
                style={{ background: '#ffffff' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>

            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Processing view: sweep shimmer + text + estimated progress bar */
function ProcessingView({ recordingDuration }: { recordingDuration: number }) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Estimate: STT ≈ 0.25× duration + 0.8s (capped at 4s), LLM ≈ 2s
    const sttMs = Math.min(recordingDuration * 250 + 800, 4000);
    const llmMs = 2000;
    const start = Date.now();
    let raf: number;

    const tick = () => {
      const elapsed = Date.now() - start;
      let p: number;
      if (elapsed <= sttMs) {
        // STT phase: 0 → 70%
        p = (elapsed / sttMs) * 70;
      } else {
        // LLM phase: 70 → 90%
        p = 70 + (Math.min(elapsed - sttMs, llmMs) / llmMs) * 20;
      }
      setProgress(Math.min(p, 90));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      {/* Background sweep shimmer */}
      <div
        style={{
          position: 'absolute',
          top: 0, bottom: 0,
          width: '50%',
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
          animation: 'pill-sweep 1.8s ease-in-out infinite',
        }}
      />

      {/* Label */}
      <span className="relative z-10 text-[12px] font-medium text-white/60 tracking-wide">
        {t('overlay.processing')}
      </span>

      {/* Progress bar at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: '2px', background: 'rgba(255,255,255,0.06)' }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: 'rgba(255,255,255,0.5)',
            transition: 'width 80ms linear',
            borderRadius: '0 1px 1px 0',
          }}
        />
      </div>
    </div>
  );
}

/** Waveform bars: frozen dots when silent, tall white wave when speaking */
const BAR_COUNT = 9;

const WaveformBars = memo(function WaveformBars({ level }: { level: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const levelRef = useRef(level);
  const smoothed = useRef(0);  // fast EMA
  const envelope = useRef(0); // slow-decay envelope follower
  levelRef.current = level;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const bars = Array.from(container.children) as HTMLDivElement[];
    const center = (BAR_COUNT - 1) / 2;
    let raf: number;

    const animate = () => {
      // Fast EMA for responsiveness
      smoothed.current = smoothed.current * 0.75 + levelRef.current * 0.25;
      // Envelope: attack fast, decay faster (0.90/frame ≈ 0.3s to freeze after sound stops)
      envelope.current = Math.max(smoothed.current, envelope.current * 0.90);
      const lv = envelope.current;

      if (lv < 0.10) {
        // Silent: frozen at minimum, always white
        bars.forEach(bar => {
          bar.style.height = '3px';
          bar.style.width = '3px';
          bar.style.borderRadius = '1.5px';
          bar.style.opacity = '1';
        });
      } else {
        frameRef.current++;
        const t = frameRef.current * 0.09;
        bars.forEach((bar, i) => {
          const dist = Math.abs(i - center);
          const bell = Math.exp(-(dist * dist) / 8);
          const wave = (Math.sin(t + i * 0.65) + 1) / 2;
          const h = 3 + 23 * bell * lv * (0.5 + 0.5 * wave);
          bar.style.height = `${Math.max(3, h)}px`;
          bar.style.width = '3px';
          bar.style.borderRadius = '1.5px';
          bar.style.opacity = '1';
        });
      }

      raf = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center"
      style={{ gap: '2.5px', height: '28px' }}
    >
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          style={{
            width: '3px',
            height: '3px',
            borderRadius: '1.5px',
            background: 'white',
            opacity: 0.28,
          }}
        />
      ))}
    </div>
  );
});
