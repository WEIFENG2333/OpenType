import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioRecorder } from '../services/audioRecorder';
import { runPipeline } from '../services/pipeline';
import { useConfigStore } from '../stores/configStore';
import { HistoryItem, getSTTProviderOpts, getSTTModelMode } from '../types/config';
import { countWords } from '../utils/wordCount';
import { errMsg } from '../utils/errMsg';

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
    // Close AudioContext when done — fallback timeout prevents leak if onended doesn't fire
    const close = () => { try { ctx.close(); } catch {} };
    osc.onended = close;
    setTimeout(close, (duration + 0.5) * 1000);
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
  streamingText: string;
  pipelinePhase: string | null; // 'stt-streaming' | 'stt' | 'llm' | 'done' | null
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
    streamingText: '',
    pipelinePhase: null,
  });

  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const generationRef = useRef(0);
  const stopRecordingRef = useRef<() => void>(() => {});
  const isStreamingRef = useRef(false);

  const startRecording = useCallback(async () => {
    try {
      // Defensive cleanup: if a previous recorder is still lingering, stop it
      if (recorderRef.current) {
        try { recorderRef.current.stop().catch(() => {}); } catch {}
        recorderRef.current = null;
      }
      setState((s) => ({ ...s, error: null, rawText: '', processedText: '', outputFailed: false, status: 'recording', duration: 0, streamingText: '', pipelinePhase: null }));
      isStreamingRef.current = false;

      // Pre-flight: check microphone permission in Electron
      if (window.electronAPI) {
        const status = await window.electronAPI.checkMicPermission();
        if (status === 'denied' || status === 'restricted') {
          setState((s) => ({ ...s, status: 'idle', error: 'Microphone access denied. Please grant microphone permission in System Settings.' }));
          window.electronAPI.cancelRealtimeSTT(); // sync main process state.isRecording = false
          return;
        }
        if (status === 'not-determined') {
          const granted = await window.electronAPI.requestMicPermission();
          if (!granted) {
            setState((s) => ({ ...s, status: 'idle', error: 'Microphone permission is required for voice dictation.' }));
            window.electronAPI.cancelRealtimeSTT();
            return;
          }
        }
      }

      // Start Realtime STT only if the selected model is streaming
      let useStreaming = false;
      let sttSampleRate = 24000;
      const currentCfg = configRef.current;
      const sttModel = getSTTProviderOpts(currentCfg).model;
      const isStreamingModel = sttModel && getSTTModelMode(currentCfg.sttProvider, sttModel) === 'streaming';

      if (window.electronAPI && isStreamingModel) {
        try {
          const r = await window.electronAPI.startRealtimeSTT();
          useStreaming = r.success;
          if (r.sampleRate) sttSampleRate = r.sampleRate;
        } catch {}
      }
      isStreamingRef.current = useStreaming;
      if (useStreaming) {
        setState((s) => ({ ...s, pipelinePhase: 'stt-streaming' }));
      }

      const recorder = new AudioRecorder();
      recorderRef.current = recorder;

      await recorder.start(
        (level) => setState((s) => ({ ...s, audioLevel: level })),
        useStreaming
          ? (pcm16Base64) => window.electronAPI?.sendAudioChunk(pcm16Base64)
          : undefined,
        sttSampleRate,
        configRef.current.selectedMicrophoneId || undefined,
      );

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
    } catch (e) {
      setState((s) => ({ ...s, status: 'idle', error: `Microphone error: ${errMsg(e)}` }));
      window.electronAPI?.cancelRealtimeSTT(); // sync main process state.isRecording = false
    }
  }, []);

  const stopRecording = useCallback(async () => {
    // Capture recorder locally — prevents a concurrent startRecording() from
    // creating a new recorder that we then accidentally null out after await
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null; // release ref immediately so startRecording can proceed

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
      const audioBuffer = await recorder.stop();

      // Save audio to file (not inline base64 — keeps config.json small)
      let audioPath: string | undefined;
      if (window.electronAPI) {
        try {
          const audioBytes = new Uint8Array(audioBuffer);
          // Use Blob + FileReader for safe base64 encoding (no stack overflow on large audio)
          const b64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              resolve(dataUrl.split(',')[1] || '');
            };
            reader.onerror = reject;
            reader.readAsDataURL(new Blob([audioBytes], { type: 'audio/wav' }));
          });
          const filename = `audio-${Date.now()}.wav`;
          audioPath = await window.electronAPI.saveMedia(filename, b64);
        } catch (e) {
          console.error('Failed to save audio:', e);
          // Continue without audioPath — pipeline still runs
        }
      }

      // Run pipeline + get context in parallel.
      // getLastContext has 10s timeout to prevent permanent hang if osascript stalls.
      const contextWithTimeout = window.electronAPI
        ? Promise.race([
            window.electronAPI.getLastContext(),
            new Promise<Record<string, any>>((resolve) => setTimeout(() => resolve({}), 10000)),
          ])
        : Promise.resolve({} as Record<string, any>);

      const [result, context] = await Promise.all([
        runPipeline(audioBuffer, configRef.current),
        contextWithTimeout,
      ]);

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
        contextL0Enabled: configRef.current.contextL0Enabled,
        contextL1Enabled: configRef.current.contextL1Enabled,
        contextOcrEnabled: configRef.current.contextOcrEnabled,
        systemPrompt: result.systemPrompt,
        sttProvider: result.sttProvider,
        llmProvider: result.llmProvider,
        sttModel: result.sttModel,
        llmModel: result.llmModel,
        sttDurationMs: result.sttDurationMs,
        llmDurationMs: result.llmDurationMs,
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
            if (!outputSuccess) {
              // Paste failed — write to clipboard as fallback (restore already happened immediately)
              await window.electronAPI.writeClipboard(text);
            } else if (configRef.current.alsoWriteClipboard) {
              // Wait for typeAtCursor's 500ms clipboard restore to complete, then write
              setTimeout(() => window.electronAPI?.writeClipboard(text), 600);
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
    } catch (e) {
      if (generationRef.current !== gen) return;
      setState((s) => ({ ...s, status: 'idle', error: errMsg(e) }));
    }
  }, [addHistoryItem]);

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
    // Cancel Realtime STT session if active
    if (isStreamingRef.current) {
      window.electronAPI?.cancelRealtimeSTT();
      isStreamingRef.current = false;
    }
    // Stop recorder without processing the audio
    if (recorderRef.current) {
      try { recorderRef.current.stop().catch(() => {}); } catch {}
      recorderRef.current = null;
    }
    setState({ status: 'idle', duration: 0, audioLevel: 0, rawText: '', processedText: '', error: null, outputFailed: false, streamingText: '', pipelinePhase: null });
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

  // Listen for streaming STT deltas and pipeline phase changes
  useEffect(() => {
    if (!window.electronAPI) return;
    const cleanups = [
      window.electronAPI.onSttDelta((data) => {
        setState((s) => ({ ...s, streamingText: data.accumulated }));
      }),
      window.electronAPI.onPipelinePhase((phase) => {
        setState((s) => ({ ...s, pipelinePhase: phase }));
      }),
    ];
    return () => cleanups.forEach((c) => c());
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    };
  }, []);

  return { ...state, startRecording, stopRecording, toggleRecording, cancelRecording };
}
