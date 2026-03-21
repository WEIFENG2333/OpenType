/**
 * Test config migration: simulates the exact scenario where config.json
 * has both old flat fields AND a providers map with empty values.
 *
 * Usage: npx tsx scripts/test-migration.ts
 */
import { DEFAULT_CONFIG, getProviderConfig, getSTTProviderOpts, getLLMProviderOpts } from '../src/types/config';

// Simulate the broken state: providers exists but apiKeys are empty,
// while old flat fields have the real values
const rawFromDisk: any = {
  sttProvider: 'dashscope',
  llmProvider: 'siliconflow',
  // Old flat fields (have real values)
  dashscopeApiKey: 'sk-real-dashscope-key',
  dashscopeBaseUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime',
  dashscopeSttModel: 'qwen3-asr-flash-realtime',
  siliconflowApiKey: 'sk-real-sf-key',
  siliconflowBaseUrl: 'https://api.siliconflow.cn/v1',
  siliconflowSttModel: 'FunAudioLLM/SenseVoiceSmall',
  siliconflowLlmModel: 'Pro/deepseek-ai/DeepSeek-V3.2',
  // providers map exists but with empty apiKeys (from previous bad migration)
  providers: {
    siliconflow: { apiKey: '', baseUrl: 'https://api.siliconflow.cn/v1', sttModel: 'FunAudioLLM/SenseVoiceSmall', llmModel: 'Pro/deepseek-ai/DeepSeek-V3.2' },
    dashscope: { apiKey: '', baseUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime', sttModel: 'qwen3-asr-flash-realtime', llmModel: '' },
    openrouter: { apiKey: '', baseUrl: 'https://openrouter.ai/api/v1', sttModel: '', llmModel: 'google/gemini-2.5-flash' },
    openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', sttModel: 'gpt-4o-transcribe', llmModel: 'gpt-5-mini' },
    'openai-compatible': { apiKey: '', baseUrl: '', sttModel: 'whisper-1', llmModel: '' },
  },
};

// Run the same migration logic as config-store.ts
const raw: any = { ...DEFAULT_CONFIG, ...rawFromDisk };

const OLD_PREFIXES: Record<string, { prefix: string; hasStt: boolean; hasLlm: boolean }> = {
  siliconflow: { prefix: 'siliconflow', hasStt: true, hasLlm: true },
  openrouter:  { prefix: 'openrouter', hasStt: false, hasLlm: true },
  openai:      { prefix: 'openai', hasStt: true, hasLlm: true },
  dashscope:   { prefix: 'dashscope', hasStt: true, hasLlm: false },
  'openai-compatible': { prefix: 'compatible', hasStt: true, hasLlm: true },
};

if (!raw.providers || typeof raw.providers !== 'object' || Array.isArray(raw.providers)) {
  raw.providers = { ...DEFAULT_CONFIG.providers };
}
let hasOldFields = false;
for (const [id, info] of Object.entries(OLD_PREFIXES)) {
  const oldKey = raw[`${info.prefix}ApiKey`];
  if (oldKey === undefined) continue;
  hasOldFields = true;
  const existing = raw.providers[id] || DEFAULT_CONFIG.providers[id] || { apiKey: '', baseUrl: '', sttModel: '', llmModel: '' };
  raw.providers[id] = {
    apiKey: raw[`${info.prefix}ApiKey`] ?? existing.apiKey,
    baseUrl: raw[`${info.prefix}BaseUrl`] ?? existing.baseUrl,
    sttModel: info.hasStt ? (raw[`${info.prefix}SttModel`] ?? existing.sttModel) : existing.sttModel,
    llmModel: info.hasLlm ? (raw[`${info.prefix}LlmModel`] ?? existing.llmModel) : existing.llmModel,
  };
  delete raw[`${info.prefix}ApiKey`];
  delete raw[`${info.prefix}BaseUrl`];
  if (info.hasStt) delete raw[`${info.prefix}SttModel`];
  if (info.hasLlm) delete raw[`${info.prefix}LlmModel`];
}

console.log('hasOldFields:', hasOldFields);
console.log('\n--- After migration ---');
for (const [id, pc] of Object.entries(raw.providers as Record<string, any>)) {
  console.log(`  ${id}: apiKey=${!!pc.apiKey} ("${String(pc.apiKey).slice(0,10)}..."), sttModel="${pc.sttModel}"`);
}

// Verify via helpers
const sttOpts = getSTTProviderOpts(raw);
const llmOpts = getLLMProviderOpts(raw);
console.log('\ngetSTTProviderOpts:', { hasKey: !!sttOpts.apiKey, model: sttOpts.model, baseUrl: sttOpts.baseUrl });
console.log('getLLMProviderOpts:', { hasKey: !!llmOpts.apiKey, model: llmOpts.model, baseUrl: llmOpts.baseUrl });

// Verify old fields are cleaned up
console.log('\nOld fields cleaned up:', !raw.dashscopeApiKey && !raw.siliconflowApiKey);

// Assert
const ok = sttOpts.apiKey === 'sk-real-dashscope-key' && llmOpts.apiKey === 'sk-real-sf-key';
console.log(ok ? '\n=== PASS ===' : '\n=== FAIL ===');
process.exit(ok ? 0 : 1);
