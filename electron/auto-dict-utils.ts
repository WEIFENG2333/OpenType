/**
 * Pure utility functions for auto-dictionary module.
 * No Electron dependencies — safe to import from tests.
 */

// ─── Skip logic ─────────────────────────────────────────────────────────────

const PUNCTUATION_RE = /[\s,.!?;:，。！？；：\-—""''「」【】（）()·…、]/g;

/** Returns reason string if extraction should be skipped, null if it should proceed */
export function shouldSkipExtraction(raw: string, processed: string, autoLearnEnabled: boolean): string | null {
  if (!autoLearnEnabled) return 'auto-learn disabled';
  if (raw.length < 5) return 'text too short';
  if (raw.replace(PUNCTUATION_RE, '') === processed.replace(PUNCTUATION_RE, '')) return 'no substantive changes';
  return null;
}

// ─── Prompt builders ────────────────────────────────────────────────────────

export function buildPipelinePrompt(raw: string, processed: string, hasScreenshot: boolean, existingDict: string[]): string {
  const dictNote = existingDict.length > 0
    ? `\n## 已有词典（不要重复提取）\n${existingDict.join(', ')}\n` : '';

  return `你是语音输入词典助手。判断这次转录中是否有值得加入个人词典的词。

个人词典的目的：帮助语音识别引擎在未来正确识别用户个人专属的、容易搞错的词。

## 语音识别原文
"""${raw}"""

## AI 润色后
"""${processed}"""
${dictNote}
${hasScreenshot ? '（附带了屏幕截图作为辅助上下文，仅用于验证转录中出现的词是否为专有词。不要从截图中单独提取词汇。）' : ''}

## 严格提取标准

只提取同时满足以下全部条件的词：
1. 出现在转录文本中（不是只在截图上）
2. 语音识别原文中被错误识别了（对比原文和润色后的差异，找出被修正的专有词）
3. 用户很可能在未来重复使用

重点关注：对比原文和润色后的差异，找出 STT 识别错误的专有名词。
例如：原文"白的Dance" → 润色后"ByteDance"，说明"ByteDance"需要加入词典。

不要提取：
- 通用词汇、日常用语（语音识别本身不会搞错的词）
- STT 原文和润色后完全一致的词（没有被修正，不需要词典帮助）
- 标点符号、格式、语法层面的修改
- 已在词典中的词

默认返回空数组 []。只提取 STT 明确搞错了的专有词。
最多 3 个。格式：["词1"] 或 []`;
}

export function buildEditDiffPrompt(lastTypedText: string, currentFieldText: string, existingDict: string[]): string {
  const dictNote = existingDict.length > 0
    ? `\n## 已有词典（不要重复提取）\n${existingDict.join(', ')}\n` : '';

  return `用户用语音输入了一段文本，随后手动做了修改。请判断修改中是否有值得加入个人词典的词。

## 语音输入的原文
"""${lastTypedText}"""

## 用户修改后
"""${currentFieldText.slice(0, 2000)}"""
${dictNote}
## 严格提取标准

只提取：用户将 STT 错误的同音字/谐音词手动修正为正确的专有词（人名、内部项目名、小众术语）。

不要提取：
- 标点、格式、语法层面的修改
- 新增的连接词、介词、助词
- 常见词汇、知名品牌、通用技术术语
- 已在词典中的词

默认返回空数组 []。只有非常确定时才提取。
最多 3 个。格式：["词1"] 或 []`;
}
