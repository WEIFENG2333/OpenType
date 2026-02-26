/**
 * Electron main-process LLM service.
 * Handles post-processing, rewriting, and connection testing.
 */

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

  async process(rawText: string, config: Record<string, any>, context?: any): Promise<string> {
    if (!rawText.trim()) return '';
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
    }

    return this.call({
      ...opts,
      messages: [
        { role: 'system', content: parts.join('\n') },
        { role: 'user', content: rawText },
      ],
    });
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

  private resolveTone(config: Record<string, any>, appName: string): string {
    const lower = appName.toLowerCase();
    for (const rule of config.toneRules || []) {
      if (lower.includes(rule.appPattern?.toLowerCase())) return rule.tone;
    }
    return config.defaultTone || 'professional';
  }
}
