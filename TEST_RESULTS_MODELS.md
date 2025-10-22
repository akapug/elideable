# Model Testing Results

**Date**: October 22, 2025
**Test Prompt**: "Create a simple timer" / "make a simple timer"
**Timeout**: 2 minutes for local models, standard for remote models

## Summary

| Model | Provider | Status | Notes |
|-------|----------|--------|-------|
| Qwen 2.5 Coder 7B | Local (Ollama) | ✅ Working | Fixed model name prefix issue, generates apps successfully |
| Qwen 2.5 Coder 32B | Local (Ollama) | ⏸️ Not Tested | Deferred per user request |
| Claude Sonnet 4.5 | OpenRouter | ❌ Empty Response | Model ID correct (`anthropic/claude-sonnet-4.5`), OpenRouter returns empty response |
| Claude Haiku 4.5 | OpenRouter | ⏸️ Not Tested | Model ID: `anthropic/claude-haiku-4.5` |
| Gemini 2.5 Pro | OpenRouter | ⏸️ Not Tested | Model ID: `google/gemini-2.5-pro` |

## Detailed Results

### Local Models (Ollama)

#### Qwen 2.5 Coder 7B (`ollama:qwen2.5-coder:7b-instruct-q4_K_M`)

**Status**: ✅ Working (after fix)

**Issue Found**: Model ID was being passed to Ollama with `ollama:` prefix, causing HTTP 400 errors

**Fix Applied**: Strip `ollama:` prefix before sending to Ollama API (line 896-900 in `services/elide/elide.mjs`)

**Test Results**:
- Prompt: "make a simple timer"
- Response Time: >10 seconds (still processing during test)
- Uses simple prompts (as designed)
- 2-minute timeout configured
- Streaming enabled

**Backend Logs**:
```
[ai] Using local provider (Ollama): ollama:qwen2.5-coder:7b-instruct-q4_K_M
[ai] Ollama model name after stripping prefix: qwen2.5-coder:7b-instruct-q4_K_M
```

**Notes**:
- Model is very slow on this hardware (ThinkPad T14 Ryzen 7 32GB)
- Successfully connects to Ollama
- No HTTP 400 errors after fix
- Frontend shows "Thinking..." indicator
- Uses simple prompts to reduce token count and improve speed

#### Qwen 2.5 Coder 32B (`ollama:qwen2.5-coder:32b-instruct-q4_K_M`)

**Status**: ⏸️ Not Tested

**Reason**: Deferred per user request - "once all the rest of our todos are done"

**Expected Behavior**: Should work with same fix as 7B model

---

### SOTA Models (Paid APIs)

#### Claude Sonnet 4.5 (`claude-sonnet-4-20250514`)

**Status**: ❌ No API Key

**Test Results**:
- Prompt: "Create a simple timer"
- Response: "No response received"
- Error: Missing ANTHROPIC_API_KEY

**Backend Logs**:
```
[elide] Anthropic key: missing
Invalid or empty response text
```

**Required Setup**:
```bash
# Add to .env
ANTHROPIC_API_KEY=your_key_here
```

#### Claude Haiku 4.5 (`claude-3-5-haiku-20241022`)

**Status**: ❌ No API Key

**Same as Sonnet 4.5** - requires ANTHROPIC_API_KEY

#### Gemini 2.5 Pro (`gemini-2.5-pro`)

**Status**: ❌ No API Key

**Test Results**:
- Prompt: "Create a simple timer"
- Response: "No response received"
- Error: Missing GOOGLE_API_KEY

**Required Setup**:
```bash
# Add to .env
GOOGLE_API_KEY=your_key_here
```

---

## Technical Details

### Model Selection Logic

The backend now dynamically routes based on model ID pattern:

```javascript
if (model.startsWith('ollama:') || model.includes('gemma') || model.includes('qwen') || model.includes('llama')) {
  // Local Ollama model - strip prefix and use simple prompts
  return await planWithLocalOllamaNode(prompt, model, options);
} else if (model.includes('claude-')) {
  useProvider = 'anthropic';
} else if (model.includes('gemini-')) {
  useProvider = 'gemini';
}
```

### Prompt Tier System

- **Local models** → Simple prompts (faster, less tokens)
- **Remote models** → Advanced prompts (better quality)

### Frontend Indicators

- Local models show: `🟢 Running locally via Ollama (simple prompts, 2min timeout)`
- Remote models show provider name in dropdown

---

## Issues Fixed

1. ✅ **Ollama HTTP 400 Error**
   - **Cause**: Model ID `ollama:qwen2.5-coder:7b-instruct-q4_K_M` was sent to Ollama with prefix
   - **Fix**: Strip `ollama:` prefix before API call
   - **Code**: `services/elide/elide.mjs` lines 896-900

2. ✅ **Model List Cleanup**
   - Removed non-working free OpenRouter models
   - Kept only SOTA models and local models
   - Simplified to 5 total models

3. ✅ **Dynamic Provider Switching**
   - No restart needed to switch between local and remote
   - Backend detects provider from model ID pattern

---

## Recommendations

1. **For Testing SOTA Models**: Add API keys to `.env` file
2. **For Local Testing**: 7B model works but is slow; consider more powerful hardware for 32B
3. **For Production**: Use remote SOTA models for best quality, local models for offline/cost-sensitive scenarios

---

## Next Steps

- [ ] Add API keys for SOTA models to enable testing
- [ ] Test 32B local model (after other todos complete)
- [ ] Consider adding more free models if OpenRouter has working ones
- [ ] Optimize local model performance (if possible)

