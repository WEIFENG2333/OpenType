/**
 * API connectivity test for all providers.
 * Usage: SILICONFLOW_KEY=sk-xxx OPENROUTER_KEY=sk-or-xxx npx tsx scripts/test-api.ts
 */

const SF_KEY = process.env.SILICONFLOW_KEY || '';
const OR_KEY = process.env.OPENROUTER_KEY || '';
const OA_KEY = process.env.OPENAI_KEY || '';

interface Result { provider: string; ok: boolean; msg: string; ms: number }

async function testLLM(
  name: string, baseUrl: string, key: string, model: string, extra?: Record<string, string>,
): Promise<Result> {
  if (!key) return { provider: name, ok: false, msg: 'No key', ms: 0 };
  const t = Date.now();
  try {
    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...extra },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: 'Reply: OK' }, { role: 'user', content: 'Test' }],
        max_tokens: 10,
      }),
    });
    const ms = Date.now() - t;
    if (!r.ok) return { provider: name, ok: false, msg: `HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`, ms };
    const j = await r.json();
    return { provider: name, ok: true, msg: `${model} → "${j.choices?.[0]?.message?.content}"`, ms };
  } catch (e: any) {
    return { provider: name, ok: false, msg: e.message, ms: Date.now() - t };
  }
}

async function main() {
  console.log('=== OpenType API Test ===\n');

  const results: Result[] = [];

  results.push(await testLLM('SiliconFlow', 'https://api.siliconflow.cn/v1', SF_KEY, 'Qwen/Qwen2.5-7B-Instruct'));
  results.push(await testLLM('OpenRouter', 'https://openrouter.ai/api/v1', OR_KEY, 'google/gemini-2.0-flash-001',
    { 'HTTP-Referer': 'https://opentype.app', 'X-Title': 'OpenType' }));
  if (OA_KEY) results.push(await testLLM('OpenAI', 'https://api.openai.com/v1', OA_KEY, 'gpt-4o-mini'));

  console.log('\nResults:');
  for (const r of results) {
    const tag = r.ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`  [${tag}] ${r.provider} (${r.ms}ms) — ${r.msg}`);
  }

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${pass}/${results.length} passed.`);
  if (pass < results.length) process.exit(1);
}

main().catch(console.error);
