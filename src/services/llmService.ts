/**
 * LLM post-processing service.
 * Takes raw STT output and returns polished text.
 * Also handles Voice Superpowers (text rewriting) and API testing.
 */

import { AppConfig, TonePreset } from '../types/config';

export interface LLMResult {
  success: boolean;
  text?: string;
  error?: string;
}

// ─── System Prompt Builder ──────────────────────────────────────────────────

function buildCleanupPrompt(config: AppConfig, context?: { appName?: string }): string {
  const parts: string[] = [];

  parts.push(`You are an intelligent transcription post-processor called OpenType. Transform raw speech-to-text output into clean, polished text that preserves the speaker's intent.`);

  parts.push(`\n## Core Rules:`);

  if (config.fillerWordRemoval) {
    parts.push(`1. Remove filler words (um, uh, like, you know, 那个, 嗯, 额, etc.) — only when they are meaningless fillers`);
  }
  if (config.repetitionElimination) {
    parts.push(`2. Eliminate stutters and unintentional repetitions (e.g., "I I I want" → "I want")`);
  }
  if (config.selfCorrectionDetection) {
    parts.push(`3. Recognize self-corrections: when the speaker corrects themselves (e.g., "Monday—no, Tuesday"), keep ONLY the final corrected version`);
  }
  if (config.autoFormatting) {
    parts.push(`4. Add proper punctuation and capitalization`);
    parts.push(`5. Organize spoken lists or steps into structured format when appropriate`);
  }
  parts.push(`6. Fix obvious speech recognition errors while preserving the original meaning`);
  parts.push(`7. Do NOT add any information that wasn't in the original speech`);
  parts.push(`8. Do NOT summarize or shorten beyond removing fillers/repetitions`);
  parts.push(`9. Output the cleaned text DIRECTLY — no explanations, no quotes, no prefixes`);

  // Personal dictionary
  if (config.personalDictionary.length > 0) {
    parts.push(`\n## Personal Dictionary (use these exact spellings when recognized):\n${config.personalDictionary.join(', ')}`);
  }

  // Tone from context
  if (context?.appName) {
    const tone = resolveTone(config, context.appName);
    const toneDescriptions: Record<TonePreset, string> = {
      professional: 'Use a professional, formal tone.',
      casual: 'Use a casual, conversational tone.',
      technical: 'Preserve technical terminology precisely. Be concise.',
      friendly: 'Use a warm, friendly tone.',
      custom: '',
    };
    parts.push(`\n## Context: Active app is "${context.appName}". ${toneDescriptions[tone] || ''}`);

    // Check for custom tone
    const rule = config.toneRules.find(
      (r) => context.appName!.toLowerCase().includes(r.appPattern.toLowerCase()),
    );
    if (rule?.tone === 'custom' && rule.customPrompt) {
      parts.push(rule.customPrompt);
    }
  }

  return parts.join('\n');
}

function resolveTone(config: AppConfig, appName: string): TonePreset {
  const lower = appName.toLowerCase();
  for (const rule of config.toneRules) {
    if (lower.includes(rule.appPattern.toLowerCase())) {
      return rule.tone;
    }
  }
  return config.defaultTone;
}

// ─── LLM API Call ───────────────────────────────────────────────────────────

interface CallOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  extraHeaders?: Record<string, string>;
  temperature?: number;
  maxTokens?: number;
}

async function callChatCompletion(opts: CallOptions): Promise<LLMResult> {
  const { baseUrl, apiKey, model, messages, extraHeaders, temperature = 0.3, maxTokens = 2048 } = opts;

  if (!apiKey) return { success: false, error: 'API key is required' };

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `LLM ${res.status}: ${err.slice(0, 300)}` };
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) return { success: false, error: 'No content in LLM response' };
    return { success: true, text: content };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

function getProviderOpts(config: AppConfig): Omit<CallOptions, 'messages'> {
  const p = config.llmProvider;
  if (p === 'siliconflow') {
    return {
      baseUrl: config.siliconflowBaseUrl,
      apiKey: config.siliconflowApiKey,
      model: config.siliconflowLlmModel,
    };
  }
  if (p === 'openrouter') {
    return {
      baseUrl: config.openrouterBaseUrl,
      apiKey: config.openrouterApiKey,
      model: config.openrouterLlmModel,
      extraHeaders: {
        'HTTP-Referer': 'https://opentype.app',
        'X-Title': 'OpenType',
      },
    };
  }
  if (p === 'openai-compatible') {
    return {
      baseUrl: config.compatibleBaseUrl,
      apiKey: config.compatibleApiKey,
      model: config.compatibleLlmModel,
    };
  }
  return {
    baseUrl: config.openaiBaseUrl,
    apiKey: config.openaiApiKey,
    model: config.openaiLlmModel,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Post-process raw STT text into polished output */
export async function processText(
  rawText: string,
  config: AppConfig,
  context?: { appName?: string },
): Promise<LLMResult> {
  if (window.electronAPI) {
    return window.electronAPI.processText(rawText, context);
  }
  if (!rawText.trim()) return { success: true, text: '' };

  const systemPrompt = buildCleanupPrompt(config, context);
  return callChatCompletion({
    ...getProviderOpts(config),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: rawText },
    ],
  });
}

/** Voice Superpowers: rewrite selected text per voice instruction */
export async function rewriteText(
  selectedText: string,
  instruction: string,
  config: AppConfig,
): Promise<LLMResult> {
  if (window.electronAPI) {
    return window.electronAPI.rewriteText(selectedText, instruction);
  }

  const system = `You are a writing assistant. The user will give you a piece of text and a voice instruction describing how to modify it. Apply the instruction and output ONLY the modified text — no explanations.`;
  const user = `Text:\n"""\n${selectedText}\n"""\n\nInstruction: ${instruction}`;

  return callChatCompletion({
    ...getProviderOpts(config),
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
}

/** Test LLM API connection */
export async function testLLMConnection(
  provider: string,
  config: AppConfig,
): Promise<LLMResult> {
  let opts: Omit<CallOptions, 'messages'>;

  if (provider === 'siliconflow') {
    opts = {
      baseUrl: config.siliconflowBaseUrl,
      apiKey: config.siliconflowApiKey,
      model: config.siliconflowLlmModel,
    };
  } else if (provider === 'openrouter') {
    opts = {
      baseUrl: config.openrouterBaseUrl,
      apiKey: config.openrouterApiKey,
      model: config.openrouterLlmModel,
      extraHeaders: { 'HTTP-Referer': 'https://opentype.app', 'X-Title': 'OpenType' },
    };
  } else if (provider === 'openai-compatible') {
    opts = {
      baseUrl: config.compatibleBaseUrl,
      apiKey: config.compatibleApiKey,
      model: config.compatibleLlmModel,
    };
  } else {
    opts = {
      baseUrl: config.openaiBaseUrl,
      apiKey: config.openaiApiKey,
      model: config.openaiLlmModel,
    };
  }

  const t0 = Date.now();
  const result = await callChatCompletion({
    ...opts,
    messages: [
      { role: 'system', content: 'Reply with exactly: "ok"' },
      { role: 'user', content: 'Test' },
    ],
    maxTokens: 10,
  });
  const ms = Date.now() - t0;
  if (result.success) {
    return { success: true, text: `${ms}ms` };
  }
  return result;
}

export async function testVLMConnection(
  provider: string,
  config: AppConfig,
): Promise<LLMResult> {
  const model = config.contextOcrModel || 'Qwen/Qwen2.5-VL-32B-Instruct';
  let baseUrl: string;
  let apiKey: string;
  let extraHeaders: Record<string, string> | undefined;

  if (provider === 'siliconflow') {
    baseUrl = config.siliconflowBaseUrl;
    apiKey = config.siliconflowApiKey;
  } else if (provider === 'openrouter') {
    baseUrl = config.openrouterBaseUrl;
    apiKey = config.openrouterApiKey;
    extraHeaders = { 'HTTP-Referer': 'https://opentype.app', 'X-Title': 'OpenType' };
  } else if (provider === 'openai-compatible') {
    baseUrl = config.compatibleBaseUrl;
    apiKey = config.compatibleApiKey;
  } else {
    baseUrl = config.openaiBaseUrl;
    apiKey = config.openaiApiKey;
  }

  const t0 = Date.now();
  const result = await callChatCompletion({
    baseUrl, apiKey, model,
    messages: [{ role: 'user', content: 'Say ok' }],
    maxTokens: 10,
    extraHeaders,
  });
  const ms = Date.now() - t0;
  if (result.success) return { success: true, text: `${ms}ms` };
  return result;
}

// ─── STT Connection Test ─────────────────────────────────────────────────────

export async function testSTTConnection(
  provider: string,
  config: AppConfig,
): Promise<LLMResult> {
  let baseUrl: string;
  let apiKey: string;
  let model: string;

  if (provider === 'siliconflow') {
    baseUrl = config.siliconflowBaseUrl;
    apiKey = config.siliconflowApiKey;
    model = config.siliconflowSttModel;
  } else if (provider === 'openai-compatible') {
    baseUrl = config.compatibleBaseUrl;
    apiKey = config.compatibleApiKey;
    model = config.compatibleSttModel;
  } else {
    baseUrl = config.openaiBaseUrl;
    apiKey = config.openaiApiKey;
    model = config.openaiSttModel;
  }

  if (!apiKey) return { success: false, error: 'No API key configured' };

  const form = new FormData();
  form.append('file', new Blob([makeSilentWav(0.5)], { type: 'audio/wav' }), 'test.wav');
  form.append('model', model);

  const t0 = Date.now();
  try {
    const res = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const ms = Date.now() - t0;

    if (res.ok) return { success: true, text: `${ms}ms` };

    const body = await res.text();
    return { success: false, error: `${res.status}: ${body.slice(0, 300)}` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/** PCM 16-bit mono WAV, 16 kHz, `durationSec` seconds of silence. */
function makeSilentWav(durationSec: number): ArrayBuffer {
  const sampleRate = 16000;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataBytes = numSamples * 2; // 16-bit = 2 bytes per sample
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const ascii = (off: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  ascii(0, 'RIFF'); v.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE'); ascii(12, 'fmt ');
  v.setUint32(16, 16, true);        // fmt chunk size
  v.setUint16(20, 1, true);         // PCM
  v.setUint16(22, 1, true);         // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // byte rate
  v.setUint16(32, 2, true);         // block align
  v.setUint16(34, 16, true);        // bits per sample
  ascii(36, 'data'); v.setUint32(40, dataBytes, true);
  // samples are already 0 (silence) from ArrayBuffer initialization
  return buf;
}
