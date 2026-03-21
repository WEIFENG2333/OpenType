/**
 * Test DashScope Qwen3-ASR-Flash batch transcription (chat/completions + input_audio).
 *
 * Usage: npx tsx scripts/test-dashscope-batch.ts
 * Reads API key from user's config.json.
 */
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.env.HOME || '.', 'Library/Application Support/OpenType/config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const apiKey = config.providers?.dashscope?.apiKey || config.dashscopeApiKey;

if (!apiKey) {
  console.error('No DashScope API key found in config.json');
  process.exit(1);
}

// Generate a short WAV with a 440Hz tone (0.5s) as test audio
function makeTestWav(durationSec: number): Buffer {
  const sampleRate = 16000;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);

  // WAV header
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const val = Math.sin(2 * Math.PI * 440 * t) * 0.3;
    buf.writeInt16LE(Math.round(val * 32767), 44 + i * 2);
  }
  return buf;
}

async function testBatch() {
  console.log('=== DashScope Qwen3-ASR-Flash Batch Test ===\n');

  // Try with test fixture if available, otherwise use generated tone
  const fixtureDir = path.join(process.cwd(), 'test-fixtures');
  let audioBuffer: Buffer;
  let audioDesc: string;

  if (fs.existsSync(path.join(fixtureDir, 'angry.wav'))) {
    audioBuffer = fs.readFileSync(path.join(fixtureDir, 'angry.wav'));
    audioDesc = 'angry.wav (real speech)';
  } else {
    audioBuffer = makeTestWav(0.5);
    audioDesc = 'generated 440Hz tone (0.5s)';
  }

  const base64Audio = `data:audio/wav;base64,${audioBuffer.toString('base64')}`;
  console.log(`Audio: ${audioDesc} (${(audioBuffer.length / 1024).toFixed(1)}KB)`);

  const model = 'qwen3-asr-flash';
  const url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
  console.log(`Model: ${model}`);
  console.log(`URL: ${url}\n`);

  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: [{ type: 'input_audio', input_audio: { data: base64Audio } }],
        }],
        stream: false,
      }),
    });

    const ms = Date.now() - t0;
    console.log(`Status: ${res.status} (${ms}ms)`);

    if (!res.ok) {
      const err = await res.text();
      console.error(`ERROR: ${err.slice(0, 500)}`);
      process.exit(1);
    }

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content?.trim();
    console.log(`\nTranscription: "${text}"`);
    console.log(`Usage: ${JSON.stringify(json.usage)}`);

    if (json.choices?.[0]?.message?.annotations) {
      console.log(`Annotations: ${JSON.stringify(json.choices[0].message.annotations)}`);
    }

    console.log('\n=== PASS ===');
  } catch (e: any) {
    console.error(`FAILED: ${e.message}`);
    process.exit(1);
  }
}

testBatch();
