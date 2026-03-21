/**
 * Test script for Alibaba DashScope Qwen3-ASR-Flash-Realtime WebSocket API.
 * Usage: DASHSCOPE_KEY=sk-xxx npx tsx scripts/test-dashscope-realtime.ts
 */
import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';

const API_KEY = process.env.DASHSCOPE_KEY || '';
if (!API_KEY) {
  console.error('Set DASHSCOPE_KEY env var');
  process.exit(1);
}

const url = 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=qwen3-asr-flash-realtime';

console.log('[Test] Connecting to DashScope Realtime ASR...');

const ws = new WebSocket(url, {
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'OpenAI-Beta': 'realtime=v1',
  },
});

ws.on('open', () => {
  console.log('[Test] Connected, sending session.update...');
  ws.send(JSON.stringify({
    event_id: 'evt_session',
    type: 'session.update',
    session: {
      modalities: ['text'],
      input_audio_format: 'pcm',
      sample_rate: 16000,
      input_audio_transcription: { language: 'zh' },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.0,
        silence_duration_ms: 400,
      },
    },
  }));
});

ws.on('message', (data: WebSocket.Data) => {
  const msg = JSON.parse(data.toString());
  console.log(`[Server] ${msg.type}`, JSON.stringify(msg).slice(0, 300));

  if (msg.type === 'session.updated') {
    console.log('[Test] Session ready, generating test audio...');
    sendTestAudio();
  }

  if (msg.type === 'conversation.item.input_audio_transcription.text') {
    console.log(`[Delta] text="${msg.text}" stash="${msg.stash}"`);
  }

  if (msg.type === 'conversation.item.input_audio_transcription.completed') {
    console.log(`[Completed] transcript="${msg.transcript}"`);
  }

  if (msg.type === 'session.finished') {
    console.log('[Test] Session finished, closing.');
    ws.close();
  }

  if (msg.type === 'error') {
    console.error('[Error]', msg.error);
  }
});

ws.on('error', (err: Error) => {
  console.error('[WS Error]', err.message);
});

ws.on('close', (code: number, reason: Buffer) => {
  console.log(`[WS Closed] code=${code} reason=${reason.toString()}`);
  process.exit(0);
});

function sendTestAudio() {
  // Use real TTS audio if available, else generate sine wave
  const pcmPath = '/tmp/test-zh.pcm';
  let buf: Buffer;
  if (fs.existsSync(pcmPath)) {
    buf = fs.readFileSync(pcmPath);
    console.log(`[Test] Using real audio: ${pcmPath} (${buf.length} bytes, ${(buf.length / 2 / 16000).toFixed(1)}s)`);
  } else {
    const sampleRate = 16000;
    const duration = 3;
    const samples = sampleRate * duration;
    buf = Buffer.alloc(samples * 2);
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      const val = Math.sin(2 * Math.PI * 440 * t) * 0.3;
      const s = Math.max(-1, Math.min(1, val));
      buf.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7FFF, i * 2);
    }
    console.log(`[Test] Using generated sine wave (3s)`);
  }

  // Send in chunks (~100ms each = 3200 bytes)
  const chunkSize = 16000 * 2 * 0.1;
  let offset = 0;
  let chunkNum = 0;

  const sendChunk = () => {
    if (offset >= buf.length) {
      console.log(`[Test] All ${chunkNum} chunks sent, sending session.finish...`);
      ws.send(JSON.stringify({ event_id: 'evt_finish', type: 'session.finish' }));
      return;
    }
    const end = Math.min(offset + chunkSize, buf.length);
    const chunk = buf.subarray(offset, end);
    ws.send(JSON.stringify({
      event_id: `evt_audio_${chunkNum}`,
      type: 'input_audio_buffer.append',
      audio: chunk.toString('base64'),
    }));
    chunkNum++;
    offset = end;
    setTimeout(sendChunk, 50);
  };

  sendChunk();
}

// Timeout after 30s
setTimeout(() => {
  console.log('[Test] Timeout, closing.');
  ws.close();
  process.exit(1);
}, 30000);
