/**
 * Test STTService.testConnection() for DashScope.
 * Usage: DASHSCOPE_KEY=sk-xxx npx tsx scripts/test-stt-connection.ts
 */
import WebSocket from 'ws';

// Replicate the DashScope test logic directly (electron/stt-service.ts is CJS)
const API_KEY = process.env.DASHSCOPE_KEY || '';
if (!API_KEY) { console.error('Set DASHSCOPE_KEY'); process.exit(1); }

const model = 'qwen3-asr-flash-realtime';
const wsUrl = `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${model}`;

console.log(`[Test] Connecting to ${model}...`);
const t0 = Date.now();

const ws = new WebSocket(wsUrl, {
  headers: { 'Authorization': `Bearer ${API_KEY}`, 'OpenAI-Beta': 'realtime=v1' },
});

ws.on('open', () => {
  console.log(`[Test] Connected in ${Date.now() - t0}ms, sending session.update...`);
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

  if (msg.type === 'session.updated') {
    console.log(`[Test] Session ready in ${Date.now() - t0}ms, sending test PCM...`);

    // Generate 0.5s 440Hz tone PCM16 16kHz mono
    const sampleRate = 16000;
    const samples = sampleRate * 0.5;
    const buf = Buffer.alloc(samples * 2);
    for (let i = 0; i < samples; i++) {
      const val = Math.sin(2 * Math.PI * 440 * (i / sampleRate)) * 0.3;
      const s = Math.max(-1, Math.min(1, val));
      buf.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7FFF, i * 2);
    }
    ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: buf.toString('base64') }));
    ws.send(JSON.stringify({ event_id: 'evt_finish', type: 'session.finish' }));
  }

  if (msg.type === 'session.finished') {
    console.log(`[Test] SUCCESS in ${Date.now() - t0}ms`);
    ws.close();
    process.exit(0);
  }

  if (msg.type === 'error') {
    console.error(`[Test] FAILED:`, msg.error);
    ws.close();
    process.exit(1);
  }
});

ws.on('error', (err: Error) => {
  console.error(`[Test] WS Error:`, err.message);
  process.exit(1);
});

setTimeout(() => { console.error('[Test] Timeout'); process.exit(1); }, 15000);
