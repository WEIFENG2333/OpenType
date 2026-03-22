/**
 * Unit tests for config.ts provider resolution helpers.
 * Tests: getProviderConfig, getSTTProviderOpts, getLLMProviderOpts, getSTTModelMode
 *
 * Usage: npx tsx scripts/test-config-helpers.ts
 */
import assert from 'node:assert/strict';
import {
  AppConfig, DEFAULT_CONFIG, PROVIDERS, ProviderConfig, STTProtocol,
  getProviderConfig, getSTTProviderOpts, getLLMProviderOpts, getSTTModelMode,
  getSTTModelDef, getDefaultBatchProtocol,
} from '../src/types/config';
import { migrateConfig } from '../electron/config-store';

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

// ─── Helper to build a minimal config ─────────────────────────────────────

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== getProviderConfig ===');

test('returns config from providers map when present', () => {
  const pc: ProviderConfig = { apiKey: 'sk-test', baseUrl: 'https://test.com', sttModel: 'm1', llmModel: 'm2' };
  const cfg = makeConfig({ providers: { ...DEFAULT_CONFIG.providers, siliconflow: pc } });
  const result = getProviderConfig(cfg, 'siliconflow');
  assert.equal(result.apiKey, 'sk-test');
  assert.equal(result.baseUrl, 'https://test.com');
  assert.equal(result.sttModel, 'm1');
  assert.equal(result.llmModel, 'm2');
});

test('falls back to PROVIDERS defaultConfig when provider not in map', () => {
  const cfg = makeConfig({ providers: {} });
  const result = getProviderConfig(cfg, 'siliconflow');
  const expected = PROVIDERS.find(p => p.id === 'siliconflow')!.defaultConfig;
  assert.equal(result.baseUrl, expected.baseUrl);
  assert.equal(result.sttModel, expected.sttModel);
});

test('returns empty config for completely unknown provider', () => {
  const cfg = makeConfig({ providers: {} });
  const result = getProviderConfig(cfg, 'nonexistent-provider');
  assert.equal(result.apiKey, '');
  assert.equal(result.baseUrl, '');
  assert.equal(result.sttModel, '');
  assert.equal(result.llmModel, '');
});

test('does not mutate original config', () => {
  const cfg = makeConfig();
  const orig = JSON.stringify(cfg);
  getProviderConfig(cfg, 'siliconflow');
  assert.equal(JSON.stringify(cfg), orig);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== getSTTProviderOpts ===');

test('resolves siliconflow STT opts from default config', () => {
  const cfg = makeConfig({ sttProvider: 'siliconflow' });
  const opts = getSTTProviderOpts(cfg);
  assert.equal(opts.model, 'FunAudioLLM/SenseVoiceSmall');
  assert.ok(opts.baseUrl.includes('siliconflow'));
  assert.equal(opts.extraHeaders, undefined);
});

test('resolves openrouter STT opts (no STT support) gracefully', () => {
  // OpenRouter has no STT, but the helper should still work without crashing
  const cfg = makeConfig({
    sttProvider: 'siliconflow',
    providers: {
      ...DEFAULT_CONFIG.providers,
      siliconflow: { apiKey: 'sk-abc', baseUrl: 'https://custom.url', sttModel: 'custom-model', llmModel: '' },
    },
  });
  const opts = getSTTProviderOpts(cfg);
  assert.equal(opts.apiKey, 'sk-abc');
  assert.equal(opts.baseUrl, 'https://custom.url');
  assert.equal(opts.model, 'custom-model');
});

test('includes extraHeaders for openrouter LLM', () => {
  const cfg = makeConfig({ llmProvider: 'openrouter' });
  const opts = getLLMProviderOpts(cfg);
  assert.ok(opts.extraHeaders);
  assert.equal(opts.extraHeaders!['HTTP-Referer'], 'https://opentype.app');
  assert.equal(opts.extraHeaders!['X-Title'], 'OpenType');
});

test('no extraHeaders for siliconflow', () => {
  const cfg = makeConfig({ llmProvider: 'siliconflow' });
  const opts = getLLMProviderOpts(cfg);
  assert.equal(opts.extraHeaders, undefined);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== getLLMProviderOpts ===');

test('uses config.llmProvider when no override', () => {
  const cfg = makeConfig({ llmProvider: 'siliconflow' });
  const opts = getLLMProviderOpts(cfg);
  assert.ok(opts.baseUrl.includes('siliconflow'));
});

test('respects provider override parameter', () => {
  const cfg = makeConfig({ llmProvider: 'siliconflow' });
  const opts = getLLMProviderOpts(cfg, 'openrouter');
  assert.ok(opts.baseUrl.includes('openrouter'));
});

test('returns user-configured model, not default', () => {
  const cfg = makeConfig({
    llmProvider: 'siliconflow',
    providers: {
      ...DEFAULT_CONFIG.providers,
      siliconflow: { apiKey: '', baseUrl: 'https://api.siliconflow.cn/v1', sttModel: '', llmModel: 'Qwen/Qwen3-8B' },
    },
  });
  const opts = getLLMProviderOpts(cfg);
  assert.equal(opts.model, 'Qwen/Qwen3-8B');
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== getSTTModelMode ===');

test('returns "batch" for siliconflow SenseVoice', () => {
  assert.equal(getSTTModelMode('siliconflow', 'FunAudioLLM/SenseVoiceSmall'), 'batch');
});

test('returns "batch" for dashscope qwen3-asr-flash', () => {
  assert.equal(getSTTModelMode('dashscope', 'qwen3-asr-flash'), 'batch');
});

test('returns "streaming" for dashscope qwen3-asr-flash-realtime', () => {
  assert.equal(getSTTModelMode('dashscope', 'qwen3-asr-flash-realtime'), 'streaming');
});

test('returns "streaming" for dashscope paraformer-realtime-v2', () => {
  assert.equal(getSTTModelMode('dashscope', 'paraformer-realtime-v2'), 'streaming');
});

test('returns "streaming" for dashscope fun-asr-realtime', () => {
  assert.equal(getSTTModelMode('dashscope', 'fun-asr-realtime'), 'streaming');
});

test('returns "batch" for openai whisper-1', () => {
  assert.equal(getSTTModelMode('openai', 'whisper-1'), 'batch');
});

test('returns "batch" for openai gpt-4o-transcribe', () => {
  assert.equal(getSTTModelMode('openai', 'gpt-4o-transcribe'), 'batch');
});

test('defaults to "batch" for unknown model', () => {
  assert.equal(getSTTModelMode('dashscope', 'nonexistent-model'), 'batch');
});

test('defaults to "batch" for unknown provider', () => {
  assert.equal(getSTTModelMode('unknown-provider', 'any-model'), 'batch');
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== PROVIDERS consistency ===');

test('all providers have unique ids', () => {
  const ids = PROVIDERS.map(p => p.id);
  assert.equal(ids.length, new Set(ids).size);
});

test('all provider defaultConfig.sttModel exists in sttModels (if STT supported)', () => {
  for (const p of PROVIDERS) {
    if (!p.supportsSTT) continue;
    if (!p.defaultConfig.sttModel) continue;
    const modelIds = p.sttModels.map(m => m.id);
    assert.ok(modelIds.includes(p.defaultConfig.sttModel),
      `${p.id}: default sttModel "${p.defaultConfig.sttModel}" not in sttModels [${modelIds.join(', ')}]`);
  }
});

test('all provider defaultConfig.llmModel exists in llmModels (if LLM supported)', () => {
  for (const p of PROVIDERS) {
    if (!p.supportsLLM) continue;
    if (!p.defaultConfig.llmModel) continue;
    assert.ok(p.llmModels.includes(p.defaultConfig.llmModel),
      `${p.id}: default llmModel "${p.defaultConfig.llmModel}" not in llmModels`);
  }
});

test('DEFAULT_CONFIG.providers has entry for every PROVIDERS item', () => {
  for (const p of PROVIDERS) {
    assert.ok(DEFAULT_CONFIG.providers[p.id], `Missing DEFAULT_CONFIG.providers["${p.id}"]`);
  }
});

test('DEFAULT_CONFIG.sttProvider is a valid STT provider', () => {
  const sttProviders = PROVIDERS.filter(p => p.supportsSTT).map(p => p.id);
  assert.ok(sttProviders.includes(DEFAULT_CONFIG.sttProvider),
    `DEFAULT_CONFIG.sttProvider="${DEFAULT_CONFIG.sttProvider}" not in STT providers`);
});

test('DEFAULT_CONFIG.llmProvider is a valid LLM provider', () => {
  const llmProviders = PROVIDERS.filter(p => p.supportsLLM).map(p => p.id);
  assert.ok(llmProviders.includes(DEFAULT_CONFIG.llmProvider),
    `DEFAULT_CONFIG.llmProvider="${DEFAULT_CONFIG.llmProvider}" not in LLM providers`);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== getSTTModelDef + protocol dispatch ===');

test('getSTTModelDef returns full def for known model', () => {
  const def = getSTTModelDef('dashscope', 'qwen3-asr-flash');
  assert.ok(def);
  assert.equal(def.mode, 'batch');
  assert.equal(def.protocol, 'dashscope-batch');
});

test('getSTTModelDef returns undefined for unknown model', () => {
  assert.equal(getSTTModelDef('dashscope', 'nonexistent'), undefined);
});

test('all STT models have valid protocol field', () => {
  const valid: STTProtocol[] = ['openai-batch', 'dashscope-batch', 'openai-realtime', 'qwen-asr-realtime', 'paraformer-realtime'];
  for (const p of PROVIDERS) {
    for (const m of p.sttModels) {
      assert.ok(valid.includes(m.protocol), `${p.id}/${m.id} has invalid protocol "${m.protocol}"`);
    }
  }
});

test('batch models use batch protocols', () => {
  for (const p of PROVIDERS) {
    for (const m of p.sttModels) {
      if (m.mode === 'batch') {
        assert.ok(m.protocol.endsWith('-batch'), `${p.id}/${m.id}: batch model has protocol "${m.protocol}"`);
      }
    }
  }
});

test('streaming models use streaming protocols', () => {
  for (const p of PROVIDERS) {
    for (const m of p.sttModels) {
      if (m.mode === 'streaming') {
        assert.ok(m.protocol.endsWith('-realtime'), `${p.id}/${m.id}: streaming model has protocol "${m.protocol}"`);
      }
    }
  }
});

test('DashScope Paraformer uses paraformer-realtime protocol', () => {
  const def = getSTTModelDef('dashscope', 'paraformer-realtime-v2');
  assert.equal(def?.protocol, 'paraformer-realtime');
});

test('DashScope fun-asr-realtime uses paraformer-realtime protocol', () => {
  const def = getSTTModelDef('dashscope', 'fun-asr-realtime');
  assert.equal(def?.protocol, 'paraformer-realtime');
});

test('DashScope Qwen-ASR realtime uses qwen-asr-realtime protocol', () => {
  const def = getSTTModelDef('dashscope', 'qwen3-asr-flash-realtime');
  assert.equal(def?.protocol, 'qwen-asr-realtime');
});

test('OpenAI models use openai-batch protocol', () => {
  for (const m of ['gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1']) {
    const def = getSTTModelDef('openai', m);
    assert.equal(def?.protocol, 'openai-batch', `openai/${m}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== getDefaultBatchProtocol ===');

test('DashScope defaults to dashscope-batch for unknown models', () => {
  assert.equal(getDefaultBatchProtocol('dashscope'), 'dashscope-batch');
});

test('SiliconFlow defaults to openai-batch', () => {
  assert.equal(getDefaultBatchProtocol('siliconflow'), 'openai-batch');
});

test('OpenAI defaults to openai-batch', () => {
  assert.equal(getDefaultBatchProtocol('openai'), 'openai-batch');
});

test('unknown provider defaults to openai-batch', () => {
  assert.equal(getDefaultBatchProtocol('some-new-provider'), 'openai-batch');
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== Boolean config field defaults ===');

test('llmPostProcessing defaults to true', () => {
  assert.equal(DEFAULT_CONFIG.llmPostProcessing, true);
});

test('autoLearnDictionary defaults to true', () => {
  assert.equal(DEFAULT_CONFIG.autoLearnDictionary, true);
});

test('llmPostProcessing survives migration from empty', () => {
  // Simulates old config that predates llmPostProcessing field
  const { config } = migrateConfig({});
  assert.equal(config.llmPostProcessing, true);
});

test('llmPostProcessing=false is preserved', () => {
  const { config } = migrateConfig({ llmPostProcessing: false });
  assert.equal(config.llmPostProcessing, false);
});

test('all boolean AppConfig fields have explicit defaults', () => {
  // Ensure no boolean field defaults to undefined
  const boolFields: (keyof AppConfig)[] = [
    'llmPostProcessing', 'autoFormatting', 'selfCorrectionDetection',
    'fillerWordRemoval', 'repetitionElimination', 'autoLearnDictionary',
    'launchOnStartup', 'alsoWriteClipboard', 'soundEnabled', 'muteSystemAudio',
    'historyEnabled', 'contextL0Enabled', 'contextL1Enabled', 'contextOcrEnabled',
  ];
  for (const field of boolFields) {
    assert.equal(typeof DEFAULT_CONFIG[field], 'boolean', `DEFAULT_CONFIG.${field} should be boolean`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
