/**
 * LLM post-processing service.
 * Takes raw STT output and returns polished text.
 * Also handles Voice Superpowers (text rewriting) and API testing.
 */

import { AppConfig, TonePreset, getLLMProviderOpts, LLMProviderID } from '../types/config';

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
    parts.push(`\n## Personal Dictionary (use these exact spellings when recognized):\n${config.personalDictionary.map(e => e.word).join(', ')}`);
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
    ...getLLMProviderOpts(config),
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
    ...getLLMProviderOpts(config),
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
}

/** Test LLM API connection */
export async function testLLMConnection(
  provider: LLMProviderID,
  config: AppConfig,
): Promise<LLMResult> {
  const t0 = Date.now();
  const result = await callChatCompletion({
    ...getLLMProviderOpts(config, provider),
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
  provider: LLMProviderID,
  config: AppConfig,
): Promise<LLMResult> {
  if (!config.contextOcrModel) throw new Error('contextOcrModel not configured');

  const t0 = Date.now();
  const result = await callChatCompletion({
    ...getLLMProviderOpts(config, provider),
    model: config.contextOcrModel,
    messages: [{ role: 'user', content: 'Say ok' }],
    maxTokens: 10,
  });
  const ms = Date.now() - t0;
  if (result.success) return { success: true, text: `${ms}ms` };
  return result;
}

// ─── STT Connection Test ─────────────────────────────────────────────────────

export async function testSTTConnection(
  _provider: string,
  _config: AppConfig,
): Promise<LLMResult> {
  // All STT testing (batch + WebSocket) is handled in main process
  if (window.electronAPI?.testSTTConnection) {
    return window.electronAPI.testSTTConnection();
  }
  return { success: false, error: 'STT test requires Electron' };
}
