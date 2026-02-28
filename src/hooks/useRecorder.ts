import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioRecorder } from '../services/audioRecorder';
import { runPipeline } from '../services/pipeline';
import { useConfigStore } from '../stores/configStore';
import { HistoryItem } from '../types/config';
import { countWords } from '../utils/wordCount';

export interface RecorderState {
  status: 'idle' | 'recording' | 'processing';
  duration: number;
  audioLevel: number;
  rawText: string;
  processedText: string;
  error: string | null;
  outputFailed: boolean;
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
    outputFailed: false,
  });

  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);

  const startRecording = useCallback(async () => {
    try {
      setState((s) => ({ ...s, error: null, rawText: '', processedText: '', outputFailed: false, status: 'recording', duration: 0 }));

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

      // Get context captured at hotkey press time
      const context = window.electronAPI
        ? await window.electronAPI.getLastContext()
        : {};

      const result = await runPipeline(audioBuffer, config, context);

      if (result.success && !result.skipped) {
        const text = result.processedText;

        // Output text based on outputMode
        let outputSuccess = false;
        if (window.electronAPI) {
          if (config.outputMode === 'cursor') {
            try {
              const r = await window.electronAPI.typeAtCursor(text);
              outputSuccess = r.success;
            } catch {
              outputSuccess = false;
            }
          }
          // Clipboard mode, or cursor mode failed -> copy to clipboard
          if (!outputSuccess) {
            await window.electronAPI.writeClipboard(text);
          }
        } else {
          try { await navigator.clipboard.writeText(text); } catch {}
        }

        setState((s) => ({
          ...s,
          status: 'idle',
          rawText: result.rawText,
          processedText: result.processedText,
          outputFailed: config.outputMode === 'cursor' && !outputSuccess,
        }));

        // Save to history with full context
        const wordCount = countWords(result.processedText);
        const item: HistoryItem = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          timestamp: Date.now(),
          rawText: result.rawText,
          processedText: result.processedText,
          durationMs,
          wordCount,
          sourceApp: context.appName,
          windowTitle: context.windowTitle,
          context: {
            // L0
            appName: context.appName,
            windowTitle: context.windowTitle,
            bundleId: context.bundleId,
            url: context.url,
            // L1
            selectedText: context.selectedText,
            fieldText: context.fieldText,
            fieldRole: context.fieldRole,
            fieldRoleDescription: context.fieldRoleDescription,
            fieldLabel: context.fieldLabel,
            fieldPlaceholder: context.fieldPlaceholder,
            cursorPosition: context.cursorPosition,
            selectionRange: context.selectionRange,
            numberOfCharacters: context.numberOfCharacters,
            insertionLineNumber: context.insertionLineNumber,
            // Clipboard & recent
            clipboardText: context.clipboardText,
            recentTranscriptions: context.recentTranscriptions,
            // OCR
            screenContext: context.screenContext,
            // Don't save screenshot to history (too large for JSON config)
            // Feature flags
            contextL0Enabled: config.contextL0Enabled,
            contextL1Enabled: config.contextL1Enabled,
            contextOcrEnabled: config.contextOcrEnabled,
            // Pipeline metadata
            systemPrompt: result.systemPrompt,
            sttProvider: result.sttProvider,
            llmProvider: result.llmProvider,
            sttModel: result.sttModel,
            llmModel: result.llmModel,
            // Timing
            sttDurationMs: result.sttDurationMs,
            llmDurationMs: result.llmDurationMs,
            // Auto-learned terms
            autoLearnedTerms: result.autoLearnedTerms,
          },
        };
        addHistoryItem(item);
      } else if (result.skipped) {
        setState((s) => ({ ...s, status: 'idle', error: 'No speech detected' }));
      } else {
        const errorMsg = result.error || 'Processing failed';
        setState((s) => ({ ...s, status: 'idle', error: errorMsg }));

        // Save failed transcription to history
        const failItem: HistoryItem = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          timestamp: Date.now(),
          rawText: result.rawText || '',
          processedText: '',
          durationMs,
          wordCount: 0,
          error: errorMsg,
          sourceApp: context.appName,
          windowTitle: context.windowTitle,
          context: {
            appName: context.appName,
            windowTitle: context.windowTitle,
            bundleId: context.bundleId,
            url: context.url,
            contextL0Enabled: config.contextL0Enabled,
            contextL1Enabled: config.contextL1Enabled,
            contextOcrEnabled: config.contextOcrEnabled,
            sttProvider: result.sttProvider,
            llmProvider: result.llmProvider,
            sttModel: result.sttModel,
            llmModel: result.llmModel,
            sttDurationMs: result.sttDurationMs,
            llmDurationMs: result.llmDurationMs,
          },
        };
        addHistoryItem(failItem);
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
