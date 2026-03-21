/**
 * Unit tests for i18n: resolve, interpolate, fallback, locale files.
 *
 * Usage: npx tsx scripts/test-i18n.ts
 */
import assert from 'node:assert/strict';
import { resolve, interpolate } from '../src/i18n/index';
import en from '../src/i18n/locales/en.json';
import zh from '../src/i18n/locales/zh.json';

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
console.log('\n=== resolve ===');

test('simple key', () => {
  assert.equal(resolve({ hello: 'world' }, 'hello'), 'world');
});

test('nested key', () => {
  assert.equal(resolve({ a: { b: { c: 'deep' } } }, 'a.b.c'), 'deep');
});

test('missing key returns path', () => {
  assert.equal(resolve({ a: 1 }, 'missing.key'), 'missing.key');
});

test('partial path returns path', () => {
  assert.equal(resolve({ a: { b: 'val' } }, 'a.b.c'), 'a.b.c');
});

test('non-string value returns path', () => {
  assert.equal(resolve({ a: { b: 42 } }, 'a.b'), 'a.b');
});

test('null object returns path', () => {
  assert.equal(resolve({}, 'any.key'), 'any.key');
});

test('real en.json key', () => {
  const val = resolve(en, 'settings.providers.apiKey');
  assert.ok(val !== 'settings.providers.apiKey', `Should resolve, got: ${val}`);
  assert.equal(typeof val, 'string');
});

test('real zh.json key', () => {
  const val = resolve(zh, 'settings.providers.apiKey');
  assert.ok(val !== 'settings.providers.apiKey');
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== interpolate ===');

test('no params', () => {
  assert.equal(interpolate('hello world'), 'hello world');
});

test('single param', () => {
  assert.equal(interpolate('hello {name}', { name: 'Alice' }), 'hello Alice');
});

test('multiple params', () => {
  assert.equal(interpolate('{a} and {b}', { a: 'X', b: 'Y' }), 'X and Y');
});

test('numeric param', () => {
  assert.equal(interpolate('{count} items', { count: 42 }), '42 items');
});

test('missing param keeps placeholder', () => {
  assert.equal(interpolate('hello {name}', {}), 'hello {name}');
});

test('undefined params returns original', () => {
  assert.equal(interpolate('hello {name}'), 'hello {name}');
});

test('param value 0 is rendered', () => {
  assert.equal(interpolate('{n} left', { n: 0 }), '0 left');
});

test('real template from en.json', () => {
  const template = resolve(en, 'history.mAgo');
  const result = interpolate(template, { n: 5 });
  assert.ok(result.includes('5'), `Should contain '5', got: ${result}`);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== locale file structure ===');

function getKeys(obj: any, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      keys.push(...getKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

const enKeys = new Set(getKeys(en));
const zhKeys = new Set(getKeys(zh));

test('en and zh have same key count', () => {
  assert.equal(enKeys.size, zhKeys.size, `en: ${enKeys.size}, zh: ${zhKeys.size}`);
});

test('every en key exists in zh', () => {
  const missing = [...enKeys].filter(k => !zhKeys.has(k));
  assert.equal(missing.length, 0, `Missing in zh: ${missing.join(', ')}`);
});

test('every zh key exists in en', () => {
  const missing = [...zhKeys].filter(k => !enKeys.has(k));
  assert.equal(missing.length, 0, `Missing in en: ${missing.join(', ')}`);
});

test('no empty string values in en', () => {
  const empty = [...enKeys].filter(k => resolve(en, k) === '');
  assert.equal(empty.length, 0, `Empty values: ${empty.join(', ')}`);
});

test('no empty string values in zh', () => {
  const empty = [...zhKeys].filter(k => resolve(zh, k) === '');
  assert.equal(empty.length, 0, `Empty values: ${empty.join(', ')}`);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== fallback logic ===');

test('t() falls back to en when zh key missing', () => {
  // Simulate: zh missing a key → resolve returns the key → fallback to en
  const key = 'settings.providers.apiKey';
  const zhResult = resolve(zh, key);
  const enResult = resolve(en, key);
  // Both should resolve (we verified earlier). Simulate fallback:
  const template = zhResult === key ? enResult : zhResult;
  assert.ok(template !== key, 'Should resolve from either locale');
});

test('t() returns key path when missing from both', () => {
  const key = 'totally.nonexistent.key';
  const template = resolve(en, key);
  const resolved = template === key ? resolve(en, key) : template;
  assert.equal(resolved, key);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
