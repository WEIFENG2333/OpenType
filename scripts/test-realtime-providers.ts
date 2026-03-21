/**
 * Test realtime STT session creation with the new providers config format.
 * Verifies that getProviderConfig resolves correctly for all STT providers.
 *
 * Usage: npx tsx scripts/test-realtime-providers.ts
 */
import { AppConfig, DEFAULT_CONFIG, PROVIDERS, getProviderConfig, getSTTProviderOpts } from '../src/types/config';

console.log('=== Provider Config Resolution Test ===\n');

// 1. Test with default config (fresh install)
console.log('--- Default config (fresh install) ---');
for (const p of PROVIDERS.filter(p => p.supportsSTT)) {
  const pc = getProviderConfig(DEFAULT_CONFIG, p.id);
  console.log(`  ${p.id}:`);
  console.log(`    apiKey:   "${pc.apiKey.slice(0, 8) || '(empty)'}..."`);
  console.log(`    baseUrl:  "${pc.baseUrl}"`);
  console.log(`    sttModel: "${pc.sttModel}"`);
  console.log(`    llmModel: "${pc.llmModel}"`);
}

// 2. Test getSTTProviderOpts for each STT provider
console.log('\n--- getSTTProviderOpts ---');
for (const p of PROVIDERS.filter(p => p.supportsSTT)) {
  const cfg: AppConfig = { ...DEFAULT_CONFIG, sttProvider: p.id as any };
  const opts = getSTTProviderOpts(cfg);
  console.log(`  ${p.id}: model="${opts.model}", baseUrl="${opts.baseUrl}", hasKey=${!!opts.apiKey}`);
}

// 3. Simulate migrated config (old flat fields → new providers map)
console.log('\n--- Migration simulation ---');
const oldConfig: any = {
  sttProvider: 'dashscope',
  llmProvider: 'siliconflow',
  dashscopeApiKey: 'sk-test-dashscope-key',
  dashscopeBaseUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime',
  dashscopeSttModel: 'qwen3-asr-flash-realtime',
  siliconflowApiKey: 'sk-test-sf-key',
  siliconflowBaseUrl: 'https://api.siliconflow.cn/v1',
  siliconflowSttModel: 'FunAudioLLM/SenseVoiceSmall',
  siliconflowLlmModel: 'Pro/deepseek-ai/DeepSeek-V3.2',
};

// Simulate migration logic from config-store.ts
if (!oldConfig.providers) {
  const OLD_PREFIXES: Record<string, { prefix: string; hasStt: boolean; hasLlm: boolean }> = {
    siliconflow: { prefix: 'siliconflow', hasStt: true, hasLlm: true },
    openrouter:  { prefix: 'openrouter', hasStt: false, hasLlm: true },
    openai:      { prefix: 'openai', hasStt: true, hasLlm: true },
    dashscope:   { prefix: 'dashscope', hasStt: true, hasLlm: false },
    'openai-compatible': { prefix: 'compatible', hasStt: true, hasLlm: true },
  };
  oldConfig.providers = { ...DEFAULT_CONFIG.providers };
  for (const [id, info] of Object.entries(OLD_PREFIXES)) {
    const defaults = DEFAULT_CONFIG.providers[id] || { apiKey: '', baseUrl: '', sttModel: '', llmModel: '' };
    oldConfig.providers[id] = {
      apiKey: oldConfig[`${info.prefix}ApiKey`] ?? defaults.apiKey,
      baseUrl: oldConfig[`${info.prefix}BaseUrl`] ?? defaults.baseUrl,
      sttModel: info.hasStt ? (oldConfig[`${info.prefix}SttModel`] ?? defaults.sttModel) : defaults.sttModel,
      llmModel: info.hasLlm ? (oldConfig[`${info.prefix}LlmModel`] ?? defaults.llmModel) : defaults.llmModel,
    };
  }
}

const migratedConfig: AppConfig = { ...DEFAULT_CONFIG, ...oldConfig };
const dashPC = getProviderConfig(migratedConfig, 'dashscope');
const sfPC = getProviderConfig(migratedConfig, 'siliconflow');

console.log(`  dashscope after migration:`);
console.log(`    apiKey:   "${dashPC.apiKey}"`);
console.log(`    baseUrl:  "${dashPC.baseUrl}"`);
console.log(`    sttModel: "${dashPC.sttModel}"`);

console.log(`  siliconflow after migration:`);
console.log(`    apiKey:   "${sfPC.apiKey}"`);
console.log(`    baseUrl:  "${sfPC.baseUrl}"`);
console.log(`    sttModel: "${sfPC.sttModel}"`);
console.log(`    llmModel: "${sfPC.llmModel}"`);

const sttOpts = getSTTProviderOpts(migratedConfig);
console.log(`\n  getSTTProviderOpts(dashscope): model="${sttOpts.model}", baseUrl="${sttOpts.baseUrl}", hasKey=${!!sttOpts.apiKey}`);

// 4. Test with providers map already set (normal post-migration state)
console.log('\n--- Direct providers map config ---');
const newConfig: AppConfig = {
  ...DEFAULT_CONFIG,
  sttProvider: 'dashscope',
  providers: {
    ...DEFAULT_CONFIG.providers,
    dashscope: {
      apiKey: 'sk-direct-key',
      baseUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime',
      sttModel: 'paraformer-realtime-v2',
      llmModel: '',
    },
  },
};
const directOpts = getSTTProviderOpts(newConfig);
console.log(`  getSTTProviderOpts: model="${directOpts.model}", baseUrl="${directOpts.baseUrl}", hasKey=${!!directOpts.apiKey}`);

// 5. Edge case: provider not in map → falls back to PROVIDER_MAP defaults
console.log('\n--- Missing provider in map (fallback) ---');
const sparseConfig: AppConfig = {
  ...DEFAULT_CONFIG,
  sttProvider: 'dashscope',
  providers: {},  // empty!
};
const fallbackPC = getProviderConfig(sparseConfig, 'dashscope');
console.log(`  dashscope fallback: sttModel="${fallbackPC.sttModel}", baseUrl="${fallbackPC.baseUrl}"`);

console.log('\n=== All tests passed ===');
