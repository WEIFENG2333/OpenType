/**
 * LLM service — thin wrapper around IPC (Electron) or direct fetch (browser dev).
 *
 * Architecture rule: In Electron, ALL API calls go through IPC to main process.
 * The browser-mode fallback (direct fetch) is only for `npm run dev` without Electron.
 */

import { AppConfig, TonePreset, getLLMProviderOpts, getSTTProviderOpts, LLMProviderID } from '../types/config';
import { errMsg } from '../utils/errMsg';

export interface LLMResult {
  success: boolean;
  text?: string;
  error?: string;
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
  return browserFetchLLM(config, buildCleanupPrompt(config, context), rawText);
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
  return browserFetchLLM(config, system, `Text:\n"""\n${selectedText}\n"""\n\nInstruction: ${instruction}`);
}

/** Test LLM API connection */
export async function testLLMConnection(
  provider: LLMProviderID,
  config: AppConfig,
): Promise<LLMResult> {
  if (window.electronAPI) {
    const t0 = Date.now();
    const r = await window.electronAPI.testAPI(provider);
    const ms = Date.now() - t0;
    return r.success
      ? { success: true, text: `${ms}ms` }
      : { success: false, error: r.error || r.message };
  }
  const { apiKey } = getLLMProviderOpts(config);
  if (!apiKey) return { success: false, error: 'API key not configured' };
  return { success: true, text: 'Key configured (browser mode)' };
}

/** Test VLM API connection */
export async function testVLMConnection(
  _provider: LLMProviderID,
  config: AppConfig,
): Promise<LLMResult> {
  if (window.electronAPI) {
    const t0 = Date.now();
    const r = await window.electronAPI.testVLM();
    const ms = Date.now() - t0;
    return r.success
      ? { success: true, text: `${ms}ms` }
      : { success: false, error: r.error || r.message };
  }
  const { apiKey } = getLLMProviderOpts(config);
  if (!apiKey) return { success: false, error: 'API key not configured' };
  return { success: true, text: 'Key configured (browser mode)' };
}

/** Test STT API connection */
export async function testSTTConnection(
  _provider: string,
  config: AppConfig,
): Promise<LLMResult> {
  if (window.electronAPI) {
    return window.electronAPI.testSTTConnection();
  }
  // Browser fallback: check if API key is set
  const { apiKey } = getSTTProviderOpts(config);
  if (!apiKey) return { success: false, error: 'API key not configured' };
  return { success: true, text: 'Key configured (browser mode)' };
}

// ─── Browser-mode fallback (npm run dev without Electron) ───────────────────

async function browserFetchLLM(
  config: AppConfig,
  systemPrompt: string,
  userMessage: string,
): Promise<LLMResult> {
  const { baseUrl, apiKey, model, extraHeaders } = getLLMProviderOpts(config);
  if (!apiKey) return { success: false, error: 'API key is required' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return { success: false, error: `LLM ${res.status}: ${err.slice(0, 300)}` };
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) return { success: false, error: 'No content in LLM response' };
    return { success: true, text: content };
  } catch (e) {
    return { success: false, error: e instanceof Error && e.name === 'AbortError' ? 'Request timed out (30s)' : errMsg(e) };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Prompt Builder (browser-mode only, main process has its own) ───────────

function buildCleanupPrompt(config: AppConfig, context?: { appName?: string }): string {
  const parts: string[] = [];
  parts.push(`You are an intelligent transcription post-processor called OpenType. Transform raw speech-to-text output into clean, polished text that preserves the speaker's intent.`);
  parts.push(`\n## Core Rules:`);
  if (config.fillerWordRemoval) parts.push(`1. Remove filler words (um, uh, like, you know, 那个, 嗯, 额, etc.)`);
  if (config.repetitionElimination) parts.push(`2. Eliminate stutters and unintentional repetitions`);
  if (config.selfCorrectionDetection) parts.push(`3. Recognize self-corrections: keep ONLY the final corrected version`);
  if (config.autoFormatting) {
    parts.push(`4. Add proper punctuation and capitalization`);
    parts.push(`5. Organize spoken lists or steps into structured format when appropriate`);
  }
  parts.push(`6. Fix obvious speech recognition errors while preserving the original meaning`);
  parts.push(`7. Do NOT add any information that wasn't in the original speech`);
  parts.push(`8. Do NOT summarize or shorten beyond removing fillers/repetitions`);
  parts.push(`9. Output the cleaned text DIRECTLY — no explanations, no quotes, no prefixes`);
  if (config.personalDictionary.length > 0) {
    parts.push(`\n## Personal Dictionary:\n${config.personalDictionary.map(e => e.word).join(', ')}`);
  }
  if (context?.appName) {
    const tone = resolveTone(config, context.appName);
    const desc: Record<TonePreset, string> = {
      professional: 'Use a professional, formal tone.',
      casual: 'Use a casual, conversational tone.',
      technical: 'Preserve technical terminology precisely. Be concise.',
      friendly: 'Use a warm, friendly tone.',
      custom: '',
    };
    parts.push(`\n## Context: Active app is "${context.appName}". ${desc[tone] || ''}`);
    const rule = config.toneRules.find(r => context.appName!.toLowerCase().includes(r.appPattern.toLowerCase()));
    if (rule?.tone === 'custom' && rule.customPrompt) parts.push(rule.customPrompt);
  }
  return parts.join('\n');
}

function resolveTone(config: AppConfig, appName: string): TonePreset {
  const lower = appName.toLowerCase();
  for (const rule of config.toneRules) {
    if (lower.includes(rule.appPattern.toLowerCase())) return rule.tone;
  }
  return config.defaultTone;
}
