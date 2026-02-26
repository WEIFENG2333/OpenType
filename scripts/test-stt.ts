/**
 * STT (Speech-to-Text) API test.
 * Generates a minimal WAV file and sends it to SiliconFlow STT.
 * Usage: SILICONFLOW_KEY=sk-xxx npx tsx scripts/test-stt.ts
 */

const KEY = process.env.SILICONFLOW_KEY || '';

function makeWav(seconds = 1, sr = 16000): Buffer {
  const n = sr * seconds;
  const data = n * 2;
  const buf = Buffer.alloc(44 + data);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + data, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(data, 40);

  // Low-amplitude noise
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.floor(Math.random() * 80) - 40, 44 + i * 2);
  }
  return buf;
}

async function main() {
  console.log('=== OpenType STT Test ===\n');

  if (!KEY) { console.log('SILICONFLOW_KEY not set. Skipping.'); return; }

  const wav = makeWav(2);
  console.log(`WAV: ${wav.length} bytes`);

  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(wav.buffer, wav.byteOffset, wav.byteLength)], { type: 'audio/wav' }), 'test.wav');
  fd.append('model', 'FunAudioLLM/SenseVoiceSmall');

  const t = Date.now();
  try {
    const r = await fetch('https://api.siliconflow.cn/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}` },
      body: fd,
    });
    const ms = Date.now() - t;

    if (!r.ok) {
      console.log(`\x1b[31mFAIL\x1b[0m (${ms}ms): HTTP ${r.status}`);
      console.log(await r.text());
      process.exit(1);
    }

    const j = await r.json();
    console.log(`\x1b[32mPASS\x1b[0m (${ms}ms)`);
    console.log('Result:', JSON.stringify(j));
  } catch (e: any) {
    console.log(`\x1b[31mFAIL\x1b[0m:`, e.message);
    process.exit(1);
  }
}

main().catch(console.error);
