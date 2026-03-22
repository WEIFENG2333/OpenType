/**
 * Unit tests for llm-service.ts pure functions.
 * Tests: smartTruncate, cursorCenteredTruncate, buildFieldContext, parseTermsResponse
 *
 * Usage: npx tsx scripts/test-llm-helpers.ts
 */
import assert from 'node:assert/strict';
import { smartTruncate, cursorCenteredTruncate, buildFieldContext, parseTermsResponse, buildSystemPrompt } from '../electron/llm-service';
import { DEFAULT_CONFIG, AppConfig } from '../src/types/config';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== smartTruncate ===');

test('returns short text unchanged', () => {
  assert.equal(smartTruncate('hello', 100), 'hello');
});

test('returns empty string unchanged', () => {
  assert.equal(smartTruncate('', 100), '');
});

test('handles null/undefined gracefully', () => {
  assert.equal(smartTruncate(null as any, 100), null);
  assert.equal(smartTruncate(undefined as any, 100), undefined);
});

test('truncates long text keeping beginning + end', () => {
  const text = 'A'.repeat(100);
  const result = smartTruncate(text, 50);
  assert.ok(result.length <= 60); // 50 + ellipsis overhead
  assert.ok(result.startsWith('AAAA'));
  assert.ok(result.endsWith('AAAA'));
  assert.ok(result.includes('[truncated]'));
});

test('text at exact limit is not truncated', () => {
  const text = 'A'.repeat(50);
  assert.equal(smartTruncate(text, 50), text);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== cursorCenteredTruncate ===');

test('short text returned unchanged', () => {
  const { text, adjustedPos } = cursorCenteredTruncate('hello world', 5, 100);
  assert.equal(text, 'hello world');
  assert.equal(adjustedPos, 5);
});

test('centers truncation around cursor', () => {
  const text = 'A'.repeat(200) + '|CURSOR|' + 'B'.repeat(200);
  const cursor = 200; // position of |
  const { text: result, adjustedPos } = cursorCenteredTruncate(text, cursor, 100);
  assert.ok(result.length <= 120); // 100 + ellipsis overhead
  // The cursor should be roughly in the middle of the result
  assert.ok(adjustedPos > 20 && adjustedPos < result.length - 20,
    `adjustedPos ${adjustedPos} should be near middle of ${result.length}`);
});

test('cursor at start favors beginning', () => {
  const text = 'A'.repeat(500);
  const { text: result, adjustedPos } = cursorCenteredTruncate(text, 0, 100);
  assert.equal(adjustedPos, 0);
  assert.ok(result.startsWith('AAAA'));
});

test('cursor at end favors ending', () => {
  const text = 'A'.repeat(500);
  const { text: result } = cursorCenteredTruncate(text, 500, 100);
  assert.ok(result.endsWith('AAAA'));
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== buildFieldContext ===');

test('returns null for undefined context', () => {
  assert.equal(buildFieldContext(undefined), null);
});

test('returns null for context without fieldText', () => {
  assert.equal(buildFieldContext({ fieldText: '' } as any), null);
  assert.equal(buildFieldContext({ fieldText: undefined } as any), null);
});

test('shows cursor marker for zero-length selection', () => {
  const result = buildFieldContext({
    fieldText: 'Hello world',
    selectionRange: { location: 5, length: 0 },
    fieldRole: 'text field',
  } as any);
  assert.ok(result!.includes('|'));
  assert.ok(result!.includes('Hello|'));
  assert.ok(result!.includes('cursor position'));
});

test('shows SELECTED marker for non-zero selection', () => {
  const result = buildFieldContext({
    fieldText: 'Hello world here',
    selectionRange: { location: 6, length: 5 },
    fieldRole: 'text field',
  } as any);
  assert.ok(result!.includes('[SELECTED:'));
  assert.ok(result!.includes('world'));
  assert.ok(result!.includes('replace'));
});

test('fallback: shows raw text when no range info', () => {
  const result = buildFieldContext({
    fieldText: 'Hello world',
    fieldRole: 'text field',
  } as any);
  assert.ok(result!.includes('Hello world'));
  assert.ok(result!.includes('flow naturally'));
});

test('includes field label and role in descriptor', () => {
  const result = buildFieldContext({
    fieldText: 'content',
    fieldLabel: 'Message',
    fieldRoleDescription: 'text area',
    selectionRange: { location: 0, length: 0 },
  } as any);
  assert.ok(result!.includes('"Message"'));
  assert.ok(result!.includes('text area'));
});

test('selection in very long field text does not crash', () => {
  const longText = 'A'.repeat(10000);
  const result = buildFieldContext({
    fieldText: longText,
    selectionRange: { location: 5000, length: 100 },
    fieldRole: 'text area',
  } as any);
  assert.ok(result!.includes('[SELECTED:'));
  // Should not contain the full 10000 chars
  assert.ok(result!.length < 3000);
});

test('cursor at end of long text does not crash', () => {
  const longText = 'A'.repeat(10000);
  const result = buildFieldContext({
    fieldText: longText,
    selectionRange: { location: 10000, length: 0 },
    fieldRole: 'input',
  } as any);
  assert.ok(result!.includes('|'));
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== parseTermsResponse ===');

test('parses clean JSON array', () => {
  assert.deepEqual(parseTermsResponse('["word1", "word2"]'), ['word1', 'word2']);
});

test('parses empty array', () => {
  assert.deepEqual(parseTermsResponse('[]'), []);
});

test('filters out non-string items', () => {
  assert.deepEqual(parseTermsResponse('[1, "word", null, ""]'), ['word']);
});

test('extracts array embedded in text', () => {
  assert.deepEqual(
    parseTermsResponse('Here are the terms: ["term1", "term2"]'),
    ['term1', 'term2'],
  );
});

test('falls back to comma-separated parsing', () => {
  assert.deepEqual(parseTermsResponse('word1, word2, word3'), ['word1', 'word2', 'word3']);
});

test('strips quotes from comma-separated', () => {
  assert.deepEqual(parseTermsResponse('"word1", "word2"'), ['word1', 'word2']);
});

test('returns empty for non-parseable single word', () => {
  assert.deepEqual(parseTermsResponse('nothing'), []);
});

test('returns empty for empty string', () => {
  assert.deepEqual(parseTermsResponse(''), []);
});

test('handles LLM preamble with JSON', () => {
  const response = '根据分析，提取以下词语：\n["TeamBition", "飞书"]';
  assert.deepEqual(parseTermsResponse(response), ['TeamBition', '飞书']);
});

test('handles markdown code block with JSON', () => {
  const response = '```json\n["term1", "term2"]\n```';
  // The regex should still find the array
  assert.deepEqual(parseTermsResponse(response), ['term1', 'term2']);
});

// ═══════════════════════════════════════════════════════════════════════════
// buildSystemPrompt
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== buildSystemPrompt ===');

const dummyToneResolver = (_cfg: AppConfig, _app: string) => ({ tone: 'professional' as string });

test('minimal config produces base rules', () => {
  const cfg = { ...DEFAULT_CONFIG, fillerWordRemoval: false, repetitionElimination: false, selfCorrectionDetection: false, autoFormatting: false };
  const prompt = buildSystemPrompt(cfg, undefined, dummyToneResolver);
  assert.ok(prompt.includes('transcription restater'));
  assert.ok(prompt.includes('Fix obvious speech recognition errors'));
  // Should NOT have filler/repetition/formatting rules
  assert.ok(!prompt.includes('Remove filler'));
  assert.ok(!prompt.includes('Remove stutters'));
  assert.ok(!prompt.includes('punctuation'));
});

test('all toggles enabled adds all rules', () => {
  const prompt = buildSystemPrompt(DEFAULT_CONFIG, undefined, dummyToneResolver);
  assert.ok(prompt.includes('Remove filler'));
  assert.ok(prompt.includes('Remove stutters'));
  assert.ok(prompt.includes('self-corrections'));
  assert.ok(prompt.includes('punctuation'));
  assert.ok(prompt.includes('numbered list'));
  assert.ok(prompt.includes('Arabic numerals'));
});

test('personal dictionary appears in prompt', () => {
  const cfg = { ...DEFAULT_CONFIG, personalDictionary: [{ word: 'OpenType', source: 'manual' as const }, { word: 'Zustand', source: 'auto-llm' as const }] };
  const prompt = buildSystemPrompt(cfg, undefined, dummyToneResolver);
  assert.ok(prompt.includes('Hot Word Table'));
  assert.ok(prompt.includes('OpenType'));
  assert.ok(prompt.includes('Zustand'));
});

test('empty dictionary omits hot word section', () => {
  const prompt = buildSystemPrompt(DEFAULT_CONFIG, undefined, dummyToneResolver);
  assert.ok(!prompt.includes('Hot Word Table'));
});

test('context app name triggers tone', () => {
  const ctx = { appName: 'Slack', windowTitle: 'general' } as any;
  const resolver = (_cfg: AppConfig, _app: string) => ({ tone: 'casual' as string });
  const prompt = buildSystemPrompt(DEFAULT_CONFIG, ctx, resolver);
  assert.ok(prompt.includes('Active app "Slack"'));
  assert.ok(prompt.includes('Casual'));
  assert.ok(prompt.includes('Window title: "general"'));
});

test('custom tone includes customPrompt', () => {
  const ctx = { appName: 'MyApp' } as any;
  const resolver = (_cfg: AppConfig, _app: string) => ({ tone: 'custom', customPrompt: 'Be very concise.' });
  const prompt = buildSystemPrompt(DEFAULT_CONFIG, ctx, resolver);
  assert.ok(prompt.includes('Be very concise.'));
});

test('clipboard text included and truncated', () => {
  const ctx = { clipboardText: 'A'.repeat(1000) } as any;
  const prompt = buildSystemPrompt(DEFAULT_CONFIG, ctx, dummyToneResolver);
  assert.ok(prompt.includes('Clipboard content'));
  assert.ok(prompt.length < 3000); // truncation applied
});

test('screen context from OCR included', () => {
  const ctx = { screenContext: 'User is editing a spreadsheet with sales data' } as any;
  const prompt = buildSystemPrompt(DEFAULT_CONFIG, ctx, dummyToneResolver);
  assert.ok(prompt.includes('Screen context (from OCR)'));
  assert.ok(prompt.includes('spreadsheet'));
});

test('recent transcriptions included with numbering', () => {
  const ctx = { recentTranscriptions: ['Hello world', 'Testing one two three'] } as any;
  const prompt = buildSystemPrompt(DEFAULT_CONFIG, ctx, dummyToneResolver);
  assert.ok(prompt.includes('Recent transcriptions'));
  assert.ok(prompt.includes('1. Hello world'));
  assert.ok(prompt.includes('2. Testing'));
});

test('field placeholder included', () => {
  const ctx = { fieldPlaceholder: 'Type a message...' } as any;
  const prompt = buildSystemPrompt(DEFAULT_CONFIG, ctx, dummyToneResolver);
  assert.ok(prompt.includes('placeholder reads: "Type a message..."'));
});

test('no context produces clean prompt', () => {
  const prompt = buildSystemPrompt(DEFAULT_CONFIG, undefined, dummyToneResolver);
  assert.ok(!prompt.includes('Active app'));
  assert.ok(!prompt.includes('Clipboard'));
  assert.ok(!prompt.includes('Screen context'));
  assert.ok(!prompt.includes('Recent transcriptions'));
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== Edge cases: smartTruncate ===');

test('smartTruncate with maxLen=0 returns empty or minimal', () => {
  const result = smartTruncate('hello world', 0);
  assert.ok(result.length <= 25, `Expected very short result, got ${result.length} chars`);
});

test('smartTruncate with maxLen=1 returns single char', () => {
  const result = smartTruncate('hello world', 1);
  assert.equal(result, 'h');
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== Edge cases: cursorCenteredTruncate ===');

test('cursorCenteredTruncate with negative cursorPos', () => {
  const { text: result, adjustedPos } = cursorCenteredTruncate('hello world', -1, 100);
  assert.equal(result, 'hello world');
  assert.ok(adjustedPos >= 0, 'adjustedPos should not be negative');
});

test('cursorCenteredTruncate with cursorPos beyond text length', () => {
  const { text: result, adjustedPos } = cursorCenteredTruncate('hello', 999, 100);
  assert.equal(result, 'hello');
  assert.ok(adjustedPos <= result.length);
});

test('cursorCenteredTruncate with maxLen=0', () => {
  const { text: result } = cursorCenteredTruncate('hello world', 5, 0);
  assert.ok(result.length <= 25, 'Should handle maxLen=0 gracefully');
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== Edge cases: parseTermsResponse ===');

test('parseTermsResponse with nested array returns flat strings', () => {
  const result = parseTermsResponse('[["nested"], "valid"]');
  // Should only include string elements, not arrays
  assert.ok(result.every(t => typeof t === 'string'));
});

test('parseTermsResponse with more than 3 items returns all (caller trims)', () => {
  const result = parseTermsResponse('["a","b","c","d","e"]');
  assert.equal(result.length, 5);
});

test('parseTermsResponse with non-string array elements filters them', () => {
  const result = parseTermsResponse('[1, null, "valid", true, "also valid"]');
  assert.deepEqual(result, ['valid', 'also valid']);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
