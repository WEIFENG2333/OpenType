/**
 * Unit tests for auto-dict.ts: skip logic, prompt building, edge cases.
 *
 * Usage: npx tsx scripts/test-auto-dict.ts
 */
import assert from 'node:assert/strict';
import { shouldSkipExtraction, buildPipelinePrompt, buildEditDiffPrompt } from '../electron/auto-dict-utils';

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
console.log('\n=== shouldSkipExtraction ===');

test('skips when auto-learn disabled', () => {
  assert.equal(shouldSkipExtraction('hello world test', 'Hello world test.', false), 'auto-learn disabled');
});

test('skips when text too short', () => {
  assert.equal(shouldSkipExtraction('hi', 'Hi.', true), 'text too short');
});

test('skips when exactly 4 chars', () => {
  assert.equal(shouldSkipExtraction('test', 'Test', true), 'text too short');
});

test('proceeds when exactly 5 chars', () => {
  assert.equal(shouldSkipExtraction('hello', 'Hello!', true), null);
});

test('skips when raw === processed (no changes)', () => {
  assert.equal(shouldSkipExtraction('hello world', 'hello world', true), 'no substantive changes');
});

test('skips when only punctuation differs', () => {
  assert.equal(shouldSkipExtraction('hello world', 'hello, world.', true), 'no substantive changes');
});

test('skips when only Chinese punctuation differs', () => {
  assert.equal(shouldSkipExtraction('你好世界欢迎', '你好，世界。欢迎！', true), 'no substantive changes');
});

test('skips when only whitespace differs', () => {
  assert.equal(shouldSkipExtraction('helloworld', 'hello world', true), 'no substantive changes');
});

test('proceeds when words actually change', () => {
  assert.equal(shouldSkipExtraction('我用了飞出', '我用了飞书', true), null);
});

test('proceeds when words are added', () => {
  assert.equal(shouldSkipExtraction('我去上班了', '我去公司上班了', true), null);
});

test('proceeds when homophone correction exists', () => {
  assert.equal(shouldSkipExtraction('打开team bition', '打开 TeamBition', true), null);
});

test('skips dash and em-dash differences', () => {
  assert.equal(shouldSkipExtraction('hello-world', 'hello—world', true), 'no substantive changes');
});

test('skips mixed punctuation changes', () => {
  assert.equal(shouldSkipExtraction('好的 谢谢', '好的，谢谢！', true), 'no substantive changes');
});

test('skips quotes changes', () => {
  assert.equal(shouldSkipExtraction('他说好的没问题', '他说"好的，没问题"', true), 'no substantive changes');
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== buildPipelinePrompt ===');

test('includes raw and processed text', () => {
  const prompt = buildPipelinePrompt('raw text', 'processed text', false, []);
  assert.ok(prompt.includes('raw text'));
  assert.ok(prompt.includes('processed text'));
});

test('includes existing dictionary note when words exist', () => {
  const prompt = buildPipelinePrompt('test', 'test', false, ['word1', 'word2']);
  assert.ok(prompt.includes('word1, word2'));
  assert.ok(prompt.includes('不要重复提取'));
});

test('no dictionary note when empty', () => {
  const prompt = buildPipelinePrompt('test', 'test', false, []);
  assert.ok(!prompt.includes('不要重复提取'));
});

test('includes screenshot note when has screenshot', () => {
  const prompt = buildPipelinePrompt('test', 'test', true, []);
  assert.ok(prompt.includes('屏幕截图'));
});

test('no screenshot note when no screenshot', () => {
  const prompt = buildPipelinePrompt('test', 'test', false, []);
  assert.ok(!prompt.includes('屏幕截图'));
});

test('mentions max 3 terms', () => {
  const prompt = buildPipelinePrompt('test', 'test', false, []);
  assert.ok(prompt.includes('3'));
});

test('mentions returning empty array', () => {
  const prompt = buildPipelinePrompt('test', 'test', false, []);
  assert.ok(prompt.includes('[]'));
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== buildEditDiffPrompt ===');

test('includes original and edited text', () => {
  const prompt = buildEditDiffPrompt('original', 'edited version', []);
  assert.ok(prompt.includes('original'));
  assert.ok(prompt.includes('edited version'));
});

test('truncates long field text to 2000 chars', () => {
  const longText = 'A'.repeat(5000);
  const prompt = buildEditDiffPrompt('test', longText, []);
  // The prompt should not contain the full 5000 char text
  assert.ok(!prompt.includes('A'.repeat(3000)));
  assert.ok(prompt.includes('A'.repeat(2000)));
});

test('includes existing dictionary', () => {
  const prompt = buildEditDiffPrompt('test', 'edit', ['existing']);
  assert.ok(prompt.includes('existing'));
});

test('mentions same-sound corrections', () => {
  const prompt = buildEditDiffPrompt('test', 'edit', []);
  assert.ok(prompt.includes('同音'));
});

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
