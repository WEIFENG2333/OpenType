/**
 * Test which DashScope models work with the OpenAI-compatible Realtime API.
 * Usage: DASHSCOPE_KEY=sk-xxx npx tsx scripts/test-dashscope-models.ts
 */
import WebSocket from 'ws';

const API_KEY = process.env.DASHSCOPE_KEY || '';
if (!API_KEY) { console.error('Set DASHSCOPE_KEY env var'); process.exit(1); }

const MODELS = [
  'qwen3-asr-flash-realtime',
  'qwen3-asr-flash-realtime-2026-02-10',
  'qwen3-asr-flash-realtime-2025-10-27',
  // Paraformer models (likely different protocol, but let's test)
  'paraformer-realtime-v2',
  'fun-asr-realtime',
  'gummy-realtime-v1',
];

async function testModel(model: string): Promise<string> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve('TIMEOUT'), 8000);
    const ws = new WebSocket(`wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${model}`, {
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'OpenAI-Beta': 'realtime=v1' },
    });

    ws.on('open', () => {
      ws.send(JSON.stringify({
        event_id: 'evt_session',
        type: 'session.update',
        session: {
          modalities: ['text'],
          input_audio_format: 'pcm',
          sample_rate: 16000,
          input_audio_transcription: { language: 'zh' },
          turn_detection: { type: 'server_vad', threshold: 0.0, silence_duration_ms: 400 },
        },
      }));
    });

    ws.on('message', (data: WebSocket.Data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'session.created' || msg.type === 'session.updated') {
        clearTimeout(timeout);
        ws.close();
        resolve('OK');
      }
      if (msg.type === 'error') {
        clearTimeout(timeout);
        ws.close();
        resolve(`ERROR: ${JSON.stringify(msg.error || msg).slice(0, 120)}`);
      }
    });

    ws.on('error', (err: Error) => {
      clearTimeout(timeout);
      resolve(`WS_ERROR: ${err.message.slice(0, 80)}`);
    });

    ws.on('close', (code: number) => {
      clearTimeout(timeout);
      resolve(`CLOSED: code=${code}`);
    });
  });
}

(async () => {
  console.log('Testing DashScope models on OpenAI-compatible Realtime API...\n');
  for (const model of MODELS) {
    const result = await testModel(model);
    const icon = result === 'OK' ? '+' : '-';
    console.log(`[${icon}] ${model.padEnd(45)} → ${result}`);
  }
})();
