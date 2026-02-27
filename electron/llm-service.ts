/**
 * Electron main-process LLM service.
 * Handles post-processing, rewriting, and connection testing.
 */

/** Smart truncation: keeps beginning + end of long text, with ellipsis in middle */
function smartTruncate(text: string, maxLen: number): string {
  if (!text || text.length <= maxLen) return text;
  const keepEach = Math.floor((maxLen - 20) / 2);
  return text.slice(0, keepEach) + '\n... [truncated] ...\n' + text.slice(-keepEach);
}

/** Truncation limits for each context field (in characters) */
const CONTEXT_LIMITS = {
  selectedText: 500,
  fieldText: 1500,
  clipboardText: 500,
  screenContext: 400,
  recentTranscription: 200,  // per item
  recentTotal: 3,            // max items
};

export class LLMService {
  private getOpts(config: Record<string, any>, provider?: string) {
    const p = provider || config.llmProvider || 'siliconflow';
    if (p === 'siliconflow') {
      return { baseUrl: config.siliconflowBaseUrl, apiKey: config.siliconflowApiKey, model: config.siliconflowLlmModel };
    }
    if (p === 'openrouter') {
      return {
        baseUrl: config.openrouterBaseUrl, apiKey: config.openrouterApiKey, model: config.openrouterLlmModel,
        extraHeaders: { 'HTTP-Referer': 'https://opentype.app', 'X-Title': 'OpenType' },
      };
    }
    return { baseUrl: config.openaiBaseUrl, apiKey: config.openaiApiKey, model: config.openaiLlmModel };
  }

  private async call(opts: {
    baseUrl: string; apiKey: string; model: string;
    messages: Array<{ role: string; content: string }>;
    extraHeaders?: Record<string, string>;
    temperature?: number; maxTokens?: number;
  }): Promise<string> {
    if (!opts.apiKey) throw new Error('API key required');

    const res = await fetch(`${opts.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
        ...opts.extraHeaders,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 2048,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LLM ${res.status}: ${err.slice(0, 300)}`);
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('Empty LLM response');
    return content;
  }

  async process(rawText: string, config: Record<string, any>, context?: any): Promise<{ text: string; systemPrompt: string }> {
    if (!rawText.trim()) return { text: '', systemPrompt: '' };
    const opts = this.getOpts(config);

    const parts: string[] = [
      'You are an intelligent transcription post-processor. Transform raw speech-to-text output into clean text.',
      '\nRules:',
    ];

    if (config.fillerWordRemoval !== false)
      parts.push('1. Remove filler words (um, uh, like, you know, 那个, 嗯, 额)');
    if (config.repetitionElimination !== false)
      parts.push('2. Eliminate stutters and repetitions');
    if (config.selfCorrectionDetection !== false)
      parts.push('3. Recognize self-corrections — keep ONLY the final version');
    if (config.autoFormatting !== false)
      parts.push('4. Add punctuation, capitalization, and structure lists');

    parts.push('5. Fix speech recognition errors while preserving meaning');
    parts.push('6. Do NOT add information not in the original speech');
    parts.push('7. Output cleaned text directly — no explanations or quotes');

    if (config.outputLanguage && config.outputLanguage !== 'auto')
      parts.push(`8. Output in ${config.outputLanguage}`);

    if (config.personalDictionary?.length > 0)
      parts.push(`\nPersonal Dictionary: ${config.personalDictionary.join(', ')}`);

    if (context?.appName) {
      const tone = this.resolveTone(config, context.appName);
      const desc: Record<string, string> = {
        professional: 'Professional, formal tone.',
        casual: 'Casual, conversational tone.',
        technical: 'Precise technical language.',
        friendly: 'Warm, friendly tone.',
      };
      parts.push(`\nContext: Active app "${context.appName}". ${desc[tone] || ''}`);

      if (context.windowTitle) {
        parts.push(`Window title: "${context.windowTitle}"`);
      }
      if (context.url) {
        parts.push(`URL: ${context.url}`);
      }
    }

    // L1: selected text (what the user highlighted)
    if (context?.selectedText) {
      const snippet = smartTruncate(context.selectedText, CONTEXT_LIMITS.selectedText);
      parts.push(`\nThe user had selected this text:\n"""\n${snippet}\n"""\nEnsure the dictation output is consistent and coherent with this context.`);
    }

    // L1: full field content (what's already in the input field)
    if (context?.fieldText && context.fieldText !== context?.selectedText) {
      const snippet = smartTruncate(context.fieldText, CONTEXT_LIMITS.fieldText);
      parts.push(`\nExisting text in the input field (${context.fieldRole || 'unknown type'}):\n"""\n${snippet}\n"""\nThe dictated text should flow naturally with this existing content.`);
    }

    // Clipboard content
    if (context?.clipboardText) {
      const snippet = smartTruncate(context.clipboardText, CONTEXT_LIMITS.clipboardText);
      parts.push(`\nClipboard content:\n"""\n${snippet}\n"""\nThis may provide additional context for the dictation.`);
    }

    // Recent transcriptions for continuity
    if (context?.recentTranscriptions?.length > 0) {
      const recents = context.recentTranscriptions
        .slice(0, CONTEXT_LIMITS.recentTotal)
        .map((t: string) => smartTruncate(t, CONTEXT_LIMITS.recentTranscription));
      parts.push(`\nRecent transcriptions (for continuity):\n${recents.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}`);
    }

    if (context?.screenContext) {
      const snippet = smartTruncate(context.screenContext, CONTEXT_LIMITS.screenContext);
      parts.push(`\nScreen context (from OCR): ${snippet}`);
    }

    const systemPrompt = parts.join('\n');
    const text = await this.call({
      ...opts,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: rawText },
      ],
    });

    return { text, systemPrompt };
  }

  async rewrite(selectedText: string, instruction: string, config: Record<string, any>): Promise<string> {
    const opts = this.getOpts(config);
    return this.call({
      ...opts,
      messages: [
        { role: 'system', content: 'You are a writing assistant. Apply the instruction to the text. Output ONLY the modified text.' },
        { role: 'user', content: `Text:\n"""\n${selectedText}\n"""\n\nInstruction: ${instruction}` },
      ],
    });
  }

  async testConnection(config: Record<string, any>, provider: string): Promise<string> {
    const opts = this.getOpts(config, provider);
    return this.call({
      ...opts,
      messages: [
        { role: 'system', content: 'Reply with exactly: "Connection successful!"' },
        { role: 'user', content: 'Test' },
      ],
      maxTokens: 20,
    });
  }

  async analyzeScreenshot(dataUrl: string, config: Record<string, any>): Promise<string> {
    const model = config.contextOcrModel || 'Qwen/Qwen2-VL-7B-Instruct';
    const opts = this.getOpts(config);

    const prompt = [
      'Analyze this screenshot to help with voice dictation context. Extract:',
      '1. APP: Which application is open',
      '2. TASK: What the user is working on (1 sentence)',
      '3. KEY TERMS: List any proper nouns, brand names, technical terms, project names, or specialized vocabulary visible on screen (comma-separated)',
      '4. TEXT CONTEXT: If there is a text input area, summarize what has been written so far (1 sentence)',
      '',
      'Format your response exactly as:',
      'APP: ...',
      'TASK: ...',
      'KEY TERMS: ...',
      'TEXT CONTEXT: ...',
      '',
      'Keep each line brief. If a field is not applicable, write "none".',
    ].join('\n');

    const res = await fetch(`${opts.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
        ...(opts as any).extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: prompt },
          ],
        }],
        max_tokens: 300,
        temperature: 0.1,
      }),
    });

    if (!res.ok) throw new Error(`VLM ${res.status}`);
    const json = await res.json();
    return json.choices?.[0]?.message?.content?.trim() || '';
  }

  private resolveTone(config: Record<string, any>, appName: string): string {
    const lower = appName.toLowerCase();
    for (const rule of config.toneRules || []) {
      if (lower.includes(rule.appPattern?.toLowerCase())) return rule.tone;
    }
    return config.defaultTone || 'professional';
  }
}
