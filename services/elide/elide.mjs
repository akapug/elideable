import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, 'apps', 'web', 'src', 'generated');

const PORT = Number(process.env.PORT_ELIDE || 8787);
const PROVIDER = process.env.ELV_PROVIDER || 'gemini';

// Initialize AI providers
let genAI, anthropic;
const geminiKey = process.env.GEMINI_API_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

console.log(`[elide] Provider: ${PROVIDER}`);

if (PROVIDER === 'gemini' && geminiKey) {
  genAI = new GoogleGenerativeAI(geminiKey);
  console.log('[elide] Gemini AI initialized');
} else if (PROVIDER === 'anthropic' && anthropicKey) {
  anthropic = new Anthropic({ apiKey: anthropicKey });
  console.log('[elide] Anthropic AI initialized');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
  }
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, provider: PROVIDER }));
    return;
  }
  if (url.pathname === '/api/ai/plan' && req.method === 'POST') {
    const body = await readJSON(req, res);
    try {
      const result = await generatePlan(body?.prompt || 'Create a simple app');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error('AI Plan error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  if (url.pathname === '/api/ai/apply' && req.method === 'POST') {
    const body = await readJSON(req, res);
    try {
      const changed = await applyFiles(body?.files || []);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ changed }));
    } catch (error) {
      console.error('AI Apply error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  if (url.pathname === '/api/files/tree' && req.method === 'GET') {
    const tree = await readTree();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tree }));
    return;
  }
  if (url.pathname === '/api/files/read' && req.method === 'GET') {
    const p = url.searchParams.get('path') || '';
    const content = await readFileSafe(p);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ path: p, content }));
    return;
  }
  if (url.pathname === '/api/ai/summarize' && req.method === 'POST') {
    const body = await readJSON(req, res);
    const text = String(body?.text || '');
    try {
      const out = await summarizePython(text);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ summary: out }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e) }));
    }
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

async function generatePlan(prompt) {
  if (!genAI && !anthropic) {
    return { plan: { message: 'No AI provider configured', prompt }, diffs: [] };
  }

  const systemPrompt = `You are an expert app builder. Given a user's description, create a detailed plan for building their app.

Respond with a JSON object containing:
- summary: Brief description of what you'll build
- files: Array of files to create with their contents
- technologies: List of technologies used

Keep responses practical and focused on React + TypeScript apps.`;

  let text;

  if (PROVIDER === 'anthropic' && anthropic) {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: prompt }
      ]
    });
    text = response.content[0].text;
  } else if (PROVIDER === 'gemini' && genAI) {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const fullPrompt = `${systemPrompt}\n\nUser request: ${prompt}`;
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    text = response.text();
// --- File apply & tree helpers ---
async function applyFiles(files) {
  // files: [{ name or path, content }]
  if (!Array.isArray(files)) throw new Error('files must be an array');
  await fs.mkdir(GENERATED_DIR, { recursive: true });
  const changed = [];
  for (const f of files) {
    const rel = normalizeGeneratedPath(f.name || f.path);
    const dest = path.join(GENERATED_DIR, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, f.content ?? f.contents ?? '', 'utf8');
    changed.push(rel);
  }
  return changed;
}

function normalizeGeneratedPath(p) {
  if (!p) throw new Error('file missing name/path');
  // strip leading src/ if present and map to generated/
  return p.replace(/^src\//, '').replace(/^\.\//, '');
}

async function readTree() {
  const entries = [];
  async function walk(dir, base = '') {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const it of items) {
      const p = path.join(dir, it.name);
      const rel = path.relative(GENERATED_DIR, p).replace(/\\/g, '/');
      if (it.isDirectory()) {
        entries.push({ type: 'dir', path: rel });
        await walk(p, path.join(base, it.name));
      } else {
        entries.push({ type: 'file', path: rel });
      }
    }
  }
  try {
    await walk(GENERATED_DIR);
  } catch {
    // empty initially
  }
  return entries;
}

async function readFileSafe(rel) {
  if (!rel) return '';
  const full = path.join(GENERATED_DIR, rel);
  const content = await fs.readFile(full, 'utf8').catch(() => '');
  return content;
}

  } else {
    return { plan: { message: 'No AI provider available', prompt }, diffs: [] };
  }

  // Try to extract JSON from response
  let planData;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      planData = JSON.parse(jsonMatch[0]);
    } else {
      planData = { summary: text, files: [], technologies: [] };
    }
  } catch (e) {
    planData = { summary: text, files: [], technologies: [] };
  }

  return {
    plan: {
      message: planData.summary || text,
      prompt,
      ...planData
    },
    diffs: planData.files || []
  };
}

async function summarizePython(text) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.platform === 'win32' ? 'python' : 'python3', ['-c', `import sys, json; t=sys.stdin.read(); print(json.dumps({'summary': t[:200] + '...' if len(t)>200 else t}))`]);
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => out += d);
    proc.stderr.on('data', (d) => err += d);
    proc.on('exit', (code) => {
      if (code === 0) {
        try { resolve(JSON.parse(out)); } catch (e) { resolve({ summary: out }) }
      } else {
        reject(new Error(err || `python exited ${code}`));
      }
    });
    proc.stdin.write(text);
    proc.stdin.end();
  });
}

server.listen(PORT, () => {
  console.log(`[elide] listening on http://localhost:${PORT} (provider: ${PROVIDER})`);
});

function readJSON(req, res) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch (e) { resolve({}); }
    });
  });
}

