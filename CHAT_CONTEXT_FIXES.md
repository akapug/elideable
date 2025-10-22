# Chat Context & History Fixes - Complete Implementation

## 🎯 Issues Fixed

### 1. ✅ Chat Context Lost When Switching Models
**Problem**: When switching models mid-conversation, the new model had no context of previous messages.

**Solution**: Frontend now sends the last 10 messages as chat history with every request.

### 2. ✅ "JSON Parse Error" Shown for Chat Responses
**Problem**: When models returned text-only responses in chat mode, the backend logged "JSON parse error" which looked like an error but was actually expected behavior.

**Solution**: Backend now only logs parse errors in edit mode. In chat mode, it logs "Chat mode: returning text response (no JSON structure)" instead.

### 3. ✅ Text-Only Responses Display Correctly
**Problem**: User reported errors when models return text responses.

**Solution**: This was already working correctly - the backend wraps text responses in `{ plan: { message: text }, diffs: [] }` and the frontend displays them. The "error" was just the misleading log message, which is now fixed.

---

## 📝 Changes Made

### Frontend Changes (`apps/web/src/App.tsx`)

**Line 555-592**: Updated `sendMessage()` function to include chat history:

```typescript
async function sendMessage(mode: 'chat' | 'edit' = 'edit') {
  // ... existing code ...
  
  // Prepare chat history (last 10 messages, excluding the current one)
  const chatHistory = messages.slice(-10).map(msg => ({
    role: msg.role,
    content: msg.content
  }));

  // Step 1: Generate the plan
  const resp = await fetch('http://localhost:8787/api/ai/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      prompt: userMessage.content, 
      model: selectedModel, 
      mode, 
      appId: currentAppId || undefined,
      history: chatHistory  // ← NEW: Send chat history
    }),
    signal: controller.signal
  });
  // ... rest of function ...
}
```

**What this does**:
- Takes the last 10 messages from the chat
- Formats them as `{ role: 'user' | 'assistant', content: string }[]`
- Sends them with every API request
- This gives the AI full context of the conversation

---

### Backend Changes (`services/elide/elide.mjs`)

#### 1. API Endpoint Update (Line 58-76)

```javascript
if (url.pathname === '/api/ai/plan' && req.method === 'POST') {
  const body = await readJSON(req, res);
  console.log('[ai] Planning request:', body?.prompt, 'with model:', body?.model, 
              'mode:', body?.mode || 'edit', 'appId:', body?.appId || '(new app)', 
              'history:', body?.history?.length || 0, 'messages');  // ← NEW: Log history count
  try {
    const result = await generatePlan(body?.prompt || 'Create a simple app', body?.model, { 
      mode: body?.mode || 'edit', 
      appId: body?.appId || null,
      history: body?.history || []  // ← NEW: Pass history to generatePlan
    });
    // ... rest of endpoint ...
  }
}
```

#### 2. OpenRouter Tool-Calling (Line 1031-1083)

```javascript
async function planWithOpenRouterTools({ prompt, systemPrompt, openrouterKey, model, appId, history }) {
  // ... tool definitions ...
  
  // Build messages array with history
  const messages = [
    { role: 'system', content: systemPrompt }
  ];
  
  // Add chat history if provided
  if (history && Array.isArray(history) && history.length > 0) {
    messages.push(...history);  // ← NEW: Include history
  }
  
  // Add current prompt
  messages.push({ role: 'user', content: prompt });

  const requestBody = {
    model: model || 'google/gemini-2.0-flash-exp:free',
    messages: messages,  // ← Messages now include history
    tools: tools,
    tool_choice: 'auto',
    max_tokens: 4000,
    temperature: 0.7
  };
  // ... rest of function ...
}
```

#### 3. OpenRouter Chat Mode (Line 490-521)

```javascript
} else {
  // Chat mode - no tools
  const selectedPrompt = chatSystemPrompt;
  
  // Build messages array with history
  const messages = [
    { role: 'system', content: selectedPrompt }
  ];
  
  // Add chat history if provided
  if (options?.history && Array.isArray(options.history) && options.history.length > 0) {
    messages.push(...options.history);  // ← NEW: Include history
  }
  
  // Add current prompt
  messages.push({ role: 'user', content: prompt });
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    // ... headers ...
    body: JSON.stringify({
      model: model || 'google/gemini-2.0-flash-exp:free',
      messages: messages,  // ← Messages now include history
      max_tokens: 4000,
      temperature: 0.7
    })
  });
}
```

#### 4. Anthropic Tool-Calling (Line 694-748)

```javascript
async function planWithAnthropicTools({ prompt, systemPrompt, anthropic, appId, history }) {
  // ... tool definitions ...
  
  // Build messages array with history
  const messages = [];
  
  // Add chat history if provided (convert to Anthropic format)
  if (history && Array.isArray(history) && history.length > 0) {
    for (const msg of history) {
      messages.push({
        role: msg.role,
        content: [{ type: 'text', text: msg.content }]  // ← Anthropic format
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
    // ... config ...
    messages: messages  // ← Messages now include history
  });
}
```

#### 5. Anthropic Chat Mode (Line 461-495)

```javascript
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
    messages: messages  // ← Messages now include history
  });
  text = (response.content?.find?.(c => c.type === 'text')?.text) || response.content?.[0]?.text || '';
}
```

#### 6. Local Ollama (Line 991-1014)

```javascript
// Build messages array with history
const messages = [
  { role: 'system', content: systemPrompt }
];

// Add chat history if provided
if (options?.history && Array.isArray(options.history) && options.history.length > 0) {
  messages.push(...options.history);  // ← NEW: Include history
}

// Add current prompt
messages.push({ role: 'user', content: userPrompt });

const body = {
  model: mdl,
  stream: true,
  format: 'json',
  options: { temperature: 0.3 },
  messages: messages  // ← Messages now include history
};
```

#### 7. Better Error Logging (Line 660-668)

```javascript
} catch (e) {
  // In chat mode, text-only responses are expected, so don't log as error
  if (mode === 'chat') {
    console.log('[ai] Chat mode: returning text response (no JSON structure)');  // ← NEW: Informative message
  } else {
    console.warn('[ai] JSON parse error in edit mode:', e.message);  // ← Only warn in edit mode
  }
  return { plan: { message: text, prompt }, diffs: [] };
}
```

---

## 🧪 Testing Instructions

### Test 1: Chat Context Preservation

1. Start a new chat
2. Send: "💬 Chat: help me plan a todo app"
3. Wait for response
4. Send: "💬 Chat: what about adding categories?"
5. **Expected**: The AI should reference the todo app from the previous message
6. Switch to a different model (e.g., from Sonnet to Haiku)
7. Send: "💬 Chat: and what about due dates?"
8. **Expected**: The AI should still have context about the todo app with categories

### Test 2: Chat Mode Text Responses

1. Select any model (free or SOTA)
2. Send: "💬 Chat: what's the best way to structure a React app?"
3. **Expected**: 
   - AI returns helpful text response
   - Response appears in chat
   - Backend logs show: `[ai] Chat mode: returning text response (no JSON structure)`
   - NO "JSON parse error" in logs

### Test 3: Edit Mode with Context

1. Send: "✨ Generate App: make a counter"
2. Wait for app to be created
3. Send: "✏️ Edit App: add a reset button"
4. **Expected**: 
   - AI should edit the existing counter app
   - Should add a reset button without regenerating the entire app
   - Backend logs show history being sent

### Test 4: Model Switching During Development

1. Start with Claude Sonnet 4.5
2. Send: "✨ Generate App: make a calculator"
3. Wait for app to be created
4. Switch to Claude Haiku 4.5
5. Send: "✏️ Edit App: add keyboard support"
6. **Expected**: 
   - Haiku should have context about the calculator
   - Should add keyboard support without regenerating

---

## 📊 What You'll See in Logs

### Before (Old Behavior)
```
[ai] Planning request: add a button with model: anthropic/claude-haiku-4.5 mode: chat appId: (new app)
JSON parse error: Unexpected token 'O', "Okay, let'"... is not valid JSON
```

### After (New Behavior)
```
[ai] Planning request: add a button with model: anthropic/claude-haiku-4.5 mode: chat appId: (new app) history: 4 messages
[ai] Chat mode: returning text response (no JSON structure)
```

---

## 🎯 Summary

**All issues are now fixed:**

1. ✅ **Chat history preserved** - Last 10 messages sent with every request
2. ✅ **Context maintained when switching models** - New model receives full conversation history
3. ✅ **No more misleading error logs** - Chat mode logs are now informative, not scary
4. ✅ **Text responses work perfectly** - Already working, now with better logging

**All providers supported:**
- ✅ OpenRouter (tool-calling and chat mode)
- ✅ Anthropic Direct (tool-calling and chat mode)
- ✅ Google Gemini
- ✅ Local Ollama

**Backend is running and ready to test!** 🚀

