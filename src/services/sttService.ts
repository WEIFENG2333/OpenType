/**
 * Speech-to-Text service — thin wrapper around IPC (Electron) or direct fetch (browser dev).
 *
 * Architecture rule: In Electron, ALL API calls go through IPC to main process.
 * The browser-mode fallback (direct fetch) is only for `npm run dev` without Electron.
 */

import { AppConfig, getSTTProviderOpts } from '../types/config';

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
  if (window.electronAPI) {
    return window.electronAPI.transcribe(audioBuffer, options);
  }
  return browserFetchSTT(audioBuffer, config, options);
}

// ─── Browser-mode fallback (npm run dev without Electron) ───────────────────

async function browserFetchSTT(
  audioBuffer: ArrayBuffer,
  config: AppConfig,
  options?: { language?: string },
): Promise<STTResult> {
  const { baseUrl, apiKey, model } = getSTTProviderOpts(config);
  if (!apiKey) return { success: false, error: `No API key configured for ${config.sttProvider}` };

  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'recording.wav');
  formData.append('model', model);
  if (options?.language && options.language !== 'auto') {
    formData.append('language', options.language);
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
