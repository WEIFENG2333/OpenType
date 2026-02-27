import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioRecorder } from '../services/audioRecorder';
import { runPipeline } from '../services/pipeline';
import { useConfigStore } from '../stores/configStore';
import { HistoryItem } from '../types/config';

export interface RecorderState {
  status: 'idle' | 'recording' | 'processing';
  duration: number;
  audioLevel: number;
  rawText: string;
  processedText: string;
  error: string | null;
}

export function useRecorder() {
  const config = useConfigStore((s) => s.config);
  const addHistoryItem = useConfigStore((s) => s.addHistoryItem);

  const [state, setState] = useState<RecorderState>({
    status: 'idle',
    duration: 0,
    audioLevel: 0,
    rawText: '',
    processedText: '',
    error: null,
  });

  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);

  const startRecording = useCallback(async () => {
    try {
      setState((s) => ({ ...s, error: null, rawText: '', processedText: '', status: 'recording', duration: 0 }));

      // Pre-flight: check microphone permission in Electron
      if (window.electronAPI) {
        const status = await window.electronAPI.checkMicPermission();
        if (status === 'denied' || status === 'restricted') {
          setState((s) => ({ ...s, status: 'idle', error: 'Microphone access denied. Please grant microphone permission in System Settings.' }));
          return;
        }
        if (status === 'not-determined') {
          const granted = await window.electronAPI.requestMicPermission();
          if (!granted) {
            setState((s) => ({ ...s, status: 'idle', error: 'Microphone permission is required for voice dictation.' }));
            return;
          }
        }
      }

      const recorder = new AudioRecorder();
      recorderRef.current = recorder;

      await recorder.start((level) => {
        setState((s) => ({ ...s, audioLevel: level }));
      });

      startTimeRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        setState((s) => ({ ...s, duration: (Date.now() - startTimeRef.current) / 1000 }));
      }, 100);
    } catch (e: any) {
      setState((s) => ({ ...s, status: 'idle', error: `Microphone error: ${e.message}` }));
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recorderRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const durationMs = Date.now() - startTimeRef.current;
    setState((s) => ({ ...s, status: 'processing', audioLevel: 0 }));

    try {
      const audioBuffer = await recorderRef.current.stop();
      recorderRef.current = null;

      const result = await runPipeline(audioBuffer, config);

      if (result.success && !result.skipped) {
        setState((s) => ({
          ...s,
          status: 'idle',
          rawText: result.rawText,
          processedText: result.processedText,
        }));

        // Save to history
        const wordCount = result.processedText.split(/\s+/).filter(Boolean).length;
        const item: HistoryItem = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          timestamp: Date.now(),
          rawText: result.rawText,
          processedText: result.processedText,
          durationMs,
          wordCount,
        };
        addHistoryItem(item);
      } else if (result.skipped) {
        setState((s) => ({ ...s, status: 'idle', error: 'No speech detected' }));
      } else {
        setState((s) => ({ ...s, status: 'idle', error: result.error || 'Processing failed' }));
      }
    } catch (e: any) {
      setState((s) => ({ ...s, status: 'idle', error: e.message }));
    }
  }, [config, addHistoryItem]);

  const toggleRecording = useCallback(async () => {
    if (state.status === 'recording') {
      await stopRecording();
    } else if (state.status === 'idle') {
      await startRecording();
    }
  }, [state.status, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { ...state, startRecording, stopRecording, toggleRecording };
}
