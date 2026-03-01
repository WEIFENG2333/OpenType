import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioRecorder, prewarmMicrophone } from '../services/audioRecorder';
import { runPipeline } from '../services/pipeline';
import { useConfigStore } from '../stores/configStore';
import { HistoryItem } from '../types/config';
import { countWords } from '../utils/wordCount';

function playBeep(freq: number, duration: number, volume = 0.25) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    osc.onended = () => ctx.close();
  } catch {}
}

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
  const configRef = useRef(config);
  configRef.current = config;

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
  const maxTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const generationRef = useRef(0);
  const stopRecordingRef = useRef<() => void>(() => {});

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

      if (configRef.current.soundEnabled) playBeep(880, 0.12);
      startTimeRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        setState((s) => ({ ...s, duration: (Date.now() - startTimeRef.current) / 1000 }));
      }, 100);
      // Auto-stop after 10 minutes
      maxTimerRef.current = window.setTimeout(() => {
        maxTimerRef.current = null;
        stopRecordingRef.current();
      }, 600000);
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
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }

    const durationMs = Date.now() - startTimeRef.current;
    const gen = generationRef.current;
    if (configRef.current.soundEnabled) playBeep(520, 0.15);
    setState((s) => ({ ...s, status: 'processing', audioLevel: 0 }));

    try {
      const audioBuffer = await recorderRef.current.stop();
      recorderRef.current = null;

      // Save audio to file (not inline base64 — keeps config.json small)
      let audioPath: string | undefined;
      if (window.electronAPI) {
        const audioBytes = new Uint8Array(audioBuffer);
        let raw = '';
        const CHUNK = 8192;
        for (let i = 0; i < audioBytes.length; i += CHUNK) {
          raw += String.fromCharCode(...audioBytes.subarray(i, i + CHUNK));
        }
        const b64 = btoa(raw);
        const filename = `audio-${Date.now()}.wav`;
        audioPath = await window.electronAPI.saveMedia(filename, b64);
      }

      // Get context captured at hotkey press time
      const context = window.electronAPI
        ? await window.electronAPI.getLastContext()
        : {};

      const result = await runPipeline(audioBuffer, config, context);

      const isStale = generationRef.current !== gen;

      // Save screenshot to file if present
      let screenshotPath: string | undefined;
      if (window.electronAPI && context.screenshotDataUrl) {
        const match = context.screenshotDataUrl.match(/base64,(.+)/);
        if (match) {
          const fname = `screenshot-${Date.now()}.jpg`;
          screenshotPath = await window.electronAPI.saveMedia(fname, match[1]);
        }
      }

      // Helper to build context object for history
      const buildContext = (full: boolean) => ({
        appName: context.appName,
        windowTitle: context.windowTitle,
        bundleId: context.bundleId,
        url: context.url,
        ...(full ? {
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
          clipboardText: context.clipboardText,
          recentTranscriptions: context.recentTranscriptions,
          screenContext: context.screenContext,
          screenshotPath,
          ocrDurationMs: context.ocrDurationMs,
        } : {}),
        contextL0Enabled: config.contextL0Enabled,
        contextL1Enabled: config.contextL1Enabled,
        contextOcrEnabled: config.contextOcrEnabled,
        systemPrompt: result.systemPrompt,
        sttProvider: result.sttProvider,
        llmProvider: result.llmProvider,
        sttModel: result.sttModel,
        llmModel: result.llmModel,
        sttDurationMs: result.sttDurationMs,
        llmDurationMs: result.llmDurationMs,
        autoLearnedTerms: result.autoLearnedTerms,
      });

      if (result.success && !result.skipped) {
        const text = result.processedText;

        // Only output text and update UI if this generation is still current
        if (!isStale) {
          let outputSuccess = false;
          if (window.electronAPI) {
            try {
              const r = await window.electronAPI.typeAtCursor(text);
              outputSuccess = r.success;
            } catch {
              outputSuccess = false;
            }
            if (config.alsoWriteClipboard || !outputSuccess) {
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
            outputFailed: !outputSuccess,
          }));
        }

        // Always save to history, even if stale
        const wordCount = countWords(result.processedText);
        const item: HistoryItem = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          timestamp: Date.now(),
          rawText: result.rawText,
          processedText: result.processedText,
          durationMs,
          wordCount,
          audioPath,
          sourceApp: context.appName,
          windowTitle: context.windowTitle,
          context: buildContext(true),
        };
        addHistoryItem(item);
      } else if (result.skipped) {
        if (!isStale) {
          setState((s) => ({ ...s, status: 'idle', error: 'No speech detected' }));
        }
        // Save skipped to history
        const skipItem: HistoryItem = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          timestamp: Date.now(),
          rawText: '',
          processedText: '',
          durationMs,
          wordCount: 0,
          audioPath,
          error: 'No speech detected',
          sourceApp: context.appName,
          windowTitle: context.windowTitle,
          context: buildContext(false),
        };
        addHistoryItem(skipItem);
      } else {
        const errorMsg = result.error || 'Processing failed';
        if (!isStale) {
          setState((s) => ({ ...s, status: 'idle', error: errorMsg }));
        }
        // Always save failed to history
        const failItem: HistoryItem = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          timestamp: Date.now(),
          rawText: result.rawText || '',
          processedText: '',
          durationMs,
          wordCount: 0,
          audioPath,
          error: errorMsg,
          sourceApp: context.appName,
          windowTitle: context.windowTitle,
          context: buildContext(false),
        };
        addHistoryItem(failItem);
      }
    } catch (e: any) {
      if (generationRef.current !== gen) return;
      setState((s) => ({ ...s, status: 'idle', error: e.message }));
    }
  }, [config, addHistoryItem]);

  stopRecordingRef.current = stopRecording;

  const cancelRecording = useCallback(() => {
    // Bump generation so any in-flight pipeline result is discarded
    generationRef.current++;
    // Stop timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    // Stop recorder without processing the audio
    if (recorderRef.current) {
      try { recorderRef.current.stop().catch(() => {}); } catch {}
      recorderRef.current = null;
    }
    setState({ status: 'idle', duration: 0, audioLevel: 0, rawText: '', processedText: '', error: null, outputFailed: false });
  }, []);

  const toggleRecording = useCallback(async () => {
    if (state.status === 'recording') {
      await stopRecording();
    } else {
      // Works from both 'idle' and 'processing' — if processing, bump
      // generation so the stale pipeline result gets discarded
      if (state.status === 'processing') {
        generationRef.current++;
      }
      await startRecording();
    }
  }, [state.status, startRecording, stopRecording]);

  // Pre-warm microphone on mount so first recording starts instantly
  useEffect(() => {
    prewarmMicrophone();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    };
  }, []);

  return { ...state, startRecording, stopRecording, toggleRecording, cancelRecording };
}
