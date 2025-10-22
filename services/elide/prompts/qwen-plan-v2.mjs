/**
 * Qwen 2.5 System Prompt v2.0
 * 
 * Optimized for small models (1.5B-7B parameters)
 * Based on research and best practices from:
 * - Qwen documentation (structured output)
 * - Cursor/Windsurf agent patterns
 * - Small model prompting best practices
 */

export function buildSystemPrompt(options = {}) {
  const { appId, appContext } = options;
  
  // For small models: SHORT, CONCRETE, STRUCTURED
  const sections = [];
  
  // 1. ROLE (one sentence)
  sections.push('You create web apps. Output valid JSON only.');
  
  // 2. OUTPUT FORMAT (explicit schema)
  sections.push('');
  sections.push('JSON SCHEMA:');
  sections.push('{');
  sections.push('  "plan": {"message": "what you built", "prompt": "user request"},');
  sections.push('  "diffs": [{"name": "filename.ext", "content": "full file content"}]');
  sections.push('}');
  
  // 3. CRITICAL RULES (max 3, concrete)
  sections.push('');
  sections.push('RULES:');
  sections.push('1. Create ALL files you reference (if HTML links style.css, create style.css)');
  sections.push('2. Write complete code (no TODOs, no placeholders)');
  sections.push('3. Prefer inline CSS/JS in HTML for simple apps');
  
  // 4. EXAMPLES (show, don't tell)
  sections.push('');
  sections.push('EXAMPLE 1 (inline, simple):');
  sections.push('{"plan":{"message":"counter app","prompt":"make a counter"},"diffs":[{"name":"index.html","content":"<!DOCTYPE html><html><head><meta charset=\\"UTF-8\\"><title>Counter</title><style>body{text-align:center;padding:2rem;font-family:sans-serif}button{font-size:2rem;padding:1rem 2rem;margin:0.5rem;cursor:pointer}</style></head><body><h1 id=\\"count\\">0</h1><button onclick=\\"let c=document.getElementById(\'count\');c.textContent=parseInt(c.textContent)+1\\">+</button><button onclick=\\"let c=document.getElementById(\'count\');c.textContent=parseInt(c.textContent)-1\\">-</button></body></html>"}]}');
  
  sections.push('');
  sections.push('EXAMPLE 2 (multi-file):');
  sections.push('{"plan":{"message":"todo app with styling","prompt":"todo list"},"diffs":[{"name":"index.html","content":"<!DOCTYPE html><html><head><meta charset=\\"UTF-8\\"><title>Todos</title><link rel=\\"stylesheet\\" href=\\"style.css\\"><script src=\\"app.js\\"></script></head><body><h1>My Todos</h1><input id=\\"input\\" placeholder=\\"Add task\\"><button onclick=\\"addTodo()\\">Add</button><ul id=\\"list\\"></ul></body></html>"},{"name":"style.css","content":"body{font-family:sans-serif;max-width:600px;margin:2rem auto;padding:1rem}input{padding:0.5rem;font-size:1rem}button{padding:0.5rem 1rem;cursor:pointer}"},{"name":"app.js","content":"function addTodo(){const input=document.getElementById(\'input\');const list=document.getElementById(\'list\');if(input.value){const li=document.createElement(\'li\');li.textContent=input.value;list.appendChild(li);input.value=\'\';}}"}]}');
  
  // 5. EDITING MODE (if appId provided)
  if (appId && appContext) {
    sections.push('');
    sections.push('EDITING MODE:');
    sections.push('Current app files:');
    sections.push(appContext);
    sections.push('');
    sections.push('Only output CHANGED or NEW files. Keep other files unchanged.');
  }
  
  return sections.join('\n');
}

export function buildUserPrompt(prompt, options = {}) {
  // For small models: keep user prompt simple and direct
  return String(prompt || 'Create a simple web app');
}

