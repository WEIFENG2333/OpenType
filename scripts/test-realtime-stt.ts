/**
 * Test script for OpenAI Realtime API transcription.
 * Sends a short PCM audio buffer and verifies delta/completed events.
 *
 * Usage: OPENAI_API_KEY=sk-xxx npx tsx scripts/test-realtime-stt.ts
 */

import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';

const API_KEY = process.env.OPENAI_API_KEY!;

const WS_URL = 'wss://api.openai.com/v1/realtime?intent=transcription';

// Generate a short PCM 24kHz mono tone (1 second of 440Hz sine wave) as test audio
function generateTestPCM(durationSec = 1, sampleRate = 24000): Buffer {
  const numSamples = sampleRate * durationSec;
  const buf = Buffer.alloc(numSamples * 2); // 16-bit = 2 bytes per sample
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.5;
    buf.writeInt16LE(Math.round(sample * 32767), i * 2);
  }
  return buf;
}

async function main() {
  console.log('Connecting to OpenAI Realtime API...');

  const ws = new WebSocket(WS_URL, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  let sessionReady = false;
  let accumulated = '';

  ws.on('open', () => {
    console.log('WebSocket connected. Sending session config...');
    ws.send(JSON.stringify({
      type: 'transcription_session.update',
      session: {
        input_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'gpt-4o-transcribe',
          language: 'zh',
        },
        turn_detection: null,
        input_audio_noise_reduction: {
          type: 'near_field',
        },
      },
    }));
  });

  ws.on('message', (data: WebSocket.Data) => {
    const event = JSON.parse(data.toString());
    console.log(`[Event] ${event.type}`, event.type.includes('delta') ? `delta="${event.delta}"` : '');

    if (event.type === 'session.created' || event.type === 'session.updated' || event.type === 'transcription_session.updated') {
      if (!sessionReady) {
        sessionReady = true;
        console.log('Session ready. Sending test audio...');
        sendTestAudio(ws);
      }
    }

    if (event.type === 'conversation.item.input_audio_transcription.delta') {
      accumulated += event.delta || '';
      console.log(`  accumulated: "${accumulated}"`);
    }

    if (event.type === 'conversation.item.input_audio_transcription.completed') {
      console.log(`\nFinal transcript: "${event.transcript}"`);
      console.log('Test PASSED - Realtime API is working!');
      ws.close();
    }

    if (event.type === 'error') {
      console.error('API Error:', JSON.stringify(event.error || event, null, 2));
      ws.close();
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });

  ws.on('close', (code, reason) => {
    console.log(`WebSocket closed: code=${code} reason=${reason.toString()}`);
    process.exit(0);
  });

  // Timeout after 15s
  setTimeout(() => {
    console.error('Timeout - no response in 15s');
    ws.close();
    process.exit(1);
  }, 15000);
}

function sendTestAudio(ws: WebSocket) {
  // Send 2 seconds of silence (will result in empty/no transcription, but tests the flow)
  const pcm = generateTestPCM(2, 24000);

  // Send in chunks of ~100ms
  const chunkSize = 24000 * 2 * 0.1; // 100ms at 24kHz, 16-bit
  for (let i = 0; i < pcm.length; i += chunkSize) {
    const chunk = pcm.subarray(i, Math.min(i + chunkSize, pcm.length));
    ws.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: chunk.toString('base64'),
    }));
  }

  console.log(`Sent ${pcm.length} bytes of test audio (${pcm.length / 48000}s). Committing...`);
  ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
}

main().catch(console.error);
