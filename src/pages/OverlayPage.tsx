import { useEffect, useState, useRef, useCallback, memo } from 'react';
import { useRecorder } from '../hooks/useRecorder';
import { useTranslation } from '../i18n';

// ─── Constants ───────────────────────────────────────────────────────────────

const PILL_H = 40;
const PILL_MIN_W = 140;
const PILL_MAX_W = 240;
const RESIZE_SPEED = 0.12; // lerp factor per frame (0–1, higher = faster)

// ─── Smooth Resize Hook ─────────────────────────────────────────────────────
// Animates the Electron overlay window width smoothly via RAF lerp.

function useSmoothResize() {
  const currentRef = useRef(PILL_MIN_W);
  const targetRef = useRef(PILL_MIN_W);
  const rafRef = useRef<number | null>(null);

  const startLoop = useCallback(() => {
    if (rafRef.current) return; // already running
    const tick = () => {
      const diff = targetRef.current - currentRef.current;
      if (Math.abs(diff) < 1) {
        if (currentRef.current !== targetRef.current) {
          currentRef.current = targetRef.current;
          window.electronAPI?.resizeOverlay(targetRef.current, PILL_H);
        }
        rafRef.current = null;
        return;
      }
      currentRef.current += diff * RESIZE_SPEED;
      window.electronAPI?.resizeOverlay(Math.round(currentRef.current), PILL_H);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    startLoop();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
  }, [startLoop]);

  return useCallback((w: number) => {
    targetRef.current = w;
    startLoop();
  }, [startLoop]);
}

// ─── Typewriter Hook ─────────────────────────────────────────────────────────
// Smoothly reveals text using RAF. Adapts speed to stay close behind the source
// without sudden jumps: moves ~1 char per 30ms, accelerates when falling behind.

function useTypewriter(source: string, active: boolean) {
  const [display, setDisplay] = useState('');
  const stateRef = useRef({ target: '', pos: 0, lastTime: 0 });

  stateRef.current.target = source;

  useEffect(() => {
    if (!active) {
      stateRef.current.pos = 0;
      stateRef.current.lastTime = 0;
      setDisplay('');
      return;
    }
    stateRef.current.lastTime = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const s = stateRef.current;
      const behind = s.target.length - s.pos;
      if (behind <= 0) return; // caught up — RAF restarts via useEffect when source changes
      // Always 1 char at a time; shorten the interval when falling behind
      const interval = behind > 20 ? 10 : behind > 10 ? 18 : behind > 4 ? 25 : 35;
      if (now - s.lastTime >= interval) {
        s.pos++;
        s.lastTime = now;
        setDisplay(s.target.slice(0, s.pos));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, source]);

  return display;
}

// ─── OverlayPage ─────────────────────────────────────────────────────────────

export function OverlayPage() {
  const rec = useRecorder();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [flashDone, setFlashDone] = useState(false);
  const maxWidthRef = useRef(PILL_MIN_W);
  const setWidth = useSmoothResize();

  const isRecording = rec.status === 'recording';
  const isProcessing = rec.status === 'processing';

  const displayText = useTypewriter(rec.streamingText, isRecording && rec.streamingText.length > 0);
  const hasText = displayText.length > 0;

  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;
    return window.electronAPI.onToggleRecording(() => rec.toggleRecording());
  }, [rec.toggleRecording]);

  useEffect(() => {
    if (rec.status === 'recording') {
      setCopied(false);
      setFlashDone(false);
      maxWidthRef.current = PILL_MIN_W;
    }
  }, [rec.status]);

  // Success flash → quick hide
  useEffect(() => {
    if (rec.status === 'idle' && rec.processedText && !rec.outputFailed) {
      setFlashDone(true);
      const timer = setTimeout(() => window.electronAPI?.hideOverlay(), 600);
      return () => clearTimeout(timer);
    }
    if (rec.status === 'idle' && rec.error) {
      const timer = setTimeout(() => window.electronAPI?.hideOverlay(), 2500);
      return () => clearTimeout(timer);
    }
  }, [rec.status, rec.processedText, rec.error, rec.outputFailed]);

  // ── Resize overlay ──
  useEffect(() => {
    if (!isRecording || !hasText) {
      maxWidthRef.current = PILL_MIN_W;
      setWidth(PILL_MIN_W);
      return;
    }
    const cjk = (displayText.match(/[\u4e00-\u9fff\u3000-\u303f]/g) || []).length;
    const other = displayText.length - cjk;
    const textW = cjk * 9 + other * 7 + 110;
    const desired = Math.min(PILL_MAX_W, Math.max(PILL_MIN_W, textW));
    const w = Math.max(maxWidthRef.current, desired);
    maxWidthRef.current = w;
    setWidth(w);
  }, [isRecording, hasText, displayText, setWidth]);

  const showFallback = rec.status === 'idle' && rec.processedText && rec.outputFailed;
  useEffect(() => {
    if (showFallback) window.electronAPI?.resizeOverlay(320, 100);
  }, [showFallback]);

  // ── Handlers ──
  const handleCancel = useCallback(() => {
    rec.cancelRecording();
    window.electronAPI?.hideOverlay();
  }, [rec.cancelRecording]);

  const handleStop = useCallback(() => {
    if (rec.status === 'recording') rec.stopRecording();
  }, [rec.status, rec.stopRecording]);

  const handleCopy = useCallback(async () => {
    if (!rec.processedText) return;
    try {
      if (window.electronAPI) await window.electronAPI.writeClipboard(rec.processedText);
      else await navigator.clipboard.writeText(rec.processedText);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        window.electronAPI?.hideOverlay();
      }, 1200);
    } catch (e) { console.error('[Overlay] clipboard write failed:', e); }
  }, [rec.processedText]);

  const handleDismiss = useCallback(() => window.electronAPI?.hideOverlay(), []);

  return (
    <div className="w-full h-full flex items-center justify-center select-none" style={{ background: 'transparent' }}>
      <style>{`
        @keyframes pill-sweep { 0% { transform: translateX(-100%); } 100% { transform: translateX(320%); } }
        @keyframes cursor-blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes rec-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes done-flash { 0% { border-color: rgba(74,222,128,0.6); } 100% { border-color: rgba(255,255,255,0.18); } }
      `}</style>

      {showFallback ? (
        <FallbackView text={rec.processedText!} copied={copied} onCopy={handleCopy} onDismiss={handleDismiss} t={t} />
      ) : isProcessing ? (
        /* Processing: clean pill, no buttons, just text + progress bar */
        <PillShell flash={false}>
          <ProcessingView phase={rec.pipelinePhase} />
        </PillShell>
      ) : (
        /* Recording / idle: buttons + center content */
        <PillShell flash={flashDone}>
          <PillButton onClick={isRecording ? handleCancel : handleDismiss} bg="rgb(66,66,66)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </PillButton>

          <div className="flex-1 flex items-center min-w-0 overflow-hidden">
            {hasText ? (
              <ScrollingText text={displayText} level={rec.audioLevel} phase={rec.pipelinePhase} />
            ) : isRecording ? (
              <div className="w-full flex items-center justify-center">
                <WaveformBars level={rec.audioLevel} />
              </div>
            ) : rec.error ? (
              <span className="w-full text-center text-[10px] text-red-400 truncate">{rec.error}</span>
            ) : null}
          </div>

          {isRecording ? (
            <button
              onClick={handleStop}
              className="flex-shrink-0 w-[30px] h-[30px] rounded-full flex items-center justify-center active:opacity-60"
              style={{ background: 'rgb(66,66,66)' }}
            >
              <div
                className="w-[10px] h-[10px] rounded-full"
                style={{ background: '#ef4444', animation: 'rec-pulse 1.5s ease-in-out infinite' }}
              />
            </button>
          ) : (
            <div className="flex-shrink-0 w-[30px] h-[30px]" />
          )}
        </PillShell>
      )}
    </div>
  );
}

// ─── Pill Shell ──────────────────────────────────────────────────────────────

function PillShell({ children, flash }: { children: React.ReactNode; flash?: boolean }) {
  return (
    <div
      className="w-full h-full flex items-center gap-[5px] px-[5px] overflow-hidden"
      style={{
        background: '#000',
        border: '1.5px solid rgba(255,255,255,0.18)',
        borderRadius: '9999px',
        ...(flash ? { animation: 'done-flash 0.5s ease-out' } : {}),
      }}
    >
      {children}
    </div>
  );
}

// ─── Pill Button ─────────────────────────────────────────────────────────────

function PillButton({ onClick, bg, children }: {
  onClick: () => void; bg: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-[30px] h-[30px] rounded-full flex items-center justify-center transition-opacity active:opacity-60"
      style={{ background: bg }}
    >
      {children}
    </button>
  );
}

// ─── Scrolling Text ──────────────────────────────────────────────────────────

function ScrollingText({ text, level, phase }: { text: string; level: number; phase: string | null }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: scrollRef.current.scrollWidth, behavior: 'smooth' });
    }
  }, [text]);

  const isListening = phase === 'stt-streaming' || phase === 'stt';

  return (
    <div className="flex items-center gap-[6px] w-full min-w-0">
      {isListening && <MiniVoiceBars level={level} />}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto whitespace-nowrap min-w-0"
        style={{ scrollbarWidth: 'none' }}
      >
        <span className="text-[12px] text-white/90 leading-none">
          {text}
          {isListening && (
            <span
              className="inline-block w-[2px] h-[12px] bg-white/70 ml-[2px] align-middle"
              style={{ animation: 'cursor-blink 1s step-end infinite' }}
            />
          )}
        </span>
      </div>
    </div>
  );
}

// ─── Mini Voice Bars ─────────────────────────────────────────────────────────

const MiniVoiceBars = memo(function MiniVoiceBars({ level }: { level: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const levelRef = useRef(level);
  const smoothed = useRef(0);
  levelRef.current = level;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const bars = Array.from(el.children) as HTMLDivElement[];
    let frame = 0;
    let raf: number;

    const animate = () => {
      smoothed.current = smoothed.current * 0.7 + levelRef.current * 0.3;
      const lv = smoothed.current;
      frame++;
      const t = frame * 0.12;
      bars.forEach((bar, i) => {
        const wave = (Math.sin(t + i * 1.2) + 1) / 2;
        const h = lv < 0.08 ? 3 : 3 + 9 * lv * (0.4 + 0.6 * wave);
        bar.style.height = `${Math.max(3, h)}px`;
      });
      raf = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={ref} className="flex items-center flex-shrink-0" style={{ gap: '1.5px', height: '16px' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: '2px', height: '3px', borderRadius: '1px', background: '#ef4444' }} />
      ))}
    </div>
  );
});

// ─── Processing View ─────────────────────────────────────────────────────────
// Clean full-width view: centered text + bottom progress bar + shimmer sweep.
// No buttons — the entire pill is just this view.

function ProcessingView({ phase }: { phase: string | null }) {
  const { t } = useTranslation();
  const [pct, setPct] = useState(0);
  const stateRef = useRef({ target: 30, lastTime: 0 });

  // Phase → target: each transition raises the ceiling
  useEffect(() => {
    if (phase === 'done') stateRef.current.target = 100;
    else if (phase === 'llm') stateRef.current.target = 90;
    else if (phase === 'stt') stateRef.current.target = 60;
    else stateRef.current.target = 30; // stt-streaming / null (just started)
  }, [phase]);

  // Constant-speed animation: ~15%/sec towards target, never stalls
  useEffect(() => {
    stateRef.current.lastTime = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const dt = now - stateRef.current.lastTime;
      stateRef.current.lastTime = now;
      setPct((prev) => {
        const target = stateRef.current.target;
        if (prev >= target) return prev;
        // Speed: 15%/sec for normal phases, 40%/sec for 'done' to finish fast
        const speed = target >= 100 ? 40 : 15;
        const step = (speed * dt) / 1000;
        return Math.min(target, prev + step);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden" style={{ borderRadius: '9999px' }}>
      {/* Shimmer sweep */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, width: '40%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
        animation: 'pill-sweep 2s ease-in-out infinite',
      }} />
      {/* Center label */}
      <span className="relative z-10 text-[11px] font-medium text-white/50 tracking-wide">
        {t('overlay.processing')}
      </span>
      {/* Full-width progress bar at bottom edge */}
      <div className="absolute bottom-0 left-0 right-0" style={{ height: '2px', background: 'rgba(255,255,255,0.08)' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: 'rgba(255,255,255,0.45)',
          transition: 'width 120ms linear',
          borderRadius: '0 1px 1px 0',
        }} />
      </div>
    </div>
  );
}

// ─── Fallback View ───────────────────────────────────────────────────────────

function FallbackView({ text, copied, onCopy, onDismiss, t }: {
  text: string; copied: boolean; onCopy: () => void; onDismiss: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="w-full mx-1 rounded-2xl flex flex-col gap-2 px-3 py-2.5" style={{ background: '#000', border: '1.5px solid rgba(255,255,255,0.18)' }}>
      <button onClick={onCopy} className="text-left w-full cursor-pointer active:opacity-70 transition-opacity">
        <p className="text-[11px] text-white/90 leading-relaxed line-clamp-3">{text}</p>
      </button>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/40">
          {copied ? t('overlay.copiedToClipboard') : t('overlay.tapToCopy')}
        </span>
        <button onClick={onDismiss} className="px-2 py-1 rounded-md text-[10px] text-white/50 hover:text-white/80 transition-colors">
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}

// ─── Waveform Bars ───────────────────────────────────────────────────────────

const BAR_COUNT = 9;

const WaveformBars = memo(function WaveformBars({ level }: { level: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const levelRef = useRef(level);
  const smoothed = useRef(0);
  const envelope = useRef(0);
  levelRef.current = level;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const bars = Array.from(container.children) as HTMLDivElement[];
    const center = (BAR_COUNT - 1) / 2;
    let raf: number;

    const animate = () => {
      smoothed.current = smoothed.current * 0.75 + levelRef.current * 0.25;
      envelope.current = Math.max(smoothed.current, envelope.current * 0.90);
      const lv = envelope.current;

      if (lv < 0.10) {
        bars.forEach(bar => {
          bar.style.height = '3px';
          bar.style.width = '3px';
          bar.style.borderRadius = '1.5px';
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
        });
      }
      raf = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={containerRef} className="flex items-center justify-center" style={{ gap: '2.5px', height: '28px' }}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div key={i} style={{ width: '3px', height: '3px', borderRadius: '1.5px', background: 'white', opacity: 0.28 }} />
      ))}
    </div>
  );
});
