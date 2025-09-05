import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, 'apps', 'web', 'src', 'generated');

const PORT = Number(process.env.PORT_ELIDE || 8787);
const PROVIDER = process.env.ELV_PROVIDER || 'openrouter';

// Initialize AI providers
let genAI, anthropic, openrouterKey;
const geminiKey = process.env.GEMINI_API_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;
openrouterKey = process.env.OPENROUTER_API_KEY;

console.log(`[elide] Provider: ${PROVIDER}`);

if (PROVIDER === 'gemini' && geminiKey) {
  genAI = new GoogleGenerativeAI(geminiKey);
  console.log('[elide] Gemini AI initialized');
} else if (PROVIDER === 'anthropic' && anthropicKey) {
  anthropic = new Anthropic({ apiKey: anthropicKey });
  console.log('[elide] Anthropic AI initialized');
} else if (PROVIDER === 'openrouter' && openrouterKey) {
  console.log('[elide] OpenRouter initialized');
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
      const result = await generatePlan(body?.prompt || 'Create a simple app', body?.model);
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

  if (url.pathname === '/api/polyglot/execute' && req.method === 'POST') {
    await executePolyglotCode(req, res);
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

async function generatePlan(prompt, model = null) {
  if (!genAI && !anthropic && !openrouterKey) {
    return { plan: { message: 'No AI provider configured', prompt }, diffs: [] };
  }

  // Determine provider based on model
  let useProvider = PROVIDER;
  if (model) {
    if (model.includes('claude-')) {
      useProvider = 'anthropic';
    } else if (model.includes('gemini-')) {
      useProvider = 'gemini';
    } else if (model.includes('/') || model.includes(':free')) {
      useProvider = 'openrouter';
    }
  }

  const systemPrompt = `You are an expert Elide polyglot app builder. Elide is a high-performance polyglot runtime that supports JavaScript, TypeScript, Python, Kotlin, and Java in the same project.

Given a user's description, create a detailed plan for building their app using Elide's polyglot capabilities.

ELIDE CAPABILITIES:
- JavaScript/TypeScript: Frontend components, Node.js-compatible APIs
- Python: Data processing, ML/AI, scientific computing, text analysis
- Kotlin: High-performance business logic, type-safe operations
- Java: Enterprise integrations, complex algorithms
- Mix languages in the same project for optimal performance

RESPONSE FORMAT - JSON object containing:
- summary: Brief description highlighting which languages you'll use and why
- files: Array of files with polyglot code (mix JS/TS/Python/Kotlin as appropriate)
- technologies: List of Elide-supported technologies

BEST PRACTICES:
- Use Python for data processing, text analysis, ML tasks
- Use TypeScript for React components and frontend logic
- Use Kotlin for performance-critical backend operations
- Create realistic, working polyglot applications
- Include proper imports and Elide-compatible code

Example file structure:
- App.tsx (React frontend)
- api/processor.py (Python data processing)
- core/BusinessLogic.kt (Kotlin business rules)
- utils/helpers.js (JavaScript utilities)`;

  let text;

  if (useProvider === 'anthropic' && anthropic) {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: prompt }
      ]
    });
    text = response.content[0].text;
  } else if (useProvider === 'gemini' && genAI) {
    const geminiModel = genAI.getGenerativeModel({ model: model || 'gemini-1.5-flash' });
    const fullPrompt = `${systemPrompt}\n\nUser request: ${prompt}`;
    const result = await geminiModel.generateContent(fullPrompt);
    const response = await result.response;
    text = response.text();
  } else if (useProvider === 'openrouter' && openrouterKey) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:8787',
        'X-Title': 'Elideable'
      },
      body: JSON.stringify({
        model: model || 'google/gemini-2.0-flash-exp:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 4000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    text = data.choices[0].message.content;
  }

  // Parse JSON response
  try {
    const parsed = JSON.parse(text);
    return { plan: parsed, diffs: [] };
  } catch (e) {
    return { plan: { message: text, prompt }, diffs: [] };
  }
}

// --- Polyglot execution endpoints ---

async function executePolyglotCode(req, res) {
  const body = await readJSON(req, res);
  const { language, code, function: funcName, args = [] } = body;

  try {
    let result;

    if (language === 'python') {
      // Simulate Python execution (in real Elide, this would use GraalVM Python)
      result = await simulatePythonExecution(code, funcName, args);
    } else if (language === 'kotlin') {
      // Simulate Kotlin execution (in real Elide, this would use GraalVM Kotlin)
      result = await simulateKotlinExecution(code, funcName, args);
    } else {
      throw new Error(`Unsupported language: ${language}`);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ result, language, function: funcName }));
  } catch (error) {
    console.error('Polyglot execution error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

async function simulatePythonExecution(code, funcName, args) {
  // In real Elide, this would execute actual Python code via GraalVM
  // For demo purposes, we'll simulate realistic Python behavior

  if (funcName === 'extractTags') {
    const text = args[0] || '';
    // Simulate Python regex tag extraction
    const tags = text.match(/#(\w+)/g) || [];
    return tags.map(tag => tag.substring(1));
  }

  if (funcName === 'processText') {
    const text = args[0] || '';
    // Simulate Python text processing
    return {
      wordCount: text.split(/\s+/).length,
      charCount: text.length,
      sentences: text.split(/[.!?]+/).length - 1
    };
  }

  // Default simulation
  return `Python executed: ${funcName}(${args.join(', ')})`;
}

async function simulateKotlinExecution(code, funcName, args) {
  // In real Elide, this would execute actual Kotlin code via GraalVM
  // For demo purposes, we'll simulate realistic Kotlin behavior

  if (funcName === 'saveNote') {
    const note = args[0] || {};
    // Simulate Kotlin data persistence
    const savedNote = {
      ...note,
      id: note.id || Date.now().toString(),
      timestamp: new Date().toISOString(),
      saved: true
    };

    // In real Elide, this would persist to database
    console.log('[Kotlin] Note saved:', savedNote);
    return savedNote;
  }

  if (funcName === 'loadNotes') {
    // Simulate Kotlin data retrieval
    return [
      { id: '1', content: 'Sample note #kotlin #elide', tags: ['kotlin', 'elide'], timestamp: new Date().toISOString() }
    ];
  }

  // Default simulation
  return `Kotlin executed: ${funcName}(${args.join(', ')})`;
}

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
      try {
        resolve(JSON.parse(data || '{}'));
      } catch (e) {
        resolve({});
      }
    });
  });
}

