/**
 * Electron main-process STT service.
 * Sends audio to SiliconFlow or OpenAI-compatible STT API.
 */

export class STTService {
  async transcribe(
    audioBuffer: Buffer,
    config: Record<string, any>,
    options?: { language?: string },
  ): Promise<string> {
    const provider = config.sttProvider || 'siliconflow';
    let baseUrl: string;
    let apiKey: string;
    let model: string;

    if (provider === 'siliconflow') {
      baseUrl = config.siliconflowBaseUrl;
      apiKey = config.siliconflowApiKey;
      model = config.siliconflowSttModel;
    } else {
      baseUrl = config.openaiBaseUrl;
      apiKey = config.openaiApiKey;
      model = config.openaiSttModel;
    }

    if (!apiKey) throw new Error(`No API key for STT provider "${provider}"`);

    const formData = new FormData();
    const ab = audioBuffer.buffer.slice(audioBuffer.byteOffset, audioBuffer.byteOffset + audioBuffer.byteLength) as ArrayBuffer;
    formData.append('file', new Blob([ab], { type: 'audio/wav' }), 'recording.wav');
    formData.append('model', model);

    const lang = options?.language ?? config.inputLanguage;
    if (lang && lang !== 'auto') formData.append('language', lang);

    const url = `${baseUrl}/audio/transcriptions`;
    console.log(`[STT] ${provider} → ${url} model=${model}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`STT ${res.status}: ${err.slice(0, 300)}`);
    }

    const json = await res.json();
    return json.text ?? '';
  }
}
