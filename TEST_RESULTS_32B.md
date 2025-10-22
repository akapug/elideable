# Qwen 2.5 Coder 32B Testing Results

**Date**: 2025-10-22  
**Model**: qwen2.5-coder:32b-instruct-q4_K_M  
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
- **Qwen 2.5 7B Coder**: UNABLE TO TEST - Ollama timeout issue
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
- [ ] Test started
- [ ] Files generated
- [ ] All files created (no 404s)
- [ ] No TODOs/placeholders
- [ ] App functional
- [ ] Code quality assessment

**Notes**:


---

## Test 2: Todo App with localStorage

**Prompt**: "Create a todo app with add, delete, and mark complete. Save to localStorage."

**Expected Outcome**:
- Complete HTML/CSS/JS implementation
- localStorage persistence working
- All referenced files created

**Results**:
- [ ] Test started
- [ ] Files generated
- [ ] All files created (no 404s)
- [ ] No TODOs/placeholders
- [ ] App functional
- [ ] localStorage working
- [ ] Code quality assessment

**Notes**:


---

## Test 3: Dream Journal (Previously Failed with 1.5B)

**Prompt**: "Create a dream journal app where I can log my dreams with date, title, and description. Include search and filter by date."

**Expected Outcome**:
- Multi-file app (HTML, CSS, JS)
- All files created (no 404 errors)
- Search and filter functionality working
- No white screen errors

**Results**:
- [ ] Test started
- [ ] Files generated
- [ ] All files created (no 404s)
- [ ] No TODOs/placeholders
- [ ] App functional
- [ ] Search working
- [ ] Filter working
- [ ] Code quality assessment

**Notes**:


---

## Summary

### Quality Improvements vs 7B Model
- **File Completeness**: 
- **Code Quality**: 
- **Functionality**: 
- **Overall Assessment**: 

### Quality Improvements vs 1.5B Model
- **File Completeness**: 
- **Code Quality**: 
- **Functionality**: 
- **Overall Assessment**: 

### Recommendations
- **32B Model Suitable For**: 
- **Limitations Found**: 
- **Next Steps**: Document findings and update README

---

## Prerequisites

Before running these tests, ensure:
1. Ollama timeout issue from 7B testing is resolved
2. Backend restarted with 32B model:
```bash
pkill -f 'node.*elide.mjs'
ELV_PROVIDER=local OLLAMA_MODEL='qwen2.5-coder:32b-instruct-q4_K_M' OLLAMA_BASE_URL='http://127.0.0.1:11434' node services/elide/elide.mjs &
```
3. Verify Ollama responds to test query:
```bash
curl -X POST http://127.0.0.1:11434/api/generate -d '{"model":"qwen2.5-coder:32b-instruct-q4_K_M","prompt":"Say hello","stream":false}' -H "Content-Type: application/json" --max-time 30
```

