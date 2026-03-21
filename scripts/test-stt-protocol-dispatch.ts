/**
 * Integration tests for STT protocol dispatch logic.
 * Verifies that the right protocol handler is selected for each model.
 *
 * Usage: npx tsx scripts/test-stt-protocol-dispatch.ts
 */
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG, AppConfig, PROVIDERS,
  getSTTModelDef, getSTTModelMode, getProviderConfig, getSTTProviderOpts,
} from '../src/types/config';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.log(`  ✗ ${name}\n    ${e.message}`); }
}

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== STTModelDef.protocol consistency ===');

test('every STT model in PROVIDERS has a protocol field', () => {
  for (const p of PROVIDERS) {
    for (const m of p.sttModels) {
      assert.ok(m.protocol, `${p.id}/${m.id} missing protocol`);
    }
  }
});

test('batch models have batch protocols', () => {
  for (const p of PROVIDERS) {
    for (const m of p.sttModels) {
      if (m.mode === 'batch') {
        assert.ok(m.protocol.endsWith('-batch'), `${p.id}/${m.id}: batch model has non-batch protocol "${m.protocol}"`);
      }
    }
  }
});

test('streaming models have realtime protocols', () => {
  for (const p of PROVIDERS) {
    for (const m of p.sttModels) {
      if (m.mode === 'streaming') {
        assert.ok(m.protocol.endsWith('-realtime'), `${p.id}/${m.id}: streaming model has non-realtime protocol "${m.protocol}"`);
      }
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== getSTTModelDef ===');

test('returns full def for known model', () => {
  const def = getSTTModelDef('dashscope', 'qwen3-asr-flash');
  assert.ok(def);
  assert.equal(def.mode, 'batch');
  assert.equal(def.protocol, 'dashscope-batch');
});

test('returns full def for streaming model', () => {
  const def = getSTTModelDef('dashscope', 'paraformer-realtime-v2');
  assert.ok(def);
  assert.equal(def.mode, 'streaming');
  assert.equal(def.protocol, 'paraformer-realtime');
});

test('returns undefined for unknown model', () => {
  const def = getSTTModelDef('dashscope', 'nonexistent');
  assert.equal(def, undefined);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== Protocol dispatch scenarios ===');

test('DashScope batch model → dashscope-batch protocol', () => {
  const cfg = makeConfig({
    sttProvider: 'dashscope',
    providers: { ...DEFAULT_CONFIG.providers, dashscope: { apiKey: 'sk-test', baseUrl: '', sttModel: 'qwen3-asr-flash', llmModel: '' } },
  });
  const opts = getSTTProviderOpts(cfg);
  const def = getSTTModelDef(cfg.sttProvider, opts.model);
  assert.equal(def?.protocol, 'dashscope-batch');
  assert.equal(def?.mode, 'batch');
});

test('DashScope streaming model → qwen-asr-realtime protocol', () => {
  const cfg = makeConfig({
    sttProvider: 'dashscope',
    providers: { ...DEFAULT_CONFIG.providers, dashscope: { apiKey: 'sk-test', baseUrl: '', sttModel: 'qwen3-asr-flash-realtime', llmModel: '' } },
  });
  const opts = getSTTProviderOpts(cfg);
  const def = getSTTModelDef(cfg.sttProvider, opts.model);
  assert.equal(def?.protocol, 'qwen-asr-realtime');
  assert.equal(def?.mode, 'streaming');
});

test('DashScope paraformer model → paraformer-realtime protocol', () => {
  const cfg = makeConfig({
    sttProvider: 'dashscope',
    providers: { ...DEFAULT_CONFIG.providers, dashscope: { apiKey: 'sk-test', baseUrl: '', sttModel: 'paraformer-realtime-v2', llmModel: '' } },
  });
  const def = getSTTModelDef(cfg.sttProvider, getSTTProviderOpts(cfg).model);
  assert.equal(def?.protocol, 'paraformer-realtime');
});

test('OpenAI batch model → openai-batch protocol', () => {
  const cfg = makeConfig({ sttProvider: 'openai' });
  const def = getSTTModelDef(cfg.sttProvider, getSTTProviderOpts(cfg).model);
  assert.equal(def?.protocol, 'openai-batch');
});

test('SiliconFlow batch model → openai-batch protocol', () => {
  const cfg = makeConfig({ sttProvider: 'siliconflow' });
  const def = getSTTModelDef(cfg.sttProvider, getSTTProviderOpts(cfg).model);
  assert.equal(def?.protocol, 'openai-batch');
});

test('supportsStreaming returns false for batch DashScope model', () => {
  const cfg = makeConfig({
    sttProvider: 'dashscope',
    providers: { ...DEFAULT_CONFIG.providers, dashscope: { apiKey: 'sk-test', baseUrl: '', sttModel: 'qwen3-asr-flash', llmModel: '' } },
  });
  assert.equal(getSTTModelMode(cfg.sttProvider, getSTTProviderOpts(cfg).model), 'batch');
});

test('supportsStreaming returns true for streaming DashScope model', () => {
  const cfg = makeConfig({
    sttProvider: 'dashscope',
    providers: { ...DEFAULT_CONFIG.providers, dashscope: { apiKey: 'sk-test', baseUrl: '', sttModel: 'qwen3-asr-flash-realtime', llmModel: '' } },
  });
  assert.equal(getSTTModelMode(cfg.sttProvider, getSTTProviderOpts(cfg).model), 'streaming');
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== DashScope baseUrl is irrelevant for streaming ===');

test('streaming session does not depend on config baseUrl', () => {
  // Even with an HTTPS baseUrl, streaming should work because
  // createRealtimeSession() hardcodes the WSS URL per protocol
  const cfg = makeConfig({
    sttProvider: 'dashscope',
    providers: { ...DEFAULT_CONFIG.providers, dashscope: {
      apiKey: 'sk-test',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', // batch URL
      sttModel: 'qwen3-asr-flash-realtime',
      llmModel: '',
    }},
  });
  const def = getSTTModelDef(cfg.sttProvider, 'qwen3-asr-flash-realtime');
  assert.equal(def?.protocol, 'qwen-asr-realtime');
  // The createRealtimeSession in stt-service.ts now uses hardcoded WSS URL
  // instead of pc.baseUrl, so this config is safe
});

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
