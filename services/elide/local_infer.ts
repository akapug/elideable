// Elide runtime script: local inference via Ollama
// Usage: elide run services/elide/local_infer.ts -- '{"prompt":"...","ollama":{"baseUrl":"http://127.0.0.1:11434","model":"gemma2:2b-instruct"}}'

// In Elide, fetch should be available. If not, this will still work under Node 18+ where fetch is global.

interface Payload {
  prompt: string;
  model?: string | null;
  options?: Record<string, unknown> | null;
  ollama?: { baseUrl?: string; model?: string } | null;
}

async function main() {
  const argRaw = process.argv.slice(2)[0] ?? process.env.INFER_PAYLOAD ?? '{}';
  let payload: Payload;
  try { payload = JSON.parse(argRaw); } catch {
    payload = { prompt: String(argRaw || 'Create a minimal app') } as Payload;
  }

  const baseUrl = payload.ollama?.baseUrl || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
  const model = payload.ollama?.model || process.env.OLLAMA_MODEL || 'gemma2:2b-instruct';
  const userPrompt = String(payload.prompt || 'Create a minimal app');

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
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userPrompt }
    ]
  } as any;

  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    const content: string = data?.message?.content || '';

    // Try to parse model JSON directly
    let parsed: any | null = null;
    try { parsed = JSON.parse(content.trim()); } catch {}

    // Fallback: wrap plain text into a minimal index.html
    if (!parsed || !parsed.diffs) {
      parsed = {
        plan: { message: 'Creating a minimal Hello World app (index.html).', prompt: userPrompt },
        diffs: [ { name: 'index.html', content: `<!doctype html><html><head><meta charset="utf-8"/><title>Hello</title><style>body{font-family:system-ui;display:grid;place-items:center;height:100vh}</style></head><body><h1>Hello from Gemma!</h1></body></html>` } ]
      };
    } else {
      // Ensure plan fields exist
      parsed.plan = parsed.plan || { message: 'Generated plan', prompt: userPrompt };
    }

    process.stdout.write(JSON.stringify(parsed));
  } catch (e: any) {
    const fallback = {
      plan: { message: `Local inference failed: ${e?.message || e}. Using fallback.`, prompt: userPrompt },
      diffs: [ { name: 'index.html', content: `<!doctype html><html><head><meta charset="utf-8"/><title>Fallback</title></head><body><h1>Fallback App</h1></body></html>` } ]
    };
    process.stdout.write(JSON.stringify(fallback));
  }
}

main().catch(err => {
  process.stdout.write(JSON.stringify({ plan: { message: `Fatal error: ${err?.message || err}`, prompt: '' }, diffs: [] }));
});

