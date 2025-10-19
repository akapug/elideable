#!/usr/bin/env -S elide js
// Local inference via Ollama in plain JS (run under Elide JS engine)

async function run() {
  const env = typeof process !== 'undefined' ? process.env : {};
  const argv = typeof process !== 'undefined' ? process.argv.slice(2) : [];
  const argRaw = argv[0] ?? env.INFER_PAYLOAD ?? '{}';
  let payload;
  try { payload = JSON.parse(argRaw); } catch { payload = { prompt: String(argRaw || 'Create a minimal app') }; }

  const baseUrl = (payload.ollama && payload.ollama.baseUrl) || env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
  const model = (payload.ollama && payload.ollama.model) || env.OLLAMA_MODEL || 'gemma2:2b-instruct-q8_0';
  const prompt = String(payload.prompt || 'Create a minimal app');

  const system = [
    'You are Elideable Plan Writer. Return ONLY strict JSON matching this schema:',
    '{\n  "plan": { "message": string, "prompt": string },\n  "diffs": [ { "name": string, "content": string } ]\n}',
    'ALWAYS include at least one file in diffs. Prefer a single index.html for tiny demos.',
    'Do not include markdown fences. Do not include explanations.'
  ].join('\n');

  const body = {
    model,
    stream: false,
    options: { temperature: 0.4 },
    messages: [ { role: 'system', content: system }, { role: 'user', content: prompt } ]
  };

  try {
    const res = await fetch(`${baseUrl}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    const content = data && data.message && data.message.content || '';
    let parsed = null;
    try { parsed = JSON.parse(String(content).trim()); } catch {}
    if (!parsed || !parsed.diffs) {
      parsed = { plan: { message: 'Creating a minimal Hello World app (index.html).', prompt }, diffs: [ { name: 'index.html', content: '<!doctype html><html><head><meta charset="utf-8"/><title>Hello</title></head><body><h1>Hello from Gemma!</h1></body></html>' } ] };
    } else {
      parsed.plan = parsed.plan || { message: 'Generated plan', prompt };
    }
    process.stdout.write(JSON.stringify(parsed));
  } catch (e) {
    const fallback = { plan: { message: `Local inference failed: ${e && e.message || e}. Using fallback.`, prompt }, diffs: [ { name: 'index.html', content: '<!doctype html><html><head><meta charset="utf-8"/><title>Fallback</title></head><body><h1>Fallback App</h1></body></html>' } ] };
    process.stdout.write(JSON.stringify(fallback));
  }
}

run();

