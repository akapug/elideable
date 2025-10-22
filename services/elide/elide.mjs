import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import crypto from 'node:crypto';
import { ROOT, GENERATED_APPS_DIR } from './lib/paths.mjs';
import { readJSON } from './lib/body.mjs';
import { buildAppContext, readTreeFromDir } from './lib/context.mjs';
import { streamAppArchive } from './lib/zip.mjs';
import { buildSystemPrompt as buildSimplePrompt, buildUserPrompt as buildSimpleUserPrompt } from './prompts/qwen-plan-v2.mjs';
import { buildSystemPrompt as buildAdvancedPrompt, buildUserPrompt as buildAdvancedUserPrompt } from './prompts/advanced-plan.mjs';

const PORT = Number(process.env.PORT_ELIDE || 8787);
const PROVIDER = process.env.ELV_PROVIDER || 'openrouter';

// Track running Elide processes
const runningApps = new Map(); // appId -> { process, port, url }
const PREVIEW_PORT = 9000; // Always bind the active preview to this fixed port
let nextPort = PREVIEW_PORT;

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
    res.end(JSON.stringify({ ok: true, provider: PROVIDER, local: PROVIDER === 'local', model: process.env.OLLAMA_MODEL || null }));
    return;
  }
  if (url.pathname === '/api/ai/plan' && req.method === 'POST') {
    const body = await readJSON(req, res);
    const useStreaming = body?.stream === true;

    console.log('[ai] Planning request:', body?.prompt, 'with model:', body?.model, 'mode:', body?.mode || 'edit', 'appId:', body?.appId || '(new app)', 'history:', body?.history?.length || 0, 'messages', 'streaming:', useStreaming);

    if (useStreaming) {
      // Streaming response for real-time updates
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      try {
        const result = await generatePlan(body?.prompt || 'Create a simple app', body?.model, {
          mode: body?.mode || 'edit',
          appId: body?.appId || null,
          history: body?.history || [],
          onProgress: (chunk) => {
            // Send progress updates to client (chat streaming)
            res.write(`data: ${JSON.stringify({ type: 'progress', content: chunk })}\n\n`);
          },
          onCodeProgress: (data) => {
            // Send code streaming updates to client (file-by-file streaming)
            res.write(`data: ${JSON.stringify({ type: 'code_progress', ...data })}\n\n`);
          }
        });

        console.log('[ai] Generated plan (streamed)');
        res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`);
        res.end();
      } catch (error) {
        console.error('AI Plan error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
      }
    } else {
      // Non-streaming response (original behavior)
      try {
        const result = await generatePlan(body?.prompt || 'Create a simple app', body?.model, {
          mode: body?.mode || 'edit',
          appId: body?.appId || null,
          history: body?.history || []
        });
        console.log('[ai] Generated plan:', JSON.stringify(result, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error('AI Plan error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    }
    return;
  }
  if (url.pathname === '/api/ai/apply' && req.method === 'POST') {
    const body = await readJSON(req, res);
    const { files = [], edits = [], appName, appId: incomingAppId } = body || {};

    // Reuse existing app if provided, else create new
    const appId = incomingAppId || crypto.randomUUID();
    console.log('[ai] Apply request: appId=', incomingAppId ? incomingAppId.slice(0,8) + ' (reuse)' : 'NEW', 'files=', files.length, 'edits=', edits.length);

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
      // Add a cache-busting query so browsers never show a stale cached page in new tabs
      const previewUrl = `${url}?appId=${encodeURIComponent(appId)}&ts=${Date.now()}`;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ appId, changed, previewUrl, port }));
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

    // Return cache-busted URL so a new tab always fetches fresh content
    const previewUrl = `${appUrl}?ts=${Date.now()}`;
    res.writeHead(200, { 'Content-Type': 'application/json' });

    res.end(JSON.stringify({ url: previewUrl }));
    return;
  }
  // Start (or restart) a specific app's preview
  if (url.pathname === '/api/preview/start' && req.method === 'POST') {
    try {
      const { appId } = await readJSON(req, res);
      if (!appId) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Missing appId' })); return; }
      const appDir = path.join(GENERATED_APPS_DIR, appId);
      try { await fs.access(appDir); } catch { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'App not found' })); return; }
      await startElideApp(appId, appDir);
      const appUrl = getAppUrl(appId);
      const previewUrl = `${appUrl}?appId=${encodeURIComponent(appId)}&ts=${Date.now()}`;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ url: previewUrl }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e?.message || String(e) }));
    }
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

  // List all locally generated apps
  if (url.pathname === '/api/apps' && req.method === 'GET') {
    try {
      await fs.mkdir(GENERATED_APPS_DIR, { recursive: true });
      const entries = await fs.readdir(GENERATED_APPS_DIR, { withFileTypes: true });
      const apps = [];
      for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        const appId = ent.name;
        const appDir = path.join(GENERATED_APPS_DIR, appId);
        let name = '';
        // Try elide.pkl name
        try {
          const pkl = await fs.readFile(path.join(appDir, 'elide.pkl'), 'utf8');
          const m = pkl.match(/\nname\s*=\s*"([^"]+)"/);
          if (m) name = m[1];
        } catch {}
        // Try index.html <title>
        if (!name) {
          try {
            const html = await fs.readFile(path.join(appDir, 'index.html'), 'utf8');
            const m = html.match(/<title>([^<]+)<\/title>/i);
            if (m) name = m[1];
          } catch {}
        }
        const stat = await fs.stat(appDir).catch(() => null);
        const updatedAt = stat?.mtimeMs || 0;
        apps.push({ appId, name: name || appId.slice(0, 8), updatedAt });
      }
      apps.sort((a, b) => b.updatedAt - a.updatedAt);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ apps }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e?.message || String(e) }));
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
  if (url.pathname === '/api/files/content' && req.method === 'GET') {
    const appId = url.searchParams.get('appId');
    const filePath = url.searchParams.get('filePath');
    if (!appId || !filePath) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing appId or filePath');
      return;
    }
    try {
      const appDir = path.join(GENERATED_APPS_DIR, appId);
      const fullPath = path.join(appDir, filePath);
      const content = await fs.readFile(fullPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(content);

    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
    }
    return;
  }
  if (url.pathname === '/api/files/save' && req.method === 'POST') {
    const body = await readJSON(req, res);
    const { appId, filePath, content } = body || {};
    if (!appId || !filePath || content === undefined) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing appId, filePath, or content' }));
      return;
    }
    try {
      const appDir = path.join(GENERATED_APPS_DIR, appId);
      const fullPath = path.join(appDir, filePath);
      await fs.writeFile(fullPath, content, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to save file' }));
    }
    return;
  }
  if (url.pathname === '/api/files/open' && req.method === 'POST') {
    const body = await readJSON(req, res);
    const { appId, filePath } = body || {};
    if (!appId || !filePath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing appId or filePath' }));
      return;
    }
    try {
      const appDir = path.join(GENERATED_APPS_DIR, appId);
      const fullPath = path.join(appDir, filePath);
      // For now, just return success - in a real implementation, this would open the file in the system editor
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'File opened' }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to open file' }));
    }
    return;
  }
  if (url.pathname === '/api/deploy/cloudflare-pages' && req.method === 'POST') {
    const body = await readJSON(req, res);
    const { appId, projectName } = body || {};
    if (!appId || !projectName) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing appId or projectName' }));
      return;
    }
    const appDir = path.join(GENERATED_APPS_DIR, appId);
    try {
      await fs.access(appDir);
    } catch {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'App not found' }));
      return;
    }

    try {
      const args = ['-y', 'wrangler@latest', 'pages', 'deploy', appDir, `--project-name=${projectName}`];
      console.log('[deploy] npx', args.join(' '));
      const proc = spawn('npx', args, { cwd: ROOT, env: process.env });
      let out = '';
      let err = '';
      proc.stdout.on('data', (d) => { out += d.toString(); process.stdout.write(`[deploy] ${d}`); });
      proc.stderr.on('data', (d) => { err += d.toString(); process.stderr.write(`[deploy] ERR ${d}`); });
      proc.on('close', (code) => {
        if (code !== 0) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'wrangler failed', code, out, err }));
          return;
        }
        const urlMatch = out.match(/https?:\/\/[^\s]+\.pages\.dev\S*/);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, url: urlMatch ? urlMatch[0] : null, out }));
      });
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (url.pathname === '/api/deploy/github-pages' && req.method === 'POST') {
    const body = await readJSON(req, res);
    const { appId, repoUrl, branch } = body || {};
    const targetBranch = (branch && String(branch).trim()) || 'gh-pages';
    if (!appId || !repoUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing appId or repoUrl' }));
      return;
    }
    const appDir = path.join(GENERATED_APPS_DIR, appId);
    try { await fs.access(appDir); } catch { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'App not found' })); return; }

    // Deploy via a self-contained git repo in the app folder to avoid touching the main repo
    const script = [
      'set -e',
      'git init',
      `git checkout -B ${targetBranch}`,
      "git config user.email 'elideable@local'",
      "git config user.name 'Elideable'",
      'git add .',
      "git commit -m 'Deploy to GitHub Pages' || true",
      'git remote remove origin 2>/dev/null || true',
      `git remote add origin ${repoUrl}`,
      `git push -f origin ${targetBranch}`
    ].join(' && ');

    try {
      const proc = spawn('bash', ['-lc', script], { cwd: appDir, env: process.env });
      let out = ''; let err = '';
      proc.stdout.on('data', (d) => { out += d.toString(); process.stdout.write(`[deploy-gh] ${d}`); });
      proc.stderr.on('data', (d) => { err += d.toString(); process.stderr.write(`[deploy-gh] ERR ${d}`); });
      proc.on('close', (code) => {
        if (code !== 0) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'git push failed (ensure you have access/auth)', code, out, err }));
          return;
        }
        // Return standard GitHub Pages URL hint if using origin with user/repo
        let url = null;
        try {
          const m = repoUrl.match(/github\.com[:\/](.+?)\/(.+?)\.git$/);
          if (m) {
            const owner = m[1]; const repo = m[2];
            url = targetBranch === 'gh-pages' ? `https://${owner}.github.io/${repo}/` : null;
          }
        } catch {}
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, url, out }));
      });
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (url.pathname === '/api/export.zip' && req.method === 'GET') {
    const appId = url.searchParams.get('appId');
    if (!appId) { res.writeHead(400); res.end('Missing appId'); return; }
    const appDir = path.join(GENERATED_APPS_DIR, appId);
    try { await fs.access(appDir); } catch { res.writeHead(404); res.end('App not found'); return; }
    streamAppArchive(res, appDir, appId);
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

  // Determine provider based on model ID (allows dynamic switching without restart)
  let useProvider = PROVIDER;

  if (model) {
    // Check model ID pattern to determine provider
    // IMPORTANT: Check for OpenRouter format (contains '/') FIRST before checking for claude/gemini
    // This ensures models like 'anthropic/claude-sonnet-4.5' go to OpenRouter, not Anthropic direct
    if (model.startsWith('ollama:') || model.includes('gemma') || model.includes('qwen') || model.includes('llama')) {
      // Local Ollama model
      console.log('[ai] Using local provider (Ollama):', model);
      return await planWithLocalOllamaNode(prompt, model, options);
    } else if (model.includes('/') || model.includes(':free')) {
      // OpenRouter model (e.g., 'anthropic/claude-sonnet-4.5', 'google/gemini-2.5-pro')
      console.log('[ai] Using OpenRouter provider:', model);
      useProvider = 'openrouter';
    } else if (model.includes('claude-')) {
      // Direct Anthropic API (e.g., 'claude-sonnet-4-20250514')
      console.log('[ai] Using Anthropic direct provider:', model);
      useProvider = 'anthropic';
    } else if (model.includes('gemini-')) {
      // Direct Google API (e.g., 'gemini-1.5-flash')
      console.log('[ai] Using Google direct provider:', model);
      useProvider = 'gemini';
    }
  } else if (PROVIDER === 'local') {
    // No model specified but PROVIDER is local - use default local model
    console.log('[ai] Using local provider (Ollama) - no model specified');
    return await planWithLocalOllamaNode(prompt, model, options);
  }

  if (!genAI && !anthropic && !openrouterKey) {
    // Providerless fallback: synthesize minimal files based on prompt
    return fallbackGeneratePlan(prompt);
  }

  // Remote models ALWAYS use advanced prompts (local models use simple prompts)
  // Build context for editing mode
  let appContext = null;
  if (options?.appId) {
    try {
      appContext = await buildAppContext(options.appId, { maxFiles: 12, maxCharsPerFile: 500 });
    } catch {}
  }

  const systemPrompt = buildAdvancedPrompt({ appId: options?.appId, appContext });
  const userPrompt = buildAdvancedUserPrompt(prompt, options);

  const chatSystemPrompt = `You are an expert full-stack web developer. Provide helpful, conversational guidance about web development, architecture, and best practices. Keep responses focused and practical.`;

  // Anthropic tool schema for file creation (now declared inside planWithAnthropicTools)

  let text;

  if (useProvider === 'anthropic' && anthropic) {
    if (mode !== 'chat') {
      const toolPlan = await planWithAnthropicTools({
        prompt: userPrompt,
        systemPrompt,
        anthropic,
        appId: options?.appId || null,
        history: options?.history || []
      });
      return toolPlan;
    } else {
      // Build messages array with history for chat mode
      const messages = [];

      // Add chat history if provided
      if (options?.history && Array.isArray(options.history) && options.history.length > 0) {
        for (const msg of options.history) {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
      }

      // Add current prompt
      messages.push({ role: 'user', content: prompt });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: chatSystemPrompt,
        messages: messages
      });
      text = (response.content?.find?.(c => c.type === 'text')?.text) || response.content?.[0]?.text || '';
    }
  } else if (useProvider === 'gemini' && genAI) {
    const geminiModel = genAI.getGenerativeModel({ model: model || 'gemini-1.5-flash' });
    const selectedPrompt = mode === 'chat' ? chatSystemPrompt : systemPrompt;
    const fullPrompt = `${selectedPrompt}\n\nUser request: ${userPrompt}`;
    const result = await geminiModel.generateContent(fullPrompt);
    const response = await result.response;
    text = response.text();
  } else if (useProvider === 'local') {
    return await planWithLocalOllamaNode(prompt, model, options);
  } else if (useProvider === 'openrouter' && openrouterKey) {
    // Check if model supports tool calling
    // Free models and some others don't support tools
    const freeModels = [
      'google/gemini-2.0-flash-exp:free',
      'deepseek/deepseek-chat-v3.1:free',
      'google/gemini-2.5-flash-image' // Experimental image model
    ];
    const isFreeModel = freeModels.some(freeModel => model?.includes(freeModel));

    if (mode !== 'chat' && !isFreeModel) {
      // Use OpenRouter with tool-calling (OpenAI format) for SOTA models
      const toolPlan = await planWithOpenRouterTools({
        prompt: userPrompt,
        systemPrompt,
        openrouterKey,
        model,
        appId: options?.appId || null,
        history: options?.history || [],
        onCodeProgress: options?.onCodeProgress
      });
      return toolPlan;
    } else {
      // Chat mode OR free models (no tool support) - use text-only API
      // Free models don't support tool calling, so we use chat completions for them
      let selectedPrompt = mode === 'chat' ? chatSystemPrompt : systemPrompt;
      let userMessage = mode === 'chat' ? prompt : userPrompt;

      if (isFreeModel && mode !== 'chat') {
        console.log('[ai] Free model detected in generate mode - using text-only approach (no tool calling)');

        // For free models in generate mode, use a special prompt that asks for code in markdown
        selectedPrompt = 'You are a helpful AI that generates complete, working web applications.\n\n' +
          'When the user asks you to create an app, you MUST respond with the complete HTML code wrapped in a markdown code block.\n\n' +
          'IMPORTANT:\n' +
          '- Return ONLY the code in a markdown code block (```html ... ```)\n' +
          '- Include ALL necessary HTML, CSS, and JavaScript in a single file\n' +
          '- Make it fully functional and self-contained\n' +
          '- Do NOT explain or describe the code, just return it\n' +
          '- Do NOT use any external dependencies or libraries unless absolutely necessary\n\n' +
          'Example response format:\n' +
          '```html\n' +
          '<!DOCTYPE html>\n' +
          '<html>\n' +
          '<head>\n' +
          '  <meta charset="UTF-8">\n' +
          '  <title>App Title</title>\n' +
          '  <style>\n' +
          '    /* CSS here */\n' +
          '  </style>\n' +
          '</head>\n' +
          '<body>\n' +
          '  <!-- HTML here -->\n' +
          '  <script>\n' +
          '    // JavaScript here\n' +
          '  </script>\n' +
          '</body>\n' +
          '</html>\n' +
          '```';

        userMessage = 'Create a complete, working web application: ' + userPrompt + '\n\n' +
          'Remember: Return ONLY the HTML code in a markdown code block. No explanations, no descriptions, just the code.';
      }

      // Build messages array with history
      const messages = [
        { role: 'system', content: selectedPrompt }
      ];

      // Add chat history if provided
      if (options?.history && Array.isArray(options.history) && options.history.length > 0) {
        messages.push(...options.history);
      }

      // Add current prompt
      messages.push({ role: 'user', content: userMessage });

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
          messages: messages,
          max_tokens: 4000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ai] OpenRouter API error ${response.status}:`, errorText);
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('[ai] OpenRouter chat response received');

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('[ai] Invalid OpenRouter response structure:', data);
        throw new Error('Invalid OpenRouter response structure');
      }

      text = data.choices[0].message.content;
    }
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
      // For chat mode, return as plain text
      if (mode === 'chat') {
        console.log('Response contains only code blocks, no JSON structure, treating as plain text');
        return { plan: { message: text, prompt }, diffs: [] };
      }

      // For generate mode (free models), try to extract code from markdown blocks
      console.log('Response contains code blocks - attempting to extract for deployment');
      const codeBlockPattern = /```(?:html|javascript|js|css)?\s*([\s\S]*?)```/g;
      const codeBlocks = [];
      let match;

      while ((match = codeBlockPattern.exec(text)) !== null) {
        codeBlocks.push(match[1].trim());
      }

      if (codeBlocks.length > 0) {
        console.log(`Extracted ${codeBlocks.length} code block(s) from response`);
        const htmlContent = codeBlocks[0];

        return {
          plan: {
            message: 'Generated app from free model response',
            prompt
          },
          diffs: [
            { name: 'index.html', content: htmlContent }
          ]
        };
      }

      // If no code blocks found, return as plain text
      console.log('No code blocks found, returning text response');
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
    // In chat mode, text-only responses are expected, so don't log as error
    if (mode === 'chat') {
      console.log('[ai] Chat mode: returning text response (no JSON structure)');
      return { plan: { message: text, prompt }, diffs: [] };
    }

    // For free models in generate mode, try to extract code from markdown blocks
    console.warn('[ai] JSON parse error in generate mode:', e.message);
    console.log('[ai] Attempting to extract code from markdown blocks...');

    // Try to extract HTML/code from markdown code blocks
    const codeBlockPattern = /```(?:html|javascript|js|css)?\s*([\s\S]*?)```/g;
    const codeBlocks = [];
    let match;

    while ((match = codeBlockPattern.exec(text)) !== null) {
      codeBlocks.push(match[1].trim());
    }

    if (codeBlocks.length > 0) {
      // If we found code blocks, use the first one as index.html
      console.log(`[ai] Extracted ${codeBlocks.length} code block(s) from response`);
      const htmlContent = codeBlocks[0];

      return {
        plan: {
          message: 'Generated app from free model response (extracted from markdown)',
          prompt
        },
        diffs: [
          { name: 'index.html', content: htmlContent }
        ]
      };
    }

    // If no code blocks found, return text as-is
    console.log('[ai] No code blocks found, returning text response');
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
async function planWithAnthropicTools({ prompt, systemPrompt, anthropic, appId, history }) {
  const tools = [
    {
      name: 'write_files',
      description: 'Create NEW files or COMPLETELY REWRITE existing files. Use this ONLY when creating new files or when you need to replace the entire file content. For small edits to existing files, use str_replace instead.',
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
    },
    {
      name: 'str_replace',
      description: 'Make targeted edits to existing files by replacing specific strings. Use this for small, precise changes (< 50 lines). The old_str must match EXACTLY including all whitespace, indentation, and line breaks. If you\'re unsure of the exact formatting, use read_file first to see the current content.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to app root' },
          old_str: { type: 'string', description: 'Exact string to find and replace. Must match exactly including whitespace.' },
          new_str: { type: 'string', description: 'Replacement string' }
        },
        required: ['path', 'old_str', 'new_str']
      }
    },
    {
      name: 'apply_diff',
      description: 'Apply a unified diff patch to a file. Use this for multiple changes in one file or when str_replace would be too fragile. The diff should be in standard unified diff format.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to app root' },
          diff: { type: 'string', description: 'Unified diff format patch (output of diff -u)' }
        },
        required: ['path', 'diff']
      }
    },
    {
      name: 'read_file',
      description: 'Read the current content of a file. Use this before making edits to see the exact formatting and content.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to app root' }
        },
        required: ['path']
      }
    }
  ];

  console.log('[ai] Sending request to Anthropic with tools:', tools.map(t => t.name));

  // Build messages array with history
  const messages = [];

  // Add chat history if provided (convert to Anthropic format)
  if (history && Array.isArray(history) && history.length > 0) {
    for (const msg of history) {
      messages.push({
        role: msg.role,
        content: [{ type: 'text', text: msg.content }]
      });
    }
  }

  // Add current prompt
  messages.push({
    role: 'user',
    content: appId
      ? [{ type: 'text', text: prompt }, { type: 'text', text: `Active app id: ${appId}` }]
      : [{ type: 'text', text: prompt + '\n\nPlease use the write_files tool to create the actual files.' }]
  });

  const stream = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514', max_tokens: 64000,
    system: systemPrompt + '\n\nCRITICAL: You MUST use the write_files tool to create actual files. Never just describe or explain what files you would create. Always immediately call write_files with complete, working file contents. The user expects actual files to be generated.',
    tools, tool_choice: { type: 'any' },
    stream: true,
    messages: messages
  });

  // Collect the streaming response

// Local provider via Elide runtime (spawns Elide to run TS that calls Ollama)
async function planWithLocalElide(prompt, model = null, options = {}) {
  return new Promise((resolve) => {
    try {
      const scriptPath = path.join(ROOT, 'services', 'elide', 'local_infer.js');
      const payload = {
        prompt,
        model: model || process.env.OLLAMA_MODEL || 'gemma2:2b-instruct',
        options,
        ollama: {
          baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
          model: process.env.OLLAMA_MODEL || 'gemma2:2b-instruct'
        }
      };
      const proc = spawn('elide', ['js', scriptPath, '--', JSON.stringify(payload)]);
      let out = '';
      let err = '';
      proc.stdout.on('data', (d) => out += d);
      proc.stderr.on('data', (d) => err += d);
      proc.on('exit', (code) => {
        if (code === 0) {
          try { resolve(JSON.parse(out || '{}')); }
          catch (e) { console.error('[ai] local elide parse error:', e); resolve(fallbackGeneratePlan(prompt)); }
        } else {
          console.error('[ai] local elide exited', code, err);
          resolve(fallbackGeneratePlan(prompt));
        }
      });
    } catch (e) {
      console.error('[ai] local elide spawn error:', e);
      resolve(fallbackGeneratePlan(prompt));
    }
  });
}



  let response = { content: [], stop_reason: null, usage: null };
  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta') {
      if (!response.content[chunk.index]) {
        response.content[chunk.index] = { type: chunk.delta.type };
      }
      if (chunk.delta.type === 'text_delta') {
        response.content[chunk.index].text = (response.content[chunk.index].text || '') + chunk.delta.text;
      } else if (chunk.delta.type === 'input_json_delta') {
        // Accumulate JSON string, then parse it at the end
        response.content[chunk.index].input_json_string = (response.content[chunk.index].input_json_string || '') + chunk.delta.partial_json;
      }
    } else if (chunk.type === 'content_block_start') {
      response.content[chunk.index] = chunk.content_block;
    } else if (chunk.type === 'message_delta') {
      response.stop_reason = chunk.delta.stop_reason;
      response.usage = chunk.usage;
    }
  }

  // Parse accumulated JSON strings for tool inputs
  for (const block of response.content) {
    if (block.type === 'tool_use' && block.input_json_string) {
      try {
        console.log('[ai] Parsing tool input JSON, length:', block.input_json_string.length);
        block.input = JSON.parse(block.input_json_string);
        delete block.input_json_string; // Clean up
        console.log('[ai] Successfully parsed tool input');
      } catch (e) {
        console.error('[ai] Failed to parse tool input JSON:', e.message);
        console.error('[ai] Raw JSON string (first 500 chars):', block.input_json_string.substring(0, 500));
        console.error('[ai] Raw JSON string (last 500 chars):', block.input_json_string.substring(Math.max(0, block.input_json_string.length - 500)));
        block.input = {}; // Fallback to empty object
      }
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
        let files = input.files || [];
        console.log('[ai] Processing write_files tool call, files type:', typeof files);

        // Handle case where files is a JSON string instead of array
        if (typeof files === 'string') {
          try {
            files = JSON.parse(files);
            console.log('[ai] Successfully parsed files JSON, got', files.length, 'files');
          } catch (e) {
            console.error('[ai] Failed to parse files JSON string:', e.message);
            console.error('[ai] Raw files string length:', files.length);
            files = [];
          }
        }

        console.log('[ai] Processing', files.length, 'files');
        for (const f of files) {
          const fileName = f.path || f.name;
          const fileContent = f.content ?? '';
          console.log('[ai] Adding file:', fileName, '(', fileContent.length, 'chars)');
          diffs.push({ name: fileName, content: fileContent });
        }
      }
      if (block.name === 'read_file') {
        const content = await readFileForApp(input.path);
        summaryParts.push(`Read ${input.path} (${content.length} bytes)`);
      }
      if (block.name === 'str_replace') {
        console.log('[ai] Processing str_replace tool call for:', input.path);
        const content = await readFileForApp(input.path);
        if (!content) {
          console.error('[ai] str_replace failed: file not found:', input.path);
          summaryParts.push(`Error: File ${input.path} not found`);
        } else {
          const oldStr = input.old_str;
          const newStr = input.new_str;

          if (!content.includes(oldStr)) {
            console.error('[ai] str_replace failed: old_str not found in file');
            console.error('[ai] Looking for:', oldStr.substring(0, 100));
            summaryParts.push(`Error: String not found in ${input.path}`);
          } else {
            const replaced = content.replace(oldStr, newStr);
            diffs.push({ name: input.path, content: replaced });
            console.log('[ai] str_replace successful for:', input.path);
            summaryParts.push(`Edited ${input.path} with str_replace`);
          }
        }
      }
      if (block.name === 'apply_diff') {
        console.log('[ai] Processing apply_diff tool call for:', input.path);
        const content = await readFileForApp(input.path);
        if (!content) {
          console.error('[ai] apply_diff failed: file not found:', input.path);
          summaryParts.push(`Error: File ${input.path} not found`);
        } else {
          try {
            // Simple unified diff parser
            const diffLines = input.diff.split('\\n');
            const lines = content.split('\\n');
            let result = [];
            let lineIdx = 0;

            for (const diffLine of diffLines) {
              if (diffLine.startsWith('@@')) {
                // Parse hunk header: @@ -start,count +start,count @@
                const match = diffLine.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
                if (match) {
                  const oldStart = parseInt(match[1]) - 1; // Convert to 0-based
                  lineIdx = oldStart;
                }
              } else if (diffLine.startsWith('-')) {
                // Remove line
                lineIdx++;
              } else if (diffLine.startsWith('+')) {
                // Add line
                result.push(diffLine.substring(1));
              } else if (diffLine.startsWith(' ')) {
                // Context line - keep it
                if (lineIdx < lines.length) {
                  result.push(lines[lineIdx]);
                  lineIdx++;
                }
              }
            }

            // Add remaining lines
            while (lineIdx < lines.length) {
              result.push(lines[lineIdx]);
              lineIdx++;
            }

            diffs.push({ name: input.path, content: result.join('\\n') });
            console.log('[ai] apply_diff successful for:', input.path);
            summaryParts.push(`Applied diff to ${input.path}`);
          } catch (e) {
            console.error('[ai] apply_diff failed:', e.message);
            summaryParts.push(`Error applying diff to ${input.path}: ${e.message}`);
          }
        }
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

// Local provider via Elide runtime (spawns Elide to run TS that calls Ollama)
async function planWithLocalElide(prompt, model = null, options = {}) {
  return new Promise((resolve) => {
    try {
      const scriptPath = path.join(ROOT, 'services', 'elide', 'local_infer.js');
      const payload = {
        prompt,
        model: model || process.env.OLLAMA_MODEL || 'gemma2:2b-instruct',
        options,
        ollama: {
          baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
          model: process.env.OLLAMA_MODEL || 'gemma2:2b-instruct'
        }
      };
      const proc = spawn('elide', ['js', scriptPath, '--', JSON.stringify(payload)]);
      let out = '';
      let err = '';
      proc.stdout.on('data', (d) => out += d);
      proc.stderr.on('data', (d) => err += d);
      proc.on('exit', (code) => {
        if (code === 0) {
          try { resolve(JSON.parse(out || '{}')); }
          catch (e) { console.error('[ai] local elide parse error:', e); resolve(fallbackGeneratePlan(prompt)); }
        } else {
          console.error('[ai] local elide exited', code, err);
          resolve(fallbackGeneratePlan(prompt));
        }
      });
    } catch (e) {
      console.error('[ai] local elide spawn error:', e);
      resolve(fallbackGeneratePlan(prompt));
    }
  });
}

// --- Tool Planning Helpers (Ollama) ---
async function planWithOllamaTools({ prompt, systemPrompt, userPrompt, baseUrl, model, appId, history, onProgress, onCodeProgress }) {
  const tools = [
    {
      type: 'function',
      function: {
        name: 'write_files',
        description: 'Create NEW files or COMPLETELY REWRITE existing files. Use this ONLY when creating new files or when you need to replace the entire file content. For small edits to existing files, use str_replace instead.',
        parameters: {
          type: 'object',
          properties: {
            files: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  path: { type: 'string', description: 'File path relative to app root (e.g., "server.ts", "analyzer.py")' },
                  content: { type: 'string', description: 'Complete file content' }
                },
                required: ['path', 'content']
              }
            }
          },
          required: ['files']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'str_replace',
        description: 'Make targeted edits to existing files by replacing specific strings.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to app root' },
            old_str: { type: 'string', description: 'Exact string to find and replace' },
            new_str: { type: 'string', description: 'Replacement string' }
          },
          required: ['path', 'old_str', 'new_str']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read the current content of a file.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to app root' }
          },
          required: ['path']
        }
      }
    }
  ];

  console.log('[ai] Making Ollama tool-calling request with model:', model);

  // Build messages array
  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  if (history && Array.isArray(history) && history.length > 0) {
    messages.push(...history);
  }

  messages.push({ role: 'user', content: userPrompt });

  // Helper to read file for app
  async function readFileForApp(p) {
    if (!appId) return '';
    try {
      const appDir = path.join(GENERATED_APPS_DIR, appId);
      const full = path.join(appDir, p);
      return await fs.readFile(full, 'utf8');
    } catch {
      return '';
    }
  }

  // Tool calling loop
  const MAX_ITERATIONS = 10;
  let iteration = 0;
  const summaryParts = [];
  const diffs = [];
  const timeoutMs = 300000; // 5 minutes for 32B

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    console.log(`[ai] Ollama tool calling iteration ${iteration}/${MAX_ITERATIONS}`);

    const requestBody = {
      model: model,
      messages: messages,
      tools: tools,
      stream: false, // Disable streaming for tool calls to get complete response
      options: { temperature: 0.3 }
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ai] Ollama API error ${response.status}:`, errorText);
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('[ai] Ollama tool-calling response received');

      if (!data.message) {
        console.error('[ai] Invalid Ollama response structure:', data);
        throw new Error('Invalid Ollama response structure');
      }

      const message = data.message;
      console.log('[ai] Ollama message:', JSON.stringify(message, null, 2));

      // Add assistant message to conversation
      messages.push(message);

      // Handle tool calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`[ai] Ollama returned ${message.tool_calls.length} tool calls`);

        const toolResults = [];

        for (const toolCall of message.tool_calls) {
          console.log(`[ai] Tool call:`, JSON.stringify(toolCall, null, 2));
          let toolResult = { success: false, output: '' };

          if (toolCall.function.name === 'write_files') {
            try {
              const args = toolCall.function.arguments;
              const files = args.files || [];
              console.log(`[ai] Ollama tool call: write_files with ${files.length} files`);

              for (const file of files) {
                diffs.push({ name: file.path, content: file.content || '' });

                // Stream code to editor if callback provided
                if (onCodeProgress && typeof onCodeProgress === 'function') {
                  onCodeProgress({
                    file: file.path,
                    content: file.content || '',
                    status: 'complete'
                  });
                }
              }
              summaryParts.push(`Generated ${files.length} files: ${files.map(f => f.path).join(', ')}`);
              toolResult = { success: true, output: `Created ${files.length} files` };
            } catch (e) {
              console.error('[ai] Failed to process write_files:', e.message);
              toolResult = { success: false, output: `Error: ${e.message}` };
            }
          }

          if (toolCall.function.name === 'str_replace') {
            try {
              const args = toolCall.function.arguments;
              console.log('[ai] Ollama tool call: str_replace for', args.path);

              const content = await readFileForApp(args.path);
              if (!content) {
                summaryParts.push(`Error: File ${args.path} not found`);
                toolResult = { success: false, output: `File ${args.path} not found` };
              } else if (!content.includes(args.old_str)) {
                summaryParts.push(`Error: String not found in ${args.path}`);
                toolResult = { success: false, output: `String not found in ${args.path}` };
              } else {
                const replaced = content.replace(args.old_str, args.new_str);
                diffs.push({ name: args.path, content: replaced });
                summaryParts.push(`Edited ${args.path} with str_replace`);
                toolResult = { success: true, output: `Successfully edited ${args.path}` };
              }
            } catch (e) {
              console.error('[ai] Failed to process str_replace:', e.message);
              toolResult = { success: false, output: `Error: ${e.message}` };
            }
          }

          if (toolCall.function.name === 'read_file') {
            try {
              const args = toolCall.function.arguments;
              const content = await readFileForApp(args.path);
              console.log(`[ai] read_file: ${args.path} (${content.length} bytes)`);
              summaryParts.push(`Read ${args.path} (${content.length} bytes)`);
              toolResult = { success: true, output: content || `File ${args.path} is empty or not found` };
            } catch (e) {
              console.error('[ai] Failed to process read_file:', e.message);
              toolResult = { success: false, output: `Error: ${e.message}` };
            }
          }

          // Add tool result to messages
          toolResults.push({
            role: 'tool',
            content: toolResult.output
          });
        }

        // Add all tool results to messages
        messages.push(...toolResults);

        // If we got file-modifying tool calls, we're done
        const hasFileModifications = message.tool_calls.some(tc =>
          tc.function.name === 'write_files' || tc.function.name === 'str_replace'
        );

        if (hasFileModifications) {
          console.log('[ai] File modifications detected, ending tool calling loop');
          break;
        }

        console.log('[ai] No file modifications yet, continuing tool calling loop');
      } else {
        // No tool calls - AI is done
        console.log('[ai] No tool calls in Ollama response, ending loop');
        break;
      }
    } catch (e) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') {
        console.warn('[ai] Ollama tool calling timeout after 5 minutes');
        throw new Error('Ollama timed out after 5 minutes');
      }
      throw e;
    }
  }

  if (iteration >= MAX_ITERATIONS) {
    console.warn('[ai] Tool calling loop reached maximum iterations');
    summaryParts.push('Warning: Reached maximum tool calling iterations');
  }

  const summary = summaryParts.join('\n\n');
  return { plan: { message: summary || 'Generated plan with Ollama tools.', prompt }, diffs };
}

// Local provider via direct Node fetch to Ollama (v4.0 with tool calling for 32B models)
async function planWithLocalOllamaNode(prompt, model = null, options = {}) {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';

  // Strip 'ollama:' prefix if present
  let modelName = model;
  if (modelName && modelName.startsWith('ollama:')) {
    modelName = modelName.substring(7); // Remove 'ollama:' prefix
  }

  const mdl = (process.env.OLLAMA_MODEL && process.env.OLLAMA_MODEL.trim()) ? process.env.OLLAMA_MODEL : (modelName || 'gemma2:2b-instruct-q8_0');

  console.log('[ai] Ollama model name after stripping prefix:', mdl);

  // Build context for editing mode
  let appContext = null;
  if (options?.appId) {
    try {
      appContext = await buildAppContext(options.appId, { maxFiles: 12, maxCharsPerFile: 500 });
    } catch {}
  }

  // 32B models use advanced prompts with tool calling, smaller models use simple prompts
  const is32BModel = mdl.includes('32b');
  const systemPrompt = is32BModel
    ? buildAdvancedPrompt({ appId: options?.appId, appContext })
    : buildSimplePrompt({ appId: options?.appId, appContext });
  const userPrompt = is32BModel
    ? buildAdvancedUserPrompt(prompt, options)
    : buildSimpleUserPrompt(prompt, options);

  console.log(`[ai] Using ${is32BModel ? 'ADVANCED' : 'SIMPLE'} prompts for ${mdl}`);

  // If 32B model, use tool calling
  if (is32BModel) {
    return await planWithOllamaTools({ prompt, systemPrompt, userPrompt, baseUrl, model: mdl, appId: options?.appId, history: options?.history, onProgress: options?.onProgress, onCodeProgress: options?.onCodeProgress });
  }

  // Build messages array with history
  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  // Add chat history if provided
  if (options?.history && Array.isArray(options.history) && options.history.length > 0) {
    messages.push(...options.history);
  }

  // Add current prompt
  messages.push({ role: 'user', content: userPrompt });

  // 32B models get tool calling support
  const tools = is32BModel ? [
    {
      type: 'function',
      function: {
        name: 'write_files',
        description: 'Create NEW files or COMPLETELY REWRITE existing files. Use this ONLY when creating new files or when you need to replace the entire file content. For small edits to existing files, use str_replace instead.',
        parameters: {
          type: 'object',
          properties: {
            files: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  path: { type: 'string', description: 'File path relative to app root (e.g., "index.html", "src/app.js")' },
                  content: { type: 'string', description: 'Complete file content' }
                },
                required: ['path', 'content']
              }
            }
          },
          required: ['files']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'str_replace',
        description: 'Make targeted edits to existing files by replacing specific strings. Use this for small, precise changes (< 50 lines). The old_str must match EXACTLY including all whitespace, indentation, and line breaks.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to app root' },
            old_str: { type: 'string', description: 'Exact string to find and replace. Must match exactly including whitespace.' },
            new_str: { type: 'string', description: 'Replacement string' }
          },
          required: ['path', 'old_str', 'new_str']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'apply_diff',
        description: 'Apply a unified diff patch to a file. Use this for multiple changes in one file or when str_replace would be too fragile.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to app root' },
            diff: { type: 'string', description: 'Unified diff format patch' }
          },
          required: ['path', 'diff']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read the current content of a file. Use this before making edits to see the exact formatting.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to app root' }
          },
          required: ['path']
        }
      }
    }
  ] : null;

  const body = {
    model: mdl,
    stream: true, // Enable streaming for better responsiveness
    format: is32BModel ? undefined : 'json', // 32B uses tools, don't force JSON format
    options: { temperature: 0.3 },
    messages: messages,
    ...(tools && { tools }) // Add tools for 32B model
  };

  try {
    // Determine timeout based on model size
    // 32B models need more time to load and generate
    const is32BModel = mdl.includes('32b');
    const timeoutMs = is32BModel ? 300000 : 120000; // 5 minutes for 32B, 2 minutes for others

    console.log(`[ai] Starting Ollama request for model: ${mdl} (timeout: ${timeoutMs/1000}s)`);
    const startTime = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    console.log('[ai] Sending fetch request to Ollama...');
    const fetchStartTime = Date.now();

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const fetchDuration = Date.now() - fetchStartTime;
    console.log(`[ai] Fetch completed in ${fetchDuration}ms, status: ${res.status}`);

    clearTimeout(timeout);

    if (!res.ok) {
      // Try to get the actual error message from Ollama
      let errorMessage = `Ollama HTTP ${res.status}`;
      try {
        const errorBody = await res.text();
        const errorJson = JSON.parse(errorBody);
        if (errorJson.error) {
          errorMessage = errorJson.error;
        }
      } catch (e) {
        // If we can't parse the error, use the generic message
      }
      throw new Error(errorMessage);
    }

    // Collect streaming response
    console.log('[ai] Starting to read streaming response...');
    let fullContent = '';
    let firstChunkTime = null;
    let chunkCount = 0;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (!firstChunkTime) {
        firstChunkTime = Date.now();
        const timeToFirstChunk = firstChunkTime - startTime;
        console.log(`[ai] First chunk received after ${timeToFirstChunk}ms (model load + generation start)`);
      }

      chunkCount++;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.message?.content) {
            const content = json.message.content;
            fullContent += content;

            // Call progress callback if provided
            if (options?.onProgress && typeof options.onProgress === 'function') {
              if (chunkCount % 10 === 0) { // Log every 10th chunk to avoid spam
                console.log(`[ai] Chunk ${chunkCount}: Calling onProgress with ${content.length} chars`);
              }
              options.onProgress(content);
            }
          }
        } catch (e) {
          // Skip invalid JSON lines
          if (chunkCount <= 5) { // Only log parse errors for first few chunks
            console.log(`[ai] Skipping invalid JSON line in chunk ${chunkCount}`);
          }
        }
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[ai] Streaming complete! Total: ${totalDuration}ms, Chunks: ${chunkCount}, Content length: ${fullContent.length} chars`);
    console.log(`[ai] Raw content preview (first 500 chars): ${fullContent.substring(0, 500)}`);

    let parsed = null;
    let parseError = null;
    try {
      parsed = JSON.parse(fullContent.trim());
      console.log('[ai] Successfully parsed JSON response');
    } catch (e) {
      parseError = e.message;
      console.log('[ai] JSON parse failed:', e.message);
    }

    // Tolerant fallback: if not strict JSON, accept raw HTML or heuristically mirror the prompt
    if (!parsed || !Array.isArray(parsed.diffs) || parsed.diffs.length === 0) {
      console.log('[ai] No valid diffs in parsed JSON, trying fallback extraction...');
      // Try to extract full HTML from the model output
      const htmlMatch = fullContent.match(/<html[\s\S]*<\/html>/i) || fullContent.match(/<!doctype html[\s\S]*<\/html>/i);
      if (htmlMatch) {
        console.log('[ai] Extracted HTML from model output');
        parsed = { plan: { message: 'Generated HTML from model output.', prompt }, diffs: [ { name: 'index.html', content: htmlMatch[0] } ] };
      } else {
        console.log('[ai] No HTML found, using heuristic fallback');
        // Heuristic: allow `h1: ...` hint in prompt to define the heading
        const h1Match = String(prompt || '').match(/h1:\s*([^\n]+)/i);
        const h1 = (h1Match && h1Match[1] && h1Match[1].trim()) ? h1Match[1].trim() : 'Hello from Qwen!';
        parsed = {
          plan: { message: 'Heuristic fallback from prompt.', prompt },
          diffs: [ { name: 'index.html', content: `<!doctype html><html><head><meta charset="utf-8"/><title>Hello</title></head><body><h1>${h1}</h1></body></html>` } ]
        };
      }
    } else {
      console.log(`[ai] Valid JSON with ${parsed.diffs.length} diffs`);
      parsed.plan = parsed.plan || { message: 'Generated plan', prompt };
    }

    console.log('[ai] Returning parsed result to client');
    return parsed;
  } catch (e) {
    if (e.name === 'AbortError') {
      const is32BModel = mdl.includes('32b');
      const timeoutMinutes = is32BModel ? 5 : 2;
      console.warn(`[ai] local ollama timeout after ${timeoutMinutes} minutes`);
      throw new Error(`Local model timed out after ${timeoutMinutes} minutes. Try a smaller model or simpler prompt.`);
    } else {
      console.warn('[ai] local ollama error:', e?.message || e);

      // Check if it's a memory error
      if (e?.message?.includes('requires more system memory')) {
        throw new Error(`❌ Not enough RAM: ${e.message}\n\nTry using the 7B model instead, or close other applications to free up memory.`);
      }

      throw new Error(`Local model error: ${e?.message || e}`);
    }
  }
}


// --- Tool Planning Helpers (OpenRouter) ---
async function planWithOpenRouterTools({ prompt, systemPrompt, openrouterKey, model, appId, history, onCodeProgress }) {
  const tools = [
    {
      type: 'function',
      function: {
        name: 'write_files',
        description: 'Create NEW files or COMPLETELY REWRITE existing files. Use this ONLY when creating new files or when you need to replace the entire file content. For small edits to existing files, use str_replace instead.',
        parameters: {
          type: 'object',
          properties: {
            files: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  path: { type: 'string', description: 'File path relative to app root (e.g., "index.html", "src/app.js")' },
                  content: { type: 'string', description: 'Complete file content' }
                },
                required: ['path', 'content']
              }
            }
          },
          required: ['files']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'str_replace',
        description: 'Make targeted edits to existing files by replacing specific strings. Use this for small, precise changes (< 50 lines). The old_str must match EXACTLY including all whitespace, indentation, and line breaks.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to app root' },
            old_str: { type: 'string', description: 'Exact string to find and replace. Must match exactly including whitespace.' },
            new_str: { type: 'string', description: 'Replacement string' }
          },
          required: ['path', 'old_str', 'new_str']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'apply_diff',
        description: 'Apply a unified diff patch to a file. Use this for multiple changes in one file or when str_replace would be too fragile.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to app root' },
            diff: { type: 'string', description: 'Unified diff format patch' }
          },
          required: ['path', 'diff']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read the current content of a file. Use this before making edits to see the exact formatting.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to app root' }
          },
          required: ['path']
        }
      }
    }
  ];

  console.log('[ai] Making OpenRouter tool-calling request with model:', model || 'google/gemini-2.0-flash-exp:free');
  console.log('[ai] OpenRouter API key present:', !!openrouterKey);
  console.log('[ai] OpenRouter API key length:', openrouterKey?.length || 0);

  // Build messages array with history
  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  // Add chat history if provided
  if (history && Array.isArray(history) && history.length > 0) {
    messages.push(...history);
  }

  // Add current prompt
  messages.push({ role: 'user', content: prompt });

  // Helper to read file for app
  async function readFileForApp(p) {
    if (!appId) return '';
    try {
      const appDir = path.join(GENERATED_APPS_DIR, appId);
      const full = path.join(appDir, p);
      return await fs.readFile(full, 'utf8');
    } catch {
      return '';
    }
  }

  // Tool calling loop - keep calling until AI returns files or stops calling tools
  const MAX_ITERATIONS = 10;
  let iteration = 0;
  const summaryParts = [];
  const diffs = [];

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    console.log(`[ai] Tool calling iteration ${iteration}/${MAX_ITERATIONS}`);

    const requestBody = {
      model: model || 'google/gemini-2.0-flash-exp:free',
      messages: messages,
      tools: tools,
      tool_choice: 'auto',
      max_tokens: 16000,
      temperature: 0.7
    };

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:8787',
        'X-Title': 'Elideable'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('[ai] OpenRouter response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ai] OpenRouter API error ${response.status}:`, errorText);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[ai] OpenRouter tool-calling response received');

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('[ai] Invalid OpenRouter response structure:', data);
      throw new Error('Invalid OpenRouter response structure');
    }

    const message = data.choices[0].message;
    console.log('[ai] OpenRouter message:', JSON.stringify(message, null, 2));

    // Add assistant message to conversation
    messages.push(message);

    // Handle tool calls (OpenAI format)
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log(`[ai] OpenRouter returned ${message.tool_calls.length} tool calls`);

      // Process each tool call and collect results
      const toolResults = [];

      for (const toolCall of message.tool_calls) {
        console.log(`[ai] Tool call:`, JSON.stringify(toolCall, null, 2));
        let toolResult = { success: false, output: '' };

        if (toolCall.function.name === 'write_files') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const files = args.files || [];
            console.log(`[ai] OpenRouter tool call: write_files with ${files.length} files`);

            for (const file of files) {
              diffs.push({ name: file.path, content: file.content || '' });

              // Stream code to editor if callback provided
              if (onCodeProgress && typeof onCodeProgress === 'function') {
                onCodeProgress({
                  file: file.path,
                  content: file.content || '',
                  status: 'complete'
                });
              }
            }
            summaryParts.push(`Generated ${files.length} files: ${files.map(f => f.path).join(', ')}`);
            toolResult = { success: true, output: `Created ${files.length} files` };
          } catch (e) {
            console.error('[ai] Failed to parse write_files arguments:', e.message);
            toolResult = { success: false, output: `Error: ${e.message}` };
          }
        }

        if (toolCall.function.name === 'str_replace') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            console.log('[ai] OpenRouter tool call: str_replace for', args.path);

            const content = await readFileForApp(args.path);
            if (!content) {
              console.error('[ai] str_replace failed: file not found:', args.path);
              summaryParts.push(`Error: File ${args.path} not found`);
              toolResult = { success: false, output: `File ${args.path} not found` };
            } else {
              const oldStr = args.old_str;
              const newStr = args.new_str;

              if (!content.includes(oldStr)) {
                console.error('[ai] str_replace failed: old_str not found in file');
                summaryParts.push(`Error: String not found in ${args.path}`);
                toolResult = { success: false, output: `String not found in ${args.path}` };
              } else {
                const replaced = content.replace(oldStr, newStr);
                diffs.push({ name: args.path, content: replaced });
                console.log('[ai] str_replace successful for:', args.path);
                summaryParts.push(`Edited ${args.path} with str_replace`);
                toolResult = { success: true, output: `Successfully edited ${args.path}` };
              }
            }
          } catch (e) {
            console.error('[ai] Failed to process str_replace:', e.message);
            toolResult = { success: false, output: `Error: ${e.message}` };
          }
        }

        if (toolCall.function.name === 'apply_diff') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            console.log('[ai] OpenRouter tool call: apply_diff for', args.path);

            const content = await readFileForApp(args.path);
            if (!content) {
              console.error('[ai] apply_diff failed: file not found:', args.path);
              summaryParts.push(`Error: File ${args.path} not found`);
              toolResult = { success: false, output: `File ${args.path} not found` };
            } else {
              // Simple unified diff parser
              const diffLines = args.diff.split('\n');
              const lines = content.split('\n');
              let result = [];
              let lineIdx = 0;

              for (const diffLine of diffLines) {
                if (diffLine.startsWith('@@')) {
                  const match = diffLine.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
                  if (match) {
                    const oldStart = parseInt(match[1]) - 1;
                    lineIdx = oldStart;
                  }
                } else if (diffLine.startsWith('-')) {
                  lineIdx++;
                } else if (diffLine.startsWith('+')) {
                  result.push(diffLine.substring(1));
                } else if (diffLine.startsWith(' ')) {
                  if (lineIdx < lines.length) {
                    result.push(lines[lineIdx]);
                    lineIdx++;
                  }
                }
              }

              while (lineIdx < lines.length) {
                result.push(lines[lineIdx]);
                lineIdx++;
              }

              diffs.push({ name: args.path, content: result.join('\n') });
              console.log('[ai] apply_diff successful for:', args.path);
              summaryParts.push(`Applied diff to ${args.path}`);
              toolResult = { success: true, output: `Successfully applied diff to ${args.path}` };
            }
          } catch (e) {
            console.error('[ai] Failed to process apply_diff:', e.message);
            summaryParts.push(`Error applying diff: ${e.message}`);
            toolResult = { success: false, output: `Error: ${e.message}` };
          }
        }

        if (toolCall.function.name === 'read_file') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const content = await readFileForApp(args.path);
            console.log(`[ai] read_file: ${args.path} (${content.length} bytes)`);
            summaryParts.push(`Read ${args.path} (${content.length} bytes)`);
            toolResult = { success: true, output: content || `File ${args.path} is empty or not found` };
          } catch (e) {
            console.error('[ai] Failed to process read_file:', e.message);
            toolResult = { success: false, output: `Error: ${e.message}` };
          }
        }

        // Add tool result to messages for next iteration
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult.output
        });
      }

      // Add all tool results to messages
      messages.push(...toolResults);

      // If we got file-modifying tool calls (write_files, str_replace, apply_diff), we're done
      const hasFileModifications = message.tool_calls.some(tc =>
        tc.function.name === 'write_files' ||
        tc.function.name === 'str_replace' ||
        tc.function.name === 'apply_diff'
      );

      if (hasFileModifications) {
        console.log('[ai] File modifications detected, ending tool calling loop');
        break;
      }

      // Otherwise continue loop to let AI make more tool calls
      console.log('[ai] No file modifications yet, continuing tool calling loop');
    } else {
      // No tool calls - AI is done
      console.log('[ai] No tool calls in OpenRouter response, ending loop');

      // Try to parse content as JSON (fallback for models that don't use tools)
      if (diffs.length === 0 && message.content) {
        try {
          const parsed = JSON.parse(message.content);
          if (parsed.files && Array.isArray(parsed.files)) {
            for (const file of parsed.files) {
              diffs.push({ name: file.name || file.path, content: file.content || '' });
            }
            summaryParts.push(`Parsed ${parsed.files.length} files from JSON response`);
          }
        } catch (e) {
          console.log('[ai] OpenRouter response is not JSON, treating as text');
          summaryParts.push('Generated text response (no files)');
        }
      }
      break;
    }
  }

  if (iteration >= MAX_ITERATIONS) {
    console.warn('[ai] Tool calling loop reached maximum iterations');
    summaryParts.push('Warning: Reached maximum tool calling iterations');
  }

  const summary = summaryParts.join('\n\n');
  return { plan: { message: summary || 'Generated plan with OpenRouter tools.', prompt }, diffs };
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
  // Enforce single active preview: stop all running preview apps first
  await stopAllElideApps();

  const port = PREVIEW_PORT;
  console.log(`[elide] Starting app ${appId} on port ${port}...`);

  return new Promise((resolve, reject) => {
    // Try to use Elide CLI first, fallback to Node.js server
    let process;

    // Check for Elide CLI in common locations
    const elidePaths = [
      'elide',                    // In PATH
      '/home/pug/elide/elide',   // User's local install
      '/usr/local/bin/elide',    // System install
      '/opt/elide/bin/elide'     // Alternative install
    ];

    let elidePath = null;
    for (const path of elidePaths) {
      try {
        const result = spawnSync(path, ['--version'], { stdio: 'pipe' });
        if (result.status === 0) {
          elidePath = path;
          break;
        }
      } catch (e) {
        // Path doesn't exist, try next
      }
    }

    if (elidePath) {
      // Elide CLI is available
      console.log(`[elide] Using Elide CLI at ${elidePath} for app ${appId}`);
      process = spawn(elidePath, ['serve', '--port', port.toString()], {
        cwd: appDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      setupProcessHandlers(process, appId, port, resolve, reject);
    } else {
      // Fallback to Node.js server
      console.log(`[elide] Elide CLI not found, using Node.js fallback for app ${appId}`);
      process = spawn('node', ['-e', createNodeServerScript(appDir, port)], {
        cwd: appDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      setupProcessHandlers(process, appId, port, resolve, reject);
    }
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

  // Parse URL to get pathname without query parameters
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  if (pathname === '/') {
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

  if (pathname === '/api/polyglot/greeting') {
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

  if (pathname === '/api/files') {
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

  // Serve static files (CSS, JS, images, etc.)
  try {
    const filePath = path.join(APP_DIR, pathname);

    // Security: prevent directory traversal
    if (!filePath.startsWith(APP_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.txt': 'text/plain',
        '.md': 'text/markdown'
      };

      const contentType = contentTypes[ext] || 'application/octet-stream';
      const content = fs.readFileSync(filePath);

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
      return;
    }
  } catch (err) {
    console.error('Error serving static file:', err);
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
    const output = data.toString();
    console.error(`[elide:${appId}] ERROR: ${output.trim()}`);

    // Some CLIs log startup info to stderr; mirror start detection here
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
async function killProcessOnPort(port) {
  return new Promise((resolve) => {
    // Use lsof to find process on port, then kill -9 it
    const lsof = spawn('lsof', ['-ti', `:${port}`], { stdio: 'pipe' });
    let pid = '';

    lsof.stdout.on('data', (data) => {
      pid += data.toString();
    });

    lsof.on('close', (code) => {
      if (pid.trim()) {
        const pids = pid.trim().split('\n');
        console.log(`[elide] Found ${pids.length} process(es) on port ${port}, killing...`);
        for (const p of pids) {
          try {
            process.kill(parseInt(p.trim()), 'SIGKILL');
            console.log(`[elide] Killed process ${p} on port ${port}`);
          } catch (e) {
            console.log(`[elide] Failed to kill process ${p}:`, e.message);
          }
        }
      }
      // Wait a bit for port to be freed
      setTimeout(resolve, 100);
    });

    lsof.on('error', () => {
      // lsof not available or failed, just resolve
      resolve();
    });
  });
}

async function stopAllElideApps() {
  for (const [id, app] of runningApps.entries()) {
    try {
      console.log(`[elide] Stopping app ${id}...`);
      app.process.kill();
    } catch {}
    runningApps.delete(id);
  }
  nextPort = PREVIEW_PORT;

  // Force-kill any remaining process on the preview port
  await killProcessOnPort(PREVIEW_PORT);
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
    return await readTreeFromDir(appDir, appDir);
  } catch (error) {
    console.error(`[elide] Failed to read app tree for ${appId}:`, error);
    return [];
  }
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


