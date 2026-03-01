/**
 * Auto-dictionary learning module.
 * Handles all LLM-driven term extraction and dictionary persistence.
 */

import { state } from './app-state';
import { CapturedContext } from './context-capture';

// ─── Prompts ────────────────────────────────────────────────────────────────

function buildPipelinePrompt(raw: string, processed: string, hasScreenshot: boolean): string {
  return `你是一个语音输入词典助手。用户刚完成一次语音转文字，请判断是否有值得加入个人词典的词语。

个人词典的作用：在未来的语音转录中，帮助语音识别引擎正确识别这些容易出错的词。

## 语音识别原文
"""${raw}"""

## AI 润色后
"""${processed}"""

${hasScreenshot ? '同时提供了用户当前屏幕截图。截图仅作为辅助上下文，帮助你判断转录文本中的词是否为专有词——不要从截图中独立提取与转录内容无关的词汇。' : ''}

## 提取原则（严格遵守）
核心：只从转录文本中提取词语。截图仅帮助判断某个词是不是专有名词。

应该提取的：
- 转录中语音识别明显搞错的专有词（对比原文和润色后的差异）
- 转录中出现的人名、项目名、产品名、公司名（个人化、不常见的）
- 转录中不常见的术语或缩写（语音识别容易误识别的）

不应该提取的：
- 截图中看到但转录中没提到的词（文件名、代码变量名、UI 元素名等）
- 常见技术词（如 API、Python、Google、iPhone — 语音识别本身能识别）
- 通用词汇、只出现一次不太会复用的词

如果没有符合条件的词，直接返回空数组。宁缺毋滥。
只返回 JSON 字符串数组，最多 5 个。格式：["词1", "词2"] 或 []`;
}

function buildEditDiffPrompt(lastTypedText: string, currentFieldText: string): string {
  return `用户用语音输入了一段文本，随后手动做了修改。请从修改中识别出值得加入个人词典的词语。

## 语音输入的原文
"""${lastTypedText}"""

## 用户修改后的完整内容
"""${currentFieldText.slice(0, 2000)}"""

## 提取原则
只提取用户修正中涉及的"个人化、不常见、语音识别容易搞错"的专有词（人名、项目名、产品名、术语等）。
用户修正的拼写/格式问题不算。常见词不要提取。没有就返回空数组。
只返回 JSON 字符串数组，最多 5 个。格式：["词1", "词2"] 或 []`;
}

// ─── Dictionary persistence ────────────────────────────────────────────────

export function saveDictionaryTerms(terms: string[], source: string): string[] {
  if (!terms.length) return [];
  const dictEntries: any[] = state.configStore!.get('personalDictionary') || [];
  const existingWords = new Set(dictEntries.map((e: any) => (typeof e === 'string' ? e : e.word).toLowerCase()));
  const newTerms = terms.filter(t => !existingWords.has(t.toLowerCase()));
  if (!newTerms.length) return [];
  const newEntries = newTerms.map(w => ({ word: w, source, addedAt: Date.now() }));
  state.configStore!.set('personalDictionary', [...dictEntries, ...newEntries]);
  console.log(`[AutoDict:${source}] learned:`, newTerms);
  state.mainWindow?.webContents.send('dictionary:auto-added', newTerms);
  return newTerms;
}

function getDictWords(): string[] {
  const entries: any[] = state.configStore!.get('personalDictionary') || [];
  return entries.map((e: any) => typeof e === 'string' ? e : e.word);
}

// ─── Pipeline post-extraction (fire-and-forget) ────────────────────────────

export function schedulePostPipelineExtraction(raw: string, processed: string, cfg: Record<string, any>) {
  if (cfg.autoLearnDictionary === false || raw.length < 5) return;

  setImmediate(() => {
    const screenshotDataUrl = state.lastCapturedContext?.screenshotDataUrl || null;
    const prompt = buildPipelinePrompt(raw, processed, !!screenshotDataUrl);
    const dictWords = getDictWords();

    state.llmService!.extractTermsWithImage(prompt, screenshotDataUrl, cfg, dictWords)
      .then(terms => saveDictionaryTerms(terms, 'auto-llm'))
      .catch(e => console.error('[AutoDict:auto-llm] error:', e.message));
  });
}

// ─── User edit detection ────────────────────────────────────────────────────

export interface EditDetectionParams {
  lastTypedText: string;
  lastCtx: { appName?: string; bundleId?: string; fieldRole?: string };
}

/** Snapshot state for edit detection. Must be called before context capture clears state. */
export function prepareEditDetection(cfg: Record<string, any>): EditDetectionParams | null {
  if (!state.lastTypedText || cfg.autoLearnDictionary === false || !cfg.contextL1Enabled) return null;

  const timeSince = Date.now() - state.lastTypedAt;
  if (timeSince >= 30 * 60 * 1000) {
    state.lastTypedText = null;
    return null;
  }

  const params: EditDetectionParams = {
    lastTypedText: state.lastTypedText,
    lastCtx: state.lastTypedContext!,
  };
  state.lastTypedText = null; // clear immediately to prevent re-trigger
  return params;
}

/** Run edit detection using an already-captured context (no extra osascript call). */
export function runEditDetection(params: EditDetectionParams, currentCtx: CapturedContext, cfg: Record<string, any>) {
  const { lastTypedText, lastCtx } = params;

  if (currentCtx.bundleId !== lastCtx.bundleId || currentCtx.fieldRole !== lastCtx.fieldRole) {
    console.log('[AutoDict:diff] different app/field, skipping');
    return;
  }

  const currentFieldText = currentCtx.fieldText;
  if (!currentFieldText) return;

  if (currentFieldText.includes(lastTypedText)) {
    console.log('[AutoDict:diff] text unchanged, skipping');
    return;
  }

  console.log('[AutoDict:diff] detected user edit, extracting terms...');
  const prompt = buildEditDiffPrompt(lastTypedText, currentFieldText);
  state.llmService!.extractTerms(prompt, cfg, getDictWords())
    .then(terms => saveDictionaryTerms(terms, 'auto-diff'))
    .catch(e => console.error('[AutoDict:diff]', e));
}

// ─── Record typed text for later edit detection ────────────────────────────

export function recordTypedText(text: string) {
  state.lastTypedText = text;
  state.lastTypedContext = {
    appName: state.lastCapturedContext?.appName,
    bundleId: state.lastCapturedContext?.bundleId,
    fieldRole: state.lastCapturedContext?.fieldRole,
  };
  state.lastTypedAt = Date.now();
}
