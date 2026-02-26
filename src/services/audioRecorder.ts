/**
 * Browser-based audio recorder using Web Audio API.
 * Records microphone input, monitors audio level, outputs WAV buffer.
 */

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private animationFrame: number | null = null;
  private onLevelChange?: (level: number) => void;

  async start(onLevelChange?: (level: number) => void): Promise<void> {
    this.onLevelChange = onLevelChange;
    this.audioChunks = [];

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000,
      },
    });

    // Audio analysis for level metering
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);
    this.monitorLevel();

    // MediaRecorder
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
      this.analyser!.getByteFrequencyData(buf);
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
      this.onLevelChange!(Math.min(avg / 128, 1));
      this.animationFrame = requestAnimationFrame(tick);
    };
    tick();
  }

  async stop(): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) return reject(new Error('Not recording'));

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
      this.mediaRecorder.stop();
    });
  }

  get recording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  // ─── WAV conversion ──────────────────────────────────────

  private async toWav(webmBlob: Blob): Promise<ArrayBuffer> {
    const ab = await webmBlob.arrayBuffer();
    const ctx = new AudioContext({ sampleRate: 16000 });
    const decoded = await ctx.decodeAudioData(ab);
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
    this.audioContext?.close();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.animationFrame = null;
    this.audioContext = null;
    this.analyser = null;
    this.stream = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}
