interface RecordButtonProps {
  status: 'idle' | 'recording' | 'processing';
  audioLevel: number;
  duration: number;
  onClick: () => void;
}

export function RecordButton({ status, audioLevel, duration, onClick }: RecordButtonProps) {
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Button with animated rings */}
      <div className="relative flex items-center justify-center">
        {status === 'recording' && (
          <>
            <div className="absolute w-28 h-28 rounded-full bg-red-500/10 animate-pulse-ring" />
            <div className="absolute w-28 h-28 rounded-full bg-red-500/5 animate-pulse-ring" style={{ animationDelay: '0.4s' }} />
          </>
        )}
        {status === 'processing' && (
          <div className="absolute w-28 h-28 rounded-full border-2 border-brand-500/30 border-t-brand-500 animate-spin" />
        )}

        <button
          onClick={onClick}
          disabled={status === 'processing'}
          className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg
            ${status === 'recording'
              ? 'bg-red-500 hover:bg-red-600 shadow-red-500/25 scale-110'
              : status === 'processing'
              ? 'bg-surface-700 cursor-wait'
              : 'bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-400 hover:to-brand-600 shadow-brand-600/25 hover:scale-105 active:scale-95'
            }`}
        >
          {status === 'recording' ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
          ) : status === 'processing' ? (
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0s' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0.15s' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="22"/>
            </svg>
          )}
        </button>
      </div>

      {/* Status area */}
      <div className="text-center min-h-[72px] flex flex-col items-center justify-center">
        {status === 'recording' && (
          <div className="flex flex-col items-center gap-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 text-sm font-medium">Recording</span>
            </div>
            <span className="text-2xl font-mono text-surface-300 tracking-wider">{fmt(duration)}</span>
            {/* Audio waveform */}
            <div className="flex items-end gap-[3px] h-6">
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[3px] bg-red-400/80 rounded-full transition-all duration-75"
                  style={{
                    height: `${Math.max(3, (Math.sin(Date.now() / 200 + i * 0.5) * 0.5 + 0.5) * audioLevel * 24)}px`,
                    opacity: audioLevel > 0.05 ? 0.4 + audioLevel * 0.6 : 0.2,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {status === 'processing' && (
          <div className="flex flex-col items-center gap-2 animate-fade-in">
            <span className="text-brand-400 text-sm font-medium">Processing...</span>
            <span className="text-xs text-surface-500">Transcribing & polishing your text</span>
          </div>
        )}

        {status === 'idle' && (
          <div className="flex flex-col items-center gap-2">
            <span className="text-surface-400 text-sm font-medium">Click to start dictation</span>
            <kbd className="px-2 py-0.5 bg-surface-800 rounded text-[11px] text-surface-500 border border-surface-700 font-mono">
              Ctrl+Shift+Space
            </kbd>
          </div>
        )}
      </div>
    </div>
  );
}
