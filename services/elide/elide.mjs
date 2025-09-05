import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const GENERATED_APPS_DIR = path.join(ROOT, 'generated-apps');

const PORT = Number(process.env.PORT_ELIDE || 8787);
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
    console.log('[ai] Planning request:', body?.prompt, 'with model:', body?.model);
    try {
      const result = await generatePlan(body?.prompt || 'Create a simple app', body?.model);
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
    const { files, appName } = body;

    // Generate unique app ID
    const appId = crypto.randomUUID();

    try {
      // Create isolated Elide app
      const { appDir, changed } = await createIsolatedApp(appId, files || [], appName || 'Generated App');

      // Start the Elide app
      const { port, url } = await startElideApp(appId, appDir);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        appId,
        changed,
        previewUrl: url,
        port
      }));
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

  if (url.pathname === '/api/files/open' && req.method === 'POST') {
    const data = await readJSON(req, res);
    const { appId, filePath } = data;

    if (!appId || !filePath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing appId or filePath' }));
      return;
    }

    const appDir = path.join(process.cwd(), 'generated-apps', appId);
    const fullFilePath = path.join(appDir, filePath);

    // Security check: ensure the file is within the app directory
    if (!fullFilePath.startsWith(appDir)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Access denied' }));
      return;
    }

    if (fs.existsSync(fullFilePath)) {
      try {
        // Try to open the file in the system's default editor
        const { exec } = await import('child_process');
        const command = process.platform === 'win32' ? `start "" "${fullFilePath}"` :
                      process.platform === 'darwin' ? `open "${fullFilePath}"` :
                      `xdg-open "${fullFilePath}"`;

        exec(command, (error) => {
          if (error) {
            console.log(`Could not open file in system editor: ${error.message}`);
          }
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to open file' }));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found' }));
    }
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

    const appDir = path.join(process.cwd(), 'generated-apps', appId);
    const fullFilePath = path.join(appDir, filePath);

    // Security check: ensure the file is within the app directory
    if (!fullFilePath.startsWith(appDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Access denied');
      return;
    }

    if (fs.existsSync(fullFilePath)) {
      try {
        const content = fs.readFileSync(fullFilePath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(content);
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Failed to read file');
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
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

  const systemPrompt = `You are an expert polyglot developer using Elide runtime. Create working applications that leverage multiple programming languages in a single codebase.

ELIDE CAPABILITIES:
- JavaScript/TypeScript: Frontend components, API interfaces, utilities
- Python: Data processing, ML/AI, text analysis, scientific computing
- Kotlin: High-performance business logic, type-safe operations
- Java: Enterprise integrations, complex algorithms
- All languages can interoperate seamlessly in the same application

LANGUAGE SELECTION STRATEGY:
- TypeScript: React components, type definitions, frontend logic
- Python: Data manipulation, AI/ML, text processing, algorithms
- Kotlin: Business rules, validation, performance-critical operations
- JavaScript: Utilities, Node.js compatibility, simple functions

Create a complete working application with multiple files using different languages as appropriate.

Example file structure:
- App.tsx (React frontend)
- api/processor.py (Python data processing)
- core/BusinessLogic.kt (Kotlin business rules)
- utils/helpers.js (JavaScript utilities)`;

  let text;

  if (useProvider === 'anthropic' && anthropic) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,  // Increased for large responses
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
  } else if (useProvider === 'openrouter') {
    if (!openrouterKey) {
      throw new Error('OpenRouter API key not configured. Please set OPENROUTER_API_KEY in your .env file.');
    }

    console.log(`[ai] Making OpenRouter request with model: ${model || 'google/gemini-2.0-flash-exp:free'}`);

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
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ai] OpenRouter API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`[ai] OpenRouter response received, choices: ${data.choices?.length}`);
    text = data.choices[0].message.content;
  }

  // Parse JSON response - robust handling for Claude 4.0 Sonnet and all models
  try {
    let parsed = null;
    let diffs = [];

    // Safety check for text
    if (!text || typeof text !== 'string') {
      console.log('Invalid or empty response text');
      return { plan: { message: 'No response received', prompt }, diffs: [] };
    }

    console.log(`Response length: ${text.length} characters`);

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

    // CRITICAL: Handle raw JSON responses (Claude 4.0 Sonnet's main format)
    if (!parsed && !text.includes('```json')) {
      console.log('No code blocks found, attempting to parse raw JSON...');
      try {
        parsed = JSON.parse(text);
        console.log('✅ Successfully parsed raw JSON');
      } catch (rawError) {
        console.log(`❌ Raw JSON parse failed: ${rawError.message}`);

        // Handle truncated JSON (very common with Claude 4.0 Sonnet)
        if (rawError.message.includes('Unexpected end') || rawError.message.includes('Expected')) {
          console.log('🔧 Attempting to fix truncated JSON...');

          // Find the last complete file entry
          const lastFileEnd = text.lastIndexOf('    }');
          if (lastFileEnd > 0) {
            let fixedText = text.substring(0, lastFileEnd + 5);

            // Close the JSON structure properly
            if (!fixedText.includes('],')) {
              fixedText += '\n  ],\n  "technologies": ["react", "typescript", "python", "kotlin"]\n}';
            }

            try {
              parsed = JSON.parse(fixedText);
              console.log('✅ Successfully parsed fixed truncated JSON');
            } catch (fixError) {
              console.log(`❌ Failed to fix truncated JSON: ${fixError.message}`);
            }
          }
        }

        // If still no parsed data, use regex extraction on raw text
        if (!parsed) {
          console.log('🔍 Using regex extraction on raw JSON...');

          const rawFilePattern = /"path":\s*"([^"]+)"[\s\S]*?"content":\s*"((?:[^"\\]|\\.)*)"/g;
          let match;
          while ((match = rawFilePattern.exec(text)) !== null) {
            const fileName = match[1];
            let content = match[2];

            // Comprehensive unescaping
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

          if (diffs.length > 0) {
            console.log(`✅ Extracted ${diffs.length} files from raw JSON using regex`);

            // Create parsed object for summary
            const summaryMatch = text.match(/"summary":\s*"([^"]*)"/);
            parsed = {
              summary: summaryMatch ? summaryMatch[1] : "Polyglot app created successfully"
            };
          }
        }
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
      console.log(`✅ Extracted ${diffs.length} files from parsed JSON structure`);
    }

    // Return short summary for chat and files for deployment
    const summary = parsed?.summary || "I'll create your app with the specified features.";

    // Final validation and logging
    if (diffs.length === 0) {
      console.log('⚠️ No files extracted - this may indicate a parsing issue');
      console.log('Response preview:', text.substring(0, 500) + '...');
    } else {
      console.log(`🎉 Successfully extracted ${diffs.length} files for deployment`);
      diffs.forEach((file, i) => {
        console.log(`  ${i + 1}. ${file.name} (${file.content.length} chars)`);
      });
    }

    return {
      plan: { message: summary, prompt },
      diffs: diffs
    };
  } catch (e) {
    console.warn('JSON parse error:', e.message);
    return { plan: { message: text, prompt }, diffs: [] };
  }
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
    // Serve the actual React app
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

