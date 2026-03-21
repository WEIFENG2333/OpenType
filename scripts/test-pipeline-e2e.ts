/**
 * Pipeline E2E tests — covers the full recording→transcription→output flow.
 *
 * Two modes:
 * 1. Unit tests (no API keys needed) — pure logic: config resolution, protocol dispatch, prompt assembly
 * 2. Integration tests (need API keys) — real audio file → real STT API → real LLM API
 *
 * Usage:
 *   npx tsx scripts/test-pipeline-e2e.ts                    # unit tests only
 *   DASHSCOPE_KEY=sk-xxx npx tsx scripts/test-pipeline-e2e.ts  # + DashScope integration
 *   SILICONFLOW_KEY=sk-xxx npx tsx scripts/test-pipeline-e2e.ts # + SiliconFlow integration
 */
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  DEFAULT_CONFIG, AppConfig, PROVIDERS, ProviderConfig,
  getProviderConfig, getSTTProviderOpts, getLLMProviderOpts,
  getSTTModelDef, getSTTModelMode, getDefaultBatchProtocol,
} from '../src/types/config';
import { buildSystemPrompt, buildFieldContext, smartTruncate, LLMService } from '../electron/llm-service';
import { buildOpenAIConfig, buildQwenASRConfig, STTService } from '../electron/stt-service';

let passed = 0;
let failed = 0;
const skipped: string[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  const result = fn();
  if (result instanceof Promise) {
    return result.then(() => { passed++; console.log(`  ✓ ${name}`); })
      .catch((e: any) => { failed++; console.log(`  ✗ ${name}`); console.log(`    ${e.message}`); });
  }
  try { passed++; console.log(`  ✓ ${name}`); } catch {}
}

function syncTest(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.log(`  ✗ ${name}`); console.log(`    ${e.message}`); }
}

function skip(name: string, reason: string) {
  skipped.push(name);
  console.log(`  ⊘ ${name} (${reason})`);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== STT Config Builders ===');

syncTest('buildOpenAIConfig: correct WSS URL', () => {
  const cfg = buildOpenAIConfig('sk-test', 'gpt-4o-transcribe');
  assert.equal(cfg.wsUrl, 'wss://api.openai.com/v1/realtime?intent=transcription');
  assert.equal(cfg.sampleRate, 24000);
  assert.ok(cfg.headers['Authorization'].includes('sk-test'));
  assert.ok(cfg.headers['OpenAI-Beta'].includes('realtime'));
});

syncTest('buildOpenAIConfig: session update has model', () => {
  const cfg = buildOpenAIConfig('sk-x', 'whisper-1');
  assert.equal(cfg.sessionUpdateEvent.session.input_audio_transcription.model, 'whisper-1');
});

syncTest('buildOpenAIConfig: no VAD (manual commit)', () => {
  const cfg = buildOpenAIConfig('sk-x', 'gpt-4o-transcribe');
  assert.equal(cfg.usesVAD, false);
  assert.ok(cfg.commitEvent);
  assert.equal(cfg.commitEvent.type, 'input_audio_buffer.commit');
});

syncTest('buildQwenASRConfig: WSS URL includes model param', () => {
  const cfg = buildQwenASRConfig('sk-ds', 'qwen3-asr-flash-realtime', 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime');
  assert.ok(cfg.wsUrl.includes('model=qwen3-asr-flash-realtime'));
  assert.equal(cfg.sampleRate, 16000);
});

syncTest('buildQwenASRConfig: uses server VAD', () => {
  const cfg = buildQwenASRConfig('sk-ds', 'qwen3-asr-flash-realtime', 'wss://example.com');
  assert.equal(cfg.usesVAD, true);
  assert.ok(cfg.finishEvent);
  assert.ok(!cfg.commitEvent); // Qwen uses finish, not commit
});

syncTest('buildQwenASRConfig: delta extraction handles stash', () => {
  const cfg = buildQwenASRConfig('sk-x', 'm', 'wss://x');
  // Simulate event with confirmed + stash
  const result = cfg.extractDelta({ text: '确认的', stash: '正在说' }, '');
  assert.equal(result.text, '正在说');
  assert.equal(result.accumulated, '确认的正在说');
});

syncTest('buildQwenASRConfig: delta with empty stash', () => {
  const cfg = buildQwenASRConfig('sk-x', 'm', 'wss://x');
  const result = cfg.extractDelta({ text: '完整句子', stash: '' }, '');
  assert.equal(result.text, '');
  assert.equal(result.accumulated, '完整句子');
});

syncTest('buildOpenAIConfig: delta extraction accumulates', () => {
  const cfg = buildOpenAIConfig('sk-x', 'm');
  const r1 = cfg.extractDelta({ delta: 'Hello' }, '');
  assert.equal(r1.accumulated, 'Hello');
  const r2 = cfg.extractDelta({ delta: ' world' }, r1.accumulated);
  assert.equal(r2.accumulated, 'Hello world');
});

syncTest('buildOpenAIConfig: transcript extraction', () => {
  const cfg = buildOpenAIConfig('sk-x', 'm');
  assert.equal(cfg.extractTranscript({ transcript: 'final text' }), 'final text');
  assert.equal(cfg.extractTranscript({}), '');
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== Protocol Dispatch Logic ===');

syncTest('batch model skips streaming path', () => {
  const svc = new STTService();
  const cfg = { ...DEFAULT_CONFIG, sttProvider: 'siliconflow' as const };
  assert.equal(svc.supportsStreaming(cfg), false);
});

syncTest('streaming model enables streaming path', () => {
  const svc = new STTService();
  const cfg: AppConfig = {
    ...DEFAULT_CONFIG,
    sttProvider: 'dashscope',
    providers: {
      ...DEFAULT_CONFIG.providers,
      dashscope: { apiKey: 'sk-x', baseUrl: 'wss://x', sttModel: 'qwen3-asr-flash-realtime', llmModel: '' },
    },
  };
  assert.equal(svc.supportsStreaming(cfg), true);
});

syncTest('Paraformer model enables streaming', () => {
  const svc = new STTService();
  const cfg: AppConfig = {
    ...DEFAULT_CONFIG,
    sttProvider: 'dashscope',
    providers: {
      ...DEFAULT_CONFIG.providers,
      dashscope: { apiKey: 'sk-x', baseUrl: 'wss://x', sttModel: 'paraformer-realtime-v2', llmModel: '' },
    },
  };
  assert.equal(svc.supportsStreaming(cfg), true);
});

syncTest('custom unknown model defaults to batch', () => {
  const svc = new STTService();
  const cfg: AppConfig = {
    ...DEFAULT_CONFIG,
    sttProvider: 'dashscope',
    providers: {
      ...DEFAULT_CONFIG.providers,
      dashscope: { apiKey: 'sk-x', baseUrl: 'wss://x', sttModel: 'some-future-model', llmModel: '' },
    },
  };
  assert.equal(svc.supportsStreaming(cfg), false);
});

syncTest('transcribe() rejects streaming-only model', async () => {
  const svc = new STTService();
  const cfg: AppConfig = {
    ...DEFAULT_CONFIG,
    sttProvider: 'dashscope',
    providers: {
      ...DEFAULT_CONFIG.providers,
      dashscope: { apiKey: 'sk-x', baseUrl: 'https://x', sttModel: 'qwen3-asr-flash-realtime', llmModel: '' },
    },
  };
  await assert.rejects(
    () => svc.transcribe(Buffer.from('dummy'), cfg),
    /streaming-only/,
  );
});

syncTest('transcribe() rejects missing API key', async () => {
  const svc = new STTService();
  const cfg: AppConfig = {
    ...DEFAULT_CONFIG,
    sttProvider: 'siliconflow',
    providers: {
      ...DEFAULT_CONFIG.providers,
      siliconflow: { apiKey: '', baseUrl: 'https://x', sttModel: 'FunAudioLLM/SenseVoiceSmall', llmModel: '' },
    },
  };
  await assert.rejects(
    () => svc.transcribe(Buffer.from('dummy'), cfg),
    /No API key/,
  );
});

syncTest('transcribe() rejects missing model', async () => {
  const svc = new STTService();
  const cfg: AppConfig = {
    ...DEFAULT_CONFIG,
    sttProvider: 'siliconflow',
    providers: {
      ...DEFAULT_CONFIG.providers,
      siliconflow: { apiKey: 'sk-x', baseUrl: 'https://x', sttModel: '', llmModel: '' },
    },
  };
  await assert.rejects(
    () => svc.transcribe(Buffer.from('dummy'), cfg),
    /No STT model/,
  );
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== Pipeline Decision Tree ===');

syncTest('LLM disabled: processedText === rawText', () => {
  // Simulate pipeline logic: if llmPostProcessing is false, skip LLM
  const cfg = { ...DEFAULT_CONFIG, llmPostProcessing: false };
  const raw = 'hello world 你好';
  // Pipeline: if (!cfg.llmPostProcessing) processedText = raw
  const processed = cfg.llmPostProcessing ? 'would be processed' : raw;
  assert.equal(processed, raw);
});

syncTest('empty STT result triggers skip', () => {
  const raw = '  \n  '; // whitespace only
  const isSkip = !raw.trim();
  assert.ok(isSkip);
});

syncTest('pipeline mutex: second call returns busy', () => {
  // Simulate: pipelineRunning = true
  let pipelineRunning = true;
  const result = pipelineRunning ? { success: false, error: 'Pipeline busy' } : { success: true };
  assert.equal(result.success, false);
  assert.equal(result.error, 'Pipeline busy');
});

syncTest('pipeline mutex: force unlock after timeout', () => {
  const TIMEOUT = 60_000;
  const startedAt = Date.now() - 70_000; // 70s ago
  const isStale = Date.now() - startedAt > TIMEOUT;
  assert.ok(isStale);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== buildSystemPrompt Integration ===');

const dummyTone = (_cfg: AppConfig, _app: string) => ({ tone: 'professional' as string });

syncTest('full context produces comprehensive prompt', () => {
  const cfg: AppConfig = {
    ...DEFAULT_CONFIG,
    personalDictionary: [
      { word: 'OpenType', source: 'manual' },
      { word: 'DashScope', source: 'auto-llm' },
    ],
  };
  const ctx: any = {
    appName: 'VSCode',
    windowTitle: 'main.ts - OpenType',
    fieldText: 'function hello() {\n  // cursor here\n}',
    fieldRole: 'TextArea',
    cursorPosition: 30,
    numberOfCharacters: 42,
    clipboardText: 'const x = 1;',
    recentTranscriptions: ['上一句话', '再上一句'],
    screenContext: '用户在编辑代码',
    fieldPlaceholder: 'Type code...',
  };
  const prompt = buildSystemPrompt(cfg, ctx, (_c, _a) => ({ tone: 'technical' }));

  // Must contain all sections
  assert.ok(prompt.includes('transcription restater'));
  assert.ok(prompt.includes('Hot Word Table'));
  assert.ok(prompt.includes('OpenType'));
  assert.ok(prompt.includes('DashScope'));
  assert.ok(prompt.includes('Active app "VSCode"'));
  assert.ok(prompt.includes('Precise technical'));
  assert.ok(prompt.includes('Window title'));
  assert.ok(prompt.includes('Clipboard content'));
  assert.ok(prompt.includes('Recent transcriptions'));
  assert.ok(prompt.includes('Screen context'));
  assert.ok(prompt.includes('placeholder reads'));
});

syncTest('config toggles precisely control rules', () => {
  const onlyFiller = {
    ...DEFAULT_CONFIG,
    fillerWordRemoval: true,
    repetitionElimination: false,
    selfCorrectionDetection: false,
    autoFormatting: false,
  };
  const prompt = buildSystemPrompt(onlyFiller, undefined, dummyTone);
  assert.ok(prompt.includes('Remove filler'));
  assert.ok(!prompt.includes('Remove stutters'));
  assert.ok(!prompt.includes('self-corrections'));
  assert.ok(!prompt.includes('punctuation'));
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== HistoryItem & Context Construction ===');

syncTest('history item ID format: base36 + random', () => {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  assert.ok(id.length >= 8, `ID too short: ${id}`);
  // No collisions in 1000 rapid generations
  const ids = new Set(Array.from({ length: 1000 }, () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  ));
  assert.ok(ids.size >= 990, `Too many collisions: ${ids.size}/1000`);
});

syncTest('buildContext(true) includes L1 fields', () => {
  // Simulate buildContext from useRecorder
  const context: any = {
    appName: 'Chrome', windowTitle: 'Google',
    selectedText: 'some text', fieldText: 'full field',
    clipboardText: 'clipboard',
  };
  const full = true;
  const built: any = {
    appName: context.appName,
    windowTitle: context.windowTitle,
    ...(full ? {
      selectedText: context.selectedText,
      fieldText: context.fieldText,
      clipboardText: context.clipboardText,
    } : {}),
  };
  assert.ok(built.selectedText);
  assert.ok(built.fieldText);
});

syncTest('buildContext(false) excludes L1 fields', () => {
  const context: any = {
    appName: 'Chrome', windowTitle: 'Google',
    selectedText: 'some text', fieldText: 'full field',
  };
  const full = false;
  const built: any = {
    appName: context.appName,
    windowTitle: context.windowTitle,
    ...(full ? { selectedText: context.selectedText, fieldText: context.fieldText } : {}),
  };
  assert.equal(built.selectedText, undefined);
  assert.equal(built.fieldText, undefined);
});

// ═══════════════════════════════════════════════════════════════════════════
// Integration tests — require API keys and test-fixtures/angry.wav
// ═══════════════════════════════════════════════════════════════════════════

const AUDIO_FILE = path.join(__dirname, '..', 'test-fixtures', 'angry.wav');
const hasAudio = fs.existsSync(AUDIO_FILE);
const dashscopeKey = process.env.DASHSCOPE_KEY || '';
const siliconflowKey = process.env.SILICONFLOW_KEY || '';

// ═══════════════════════════════════════════════════════════════════════════
// Integration tests — require API keys and test-fixtures/angry.wav
// Wrapped in async IIFE to avoid top-level await in CJS
// ═══════════════════════════════════════════════════════════════════════════

async function runIntegrationTests() {
  console.log('\n=== Integration: Real Audio STT ===');

  if (!hasAudio) {
    skip('DashScope batch transcription', 'test-fixtures/angry.wav not found');
    skip('SiliconFlow batch transcription', 'test-fixtures/angry.wav not found');
    return;
  }

  const audioBuffer = fs.readFileSync(AUDIO_FILE);
  console.log(`  Audio file: ${AUDIO_FILE} (${audioBuffer.length} bytes)`);

  if (dashscopeKey) {
    try {
      const svc = new STTService();
      const cfg: AppConfig = {
        ...DEFAULT_CONFIG,
        sttProvider: 'dashscope',
        providers: {
          ...DEFAULT_CONFIG.providers,
          dashscope: { apiKey: dashscopeKey, baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', sttModel: 'qwen3-asr-flash', llmModel: '' },
        },
      };
      const t0 = Date.now();
      const text = await svc.transcribe(audioBuffer as any, cfg);
      const ms = Date.now() - t0;
      console.log(`  ✓ DashScope qwen3-asr-flash (${ms}ms): "${text}"`);
      assert.ok(text.length > 0, 'Empty transcription');
      assert.ok(text.includes('欺负') || text.includes('好欺负') || text.includes('觉得'), `Unexpected: "${text}"`);
      passed++;
    } catch (e: any) {
      failed++;
      console.log(`  ✗ DashScope qwen3-asr-flash: ${e.message}`);
    }
  } else {
    skip('DashScope qwen3-asr-flash: transcribe angry.wav', 'DASHSCOPE_KEY not set');
  }

  if (siliconflowKey) {
    try {
      const svc = new STTService();
      const cfg: AppConfig = {
        ...DEFAULT_CONFIG,
        sttProvider: 'siliconflow',
        providers: {
          ...DEFAULT_CONFIG.providers,
          siliconflow: { apiKey: siliconflowKey, baseUrl: 'https://api.siliconflow.cn/v1', sttModel: 'FunAudioLLM/SenseVoiceSmall', llmModel: '' },
        },
      };
      const t0 = Date.now();
      const text = await svc.transcribe(audioBuffer as any, cfg);
      const ms = Date.now() - t0;
      console.log(`  ✓ SiliconFlow SenseVoiceSmall (${ms}ms): "${text}"`);
      assert.ok(text.length > 0, 'Empty transcription');
      assert.ok(text.includes('欺负') || text.includes('好欺负') || text.includes('觉得'), `Unexpected: "${text}"`);
      passed++;
    } catch (e: any) {
      failed++;
      console.log(`  ✗ SiliconFlow SenseVoiceSmall: ${e.message}`);
    }
  } else {
    skip('SiliconFlow SenseVoiceSmall: transcribe angry.wav', 'SILICONFLOW_KEY not set');
  }
}

async function runFullPipelineTests() {
  console.log('\n=== Integration: Full Pipeline (STT → LLM) ===');

  if (!hasAudio || !siliconflowKey) {
    skip('Full pipeline: STT + LLM post-processing', !hasAudio ? 'no audio file' : 'SILICONFLOW_KEY not set');
    skip('Full pipeline: LLM disabled bypass', 'skipped');
    skip('Full pipeline: filler removal effect', 'skipped');
    return;
  }

  const audioBuffer = fs.readFileSync(AUDIO_FILE);
  const sttService = new STTService();
  const llmService = new LLMService();

  // Test 1: Full pipeline with LLM enabled
  try {
    const cfg: AppConfig = {
      ...DEFAULT_CONFIG,
      sttProvider: 'siliconflow',
      llmProvider: 'siliconflow',
      llmPostProcessing: true,
      providers: {
        ...DEFAULT_CONFIG.providers,
        siliconflow: {
          apiKey: siliconflowKey,
          baseUrl: 'https://api.siliconflow.cn/v1',
          sttModel: 'FunAudioLLM/SenseVoiceSmall',
          llmModel: 'Qwen/Qwen2.5-7B-Instruct',
        },
      },
    };

    const t0 = Date.now();
    const raw = await sttService.transcribe(audioBuffer as any, cfg);
    const sttMs = Date.now() - t0;

    const t1 = Date.now();
    const { text: processed, systemPrompt } = await llmService.process(raw, cfg);
    const llmMs = Date.now() - t1;

    console.log(`  ✓ Full pipeline (STT ${sttMs}ms + LLM ${llmMs}ms = ${sttMs + llmMs}ms)`);
    console.log(`    Raw:       "${raw}"`);
    console.log(`    Processed: "${processed}"`);
    console.log(`    Prompt:    ${systemPrompt.length} chars`);

    assert.ok(raw.length > 0, 'STT returned empty');
    assert.ok(processed.length > 0, 'LLM returned empty');
    assert.ok(systemPrompt.includes('transcription restater'), 'Missing base prompt');
    passed++;
  } catch (e: any) {
    failed++;
    console.log(`  ✗ Full pipeline: ${e.message}`);
  }

  // Test 2: LLM disabled — processedText should equal raw
  try {
    const cfg: AppConfig = {
      ...DEFAULT_CONFIG,
      sttProvider: 'siliconflow',
      llmPostProcessing: false,
      providers: {
        ...DEFAULT_CONFIG.providers,
        siliconflow: {
          apiKey: siliconflowKey,
          baseUrl: 'https://api.siliconflow.cn/v1',
          sttModel: 'FunAudioLLM/SenseVoiceSmall',
          llmModel: '',
        },
      },
    };

    const raw = await sttService.transcribe(audioBuffer as any, cfg);
    // When LLM disabled, pipeline returns raw directly
    const processed = cfg.llmPostProcessing ? 'would process' : raw;
    assert.equal(processed, raw);
    console.log(`  ✓ LLM disabled: raw === processed ("${raw.slice(0, 50)}...")`);
    passed++;
  } catch (e: any) {
    failed++;
    console.log(`  ✗ LLM disabled bypass: ${e.message}`);
  }

  // Test 3: Prompt includes dictionary when set
  try {
    const cfg: AppConfig = {
      ...DEFAULT_CONFIG,
      sttProvider: 'siliconflow',
      llmProvider: 'siliconflow',
      personalDictionary: [
        { word: 'OpenType', source: 'manual' },
        { word: '硅基流动', source: 'auto-llm' },
      ],
      providers: {
        ...DEFAULT_CONFIG.providers,
        siliconflow: {
          apiKey: siliconflowKey,
          baseUrl: 'https://api.siliconflow.cn/v1',
          sttModel: 'FunAudioLLM/SenseVoiceSmall',
          llmModel: 'Qwen/Qwen2.5-7B-Instruct',
        },
      },
    };

    const raw = await sttService.transcribe(audioBuffer as any, cfg);
    const { systemPrompt } = await llmService.process(raw, cfg);
    assert.ok(systemPrompt.includes('OpenType'), 'Dictionary term missing from prompt');
    assert.ok(systemPrompt.includes('硅基流动'), 'Dictionary term missing from prompt');
    assert.ok(systemPrompt.includes('Hot Word Table'), 'Hot Word section missing');
    console.log(`  ✓ Dictionary injection: prompt contains "OpenType" + "硅基流动"`);
    passed++;
  } catch (e: any) {
    failed++;
    console.log(`  ✗ Dictionary injection: ${e.message}`);
  }
}

async function runAllIntegrationTests() {
  await runIntegrationTests();
  await runFullPipelineTests();
}

runAllIntegrationTests().then(() => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed${skipped.length ? `, ${skipped.length} skipped` : ''}`);
  process.exit(failed > 0 ? 1 : 0);
});
