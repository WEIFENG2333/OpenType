import { useEffect } from 'react';
import { useRecorder } from '../hooks/useRecorder';

export function OverlayPage() {
  const rec = useRecorder();

  useEffect(() => {
    if (!window.electronAPI) return;
    return window.electronAPI.onToggleRecording(() => rec.toggleRecording());
  }, [rec.toggleRecording]);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-3">
      <div className="bg-surface-900/95 backdrop-blur-xl border border-surface-700/50 rounded-2xl pl-4 pr-3 py-3 shadow-2xl flex items-center gap-3 w-full">
        {/* Status dot */}
        <div className="relative flex-shrink-0">
          {rec.status === 'recording' && (
            <div className="absolute inset-0 rounded-full bg-red-500/20 animate-pulse-ring" />
          )}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors
            ${rec.status === 'recording' ? 'bg-red-500' : rec.status === 'processing' ? 'bg-brand-500' : 'bg-surface-700'}`}>
            {rec.status === 'recording' ? (
              <div className="flex items-end gap-[2px] h-4">
                {[0,1,2,3,4].map((i) => (
                  <div key={i} className={`w-[2px] bg-white rounded-full animate-wave-${i + 1}`}
                    style={{ height: `${Math.max(3, rec.audioLevel * 16)}px` }} />
                ))}
              </div>
            ) : rec.status === 'processing' ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-surface-200 truncate">
            {rec.status === 'recording' ? 'Listening...' :
             rec.status === 'processing' ? 'Processing...' :
             rec.processedText || 'OpenType'}
          </p>
          <p className="text-[11px] text-surface-500 truncate">
            {rec.status === 'recording' ? fmt(rec.duration) :
             rec.status === 'processing' ? 'Transcribing & polishing' :
             rec.error || 'Press hotkey to start'}
          </p>
        </div>

        {/* Close */}
        <button
          onClick={() => window.electronAPI?.hideOverlay()}
          className="text-surface-600 hover:text-surface-300 p-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  );
}
