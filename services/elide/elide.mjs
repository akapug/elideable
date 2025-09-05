import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const GENERATED_APPS_DIR = path.join(ROOT, 'generated-apps');

const PORT = Number(process.env.PORT_ELIDE || 8788);
const PROVIDER = process.env.ELV_PROVIDER || 'openrouter';

// Track running Elide processes
const runningApps = new Map(); // appId -> { process, port, url }
let nextPort = 9000;

// Initialize AI providers
let genAI, anthropic, openrouterKey;
const geminiKey = process.env.GEMINI_API_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;
openrouterKey = process.env.OPENROUTER_API_KEY;

console.log(`[elide] Provider: ${PROVIDER}`);
console.log(`[elide] Anthropic key: ${anthropicKey ? 'present' : 'missing'}`);
console.log(`[elide] OpenRouter key: ${openrouterKey ? 'present' : 'missing'}`);

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
  console.log(`[server] ${req.method} ${url.pathname}`);
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
    console.log('[ai] Planning request:', body?.prompt, 'with model:', body?.model, 'mode:', body?.mode || 'edit');
    try {
      const result = await generatePlan(body?.prompt || 'Create a simple app', body?.model, { mode: body?.mode || 'edit', appId: body?.appId || null });
      console.log('[ai] Generated plan:', JSON.stringify(result, null, 2));
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
    const { files = [], edits = [], appName, appId: incomingAppId } = body || {};

    // Reuse existing app if provided, else create new
    const appId = incomingAppId || crypto.randomUUID();

    try {
      let appDir = path.join(GENERATED_APPS_DIR, appId);
      const exists = await fs.stat(appDir).then(() => true).catch(() => false);
      let changed = [];

      if (!exists) {
        // First-time creation path keeps existing behavior
        const created = await createIsolatedApp(appId, files, appName || 'Generated App');
        appDir = created.appDir;
        changed = created.changed;
      } else {
        // Iterative update: write new/updated files then apply edits
        const fileChanges = await writeFilesToApp(appId, files);
        const editChanges = await applyEditsToApp(appId, edits);
        changed = [...fileChanges, ...editChanges];
      }

      // Restart the app on same appId
      const { port, url } = await startElideApp(appId, appDir);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ appId, changed, previewUrl: url, port }));
    } catch (error) {
      console.error('[elide] Failed to create/start app:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  if (url.pathname === '/api/preview' && req.method === 'GET') {
    const appId = url.searchParams.get('appId');
    if (!appId) {
      res.writeHead(400); res.end('Missing appId parameter'); return;
    }

    const appUrl = getAppUrl(appId);
    if (!appUrl) {
      res.writeHead(404); res.end('App not found or not running'); return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ url: appUrl }));
    return;
  }
  if (url.pathname === '/api/files/tree' && req.method === 'GET') {
    const appId = url.searchParams.get('appId');
    if (appId) {
      // Get tree for specific app
      const tree = await readAppTree(appId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ tree }));
    } else {
      // Legacy: get tree from old generated directory
      const tree = await readTree();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ tree }));
    }
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

async function generatePlan(prompt, model = null, options = {}) {
  const mode = options?.mode || 'edit'; // 'chat' disables tool-calling and file extraction
  if (!genAI && !anthropic && !openrouterKey) {
    // Providerless fallback: synthesize minimal files based on prompt
    return fallbackGeneratePlan(prompt);
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

  // Anthropic tool schema for file creation (now declared inside planWithAnthropicTools)

  let text;

  if (useProvider === 'anthropic' && anthropic) {
    if (mode !== 'chat') {
      const toolPlan = await planWithAnthropicTools({ prompt, systemPrompt, anthropic, appId: options?.appId || null });
      return toolPlan;
    } else {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: prompt }
        ]
      });
      text = (response.content?.find?.(c => c.type === 'text')?.text) || response.content?.[0]?.text || '';
    }
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

  // Parse JSON response - handle Claude 4.0 Sonnet's complex format
  // If Anthropic handled tool-calling and returned early, we won't reach this block.

  try {
    let parsed = null;
    let diffs = [];

    // Safety check for text
    if (!text || typeof text !== 'string') {
      console.log('Invalid or empty response text');
      return { plan: { message: 'No response received', prompt }, diffs: [] };
    }

    // Check if response is ONLY markdown code blocks (not JSON structure)
    if (text.includes('```') && !text.includes('```json') && !text.includes('"files"') && !text.includes('"name"')) {
      console.log('Response contains only code blocks, no JSON structure, treating as plain text');
      return { plan: { message: text, prompt }, diffs: [] };
    }

    // Try to extract JSON from markdown code block first
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        // Claude 4.0 Sonnet returns complex nested JSON - use a more robust approach
        const jsonText = jsonMatch[1];

        // Try parsing directly first
        try {
          parsed = JSON.parse(jsonText);
        } catch (directParseError) {
          // If direct parsing fails, try to fix common issues
          console.log('Direct JSON parse failed, attempting to fix format...');

          // Extract files using a more robust approach
          // Look for file objects with either "name" or "path" fields
          const filePattern = /\{\s*"(?:name|path)":\s*"([^"]+)",\s*"content":\s*"((?:[^"\\]|\\[\s\S])*?)"\s*\}/g;
          let match;
          while ((match = filePattern.exec(jsonText)) !== null) {
            const fileName = match[1];
            let content = match[2];

            // Unescape the content more thoroughly
            content = content
              .replace(/\\n/g, '\n')
              .replace(/\\t/g, '\t')
              .replace(/\\r/g, '\r')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\');

            diffs.push({
              name: fileName,
              content: content
            });
          }

          // If no files found with the above pattern, try a simpler approach
          if (diffs.length === 0) {
            const simpleFilePattern = /"(?:name|path)":\s*"([^"]+)"[\s\S]*?"content":\s*"((?:[^"\\]|\\[\s\S])*?)"/g;
            let simpleMatch;
            while ((simpleMatch = simpleFilePattern.exec(jsonText)) !== null) {
              const fileName = simpleMatch[1];
              let content = simpleMatch[2];

              content = content
                .replace(/\\n/g, '\n')
                .replace(/\\t/g, '\t')
                .replace(/\\r/g, '\r')
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\');

              diffs.push({
                name: fileName,
                content: content
              });
            }
          }

          // Create a simple parsed object for the summary
          const summaryMatch = jsonText.match(/"summary":\s*"([^"]+)"/);
          parsed = {
            summary: summaryMatch ? summaryMatch[1] : "I'll create your app with the specified features."
          };
        }
      } catch (e) {
        console.warn('Failed to parse JSON from markdown:', e.message);
      }
    }

    // If we still don't have parsed data, try the old method
    if (!parsed) {
      const cleanedText = text.replace(/`([^`]*)`/gs, (match, content) => {
        const escaped = content
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        return `"${escaped}"`;
      });
      parsed = JSON.parse(cleanedText);
    }

    // If we haven't extracted diffs yet, try from parsed object
    if (diffs.length === 0 && parsed && parsed.files && Array.isArray(parsed.files)) {
      diffs = parsed.files.map(file => ({
        name: file.path || file.name,
        content: file.content
      }));
    }

    // Return short summary for chat and files for deployment
    const summary = parsed?.summary || "I'll create your app with the specified features.";

    console.log(`Extracted ${diffs.length} files for deployment`);

    return {
      plan: { message: summary, prompt },
      diffs: diffs
    };
  } catch (e) {
    console.warn('JSON parse error:', e.message);
    return { plan: { message: text, prompt }, diffs: [] };
  }
}
// Providerless minimal plan generator
function fallbackGeneratePlan(prompt) {
  const p = String(prompt || '').toLowerCase();
  if (p.includes('blog')) {
    const files = [
      { name: 'index.html', content: `<!doctype html><html><head><meta charset="utf-8"/><title>Pug Blog</title><style>body{font-family:system-ui;margin:2rem;max-width:700px} header{display:flex;align-items:center;gap:1rem} img{width:64px;height:64px;border-radius:50%} h1{margin:0}</style></head><body><header><img src="https://avatars.githubusercontent.com/u/215816?v=4" alt="Pug"/><div><h1>David "Pug" Anderson</h1><div>Personal blog</div></div></header><main><article><h2>Hello, world</h2><p>Welcome to my blog powered by Elideable.</p></article></main></body></html>` }
    ];
    return { plan: { message: 'Creating a simple personal blog for Pug with index.html.', prompt }, diffs: files };
  }
  const files = [
    { name: 'index.html', content: '<!doctype html><html><head><meta charset="utf-8"/><title>Hello Elide</title><style>body{font-family:system-ui;display:grid;place-items:center;height:100vh} h1{font-size:3rem}</style></head><body><h1>Hello, Elide! 🚀</h1></body></html>' }
  ];
  return { plan: { message: 'Creating a minimal Hello World app (index.html).', prompt }, diffs: files };
}


// --- Tool Planning Helpers (Anthropic) ---
async function planWithAnthropicTools({ prompt, systemPrompt, anthropic, appId }) {
  const tools = [
    {
      name: 'write_files',
      description: 'Create or overwrite application files with complete content. This tool should be used whenever you need to generate actual file contents for the user\'s app. You must provide the complete file content, not just snippets. Use this for creating HTML, CSS, JavaScript, Python, or any other files. The files will be written to the app directory and served to the user.',
      input_schema: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path relative to app root, e.g. "index.html" or "styles/main.css"' },
                content: { type: 'string', description: 'Complete file content as a string' }
              },
              required: ['path','content']
            }
          }
        },
        required: ['files']
      }
    }
  ];

  console.log('[ai] Sending request to Anthropic with tools:', tools.map(t => t.name));
  const stream = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514', max_tokens: 64000,
    system: systemPrompt + '\n\nCRITICAL: You MUST use the write_files tool to create actual files. Never just describe or explain what files you would create. Always immediately call write_files with complete, working file contents. The user expects actual files to be generated.',
    tools, tool_choice: { type: 'any' },
    stream: true,
    messages: [{ role: 'user', content: appId ? [{ type: 'text', text: prompt }, { type: 'text', text: `Active app id: ${appId}` }] : [{ type: 'text', text: prompt + '\n\nPlease use the write_files tool to create the actual files.' }] }]
  });

  // Collect the streaming response
  let response = { content: [], stop_reason: null, usage: null };
  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta') {
      if (!response.content[chunk.index]) {
        response.content[chunk.index] = { type: chunk.delta.type };
      }
      if (chunk.delta.type === 'text_delta') {
        response.content[chunk.index].text = (response.content[chunk.index].text || '') + chunk.delta.text;
      } else if (chunk.delta.type === 'input_json_delta') {
        response.content[chunk.index].input = (response.content[chunk.index].input || '') + chunk.delta.partial_json;
      }
    } else if (chunk.type === 'content_block_start') {
      response.content[chunk.index] = chunk.content_block;
    } else if (chunk.type === 'message_delta') {
      response.stop_reason = chunk.delta.stop_reason;
      response.usage = chunk.usage;
    }
  }

  console.log('[ai] Anthropic response:', JSON.stringify(response, null, 2));

  const diffs = [];
  const summaryParts = [];

  async function readFileForApp(p) {
    if (!appId) return '';
    try { const appDir = path.join(GENERATED_APPS_DIR, appId); const full = path.join(appDir, p); return await fs.readFile(full, 'utf8'); } catch { return ''; }
  }

  for (const block of response.content || []) {
    if (block.type === 'text' && block.text) summaryParts.push(block.text);
    if (block.type === 'tool_use') {
      const input = block.input || {};
      if (block.name === 'write_files') {
        const files = input.files || [];
        for (const f of files) diffs.push({ name: f.path || f.name, content: f.content ?? '' });
      }
      if (block.name === 'read_file') {
        const content = await readFileForApp(input.path);
        summaryParts.push(`Read ${input.path} (${content.length} bytes)`);
      }
      if (block.name === 'replace_in_file') {
        const content = await readFileForApp(input.path);
        if (content) {
          let replaced = content;
          if (input.regex) {
            const re = new RegExp(input.find, input.flags || 'g');
            replaced = replaced.replace(re, input.replace);
          } else {
            if (typeof input.count === 'number' && input.count >= 0) {
              let remaining = input.count; let idx = 0; let out = '';
              while (remaining !== 0) {
                const next = replaced.indexOf(input.find, idx);
                if (next === -1) { out += replaced.slice(idx); break; }
                out += replaced.slice(idx, next) + input.replace;
                idx = next + input.find.length;
                if (remaining > 0) remaining--;
              }
              if (remaining === 0) out += replaced.slice(idx);
              replaced = out || replaced;
            } else {
              replaced = replaced.split(input.find).join(input.replace);
            }
          }
          diffs.push({ name: input.path, content: replaced });
        }
      }
      if (block.name === 'update_block') {
        const content = await readFileForApp(input.path);
        if (content) {
          const startIdx = content.indexOf(input.start);
          const endIdx = content.indexOf(input.end, startIdx + input.start.length);
          if (startIdx !== -1 && endIdx !== -1) {
            const before = content.slice(0, input.include_markers ? startIdx + input.start.length : startIdx);
            const after = content.slice(input.include_markers ? endIdx : endIdx + input.end.length);
            const next = before + input.new_content + after;
            diffs.push({ name: input.path, content: next });
          }
        }
      }
    }
  }

  const summary = summaryParts.join('\n\n');
  return { plan: { message: summary || 'Generated plan with proposed files/edits.', prompt }, diffs };
}

// --- Apply helpers ---
async function writeFilesToApp(appId, files) {
  const changed = [];
  const appDir = path.join(GENERATED_APPS_DIR, appId);
  await fs.mkdir(appDir, { recursive: true });
  for (const f of files || []) {
    const name = f.name || f.path;
    if (!name) continue;
    const dest = path.join(appDir, name);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, f.content ?? f.contents ?? '', 'utf8');
    changed.push(name);
  }
  return changed;
}

async function applyEditsToApp(appId, edits) {
  const changed = [];
  const appDir = path.join(GENERATED_APPS_DIR, appId);
  for (const e of edits || []) {
    const dest = path.join(appDir, e.path);
    let content = await fs.readFile(dest, 'utf8').catch(() => '');
    if (!content) continue;
    if (e.type === 'replace_in_file') {
      if (e.regex) {
        const re = new RegExp(e.find, e.flags || 'g');
        content = content.replace(re, e.replace);
      } else {
        if (typeof e.count === 'number' && e.count >= 0) {
          let remaining = e.count; let idx = 0; let out = '';
          while (remaining !== 0) {
            const next = content.indexOf(e.find, idx);
            if (next === -1) { out += content.slice(idx); break; }
            out += content.slice(idx, next) + e.replace;
            idx = next + e.find.length;
            if (remaining > 0) remaining--;
          }
          if (remaining === 0) out += content.slice(idx);
          content = out || content;
        } else {
          content = content.split(e.find).join(e.replace);
        }
      }
      await fs.writeFile(dest, content, 'utf8');
      changed.push(e.path);
    }
    if (e.type === 'update_block') {
      const startIdx = content.indexOf(e.start);
      const endIdx = content.indexOf(e.end, startIdx + e.start.length);
      if (startIdx !== -1 && endIdx !== -1) {
        const before = content.slice(0, e.include_markers ? startIdx + e.start.length : startIdx);
        const after = content.slice(e.include_markers ? endIdx : endIdx + e.end.length);
        const next = before + (e.new_content ?? '') + after;
        await fs.writeFile(dest, next, 'utf8');
        changed.push(e.path);
      }
    }
  }
  return changed;
}

// --- Polyglot execution endpoints ---

async function executePolyglotCode(req, res) {
  const body = await readJSON(req, res);
  const { language, code, function: funcName, args = [] } = body;

  console.log(`[polyglot] Executing ${language} function: ${funcName}(${JSON.stringify(args)})`);

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

// --- Isolated App Generation ---
async function createIsolatedApp(appId, files, appName = 'Generated App') {
  const appDir = path.join(GENERATED_APPS_DIR, appId);
  await fs.mkdir(appDir, { recursive: true });

  // Generate elide.pkl manifest
  const elideManifest = generateElideManifest(appName, files);
  await fs.writeFile(path.join(appDir, 'elide.pkl'), elideManifest, 'utf8');

  // Write all source files
  const changed = [];
  for (const f of files) {
    const filePath = f.name || f.path;
    const dest = path.join(appDir, filePath);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, f.content ?? f.contents ?? '', 'utf8');
    changed.push(filePath);
  }

  return { appDir, changed };
}

function generateElideManifest(appName, files) {
  // Detect entrypoints from files
  const entrypoints = [];
  const dependencies = {
    npm: { packages: [] },
    pip: { packages: [] },
    maven: { packages: [] }
  };

  for (const file of files) {
    const fileName = file.name || file.path;
    const content = file.content || file.contents || '';

    // Detect entrypoints
    if (fileName.includes('server') || fileName.includes('main') || fileName.includes('app')) {
      if (fileName.endsWith('.ts') || fileName.endsWith('.tsx') || fileName.endsWith('.js')) {
        entrypoints.push(fileName);
      }
    }

    // Detect dependencies from imports
    if (content.includes('import') && (fileName.endsWith('.ts') || fileName.endsWith('.tsx'))) {
      if (content.includes('react')) dependencies.npm.packages.push('react@18', 'react-dom@18');
      if (content.includes('@types/')) dependencies.npm.packages.push('@types/node@^18.11.18');
    }
    if (content.includes('import') && fileName.endsWith('.py')) {
      if (content.includes('numpy')) dependencies.pip.packages.push('numpy');
      if (content.includes('pandas')) dependencies.pip.packages.push('pandas');
    }
  }

  // Default entrypoint if none detected
  if (entrypoints.length === 0) {
    const tsFiles = files.filter(f => (f.name || f.path).endsWith('.ts') || (f.name || f.path).endsWith('.tsx'));
    if (tsFiles.length > 0) {
      entrypoints.push(tsFiles[0].name || tsFiles[0].path);
    }
  }

  return `amends "elide:project.pkl"

name = "${appName.replace(/"/g, '\\"')}"
description = "Generated Elide polyglot application"
version = "1.0.0"

${entrypoints.length > 0 ? `entrypoint = "${entrypoints[0]}"` : ''}

dependencies {
  ${dependencies.npm.packages.length > 0 ? `npm {
    packages {
      ${dependencies.npm.packages.map(pkg => `"${pkg}"`).join('\n      ')}
    }
  }` : ''}
  ${dependencies.pip.packages.length > 0 ? `pip {
    packages {
      ${dependencies.pip.packages.map(pkg => `"${pkg}"`).join('\n      ')}
    }
  }` : ''}
}`;
}

// --- Process Management ---
async function startElideApp(appId, appDir) {
  // Stop existing app if running
  await stopElideApp(appId);

  const port = nextPort++;
  console.log(`[elide] Starting app ${appId} on port ${port}...`);

  return new Promise((resolve, reject) => {
    // Try to use Elide CLI first, fallback to Node.js server
    let process;

    // Check if elide command is available
    const checkElide = spawn('which', ['elide'], { stdio: 'pipe' });

    checkElide.on('exit', (code) => {
      if (code === 0) {
        // Elide CLI is available
        console.log(`[elide] Using Elide CLI for app ${appId}`);
        process = spawn('elide', ['serve', '--port', port.toString()], {
          cwd: appDir,
          stdio: ['pipe', 'pipe', 'pipe']
        });
      } else {
        // Fallback to Node.js server
        console.log(`[elide] Elide CLI not found, using Node.js fallback for app ${appId}`);
        process = spawn('node', ['-e', createNodeServerScript(appDir, port)], {
          cwd: appDir,
          stdio: ['pipe', 'pipe', 'pipe']
        });
      }

      setupProcessHandlers(process, appId, port, resolve, reject);
    });

    checkElide.on('error', () => {
      // Fallback to Node.js server
      console.log(`[elide] Using Node.js fallback for app ${appId}`);
      process = spawn('node', ['-e', createNodeServerScript(appDir, port)], {
        cwd: appDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      setupProcessHandlers(process, appId, port, resolve, reject);
    });
  });
}

function createNodeServerScript(appDir, port) {
  return `
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const APP_DIR = process.cwd();
const PORT = ${port};

// Mock polyglot functions for demo
const mockPolyglotFunctions = {
  async generateGreeting() {
    const greetings = ["Hello", "Hi", "Hey", "Greetings", "Welcome"];
    return greetings[Math.floor(Math.random() * greetings.length)];
  },

  async formatGreeting(greeting) {
    return greeting + ", World! 🌎";
  }
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/') {
    // If index.html exists in the app dir, serve it
    try {
      const indexPath = path.join(APP_DIR, 'index.html');
      if (fs.existsSync(indexPath)) {
        const html = fs.readFileSync(indexPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        return;
      }
    } catch {}

    // Serve the default demo React app
    const html = '<!DOCTYPE html>' +
      '<html><head><title>Elide App</title>' +
      '<script src="https://unpkg.com/react@18/umd/react.development.js"></script>' +
      '<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>' +
      '<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>' +
      '<style>' +
      'body { font-family: system-ui; margin: 0; padding: 20px; background: #f5f5f5; }' +
      '.app { text-align: center; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }' +
      'button { padding: 10px 20px; font-size: 16px; cursor: pointer; background: #0077ff; color: white; border: none; border-radius: 4px; margin: 10px; }' +
      'button:hover { background: #0056cc; }' +
      'p { font-size: 24px; margin-top: 20px; color: #333; }' +
      'h1 { color: #333; margin-bottom: 20px; }' +
      '</style>' +
      '</head><body><div id="root"></div>' +
      '<script type="text/babel">' +
      'const { useState } = React;' +
      'function App() {' +
      '  const [greeting, setGreeting] = useState("");' +
      '  const [loading, setLoading] = useState(false);' +
      '  const handleClick = async () => {' +
      '    setLoading(true);' +
      '    try {' +
      '      const response = await fetch("/api/polyglot/greeting");' +
      '      const data = await response.json();' +
      '      setGreeting(data.greeting);' +
      '    } catch (error) {' +
      '      setGreeting("Error: " + error.message);' +
      '    } finally {' +
      '      setLoading(false);' +
      '    }' +
      '  };' +
      '  return React.createElement("div", { className: "app" },' +
      '    React.createElement("h1", null, "Hello, Elide! 🚀"),' +
      '    React.createElement("p", null, "This is a polyglot app using TypeScript, Python, and Kotlin!"),' +
      '    React.createElement("button", { onClick: handleClick, disabled: loading },' +
      '      loading ? "Generating..." : "Say Hello"' +
      '    ),' +
      '    greeting && React.createElement("p", { style: { color: "#0077ff", fontWeight: "bold" } }, greeting)' +
      '  );' +
      '}' +
      'ReactDOM.render(React.createElement(App), document.getElementById("root"));' +
      '</script></body></html>';

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  if (req.url === '/api/polyglot/greeting') {
    try {
      // Simulate polyglot execution
      const baseGreeting = await mockPolyglotFunctions.generateGreeting();
      const formattedGreeting = await mockPolyglotFunctions.formatGreeting(baseGreeting);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        greeting: formattedGreeting,
        timestamp: new Date().toISOString(),
        polyglot: {
          python: "generateGreeting() executed",
          kotlin: "formatGreeting() executed"
        }
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (req.url === '/api/files') {
    const files = [];
    try {
      const entries = fs.readdirSync(APP_DIR);
      for (const entry of entries) {
        if (entry.startsWith('.')) continue;
        const fullPath = path.join(APP_DIR, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          const content = fs.readFileSync(fullPath, 'utf8');
          files.push({ name: entry, content });
        }
      }
    } catch (err) {
      console.error('Error reading files:', err);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(files));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log('Server started on port ' + PORT);
});
`;
}

function setupProcessHandlers(process, appId, port, resolve, reject) {
  let started = false;
  const timeout = setTimeout(() => {
    if (!started) {
      process.kill();
      reject(new Error(`App ${appId} failed to start within 30 seconds`));
    }
  }, 30000);

  process.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[elide:${appId}] ${output.trim()}`);

    // Look for server started indicators
    if (output.includes('Serving') || output.includes('Server started') || output.includes(`port ${port}`) || output.includes('listening')) {
      if (!started) {
        started = true;
        clearTimeout(timeout);
        const url = `http://localhost:${port}`;
        runningApps.set(appId, { process, port, url });
        console.log(`[elide] App ${appId} started at ${url}`);
        resolve({ port, url });
      }
    }
  });

  process.stderr.on('data', (data) => {
    console.error(`[elide:${appId}] ERROR: ${data.toString().trim()}`);
  });

  process.on('exit', (code) => {
    console.log(`[elide] App ${appId} exited with code ${code}`);
    runningApps.delete(appId);
    clearTimeout(timeout);
    if (!started) {
      reject(new Error(`App ${appId} exited with code ${code} before starting`));
    }
  });

  process.on('error', (err) => {
    console.error(`[elide] Failed to start app ${appId}:`, err);
    clearTimeout(timeout);
    reject(err);
  });
}

async function stopElideApp(appId) {
  const app = runningApps.get(appId);
  if (app) {
    console.log(`[elide] Stopping app ${appId}...`);
    app.process.kill();
    runningApps.delete(appId);
  }
}

function getAppUrl(appId) {
  const app = runningApps.get(appId);
  return app ? app.url : null;
}

async function readAppTree(appId) {
  const appDir = path.join(GENERATED_APPS_DIR, appId);
  try {
    return await readTreeFromDir(appDir);
  } catch (error) {
    console.error(`[elide] Failed to read app tree for ${appId}:`, error);
    return [];
  }
}

async function readTreeFromDir(dir) {
  const tree = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // Skip hidden files

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(path.join(GENERATED_APPS_DIR), fullPath);

      if (entry.isDirectory()) {
        tree.push({
          path: relativePath,
          type: 'dir',
          children: await readTreeFromDir(fullPath)
        });
      } else {
        tree.push({
          path: relativePath,
          type: 'file'
        });
      }
    }
  } catch (error) {
    console.error(`[elide] Failed to read directory ${dir}:`, error);
  }
  return tree;
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
    await walk(GENERATED_APPS_DIR);
  } catch {
    // empty initially
  }
  return entries;
}

async function readFileSafe(rel) {
  if (!rel) return '';
  const full = path.join(GENERATED_APPS_DIR, rel);
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

