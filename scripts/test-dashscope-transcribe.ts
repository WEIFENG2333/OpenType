/**
 * Test actual transcription quality for each DashScope model.
 * Sends a 3s speech-like audio and checks if any text is returned.
 * Usage: DASHSCOPE_KEY=sk-xxx npx tsx scripts/test-dashscope-transcribe.ts
 */
import WebSocket from 'ws';

const API_KEY = process.env.DASHSCOPE_KEY || '';
if (!API_KEY) { console.error('Set DASHSCOPE_KEY env var'); process.exit(1); }

const MODELS = [
  'qwen3-asr-flash-realtime',
  'paraformer-realtime-v2',
  'fun-asr-realtime',
  'gummy-realtime-v1',
];

/** Generate 3s of 16kHz PCM16 speech-like audio (mix of tones to simulate voice) */
function makeSpeechLikePCM(): Buffer {
  const sr = 16000, dur = 3, samples = sr * dur;
  const buf = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const t = i / sr;
    // Mix fundamental + harmonics to simulate voice formants
    const val = 0.3 * Math.sin(2 * Math.PI * 200 * t)
      + 0.2 * Math.sin(2 * Math.PI * 400 * t)
      + 0.1 * Math.sin(2 * Math.PI * 800 * t)
      + 0.05 * Math.sin(2 * Math.PI * 1200 * t);
    const s = Math.max(-1, Math.min(1, val));
    buf.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7FFF), i * 2);
  }
  return buf;
}

async function testModel(model: string): Promise<{ status: string; text: string; deltas: number; events: string[] }> {
  return new Promise((resolve) => {
    const result = { status: 'TIMEOUT', text: '', deltas: 0, events: [] as string[] };
    const timeout = setTimeout(() => { ws.close(); resolve(result); }, 15000);

    const ws = new WebSocket(`wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${model}`, {
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'OpenAI-Beta': 'realtime=v1' },
    });

    let sessionReady = false;
    let allTranscripts: string[] = [];

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
      result.events.push(msg.type);

      if ((msg.type === 'session.created' || msg.type === 'session.updated') && !sessionReady) {
        sessionReady = true;
        sendAudio(ws);
      }

      if (msg.type === 'conversation.item.input_audio_transcription.text') {
        result.deltas++;
        const text = (msg.text || '') + (msg.stash || '');
        if (text) result.text = text;
      }

      if (msg.type === 'conversation.item.input_audio_transcription.completed') {
        if (msg.transcript) allTranscripts.push(msg.transcript);
      }

      if (msg.type === 'session.finished') {
        clearTimeout(timeout);
        result.status = 'OK';
        result.text = allTranscripts.join('') || result.text || '(no text)';
        ws.close();
        resolve(result);
      }

      if (msg.type === 'error') {
        clearTimeout(timeout);
        result.status = `ERROR: ${JSON.stringify(msg.error || msg).slice(0, 100)}`;
        ws.close();
        resolve(result);
      }
    });

    ws.on('error', (err: Error) => {
      clearTimeout(timeout);
      result.status = `WS_ERROR: ${err.message}`;
      resolve(result);
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      if (result.status === 'TIMEOUT') {
        result.status = 'CLOSED';
        result.text = allTranscripts.join('') || result.text || '(no text)';
      }
      resolve(result);
    });
  });
}

function sendAudio(ws: WebSocket) {
  const buf = makeSpeechLikePCM();
  const chunkSize = 16000 * 2 * 0.1; // 100ms chunks
  let offset = 0;

  const send = () => {
    if (offset >= buf.length) {
      ws.send(JSON.stringify({ event_id: 'evt_finish', type: 'session.finish' }));
      return;
    }
    const end = Math.min(offset + chunkSize, buf.length);
    ws.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: buf.subarray(offset, end).toString('base64'),
    }));
    offset = end;
    setTimeout(send, 50);
  };
  send();
}

(async () => {
  console.log('Testing transcription for each DashScope model (synthetic audio)...\n');
  for (const model of MODELS) {
    console.log(`Testing ${model}...`);
    const r = await testModel(model);
    const uniqueEvents = [...new Set(r.events)];
    console.log(`  Status: ${r.status}`);
    console.log(`  Deltas: ${r.deltas}, Text: "${r.text}"`);
    console.log(`  Events: ${uniqueEvents.join(', ')}\n`);
  }
})();
