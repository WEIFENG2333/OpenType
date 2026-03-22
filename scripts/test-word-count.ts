/**
 * Unit tests for wordCount.ts: countWords + formatWordCount.
 *
 * Usage: npx tsx scripts/test-word-count.ts
 */
import assert from 'node:assert/strict';
import { countWords, formatWordCount } from '../src/utils/wordCount';

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
console.log('\n=== countWords: edge cases ===');

test('empty string → 0', () => { assert.equal(countWords(''), 0); });
test('null-ish → 0', () => { assert.equal(countWords(null as any), 0); });
test('undefined → 0', () => { assert.equal(countWords(undefined as any), 0); });
test('whitespace only → 0', () => { assert.equal(countWords('   \t\n  '), 0); });

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== countWords: English ===');

test('single word', () => { assert.equal(countWords('hello'), 1); });
test('multiple words', () => { assert.equal(countWords('hello world foo'), 3); });
test('extra whitespace', () => { assert.equal(countWords('  hello   world  '), 2); });
test('with punctuation', () => { assert.equal(countWords('Hello, world!'), 2); });
test('numbers count as words', () => { assert.equal(countWords('Version 3.5 released'), 3); });
test('hyphenated → 1 word', () => { assert.equal(countWords('state-of-the-art'), 1); });

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== countWords: Chinese ===');

test('simple Chinese', () => { assert.equal(countWords('你好世界'), 4); });
test('Chinese sentence', () => { assert.equal(countWords('今天天气很好'), 6); });
test('Chinese with spaces', () => { assert.equal(countWords('你好 世界'), 4); });

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== countWords: mixed CJK + Latin ===');

test('Chinese + English', () => {
  // "我使用 OpenType" → 3 CJK + 1 Latin = 4
  assert.equal(countWords('我使用 OpenType'), 4);
});

test('Chinese + English sentence', () => {
  // "打开 Google Chrome 搜索" → 4 CJK + 2 Latin = 6
  assert.equal(countWords('打开 Google Chrome 搜索'), 6);
});

test('Japanese hiragana', () => {
  // Each hiragana char counts as 1 CJK
  assert.equal(countWords('こんにちは'), 5);
});

test('Korean', () => {
  // Each Korean syllable counts as 1 CJK
  assert.ok(countWords('안녕하세요') > 0);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== countWords: punctuation handling ===');

test('English punctuation not counted', () => {
  // "Hi! How are you?" → 4 words, punctuation ignored
  assert.equal(countWords('Hi! How are you?'), 4);
});

test('standalone punctuation → 0', () => {
  // Just punctuation, no real words
  assert.equal(countWords('... --- ???'), 0);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== formatWordCount ===');

test('pure English', () => {
  const r = formatWordCount('hello world');
  assert.equal(r.count, 2);
  assert.equal(r.cjk, 0);
  assert.equal(r.latin, 2);
});

test('pure Chinese', () => {
  const r = formatWordCount('你好世界');
  assert.equal(r.cjk, 4);
  assert.equal(r.latin, 0);
  assert.equal(r.count, 4);
});

test('mixed', () => {
  const r = formatWordCount('我使用 OpenType');
  assert.equal(r.cjk, 3);
  assert.equal(r.latin, 1);
  assert.equal(r.count, 4);
});

test('empty', () => {
  const r = formatWordCount('');
  assert.equal(r.count, 0);
  assert.equal(r.cjk, 0);
  assert.equal(r.latin, 0);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
