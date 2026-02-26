/**
 * End-to-end pipeline test: LLM post-processing on sample raw transcriptions.
 * Usage: SILICONFLOW_KEY=sk-xxx OPENROUTER_KEY=sk-or-xxx npx tsx scripts/test-pipeline.ts
 */

const SF = process.env.SILICONFLOW_KEY || '';
const OR = process.env.OPENROUTER_KEY || '';

const SYSTEM = `You are a transcription post-processor. Rules:
1. Remove filler words (um, uh, like, 那个, 嗯)
2. Eliminate stutters and repetitions
3. Recognize self-corrections — keep ONLY the final version
4. Add proper punctuation
5. Fix speech errors
6. Output cleaned text directly — no quotes or explanations`;

const CASES = [
  '嗯 那个 我想说的是 明天的会议 不对 是后天的会议改到周三下午两点',
  'um so like I wanted to I wanted to tell you that the the meeting is uh is canceled no wait postponed to next week',
  '第一步我们需要那个先把数据库备份一下然后第二步嗯就是升级那个系统版本第三步重启服务',
  'hey can you um send me the the report yeah the quarterly report by uh by Friday no actually Thursday',
];

async function run(name: string, baseUrl: string, key: string, model: string, text: string, extra?: Record<string, string>) {
  if (!key) { console.log(`  [${name}] skipped (no key)`); return; }
  const t = Date.now();
  try {
    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...extra },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: text }], temperature: 0.3, max_tokens: 512 }),
    });
    const ms = Date.now() - t;
    if (!r.ok) { console.log(`  [${name}] \x1b[31mFAIL\x1b[0m ${ms}ms — HTTP ${r.status}`); return; }
    const j = await r.json();
    console.log(`  [${name}] \x1b[32mOK\x1b[0m ${ms}ms → "${j.choices?.[0]?.message?.content?.trim()}"`);
  } catch (e: any) {
    console.log(`  [${name}] \x1b[31mFAIL\x1b[0m — ${e.message}`);
  }
}

async function main() {
  console.log('=== OpenType Pipeline Test ===\n');

  for (const text of CASES) {
    console.log(`\nInput: "${text.slice(0, 60)}..."`);
    await run('SiliconFlow', 'https://api.siliconflow.cn/v1', SF, 'Qwen/Qwen2.5-7B-Instruct', text);
    await run('OpenRouter', 'https://openrouter.ai/api/v1', OR, 'google/gemini-2.0-flash-001', text,
      { 'HTTP-Referer': 'https://opentype.app', 'X-Title': 'OpenType' });
  }

  console.log('\nDone.');
}

main().catch(console.error);
