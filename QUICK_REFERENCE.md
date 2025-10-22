# Quick Reference - Chat Context & History

## 🎯 What Changed

**Before**: Chat had no memory, switching models lost context
**After**: Last 10 messages preserved, context maintained across model switches

---

## 🚀 Quick Start

### Backend (Already Running)
```bash
# Backend is running on http://localhost:8787
# No action needed!
```

### Frontend
```bash
cd apps/web
pnpm dev
# Opens on http://localhost:5173
```

---

## 💬 How to Use Chat Mode

### Planning Workflow
```
1. Select a model (any model works!)
2. Type your question or idea
3. Click "💬 Chat" button
4. AI responds with text (no code generation)
5. Continue conversation - context is preserved!
```

### Example Conversation
```
You: "help me plan a todo app"
AI: *provides planning guide*

You: "what about adding categories?"
AI: *explains categories for the todo app*

[Switch to different model]

You: "and what about due dates?"
AI: *explains due dates for the todo app with categories*
     ↑ Has full context even after model switch!
```

---

## 🔧 Two Modes Explained

### 💬 Chat Mode
- **Purpose**: Planning, brainstorming, asking questions
- **Output**: Text responses only
- **Use When**: You want to discuss ideas before coding
- **Example**: "help me plan a weather app"

### ✨ Generate/Edit Mode
- **Purpose**: Creating or modifying apps
- **Output**: Actual code files
- **Use When**: You're ready to build
- **Example**: "create a weather app with 5-day forecast"

---

## 🎨 Available Models

### Free Models (OpenRouter)
- `google/gemini-2.0-flash-exp:free` - Gemini 2.0 Flash (Free)
- `deepseek/deepseek-chat-v3.1:free` - DeepSeek Chat v3.1 (Free)

### SOTA Models (OpenRouter)
- `anthropic/claude-sonnet-4.5` - Claude Sonnet 4.5 ⭐ Best quality
- `anthropic/claude-haiku-4.5` - Claude Haiku 4.5 ⚡ Fast
- `google/gemini-2.5-flash-preview-09-2025` - Gemini 2.5 Flash
- `google/gemini-2.5-pro` - Gemini 2.5 Pro
- `openai/gpt-5-codex` - GPT-5 Codex
- `x-ai/grok-code-fast-1` - Grok Code Fast

### Experimental
- `google/gemini-2.5-flash-image` - Gemini 2.5 Flash Image

### Local Models
- `ollama:qwen2.5-coder:7b-instruct-q4_K_M` - Qwen 2.5 Coder 7B
- `ollama:qwen2.5-coder:32b-instruct-q4_K_M` - Qwen 2.5 Coder 32B

**All models support chat context and history!**

---

## 🔍 What to Look For

### ✅ Working Correctly
- Chat responses appear in the UI
- Follow-up questions reference previous context
- Switching models preserves conversation
- Backend logs show `history: X messages`

### ⚠️ Expected Warnings (Not Errors!)
- Frontend console: `Failed to parse raw JSON from response`
  - This is normal for chat mode
  - Does not affect functionality

### ❌ Actual Errors (Should Not Happen)
- "JSON parse error" in backend logs for chat mode
  - This should NOT appear anymore
  - If you see it, something is wrong

---

## 📊 Backend Logs Explained

### Good Logs (What You Should See)
```
[ai] Planning request: help me plan a todo app with model: anthropic/claude-sonnet-4.5 mode: chat appId: (new app) history: 1 messages
[ai] Using OpenRouter provider: anthropic/claude-sonnet-4.5
[ai] OpenRouter chat response received
Response contains only code blocks, no JSON structure, treating as plain text
```

### History Count Progression
```
First message:  history: 1 messages  (just system message)
Second message: history: 3 messages  (system + 1 user/assistant pair)
Third message:  history: 5 messages  (system + 2 user/assistant pairs)
...and so on
```

---

## 🧪 Quick Test

### Test 1: Basic Chat
```
1. Type: "help me plan a calculator"
2. Click: "💬 Chat"
3. Wait for response
✅ Should get planning text
```

### Test 2: Context Preservation
```
1. Type: "what about adding scientific functions?"
2. Click: "💬 Chat"
3. Wait for response
✅ Should reference calculator from previous message
```

### Test 3: Model Switching
```
1. Switch to different model
2. Type: "and what about a history feature?"
3. Click: "💬 Chat"
4. Wait for response
✅ Should reference both calculator AND scientific functions
```

---

## 🐛 Troubleshooting

### Chat responses not showing up
- Check backend is running: `http://localhost:8787/health`
- Check frontend console for errors
- Check backend logs for errors

### Context not preserved
- Check backend logs for `history: X messages`
- Should increase with each message
- If always `history: 1 messages`, something is wrong

### Model switching loses context
- This should NOT happen anymore
- Check backend logs to verify history is being sent
- Try refreshing the page and testing again

---

## 📁 Important Files

### Documentation
- `WORK_COMPLETE_SUMMARY.md` - Executive summary of all changes
- `CHAT_CONTEXT_FIXES.md` - Detailed technical documentation
- `TEST_RESULTS.md` - Complete test results
- `QUICK_REFERENCE.md` - This file

### Code
- `apps/web/src/App.tsx` - Frontend (chat history added)
- `services/elide/elide.mjs` - Backend (all providers updated)

---

## 🎯 Key Features

### ✅ Chat Context
- Last 10 messages sent with every request
- Includes user and assistant messages
- Formatted as `{ role: 'user' | 'assistant', content: string }[]`

### ✅ Model Switching
- Context preserved when switching models
- Works across all providers (OpenRouter, Anthropic, Ollama)
- Seamless transition

### ✅ Text Responses
- Chat mode returns helpful text
- No file generation
- Perfect for planning

### ✅ Better Logging
- Informative messages instead of errors
- History count logged for debugging
- Clear distinction between chat and edit modes

---

## 💡 Pro Tips

### Planning Workflow
```
1. Use "💬 Chat" to plan features
2. Discuss architecture and design
3. Ask questions and iterate
4. When ready, use "✨ Generate App"
5. Continue with "✏️ Edit App" for changes
```

### Model Selection
```
- Planning: Use free models (Gemini Free, DeepSeek)
- Code Generation: Use SOTA models (Claude Sonnet, Haiku)
- Quick Edits: Use Haiku (fast)
- Complex Apps: Use Sonnet (best quality)
```

### Context Management
```
- Last 10 messages preserved automatically
- No need to repeat yourself
- Switch models freely
- Context carries over
```

---

## 🎉 Summary

**Everything works!** You can now:
- Chat with AI for planning
- Preserve context across messages
- Switch models without losing context
- Generate apps when ready
- Edit apps with full context

**No further setup needed - just start using it!** 🚀

---

## 📞 Quick Commands

### Start Backend
```bash
export $(cat .env | grep -v '^#' | xargs) && node services/elide/elide.mjs
```

### Start Frontend
```bash
cd apps/web && pnpm dev
```

### Check Backend Health
```bash
curl http://localhost:8787/health
```

### View Backend Logs
```bash
# Backend logs appear in terminal where you started it
# Look for:
# - [ai] Planning request: ...
# - history: X messages
# - Chat mode: returning text response
```

---

## ✨ That's It!

Everything is ready to use. Enjoy your new chat context and history features! 🎊

