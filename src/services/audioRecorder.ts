/**
 * Browser-based audio recorder using Web Audio API.
 * Records microphone input, monitors audio level, outputs WAV buffer.
 */

const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
};

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private animationFrame: number | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private onLevelChange?: (level: number) => void;

  async start(
    onLevelChange?: (level: number) => void,
    onPCMChunk?: (pcm16Base64: string) => void,
    targetSampleRate = 24000,
  ): Promise<void> {
    this.onLevelChange = onLevelChange;
    this.audioChunks = [];

    this.stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);

    // Audio analysis for level metering
    this.audioContext = new AudioContext();
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);
    this.monitorLevel();

    // Real-time PCM streaming for Realtime STT
    if (onPCMChunk) {
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      source.connect(this.scriptProcessor);
      // Must connect to destination for onaudioprocess to fire, but use a silent gain node
      // to prevent mic audio from playing through speakers (feedback loop)
      const silentGain = this.audioContext.createGain();
      silentGain.gain.value = 0;
      this.scriptProcessor.connect(silentGain);
      silentGain.connect(this.audioContext.destination);

      this.scriptProcessor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const inputRate = this.audioContext!.sampleRate;
        const outputRate = targetSampleRate;
        const ratio = outputRate / inputRate;
        const outputLength = Math.ceil(input.length * ratio);
        const output = new Int16Array(outputLength);

        // Linear interpolation resampling + float32 → int16
        for (let i = 0; i < outputLength; i++) {
          const srcIdx = i / ratio;
          const idx0 = Math.floor(srcIdx);
          const idx1 = Math.min(idx0 + 1, input.length - 1);
          const frac = srcIdx - idx0;
          const sample = input[idx0] * (1 - frac) + input[idx1] * frac;
          const clamped = Math.max(-1, Math.min(1, sample));
          output[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
        }

        // Convert to base64
        const bytes = new Uint8Array(output.buffer);
        let binary = '';
        const CHUNK = 8192;
        for (let i = 0; i < bytes.length; i += CHUNK) {
          binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
        }
        onPCMChunk(btoa(binary));
      };
    }

    // MediaRecorder (always active — needed for WAV export and non-streaming fallback)
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.audioChunks.push(e.data);
    };
    this.mediaRecorder.start(100);
  }

  private monitorLevel() {
    if (!this.analyser || !this.onLevelChange) return;
    const buf = new Uint8Array(this.analyser.frequencyBinCount);
    const tick = () => {
      if (!this.analyser || !this.onLevelChange) return; // guard against cleanup race
      this.analyser.getByteFrequencyData(buf);
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
      this.onLevelChange(Math.min(avg / 128, 1));
      this.animationFrame = requestAnimationFrame(tick);
    };
    tick();
  }

  async stop(): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        this.cleanup();
        return reject(new Error('Not recording'));
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
          const wav = await this.toWav(blob);
          this.cleanup();
          resolve(wav);
        } catch (e) {
          this.cleanup();
          reject(e);
        }
      };

      try {
        this.mediaRecorder.stop();
      } catch {
        // MediaRecorder.stop() can throw if already stopped
        this.cleanup();
        reject(new Error('Failed to stop recording'));
      }
    });
  }

  get recording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  // ─── WAV conversion ──────────────────────────────────────

  private async toWav(webmBlob: Blob): Promise<ArrayBuffer> {
    const ab = await webmBlob.arrayBuffer();
    if (ab.byteLength === 0) {
      throw new Error('Empty audio recording — no data captured from microphone');
    }
    const ctx = new AudioContext({ sampleRate: 16000 });
    let decoded: AudioBuffer;
    try {
      decoded = await ctx.decodeAudioData(ab);
    } catch {
      ctx.close();
      throw new Error('Failed to decode audio. The browser may not support the recording format.');
    }
    if (decoded.length === 0) {
      ctx.close();
      throw new Error('Decoded audio is empty — microphone may not be capturing audio');
    }
    const wav = this.encodeWav(decoded);
    ctx.close();
    return wav;
  }

  private encodeWav(buf: AudioBuffer): ArrayBuffer {
    const ch = buf.getChannelData(0);
    const sr = buf.sampleRate;
    const dataLen = ch.length * 2;
    const out = new ArrayBuffer(44 + dataLen);
    const v = new DataView(out);

    // RIFF header
    this.str(v, 0, 'RIFF');
    v.setUint32(4, 36 + dataLen, true);
    this.str(v, 8, 'WAVE');
    this.str(v, 12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);     // PCM
    v.setUint16(22, 1, true);     // mono
    v.setUint32(24, sr, true);
    v.setUint32(28, sr * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    this.str(v, 36, 'data');
    v.setUint32(40, dataLen, true);

    let off = 44;
    for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
    return out;
  }

  private str(v: DataView, off: number, s: string) {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  }

  private cleanup() {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    this.onLevelChange = undefined;
    if (this.scriptProcessor) {
      this.scriptProcessor.onaudioprocess = null;
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    this.analyser = null;
    this.audioContext?.close();
    this.audioContext = null;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}
