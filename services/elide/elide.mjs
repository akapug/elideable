import http from 'node:http';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';

const PORT = Number(process.env.PORT_ELIDE || 8787);
const PROVIDER = process.env.ELV_PROVIDER || 'gemini';

// Initialize AI providers
let genAI, anthropic;
const geminiKey = process.env.GEMINI_API_KEY || 'REDACTED_GEMINI_KEY';
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

