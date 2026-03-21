/**
 * Electron main-process STT service.
 * Supports batch transcription (REST) and real-time streaming (WebSocket).
 *
 * Real-time protocols:
 * - OpenAI Realtime API (gpt-4o-transcribe)
 * - DashScope Qwen-ASR (OpenAI-compatible, qwen3-asr-flash-realtime)
 * - DashScope Paraformer/FunASR (native inference protocol)
 */

import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import { AppConfig, getSTTProviderOpts, getProviderConfig, getSTTModelMode, getSTTModelDef, getDefaultBatchProtocol, STTProtocol } from '../src/types/config';

// ─── Public interface for all realtime sessions ─────────────────────────────

export interface IRealtimeSession {
  readonly sampleRate: number;
  onDelta: ((delta: string, accumulated: string) => void) | null;
  onError: ((error: string) => void) | null;
  connect(): Promise<void>;
  sendAudio(pcm16Base64: string): void;
  commit(): Promise<string>;
  getAccumulated(): string;
  close(): void;
}

// ─── DashScope protocol routing is now data-driven via STTModelDef.protocol ──

// ═════════════════════════════════════════════════════════════════════════════
// Protocol 1: OpenAI-compatible Realtime (OpenAI + DashScope Qwen-ASR)
// ═════════════════════════════════════════════════════════════════════════════

interface OpenAIRealtimeConfig {
  wsUrl: string;
  headers: Record<string, string>;
  sampleRate: number;
  sessionUpdateEvent: any;
  sessionReadyTypes: string[];
  deltaType: string;
  completedType: string;
  extractDelta: (event: any, accumulated: string) => { text: string; accumulated: string };
  extractTranscript: (event: any) => string;
  usesVAD: boolean;
  finishEvent?: any;
  commitEvent?: any;
}

export function buildOpenAIConfig(apiKey: string, model: string): OpenAIRealtimeConfig {
  return {
    wsUrl: 'wss://api.openai.com/v1/realtime?intent=transcription',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'OpenAI-Beta': 'realtime=v1' },
    sampleRate: 24000,
    sessionUpdateEvent: {
      type: 'transcription_session.update',
      session: {
        input_audio_format: 'pcm16',
        input_audio_transcription: { model, language: 'zh' },
        turn_detection: null,
        input_audio_noise_reduction: { type: 'near_field' },
      },
    },
    sessionReadyTypes: ['transcription_session.created', 'transcription_session.updated'],
    deltaType: 'conversation.item.input_audio_transcription.delta',
    completedType: 'conversation.item.input_audio_transcription.completed',
    extractDelta: (event, accumulated) => {
      const delta = event.delta || '';
      return { text: delta, accumulated: accumulated + delta };
    },
    extractTranscript: (event) => event.transcript || '',
    usesVAD: false,
    commitEvent: { type: 'input_audio_buffer.commit' },
  };
}

export function buildQwenASRConfig(apiKey: string, model: string, baseUrl: string): OpenAIRealtimeConfig {
  return {
    wsUrl: `${baseUrl}?model=${model}`,
    headers: { 'Authorization': `Bearer ${apiKey}`, 'OpenAI-Beta': 'realtime=v1' },
    sampleRate: 16000,
    sessionUpdateEvent: {
      event_id: 'evt_session',
      type: 'session.update',
      session: {
        modalities: ['text'],
        input_audio_format: 'pcm',
        sample_rate: 16000,
        input_audio_transcription: { language: 'zh' },
        turn_detection: { type: 'server_vad', threshold: 0.0, silence_duration_ms: 400 },
      },
    },
    sessionReadyTypes: ['session.created', 'session.updated'],
    deltaType: 'conversation.item.input_audio_transcription.text',
    completedType: 'conversation.item.input_audio_transcription.completed',
    extractDelta: (_event) => {
      const confirmed = _event.text || '';
      const stash = _event.stash || '';
      return { text: stash, accumulated: confirmed + stash };
    },
    extractTranscript: (event) => event.transcript || '',
    usesVAD: true,
    finishEvent: { event_id: 'evt_finish', type: 'session.finish' },
  };
}

/** OpenAI-compatible realtime session (OpenAI + DashScope Qwen-ASR) */
class OpenAIRealtimeSession implements IRealtimeSession {
  private ws: WebSocket | null = null;
  private accumulated = '';
  private allTranscripts: string[] = [];
  private ready = false;
  private readyResolve: (() => void) | null = null;
  private completeResolve: ((text: string) => void) | null = null;
  private finishedResolve: ((text: string) => void) | null = null;
  private commitTimeout: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  onDelta: ((delta: string, accumulated: string) => void) | null = null;
  onError: ((error: string) => void) | null = null;

  get sampleRate(): number { return this.config.sampleRate; }

  constructor(private config: OpenAIRealtimeConfig) {}

  connect(): Promise<void> {
    if (this.ws) return Promise.reject(new Error('Session already connected'));

    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void) => { if (!settled) { settled = true; fn(); } };

      this.ws = new WebSocket(this.config.wsUrl, { headers: this.config.headers });

      const timeout = setTimeout(() => {
        settle(() => reject(new Error('Realtime STT connection timeout')));
        this.close();
      }, 10000);

      this.readyResolve = () => { clearTimeout(timeout); settle(() => resolve()); };

      this.ws.on('open', () => {
        this.ws!.send(JSON.stringify(this.config.sessionUpdateEvent));
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        if (this.closed) return;
        this.handleEvent(JSON.parse(data.toString()));
      });

      this.ws.on('error', (err: Error) => {
        console.error('[OpenAIRealtime] error:', err.message);
        clearTimeout(timeout);
        settle(() => reject(err));
        this.onError?.(err.message);
      });

      this.ws.on('close', (code: number) => {
        console.log(`[OpenAIRealtime] closed: code=${code}`);
        this.ws = null;
        if (this.finishedResolve) {
          this.finishedResolve(this.getFinalText());
          this.finishedResolve = null;
        }
      });
    });
  }

  private handleEvent(event: any) {
    const type = event.type;

    if (this.config.sessionReadyTypes.includes(type)) {
      if (!this.ready) {
        this.ready = true;
        this.readyResolve?.();
        this.readyResolve = null;
      }
      return;
    }

    if (type === this.config.deltaType) {
      const result = this.config.extractDelta(event, this.accumulated);
      this.accumulated = result.accumulated;
      const display = this.config.usesVAD
        ? this.allTranscripts.join('') + result.accumulated
        : result.accumulated;
      this.onDelta?.(result.text, display);
      return;
    }

    if (type === this.config.completedType) {
      const transcript = this.config.extractTranscript(event);
      console.log('[OpenAIRealtime] completed:', transcript.slice(0, 100));
      if (this.config.usesVAD) {
        this.allTranscripts.push(transcript);
        this.accumulated = '';
        this.onDelta?.('', this.allTranscripts.join(''));
      }
      this.completeResolve?.(transcript);
      this.completeResolve = null;
      return;
    }

    if (type === 'session.finished') {
      this.finishedResolve?.(this.getFinalText());
      this.finishedResolve = null;
      return;
    }

    if (type === 'error') {
      console.error('[OpenAIRealtime] API error:', JSON.stringify(event.error || event));
      this.onError?.(event.error?.message || 'Realtime API error');
      this.close(); // close WS on server-side error
      return;
    }

    // Silently ignore known internal events
    // Unknown events logged only in dev for debugging
  }

  sendAudio(pcm16Base64: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: pcm16Base64 }));
  }

  commit(): Promise<string> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return Promise.resolve(this.getFinalText());

    if (this.config.usesVAD) {
      return new Promise((resolve) => {
        this.finishedResolve = resolve;
        if (this.config.finishEvent) this.ws!.send(JSON.stringify(this.config.finishEvent));
        this.commitTimeout = setTimeout(() => {
          if (this.finishedResolve) { this.finishedResolve = null; resolve(this.getFinalText()); this.close(); }
        }, 30000);
      });
    }

    return new Promise((resolve) => {
      this.completeResolve = resolve;
      if (this.config.commitEvent) this.ws!.send(JSON.stringify(this.config.commitEvent));
      this.commitTimeout = setTimeout(() => {
        if (this.completeResolve) { this.completeResolve = null; resolve(this.getFinalText()); this.close(); }
      }, 30000);
    });
  }

  private getFinalText(): string {
    return this.allTranscripts.length > 0
      ? this.allTranscripts.join('') + this.accumulated
      : this.accumulated;
  }

  getAccumulated(): string { return this.getFinalText(); }

  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.commitTimeout) { clearTimeout(this.commitTimeout); this.commitTimeout = null; }
    if (this.ws) {
      this.ws.removeAllListeners();
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    const text = this.getFinalText();
    this.readyResolve = null;
    this.completeResolve?.(text); this.completeResolve = null;
    this.finishedResolve?.(text); this.finishedResolve = null;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Protocol 2: DashScope native inference (Paraformer/FunASR)
// Uses: wss://dashscope.aliyuncs.com/api-ws/v1/inference
// Audio sent as binary WebSocket frames (not base64 JSON).
// ═════════════════════════════════════════════════════════════════════════════

class ParaformerRealtimeSession implements IRealtimeSession {
  private ws: WebSocket | null = null;
  private taskId = randomUUID();
  private sentences: string[] = [];
  private currentSentence = '';
  private readyResolve: (() => void) | null = null;
  private finishedResolve: ((text: string) => void) | null = null;
  private commitTimeout: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  onDelta: ((delta: string, accumulated: string) => void) | null = null;
  onError: ((error: string) => void) | null = null;

  get sampleRate(): number { return this._sampleRate; }

  constructor(
    private apiKey: string,
    private model: string,
    private _sampleRate: number,
  ) {}

  connect(): Promise<void> {
    if (this.ws) return Promise.reject(new Error('Session already connected'));

    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void) => { if (!settled) { settled = true; fn(); } };

      this.ws = new WebSocket('wss://dashscope.aliyuncs.com/api-ws/v1/inference', {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });

      const timeout = setTimeout(() => {
        settle(() => reject(new Error('Paraformer connection timeout')));
        this.close();
      }, 10000);

      this.readyResolve = () => { clearTimeout(timeout); settle(() => resolve()); };

      this.ws.on('open', () => {
        this.ws!.send(JSON.stringify({
          header: { action: 'run-task', task_id: this.taskId, streaming: 'duplex' },
          payload: {
            task_group: 'audio',
            task: 'asr',
            function: 'recognition',
            model: this.model,
            parameters: {
              format: 'pcm',
              sample_rate: this._sampleRate,
              disfluency_removal_enabled: true,
              punctuation_prediction_enabled: true,
              inverse_text_normalization_enabled: true,
            },
            input: {},
          },
        }));
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        if (this.closed) return;
        try {
          this.handleEvent(JSON.parse(data.toString()));
        } catch {
          // Binary frame from server, ignore
        }
      });

      this.ws.on('error', (err: Error) => {
        console.error('[Paraformer] error:', err.message);
        clearTimeout(timeout);
        settle(() => reject(err));
        this.onError?.(err.message);
      });

      this.ws.on('close', (code: number) => {
        console.log(`[Paraformer] closed: code=${code}`);
        this.ws = null;
        if (this.finishedResolve) {
          this.finishedResolve(this.getFinalText());
          this.finishedResolve = null;
        }
      });
    });
  }

  private handleEvent(msg: any) {
    const event = msg.header?.event;

    if (event === 'task-started') {
      this.readyResolve?.();
      this.readyResolve = null;
      return;
    }

    if (event === 'result-generated') {
      const sentence = msg.payload?.output?.sentence;
      if (!sentence) return;

      // Some models use words[] instead of text (e.g. word-level timestamps)
      const text = sentence.text
        || sentence.words?.map((w: { text?: string }) => w.text ?? '').join('')
        || '';
      const isFinal = !!sentence.sentence_end;

      if (isFinal) {
        // Completed sentence — add to list, clear partial
        this.sentences.push(text);
        this.currentSentence = '';
      } else {
        // Partial — update current
        this.currentSentence = text;
      }

      const display = this.getFinalText();
      this.onDelta?.(text, display);
      return;
    }

    if (event === 'task-finished') {
      this.finishedResolve?.(this.getFinalText());
      this.finishedResolve = null;
      return;
    }

    if (event === 'task-failed') {
      const errMsg = msg.header?.error_message || msg.payload?.error_message || 'Paraformer task failed';
      console.error('[Paraformer] task failed:', errMsg);
      this.onError?.(errMsg);
      this.finishedResolve?.(this.getFinalText());
      this.finishedResolve = null;
      this.close(); // must close WS after task failure to prevent resource leak
      return;
    }

  }

  /** Send PCM16 audio. Accepts base64 (from renderer), converts to binary frame. */
  sendAudio(pcm16Base64: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // Paraformer expects raw binary frames, not base64 JSON
    const buf = Buffer.from(pcm16Base64, 'base64');
    this.ws.send(buf);
  }

  /** Send finish-task and wait for task-finished */
  commit(): Promise<string> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return Promise.resolve(this.getFinalText());

    return new Promise((resolve) => {
      this.finishedResolve = resolve;
      this.ws!.send(JSON.stringify({
        header: { action: 'finish-task', task_id: this.taskId, streaming: 'duplex' },
        payload: { input: {} },
      }));
      this.commitTimeout = setTimeout(() => {
        if (this.finishedResolve) {
          console.warn('[Paraformer] finish timeout');
          this.finishedResolve = null;
          resolve(this.getFinalText());
          this.close();
        }
      }, 30000);
    });
  }

  private getFinalText(): string {
    return this.sentences.join('') + this.currentSentence;
  }

  getAccumulated(): string { return this.getFinalText(); }

  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.commitTimeout) { clearTimeout(this.commitTimeout); this.commitTimeout = null; }
    if (this.ws) {
      this.ws.removeAllListeners();
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    const text = this.getFinalText();
    this.readyResolve = null;
    this.finishedResolve?.(text); this.finishedResolve = null;
  }
}

/** Extract human-readable error from API response body (JSON or plain text) */
function parseApiError(status: number, body: string): string {
  try {
    const json = JSON.parse(body);
    const msg = json?.error?.message || json?.message || json?.error || '';
    if (msg) return `${status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`;
  } catch {}
  return `${status}: ${body.slice(0, 200)}`;
}

// ═════════════════════════════════════════════════════════════════════════════
// STTService — public API
// ═════════════════════════════════════════════════════════════════════════════

export class STTService {
  /**
   * Batch transcribe audio. Protocol-driven dispatch from STTModelDef.protocol.
   */
  async transcribe(
    audioBuffer: Buffer,
    config: AppConfig,
    options?: { language?: string },
  ): Promise<string> {
    const provider = config.sttProvider;
    const { baseUrl, apiKey, model } = getSTTProviderOpts(config);
    if (!apiKey) throw new Error(`No API key for STT provider "${provider}"`);
    if (!model) throw new Error(`No STT model configured for "${provider}"`);

    const def = getSTTModelDef(provider, model);
    const protocol = def?.protocol ?? getDefaultBatchProtocol(provider);

    if (def?.mode === 'streaming') {
      throw new Error(`Model "${model}" is streaming-only. Recording will use streaming automatically.`);
    }

    switch (protocol) {
      case 'dashscope-batch':
        return this.transcribeDashScopeBatch(apiKey, model, audioBuffer, options);
      case 'openai-batch':
        return this.transcribeOpenAIBatch(provider, baseUrl, apiKey, model, audioBuffer, options);
      default:
        throw new Error(`Unsupported batch protocol "${protocol}" for model "${model}"`);
    }
  }

  /** DashScope batch via chat/completions + input_audio (Qwen3-ASR-Flash) */
  private async transcribeDashScopeBatch(
    apiKey: string, model: string, audioBuffer: Buffer, options?: { language?: string },
  ): Promise<string> {
    const base64Audio = `data:audio/wav;base64,${audioBuffer.toString('base64')}`;
    const url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    console.log(`[STT] dashscope batch → ${url} model=${model}`);

    const body: any = {
      model,
      messages: [{
        role: 'user',
        content: [{ type: 'input_audio', input_audio: { data: base64Audio } }],
      }],
      stream: false,
    };
    if (options?.language && options.language !== 'auto') {
      body.extra_body = { asr_options: { language: options.language } };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e: any) {
      clearTimeout(timeout);
      throw new Error(e.name === 'AbortError' ? 'DashScope STT request timed out (30s)' : e.message);
    }
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`DashScope STT ${parseApiError(res.status, await res.text().catch(() => ''))}`);
    }

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty DashScope STT response');
    return text;
  }

  /** Standard OpenAI-compatible batch via multipart /audio/transcriptions */
  private async transcribeOpenAIBatch(
    provider: string, baseUrl: string, apiKey: string, model: string,
    audioBuffer: Buffer, options?: { language?: string },
  ): Promise<string> {
    const formData = new FormData();
    const ab = audioBuffer.buffer.slice(audioBuffer.byteOffset, audioBuffer.byteOffset + audioBuffer.byteLength) as ArrayBuffer;
    formData.append('file', new Blob([ab], { type: 'audio/wav' }), 'recording.wav');
    formData.append('model', model);

    const lang = options?.language;
    if (lang && lang !== 'auto') formData.append('language', lang);

    const url = `${baseUrl}/audio/transcriptions`;
    console.log(`[STT] ${provider} → ${url} model=${model}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
        signal: controller.signal,
      });
    } catch (e: any) {
      clearTimeout(timeout);
      throw new Error(e.name === 'AbortError' ? 'STT request timed out (30s)' : e.message);
    }
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`STT ${parseApiError(res.status, await res.text().catch(() => ''))}`);
    }

    const json = await res.json();
    return json.text ?? '';
  }

  /** Check if current config uses a streaming model (data-driven from PROVIDERS) */
  supportsStreaming(config: AppConfig): boolean {
    const { model } = getSTTProviderOpts(config);
    if (!model) return false;
    return getSTTModelMode(config.sttProvider, model) === 'streaming';
  }

  /** Create a realtime session — protocol-driven from STTModelDef */
  createRealtimeSession(config: AppConfig): IRealtimeSession {
    const provider = config.sttProvider;
    const pc = getProviderConfig(config, provider);
    const { apiKey, sttModel: model } = pc;

    if (!apiKey) throw new Error(`No API key for STT provider "${provider}"`);
    if (!model) throw new Error(`No STT model configured for "${provider}"`);

    const def = getSTTModelDef(provider, model);
    const protocol: STTProtocol = def?.protocol ?? 'openai-realtime';
    const sampleRate = def?.sampleRate;

    console.log(`[STT] Creating realtime session: protocol=${protocol} model=${model}`);

    switch (protocol) {
      case 'paraformer-realtime': {
        const sr = sampleRate ?? (model.includes('8k') ? 8000 : 16000);
        return new ParaformerRealtimeSession(apiKey, model, sr);
      }
      case 'qwen-asr-realtime': {
        const wsUrl = 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime';
        return new OpenAIRealtimeSession(buildQwenASRConfig(apiKey, model, wsUrl));
      }
      case 'openai-realtime':
        return new OpenAIRealtimeSession(buildOpenAIConfig(apiKey, model));
      default:
        throw new Error(`Protocol "${protocol}" does not support streaming`);
    }
  }

  async testConnection(config: AppConfig): Promise<{ success: boolean; text?: string; error?: string }> {
    const t0 = Date.now();

    if (this.supportsStreaming(config)) {
      const session = this.createRealtimeSession(config);
      try {
        await session.connect();
        const pcm = makeTestPCM(session.sampleRate, 0.5);
        session.sendAudio(pcm.toString('base64'));
        await Promise.race([
          session.commit(),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Test timeout')), 15000)),
        ]);
        return { success: true, text: `${Date.now() - t0}ms` };
      } catch (e: any) {
        return { success: false, error: e.message };
      } finally {
        session.close();
      }
    }

    try {
      const wav = makeSilentWav(0.5);
      await this.transcribe(Buffer.from(wav), config);
      return { success: true, text: `${Date.now() - t0}ms` };
    } catch (e: any) {
      const msg = e.message || '';
      if (msg.includes('No speech') || msg.includes('no_speech') || msg.includes('empty')) {
        return { success: true, text: `${Date.now() - t0}ms` };
      }
      return { success: false, error: msg };
    }
  }
}

// ─── Test audio helpers ──────────────────────────────────────────────────────

function makeTestPCM(sampleRate: number, durationSec: number): Buffer {
  const numSamples = Math.floor(sampleRate * durationSec);
  const buf = Buffer.alloc(numSamples * 2);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const val = Math.sin(2 * Math.PI * 440 * t) * 0.3;
    const s = Math.max(-1, Math.min(1, val));
    buf.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7FFF, i * 2);
  }
  return buf;
}

function makeSilentWav(durationSec: number): ArrayBuffer {
  const sampleRate = 16000;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataBytes = numSamples * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const ascii = (off: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  ascii(0, 'RIFF'); v.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE'); ascii(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, 'data'); v.setUint32(40, dataBytes, true);
  return buf;
}
