/**
 * Speech-to-Text service.
 * Calls STT API (SiliconFlow or OpenAI-compatible) to transcribe audio.
 */

import { AppConfig } from '../types/config';

export interface STTResult {
  success: boolean;
  text?: string;
  error?: string;
}

export async function transcribeAudio(
  audioBuffer: ArrayBuffer,
  config: AppConfig,
  options?: { language?: string },
): Promise<STTResult> {
  // Delegate to Electron main process if available
  if (window.electronAPI) {
    return window.electronAPI.transcribe(audioBuffer, options);
  }
  return transcribeWeb(audioBuffer, config, options);
}

async function transcribeWeb(
  audioBuffer: ArrayBuffer,
  config: AppConfig,
  options?: { language?: string },
): Promise<STTResult> {
  const provider = config.sttProvider;

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

  if (!apiKey) {
    return { success: false, error: `No API key configured for ${provider}` };
  }

  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'recording.wav');
  formData.append('model', model);

  const lang = options?.language ?? config.inputLanguage;
  if (lang && lang !== 'auto') {
    formData.append('language', lang);
  }

  try {
    const res = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `STT ${res.status}: ${err.slice(0, 300)}` };
    }

    const json = await res.json();
    return { success: true, text: json.text ?? '' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
