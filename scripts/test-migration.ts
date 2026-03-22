/**
 * Unit tests for config migration logic (migrateConfig).
 * Tests all edge cases: fresh install, old format, partial migration, corrupted data.
 *
 * Usage: npx tsx scripts/test-migration.ts
 */
import assert from 'node:assert/strict';
import { migrateConfig } from '../electron/config-store';
import { DEFAULT_CONFIG } from '../src/types/config';

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
console.log('\n=== Fresh install (empty object) ===');

test('empty object returns defaults, no change', () => {
  const { config, changed } = migrateConfig({});
  assert.equal(changed, false);
  assert.equal(config.sttProvider, 'siliconflow');
  assert.equal(config.llmProvider, 'siliconflow');
  assert.ok(config.providers.siliconflow);
  assert.equal(config.providers.siliconflow.sttModel, 'FunAudioLLM/SenseVoiceSmall');
});

test('null providers field gets initialized from defaults', () => {
  const { config, changed } = migrateConfig({ providers: null });
  assert.equal(changed, false);
  assert.ok(config.providers.siliconflow);
  assert.ok(config.providers.dashscope);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== Old flat format (pre-migration) ===');

test('migrates all 5 providers from flat fields', () => {
  const { config, changed } = migrateConfig({
    siliconflowApiKey: 'sk-sf', siliconflowBaseUrl: 'https://sf.url', siliconflowSttModel: 'sf-stt', siliconflowLlmModel: 'sf-llm',
    openrouterApiKey: 'sk-or', openrouterBaseUrl: 'https://or.url', openrouterLlmModel: 'or-llm',
    openaiApiKey: 'sk-oa', openaiBaseUrl: 'https://oa.url', openaiSttModel: 'oa-stt', openaiLlmModel: 'oa-llm',
    dashscopeApiKey: 'sk-ds', dashscopeBaseUrl: 'wss://ds.url', dashscopeSttModel: 'ds-stt',
    compatibleApiKey: 'sk-cp', compatibleBaseUrl: 'https://cp.url', compatibleSttModel: 'cp-stt', compatibleLlmModel: 'cp-llm',
  });
  assert.equal(changed, true);
  assert.equal(config.providers.siliconflow.apiKey, 'sk-sf');
  assert.equal(config.providers.siliconflow.baseUrl, 'https://sf.url');
  assert.equal(config.providers.siliconflow.sttModel, 'sf-stt');
  assert.equal(config.providers.siliconflow.llmModel, 'sf-llm');
  assert.equal(config.providers.openrouter.apiKey, 'sk-or');
  assert.equal(config.providers.openrouter.llmModel, 'or-llm');
  assert.equal(config.providers.openai.apiKey, 'sk-oa');
  assert.equal(config.providers.dashscope.apiKey, 'sk-ds');
  assert.equal(config.providers.dashscope.sttModel, 'ds-stt');
  assert.equal(config.providers['openai-compatible'].apiKey, 'sk-cp');
  assert.equal(config.providers['openai-compatible'].sttModel, 'cp-stt');
});

test('flat fields are deleted after migration', () => {
  const { config } = migrateConfig({ siliconflowApiKey: 'sk-x' });
  assert.equal((config as any).siliconflowApiKey, undefined);
  assert.equal((config as any).siliconflowBaseUrl, undefined);
  assert.equal((config as any).siliconflowSttModel, undefined);
  assert.equal((config as any).siliconflowLlmModel, undefined);
});

test('openrouter has no STT — sttModel stays default', () => {
  const { config } = migrateConfig({
    openrouterApiKey: 'sk-or',
  });
  assert.equal(config.providers.openrouter.sttModel, DEFAULT_CONFIG.providers.openrouter.sttModel);
});

test('dashscope has no LLM — llmModel stays default', () => {
  const { config } = migrateConfig({
    dashscopeApiKey: 'sk-ds',
  });
  assert.equal(config.providers.dashscope.llmModel, DEFAULT_CONFIG.providers.dashscope.llmModel);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== Partial migration (providers exists but old fields too) ===');

test('old fields override empty providers', () => {
  const { config, changed } = migrateConfig({
    providers: {
      dashscope: { apiKey: '', baseUrl: 'wss://old', sttModel: 'old-model', llmModel: '' },
    },
    dashscopeApiKey: 'sk-real-key',
    dashscopeBaseUrl: 'wss://new-url',
    dashscopeSttModel: 'new-model',
  });
  assert.equal(changed, true);
  assert.equal(config.providers.dashscope.apiKey, 'sk-real-key');
  assert.equal(config.providers.dashscope.baseUrl, 'wss://new-url');
  assert.equal(config.providers.dashscope.sttModel, 'new-model');
});

test('only providers with old fields are touched', () => {
  const { config } = migrateConfig({
    providers: {
      siliconflow: { apiKey: 'keep-me', baseUrl: 'https://keep', sttModel: 'keep-stt', llmModel: 'keep-llm' },
    },
    dashscopeApiKey: 'sk-ds',
  });
  // siliconflow untouched (no flat siliconflowApiKey field)
  assert.equal(config.providers.siliconflow.apiKey, 'keep-me');
  // dashscope migrated
  assert.equal(config.providers.dashscope.apiKey, 'sk-ds');
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== Already migrated (no old fields) ===');

test('no change when providers are already populated', () => {
  const { config, changed } = migrateConfig({
    providers: {
      siliconflow: { apiKey: 'sk-x', baseUrl: 'https://x', sttModel: 'm', llmModel: 'm' },
      dashscope: { apiKey: 'sk-y', baseUrl: 'wss://y', sttModel: 'n', llmModel: '' },
    },
  });
  assert.equal(changed, false);
  assert.equal(config.providers.siliconflow.apiKey, 'sk-x');
  assert.equal(config.providers.dashscope.apiKey, 'sk-y');
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== personalDictionary migration ===');

test('migrates string[] to DictionaryEntry[]', () => {
  const { config, changed } = migrateConfig({
    personalDictionary: ['word1', 'word2'],
  });
  assert.equal(changed, true);
  assert.equal(config.personalDictionary.length, 2);
  assert.equal(config.personalDictionary[0].word, 'word1');
  assert.equal(config.personalDictionary[0].source, 'manual');
  assert.ok(config.personalDictionary[0].addedAt! > 0);
});

test('does not re-migrate already-migrated dictionary', () => {
  const entries = [{ word: 'x', source: 'manual' as const, addedAt: 123 }];
  const { config, changed } = migrateConfig({ personalDictionary: entries });
  assert.equal(changed, false);
  assert.equal(config.personalDictionary[0].addedAt, 123);
});

test('empty dictionary is untouched', () => {
  const { changed } = migrateConfig({ personalDictionary: [] });
  assert.equal(changed, false);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== Corrupted/edge-case data ===');

test('providers as array gets replaced', () => {
  const { config } = migrateConfig({ providers: [1, 2, 3] });
  assert.ok(typeof config.providers === 'object' && !Array.isArray(config.providers));
  assert.ok(config.providers.siliconflow);
});

test('empty string apiKey is preserved (not treated as missing)', () => {
  const { config } = migrateConfig({
    siliconflowApiKey: '',
    siliconflowBaseUrl: 'https://custom',
  });
  assert.equal(config.providers.siliconflow.apiKey, '');
  assert.equal(config.providers.siliconflow.baseUrl, 'https://custom');
});

test('preserves non-provider config fields', () => {
  const { config } = migrateConfig({
    theme: 'dark',
    globalHotkey: 'F5',
    soundEnabled: false,
  });
  assert.equal(config.theme, 'dark');
  assert.equal(config.globalHotkey, 'F5');
  assert.equal(config.soundEnabled, false);
});

test('unknown fields are passed through', () => {
  const { config } = migrateConfig({ futureField: 'hello' });
  assert.equal((config as any).futureField, 'hello');
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== Idempotency ===');

test('migrating twice gives same result', () => {
  const input = {
    siliconflowApiKey: 'sk-1', siliconflowBaseUrl: 'https://u', siliconflowSttModel: 's', siliconflowLlmModel: 'l',
    personalDictionary: ['a', 'b'],
  };
  const first = migrateConfig(input);
  const second = migrateConfig(first.config);
  assert.equal(second.changed, false);
  assert.equal(second.config.providers.siliconflow.apiKey, 'sk-1');
  assert.equal(second.config.personalDictionary.length, 2);
  assert.equal(second.config.personalDictionary[0].word, 'a');
});

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
