
# Qwen 2.5 Coder 7B Testing Results

**Date**: 2025-10-22  
**Model**: qwen2.5-coder:7b-instruct-q4_K_M  
**Prompt System**: Advanced prompt (auto-selected for 7B+ models)  
**Backend**: http://localhost:8787  
**Frontend**: http://localhost:5173

---

## Test Plan

Testing three app types to validate:
1. ✅ All referenced files are created
2. ✅ No placeholder/TODO comments
3. ✅ Apps are complete and functional
4. ✅ Code quality (clean, readable, follows best practices)

### Comparison Baseline
- **Qwen 2.5 1.5B Instruct** (previous model):
  - Generated incomplete files
  - Missing referenced files (e.g., script.js referenced but not created)
  - Caused white screen errors (404s)
  - Dream journal app completely failed

---

## Test 1: Simple Timer App

**Prompt**: "Create a simple countdown timer with start, pause, and reset buttons"

**Expected Outcome**:
- Single HTML file with inline CSS and JavaScript
- Complete, working timer functionality
- No missing files or placeholders

**Results**:
- [x] Test started
- [ ] Files generated
- [ ] All files created (no 404s)
- [ ] No TODOs/placeholders
- [ ] App functional
- [ ] Code quality assessment

**Notes**:
- Test started at 9:13:15 AM
- Model: qwen2.5-coder:7b-instruct-q4_K_M
- Status: Stuck in "Thinking..." state for 2.5+ minutes
- Backend logs show: "[ai] Using local provider (Ollama: Gemma)"
- No response received from Ollama
- **ISSUE**: Generation appears to hang - no files created, no error message
- Moving to next test per user guidance


---

## Test 2: Todo App with localStorage

**Prompt**: "Create a todo app with add, delete, and mark complete. Save to localStorage."

**Expected Outcome**:
- Complete HTML/CSS/JS implementation
- localStorage persistence working
- All referenced files created

**Results**:
- [x] Test started
- [ ] Files generated
- [ ] All files created (no 404s)
- [ ] No TODOs/placeholders
- [ ] App functional
- [ ] localStorage working
- [ ] Code quality assessment

**Notes**:
- Test started at 9:16:11 AM
- Model: qwen2.5-coder:7b-instruct-q4_K_M
- Status: Stuck in "Thinking..." state for 2+ minutes
- Same issue as Test 1
- **CRITICAL ISSUE FOUND**: Direct curl test to Ollama API times out after 30 seconds
- Ollama server is running but not responding to generation requests
- Moving to next test


---

## Test 3: Dream Journal (Previously Failed with 1.5B)

**Prompt**: "Create a dream journal app where I can log my dreams with date, title, and description. Include search and filter by date."

**Expected Outcome**:
- Multi-file app (HTML, CSS, JS)
- All files created (no 404 errors)
- Search and filter functionality working
- No white screen errors

**Results**:
- [x] Test started
- [ ] Files generated
- [ ] All files created (no 404s)
- [ ] No TODOs/placeholders
- [ ] App functional
- [ ] Search working
- [ ] Filter working
- [ ] Code quality assessment

**Notes**:
- Test started at 9:18:16 AM
- Model: qwen2.5-coder:7b-instruct-q4_K_M
- Status: Stuck in "Thinking..." state for 60+ seconds
- Same Ollama timeout issue as Tests 1 and 2
- Cannot complete test due to infrastructure issue


---

## Summary

### ⚠️ CRITICAL ISSUE: Ollama Not Responding

**All 3 tests failed due to Ollama timeout issue:**
- Ollama server is running (PID 323574)
- Models are downloaded and listed correctly
- Direct API calls to Ollama timeout after 30 seconds
- Backend receives requests but Ollama never responds
- Frontend stuck in "Thinking..." state indefinitely

**Root Cause Investigation Needed:**
- Check Ollama logs: `journalctl -u ollama` or check process output
- Verify model files aren't corrupted
- Check if external drive `/media/pug/dev-ext` is accessible
- Test with smaller model to isolate issue
- May need to restart Ollama service

### Quality Improvements vs 1.5B Model
- **File Completeness**: UNABLE TO TEST - Ollama timeout
- **Code Quality**: UNABLE TO TEST - Ollama timeout
- **Functionality**: UNABLE TO TEST - Ollama timeout
- **Overall Assessment**: Infrastructure issue prevents testing

### Recommendations
- **IMMEDIATE**: Fix Ollama timeout issue before proceeding
- **7B Model Suitable For**: Cannot assess until Ollama is working
- **Limitations Found**: Ollama integration broken - needs debugging
- **Next Steps**:
  1. Debug and fix Ollama timeout issue
  2. Retry 7B tests once Ollama is responding
  3. Then proceed to 32B model testing

---

## Next: 32B Model Testing

Once 7B testing is complete, restart backend with 32B model:
```bash
pkill -f 'node.*elide.mjs'
ELV_PROVIDER=local OLLAMA_MODEL='qwen2.5-coder:32b-instruct-q4_K_M' OLLAMA_BASE_URL='http://127.0.0.1:11434' node services/elide/elide.mjs >/tmp/elide-32b-test.log 2>&1 &
```

Run the same 3 tests and compare quality.

