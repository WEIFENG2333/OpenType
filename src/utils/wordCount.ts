/**
 * Universal word/character counting for mixed CJK + Latin text.
 *
 * CJK characters (Chinese, Japanese Kanji, Korean Hanja) each count as 1 "word"
 * since they are ideographic and each character carries meaning.
 * Latin-based words are split by whitespace as usual.
 * Mixed content sums both counts.
 */

// CJK Unicode ranges
const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u3000-\u303f\uff00-\uffef]/g;

/**
 * Count words in mixed-language text.
 * CJK characters = 1 word each, Latin words = split by whitespace.
 */
export function countWords(text: string): number {
  if (!text?.trim()) return 0;

  // Count CJK characters
  const cjkMatches = text.match(CJK_REGEX);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;

  // Remove CJK chars + CJK punctuation, count remaining Latin-like words
  const latinOnly = text.replace(CJK_REGEX, ' ');
  const latinWords = latinOnly.split(/\s+/).filter((w) => w.length > 0 && /[a-zA-Z0-9]/.test(w));

  return cjkCount + latinWords.length;
}

/**
 * Format word count with appropriate unit for display.
 * Returns e.g. "123 字" for Chinese, "45 words" for English, "20 字 + 5 words" for mixed.
 */
export function formatWordCount(text: string): { count: number; cjk: number; latin: number } {
  if (!text?.trim()) return { count: 0, cjk: 0, latin: 0 };

  const cjkMatches = text.match(CJK_REGEX);
  const cjk = cjkMatches ? cjkMatches.length : 0;

  const latinOnly = text.replace(CJK_REGEX, ' ');
  const latin = latinOnly.split(/\s+/).filter((w) => w.length > 0 && /[a-zA-Z0-9]/.test(w)).length;

  return { count: cjk + latin, cjk, latin };
}
