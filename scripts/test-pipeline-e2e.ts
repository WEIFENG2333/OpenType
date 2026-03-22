/**
 * Pipeline E2E tests — every test calls REAL exported functions.
 * Zero fake/inline logic. If the code changes, these tests break.
 *
 * Unit tests: call real functions with crafted inputs, no API keys needed.
 * Integration tests: real audio → real STT API → real LLM API.
 *
 * Usage:
 *   npx tsx scripts/test-pipeline-e2e.ts                                    # unit only
 *   DASHSCOPE_KEY=sk-xxx SILICONFLOW_KEY=sk-xxx npx tsx scripts/test-pipeline-e2e.ts  # + integration
 */
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { DEFAULT_CONFIG, AppConfig } from '../src/types/config';
import { buildSystemPrompt, LLMService } from '../electron/llm-service';
import { buildOpenAIConfig, buildQwenASRConfig, STTService, parseApiError } from '../electron/stt-service';

let passed = 0;
let failed = 0;
const skipped: string[] = [];

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n    ${e instanceof Error ? e.message : String(e)}`); }
}

function skip(name: string, reason: string) {
  skipped.push(name);
  console.log(`  ⊘ ${name} (${reason})`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. STT Config Builders — call real buildOpenAIConfig / buildQwenASRConfig
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== buildOpenAIConfig ===');

test('returns correct WebSocket URL and auth headers', () => {
  const cfg = buildOpenAIConfig('sk-test-key', 'gpt-4o-transcribe');
  assert.equal(cfg.wsUrl, 'wss://api.openai.com/v1/realtime?intent=transcription');
  assert.equal(cfg.sampleRate, 24000);
  assert.equal(cfg.headers['Authorization'], 'Bearer sk-test-key');
});

test('session update embeds the model name', () => {
  const cfg = buildOpenAIConfig('sk-x', 'whisper-1');
  assert.equal(cfg.sessionUpdateEvent.session.input_audio_transcription.model, 'whisper-1');
});

test('uses manual commit (no VAD)', () => {
  const cfg = buildOpenAIConfig('sk-x', 'gpt-4o-transcribe');
  assert.equal(cfg.usesVAD, false);
  assert.equal(cfg.commitEvent?.type, 'input_audio_buffer.commit');
});

test('extractDelta accumulates correctly across calls', () => {
  const cfg = buildOpenAIConfig('sk-x', 'm');
  const r1 = cfg.extractDelta({ delta: '你好' }, '');
  const r2 = cfg.extractDelta({ delta: '世界' }, r1.accumulated);
  assert.equal(r2.accumulated, '你好世界');
});

test('extractTranscript returns final text', () => {
  const cfg = buildOpenAIConfig('sk-x', 'm');
  assert.equal(cfg.extractTranscript({ transcript: '最终结果' }), '最终结果');
  assert.equal(cfg.extractTranscript({}), '');
});

console.log('\n=== buildQwenASRConfig ===');

test('WSS URL includes model as query param', () => {
  const cfg = buildQwenASRConfig('sk-ds', 'qwen3-asr-flash-realtime', 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime');
  assert.equal(cfg.wsUrl, 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=qwen3-asr-flash-realtime');
  assert.equal(cfg.sampleRate, 16000);
});

test('uses server VAD with finish event (no commit)', () => {
  const cfg = buildQwenASRConfig('sk-x', 'm', 'wss://x');
  assert.equal(cfg.usesVAD, true);
  assert.ok(cfg.finishEvent);
  assert.equal(cfg.commitEvent, undefined);
});

test('extractDelta separates confirmed text from stash', () => {
  const cfg = buildQwenASRConfig('sk-x', 'm', 'wss://x');
  const r = cfg.extractDelta({ text: '已确认', stash: '正在说' }, '');
  assert.equal(r.text, '正在说');       // display: shows stash (partial)
  assert.equal(r.accumulated, '已确认正在说'); // full: confirmed + stash
});

test('extractDelta with empty stash shows nothing new', () => {
  const cfg = buildQwenASRConfig('sk-x', 'm', 'wss://x');
  const r = cfg.extractDelta({ text: '完整', stash: '' }, '');
  assert.equal(r.text, '');
  assert.equal(r.accumulated, '完整');
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. STTService — call real supportsStreaming / transcribe error paths
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== STTService.supportsStreaming ===');

test('SiliconFlow batch model → false', () => {
  assert.equal(new STTService().supportsStreaming(DEFAULT_CONFIG), false);
});

test('DashScope streaming model → true', () => {
  const cfg: AppConfig = { ...DEFAULT_CONFIG, sttProvider: 'dashscope',
    providers: { ...DEFAULT_CONFIG.providers, dashscope: { apiKey: 'x', baseUrl: 'wss://x', sttModel: 'qwen3-asr-flash-realtime', llmModel: '' } } };
  assert.equal(new STTService().supportsStreaming(cfg), true);
});

test('Paraformer model → true', () => {
  const cfg: AppConfig = { ...DEFAULT_CONFIG, sttProvider: 'dashscope',
    providers: { ...DEFAULT_CONFIG.providers, dashscope: { apiKey: 'x', baseUrl: 'wss://x', sttModel: 'paraformer-realtime-v2', llmModel: '' } } };
  assert.equal(new STTService().supportsStreaming(cfg), true);
});

test('unknown custom model → false (batch default)', () => {
  const cfg: AppConfig = { ...DEFAULT_CONFIG, sttProvider: 'dashscope',
    providers: { ...DEFAULT_CONFIG.providers, dashscope: { apiKey: 'x', baseUrl: 'wss://x', sttModel: 'future-model-v9', llmModel: '' } } };
  assert.equal(new STTService().supportsStreaming(cfg), false);
});

console.log('\n=== STTService.transcribe error guards ===');

test('rejects streaming-only model with clear error', async () => {
  const cfg: AppConfig = { ...DEFAULT_CONFIG, sttProvider: 'dashscope',
    providers: { ...DEFAULT_CONFIG.providers, dashscope: { apiKey: 'sk-x', baseUrl: 'https://x', sttModel: 'qwen3-asr-flash-realtime', llmModel: '' } } };
  await assert.rejects(() => new STTService().transcribe(Buffer.alloc(100), cfg), /streaming-only/);
});

test('rejects empty API key', async () => {
  const cfg: AppConfig = { ...DEFAULT_CONFIG, sttProvider: 'siliconflow',
    providers: { ...DEFAULT_CONFIG.providers, siliconflow: { apiKey: '', baseUrl: 'https://x', sttModel: 'FunAudioLLM/SenseVoiceSmall', llmModel: '' } } };
  await assert.rejects(() => new STTService().transcribe(Buffer.alloc(100), cfg), /No API key/);
});

test('rejects empty model', async () => {
  const cfg: AppConfig = { ...DEFAULT_CONFIG, sttProvider: 'siliconflow',
    providers: { ...DEFAULT_CONFIG.providers, siliconflow: { apiKey: 'sk-x', baseUrl: 'https://x', sttModel: '', llmModel: '' } } };
  await assert.rejects(() => new STTService().transcribe(Buffer.alloc(100), cfg), /No STT model/);
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. buildSystemPrompt — call the real function, verify output structure
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== buildSystemPrompt ===');

const mockTone = (_cfg: AppConfig, _app: string) => ({ tone: 'professional' as string });

test('all toggles ON → prompt has more numbered rules than OFF', () => {
  const allOn = buildSystemPrompt(DEFAULT_CONFIG, undefined, mockTone);
  const allOff = buildSystemPrompt({ ...DEFAULT_CONFIG, fillerWordRemoval: false, repetitionElimination: false, selfCorrectionDetection: false, autoFormatting: false }, undefined, mockTone);
  // Count numbered rules (e.g., "1. ", "2. ", etc.)
  const countRules = (p: string) => (p.match(/^\d+\.\s/gm) || []).length;
  const onRules = countRules(allOn);
  const offRules = countRules(allOff);
  assert.ok(onRules > offRules, `ON=${onRules} should be > OFF=${offRules}`);
  assert.ok(onRules >= 6, `Expected at least 6 rules with all ON, got ${onRules}`);
  assert.ok(offRules >= 3, `Expected at least 3 base rules, got ${offRules}`);
});

test('toggling individual features changes rule count', () => {
  const countRules = (p: string) => (p.match(/^\d+\.\s/gm) || []).length;
  const base = countRules(buildSystemPrompt({ ...DEFAULT_CONFIG, fillerWordRemoval: false, repetitionElimination: false, selfCorrectionDetection: false, autoFormatting: false }, undefined, mockTone));
  const withFiller = countRules(buildSystemPrompt({ ...DEFAULT_CONFIG, fillerWordRemoval: true, repetitionElimination: false, selfCorrectionDetection: false, autoFormatting: false }, undefined, mockTone));
  assert.equal(withFiller, base + 1, 'fillerWordRemoval should add exactly 1 rule');
});

test('dictionary terms injected into Hot Word Table', () => {
  const cfg = { ...DEFAULT_CONFIG, personalDictionary: [{ word: 'ByteDance', source: 'manual' as const }, { word: '飞书', source: 'auto-llm' as const }] };
  const p = buildSystemPrompt(cfg, undefined, mockTone);
  assert.ok(p.includes('Hot Word Table'));
  assert.ok(p.includes('ByteDance'));
  assert.ok(p.includes('飞书'));
});

test('context fields injected: appName, clipboard, OCR, recent', () => {
  const ctx: any = { appName: 'Slack', clipboardText: 'paste-me', screenContext: 'OCR结果', recentTranscriptions: ['上一句'] };
  const p = buildSystemPrompt(DEFAULT_CONFIG, ctx, (_c, _a) => ({ tone: 'casual' }));
  assert.ok(p.includes('Active app "Slack"'));
  assert.ok(p.includes('Casual'));
  assert.ok(p.includes('paste-me'));
  assert.ok(p.includes('OCR结果'));
  assert.ok(p.includes('上一句'));
});

test('custom tone prompt injected', () => {
  const ctx: any = { appName: 'MyApp' };
  const p = buildSystemPrompt(DEFAULT_CONFIG, ctx, () => ({ tone: 'custom', customPrompt: '请用诗歌形式回答' }));
  assert.ok(p.includes('请用诗歌形式回答'));
});

// buildFieldContext + smartTruncate tested thoroughly in test-llm-helpers.ts

// ═══════════════════════════════════════════════════════════════════════════
// 3b. parseApiError — pure function for human-readable API error extraction
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== parseApiError ===');

test('parses OpenAI-style JSON error', () => {
  const result = parseApiError(401, '{"error":{"message":"Invalid API key"}}');
  assert.equal(result, '401: Invalid API key');
});

test('parses flat message JSON', () => {
  const result = parseApiError(429, '{"message":"Rate limit exceeded"}');
  assert.equal(result, '429: Rate limit exceeded');
});

test('parses error as string field', () => {
  const result = parseApiError(500, '{"error":"Internal server error"}');
  assert.equal(result, '500: Internal server error');
});

test('handles non-string error object', () => {
  const result = parseApiError(400, '{"error":{"type":"invalid_request","message":"Bad input"}}');
  assert.equal(result, '400: Bad input');
});

test('falls back to plain text for non-JSON body', () => {
  const result = parseApiError(502, 'Bad Gateway');
  assert.equal(result, '502: Bad Gateway');
});

test('truncates long plain text body to 200 chars', () => {
  const longBody = 'X'.repeat(500);
  const result = parseApiError(500, longBody);
  assert.ok(result.startsWith('500: '));
  assert.ok(result.length <= 210); // "500: " + 200 chars
});

test('handles empty body', () => {
  const result = parseApiError(404, '');
  assert.equal(result, '404: ');
});

test('handles JSON with no recognized error fields', () => {
  const result = parseApiError(500, '{"status":"failed","code":123}');
  // No error/message fields → falls through to plain text
  assert.ok(result.startsWith('500: '));
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. LLMService.process — empty input guard (calls real code)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== LLMService.process ===');

test('empty input returns empty without API call', async () => {
  const llm = new LLMService();
  const r = await llm.process('', DEFAULT_CONFIG);
  assert.equal(r.text, '');
  assert.equal(r.systemPrompt, '');
});

test('whitespace-only input returns empty', async () => {
  const llm = new LLMService();
  const r = await llm.process('   \n  ', DEFAULT_CONFIG);
  assert.equal(r.text, '');
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Integration: Real audio → Real API (skipped without keys)
// ═══════════════════════════════════════════════════════════════════════════

const AUDIO_FILE = path.join(__dirname, '..', 'test-fixtures', 'angry.wav');
const hasAudio = fs.existsSync(AUDIO_FILE);
const dashscopeKey = process.env.DASHSCOPE_KEY || '';
const siliconflowKey = process.env.SILICONFLOW_KEY || '';

async function runIntegrationTests() {
  console.log('\n=== Integration: Real Audio ===');
  if (!hasAudio) { skip('all integration tests', 'test-fixtures/angry.wav not found'); return; }
  const audio = fs.readFileSync(AUDIO_FILE);
  console.log(`  Audio: ${audio.length} bytes`);

  // DashScope STT
  if (dashscopeKey) {
    try {
      const cfg: AppConfig = { ...DEFAULT_CONFIG, sttProvider: 'dashscope',
        providers: { ...DEFAULT_CONFIG.providers, dashscope: { apiKey: dashscopeKey, baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', sttModel: 'qwen3-asr-flash', llmModel: '' } } };
      const t0 = Date.now();
      const text = await new STTService().transcribe(audio as any, cfg);
      console.log(`  ✓ DashScope STT (${Date.now() - t0}ms): "${text}"`);
      assert.ok(text.length > 3, 'Expected at least a few characters from 3.2s audio');
      passed++;
    } catch (e) { failed++; console.log(`  ✗ DashScope STT: ${e instanceof Error ? e.message : String(e)}`); }
  } else { skip('DashScope STT', 'DASHSCOPE_KEY not set'); }

  // SiliconFlow STT
  if (siliconflowKey) {
    try {
      const cfg: AppConfig = { ...DEFAULT_CONFIG, sttProvider: 'siliconflow',
        providers: { ...DEFAULT_CONFIG.providers, siliconflow: { apiKey: siliconflowKey, baseUrl: 'https://api.siliconflow.cn/v1', sttModel: 'FunAudioLLM/SenseVoiceSmall', llmModel: '' } } };
      const t0 = Date.now();
      const text = await new STTService().transcribe(audio as any, cfg);
      console.log(`  ✓ SiliconFlow STT (${Date.now() - t0}ms): "${text}"`);
      assert.ok(text.length > 3, 'Expected at least a few characters from 3.2s audio');
      passed++;
    } catch (e) { failed++; console.log(`  ✗ SiliconFlow STT: ${e instanceof Error ? e.message : String(e)}`); }
  } else { skip('SiliconFlow STT', 'SILICONFLOW_KEY not set'); }

  // Full pipeline: STT → LLM
  if (siliconflowKey) {
    try {
      const cfg: AppConfig = { ...DEFAULT_CONFIG, sttProvider: 'siliconflow', llmProvider: 'siliconflow',
        providers: { ...DEFAULT_CONFIG.providers, siliconflow: { apiKey: siliconflowKey, baseUrl: 'https://api.siliconflow.cn/v1', sttModel: 'FunAudioLLM/SenseVoiceSmall', llmModel: 'Qwen/Qwen2.5-7B-Instruct' } } };
      const t0 = Date.now();
      const raw = await new STTService().transcribe(audio as any, cfg);
      const sttMs = Date.now() - t0;
      const t1 = Date.now();
      const { text: processed } = await new LLMService().process(raw, cfg);
      const llmMs = Date.now() - t1;
      console.log(`  ✓ Full pipeline (STT ${sttMs}ms + LLM ${llmMs}ms)`);
      console.log(`    Raw:       "${raw}"`);
      console.log(`    Processed: "${processed}"`);
      assert.ok(processed.length > 0, 'LLM returned empty');
      passed++;
    } catch (e) { failed++; console.log(`  ✗ Full pipeline: ${e instanceof Error ? e.message : String(e)}`); }
  } else { skip('Full pipeline', 'SILICONFLOW_KEY not set'); }
}

runIntegrationTests().then(() => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed${skipped.length ? `, ${skipped.length} skipped` : ''}`);
  process.exit(failed > 0 ? 1 : 0);
});
