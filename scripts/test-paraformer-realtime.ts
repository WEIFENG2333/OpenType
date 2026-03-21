/**
 * Test DashScope Paraformer native inference protocol with real audio.
 * Usage: DASHSCOPE_KEY=sk-xxx npx tsx scripts/test-paraformer-realtime.ts
 */
import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const API_KEY = process.env.DASHSCOPE_KEY || '';
if (!API_KEY) { console.error('Set DASHSCOPE_KEY env var'); process.exit(1); }

const MODELS = ['paraformer-realtime-v2', 'fun-asr-realtime', 'gummy-realtime-v1'];

/** Read WAV file and resample from 48kHz to 16kHz PCM16 mono */
function loadAndResample(filePath: string): Buffer {
  const raw = readFileSync(filePath);
  // Parse WAV header
  const dataOffset = raw.indexOf(Buffer.from('data')) + 8; // skip 'data' + 4-byte size
  const pcmData = raw.subarray(dataOffset);
  const srcRate = 48000, dstRate = 16000;
  const ratio = srcRate / dstRate;
  const srcSamples = pcmData.length / 2;
  const dstSamples = Math.floor(srcSamples / ratio);
  const out = Buffer.alloc(dstSamples * 2);
  for (let i = 0; i < dstSamples; i++) {
    const srcIdx = Math.floor(i * ratio);
    out.writeInt16LE(pcmData.readInt16LE(srcIdx * 2), i * 2);
  }
  console.log(`Loaded ${filePath}: ${srcSamples} samples @ ${srcRate}Hz → ${dstSamples} samples @ ${dstRate}Hz`);
  return out;
}

async function testModel(model: string, pcm16k: Buffer): Promise<string> {
  return new Promise((resolve) => {
    const taskId = randomUUID();
    const timeout = setTimeout(() => { ws.close(); resolve('TIMEOUT'); }, 15000);
    const results: string[] = [];

    const ws = new WebSocket('wss://dashscope.aliyuncs.com/api-ws/v1/inference', {
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    });

    ws.on('open', () => {
      ws.send(JSON.stringify({
        header: { action: 'run-task', task_id: taskId, streaming: 'duplex' },
        payload: {
          task_group: 'audio',
          task: 'asr',
          function: 'recognition',
          model,
          parameters: {
            format: 'pcm',
            sample_rate: 16000,
            disfluency_removal_enabled: true,
            punctuation_prediction_enabled: true,
            inverse_text_normalization_enabled: true,
          },
          input: {},
        },
      }));
    });

    ws.on('message', (data: WebSocket.Data) => {
      const msg = JSON.parse(data.toString());
      const event = msg.header?.event;

      if (event === 'task-started') {
        console.log(`  [${model}] task-started, sending audio...`);
        sendAudio(ws, taskId, pcm16k);
      }

      if (event === 'result-generated') {
        const output = msg.payload?.output;
        const s = output?.sentence;
        if (s) {
          const text = s.text ?? s.transcript ?? s.result ?? '';
          const tag = s.sentence_end ? 'FINAL' : 'partial';
          const wordsText = s.words?.map((w: any) => w.text ?? w.word ?? w).join('') ?? '';
          const finalText = text || wordsText;
          console.log(`  [${model}] ${tag}: "${finalText}" | words: ${JSON.stringify(s.words?.slice(0, 3))}`);
          if (s.sentence_end && finalText) results.push(finalText);
        } else if (output) {
          console.log(`  [${model}] RAW output:`, JSON.stringify(output));
        }
      }

      if (event === 'task-finished') {
        clearTimeout(timeout);
        ws.close();
        resolve(results.join('') || '(no text)');
      }

      if (event === 'task-failed') {
        clearTimeout(timeout);
        ws.close();
        resolve(`ERROR: ${msg.header?.error_message || 'unknown'}`);
      }
    });

    ws.on('error', (err: Error) => {
      clearTimeout(timeout);
      resolve(`WS_ERROR: ${err.message}`);
    });

    ws.on('close', () => { clearTimeout(timeout); });
  });
}

function sendAudio(ws: WebSocket, taskId: string, pcm: Buffer) {
  const chunkSize = 16000 * 2 * 0.1; // 100ms = 3200 bytes
  let offset = 0;

  const send = () => {
    if (offset >= pcm.length) {
      console.log(`  Sending finish-task...`);
      ws.send(JSON.stringify({
        header: { action: 'finish-task', task_id: taskId, streaming: 'duplex' },
        payload: { input: {} },
      }));
      return;
    }
    const end = Math.min(offset + chunkSize, pcm.length);
    ws.send(pcm.subarray(offset, end));
    offset = end;
    setTimeout(send, 50);
  };
  send();
}

(async () => {
  const wavPath = resolve(__dirname, '../test-fixtures/angry.wav');
  const pcm16k = loadAndResample(wavPath);

  console.log('Testing Paraformer native protocol with real audio...\n');
  for (const model of MODELS) {
    console.log(`\n=== ${model} ===`);
    const result = await testModel(model, pcm16k);
    console.log(`  Result: "${result}"\n`);
  }
})();
