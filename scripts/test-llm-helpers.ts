/**
 * Unit tests for llm-service.ts pure functions.
 * Tests: smartTruncate, cursorCenteredTruncate, buildFieldContext, parseTermsResponse
 *
 * Usage: npx tsx scripts/test-llm-helpers.ts
 */
import assert from 'node:assert/strict';
import { smartTruncate, cursorCenteredTruncate, buildFieldContext, parseTermsResponse } from '../electron/llm-service';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
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
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
