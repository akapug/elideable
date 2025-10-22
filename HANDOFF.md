# 🤝 Agent Handoff - Elideable Project

**Date**: 2025-10-22  
**From**: Previous Agent  
**To**: Next Agent  
**Status**: Ready for testing dual-tier prompting system with Qwen 2.5 Coder models

---

## 📍 Current Situation

### ✅ What's Complete
1. **Dual-tier prompting system implemented**
   - `services/elide/prompts/qwen-plan-v2.mjs` - Simple prompts for small models (<3B)
   - `services/elide/prompts/advanced-plan.mjs` - Comprehensive prompts for large models (7B+)
   - Auto-detection in `services/elide/elide.mjs` based on model name (7b/14b/32b/coder keywords)

2. **Backend refactored** into modular helpers:
   - `services/elide/lib/paths.mjs` - Project root and generated apps directory
   - `services/elide/lib/body.mjs` - JSON body parsing
   - `services/elide/lib/context.mjs` - App context building for successive edits
   - `services/elide/lib/zip.mjs` - Archive streaming for exports

3. **Models downloaded to external drive**:
   - ✅ **Qwen 2.5 Coder 7B** (4.7GB) - READY FOR TESTING
   - ⏳ **Qwen 2.5 Coder 32B** (19GB) - At 95% (18GB/19GB), ~12-15 min remaining
   - Location: `/media/pug/dev-ext/ollama-models`
   - Ollama configured with: `OLLAMA_MODELS=/media/pug/dev-ext/ollama-models`

4. **Ollama running as user** (not systemd service):
   - This bypasses Unix permissions issues with NTFS/exFAT external drive
   - Check if running: `ps aux | grep ollama`
   - If not running, start with: `OLLAMA_MODELS=/media/pug/dev-ext/ollama-models ollama serve >/tmp/ollama-serve.log 2>&1 &`

### ⚠️ Known Issues
- **Network throttling**: Airbnb network has bandwidth cap, downloads are slow (~1.3 MB/s)
- **Qwen 1.5B quality**: Small model struggles with multi-file generation and completeness
- **Elide beta10 HTTP bug**: Responses hang or return empty body (GitHub issue #1702)

---

## 🎯 Your Mission

### Primary Goal
**Test the dual-tier prompting system with Qwen 2.5 Coder 7B model and validate quality improvements**

### Step-by-Step Instructions

#### 1. Verify Ollama is Running with Correct Model Path
```bash
# Check if Ollama is running
ps aux | grep ollama

# If not running, start it:
OLLAMA_MODELS=/media/pug/dev-ext/ollama-models ollama serve >/tmp/ollama-serve.log 2>&1 &

# Wait 3 seconds for it to start
sleep 3

# Verify the 7B model is available
OLLAMA_MODELS=/media/pug/dev-ext/ollama-models ollama list
```

You should see `qwen2.5-coder:7b-instruct-q4_K_M` in the list.

#### 2. Start the Backend with 7B Model
```bash
# Kill any existing backend processes
pkill -f 'node.*elide.mjs'

# Start backend with 7B Coder model
cd /home/pug/code/elideable
ELV_PROVIDER=local OLLAMA_MODEL='qwen2.5-coder:7b-instruct-q4_K_M' OLLAMA_BASE_URL='http://127.0.0.1:11434' node services/elide/elide.mjs >/tmp/elide-7b.log 2>&1 &

# Wait for it to start
sleep 3

# Verify it's running
curl -sS http://localhost:8787/health
```

Expected response: `{"status":"ok"}`

#### 3. Start the Frontend (if not already running)
```bash
# Check if frontend is running
curl -sS http://localhost:5173 >/dev/null 2>&1 && echo "Frontend running" || echo "Frontend not running"

# If not running, start it in a new terminal:
cd /home/pug/code/elideable
pnpm --filter ./apps/web dev
```

#### 4. Test with Multiple App Types

**Important**: The 7B model should automatically trigger the **advanced prompt** (not the simple one).

Test these apps in order:

##### Test 1: Simple Timer App
```
Prompt: "Create a simple countdown timer with start, pause, and reset buttons"
```

**Expected outcome**:
- Single HTML file with inline CSS and JavaScript
- Complete, working timer functionality
- No missing files or placeholders

##### Test 2: Todo App with localStorage
```
Prompt: "Create a todo app with add, delete, and mark complete. Save to localStorage."
```

**Expected outcome**:
- Complete HTML/CSS/JS implementation
- localStorage persistence working
- All referenced files created

##### Test 3: Dream Journal (Previously Failed with 1.5B)
```
Prompt: "Create a dream journal app where I can log my dreams with date, title, and description. Include search and filter by date."
```

**Expected outcome**:
- Multi-file app (HTML, CSS, JS)
- All files created (no 404 errors)
- Search and filter functionality working
- No white screen errors

#### 5. Document Quality Comparison

For each test, note:
- ✅ All referenced files created?
- ✅ No placeholder/TODO comments?
- ✅ App is complete and functional?
- ✅ Code quality (clean, readable, follows best practices)?

Compare to the 1.5B model behavior (which generated incomplete files and caused white screens).

#### 6. Test with 32B Model (Once Download Completes)

**Check download status**:
```bash
# The 32B download should complete in ~12-15 minutes
# Check if it's done by looking for it in the model list
OLLAMA_MODELS=/media/pug/dev-ext/ollama-models ollama list
```

Once `qwen2.5-coder:32b-instruct-q4_K_M` appears:

```bash
# Restart backend with 32B model
pkill -f 'node.*elide.mjs'

ELV_PROVIDER=local OLLAMA_MODEL='qwen2.5-coder:32b-instruct-q4_K_M' OLLAMA_BASE_URL='http://127.0.0.1:11434' node services/elide/elide.mjs >/tmp/elide-32b.log 2>&1 &

sleep 3
curl -sS http://localhost:8787/health
```

**Run the same 3 tests** and compare quality to 7B results.

---

## 📊 Expected Results

### Quality Hierarchy (Hypothesis)
1. **32B Coder** - Production-quality code, handles complex multi-file apps
2. **7B Coder** - Good code quality, suitable for most apps
3. **1.5B Instruct** - Basic functionality, struggles with multi-file apps

### Success Criteria
- ✅ 7B model produces complete apps (no missing files)
- ✅ 7B model generates clean code (no TODOs/placeholders)
- ✅ Advanced prompt is auto-selected for 7B model
- ✅ Dream journal app works (previously failed with 1.5B)
- ✅ 32B model shows further quality improvements

---

## 🔧 Troubleshooting

### Ollama Not Responding
```bash
# Check if Ollama is running
ps aux | grep ollama

# Check logs
tail -50 /tmp/ollama-serve.log

# Restart if needed
pkill -9 ollama
sleep 2
OLLAMA_MODELS=/media/pug/dev-ext/ollama-models ollama serve >/tmp/ollama-serve.log 2>&1 &
```

### Backend Not Starting
```bash
# Check logs
tail -50 /tmp/elide-7b.log

# Common issues:
# - Ollama not running
# - Wrong OLLAMA_MODELS path
# - Port 8787 already in use
```

### Model Not Found
```bash
# Verify model location
ls -lh /media/pug/dev-ext/ollama-models/

# List models with correct path
OLLAMA_MODELS=/media/pug/dev-ext/ollama-models ollama list
```

### 32B Download Stalled
```bash
# If download appears stuck, you can restart it:
OLLAMA_MODELS=/media/pug/dev-ext/ollama-models ollama pull qwen2.5-coder:32b-instruct-q4_K_M
```

---

## 📝 What to Document

After testing, update `services/elide/prompts/README.md` with:
1. Quality comparison table (1.5B vs 7B vs 32B)
2. Specific examples of improvements
3. Recommended model for different use cases
4. Any issues or limitations discovered

---

## 🚀 Next Steps After Testing

Once testing is complete and documented:

1. **Commit findings**:
   ```bash
   git add services/elide/prompts/README.md
   git commit -m "docs(prompts): add 7B and 32B model testing results"
   ```

2. **Consider Phase 1 refactor**: Move endpoints to `services/elide/routes/`
   - Only if testing shows the prompting system is solid
   - Don't refactor if there are quality issues to fix first

3. **Optimize successive edits**: Improve context selection based on learnings

---

## 💡 Tips

- **Start with 7B while 32B downloads** - Don't wait, begin testing immediately
- **Use Playwright MCP tools** - The user prefers manual testing via browser automation
- **Be thorough** - Document everything, this is critical validation work
- **Compare carefully** - The whole point is to see if larger models solve the quality issues

---

## 📞 Important Context

- **User's workflow**: Prefers Playwright MCP browser testing over writing test files
- **Another agent working on frontend**: Don't be surprised if frontend files change
- **Network is throttled**: Downloads are slow, be patient
- **External drive is NTFS/exFAT**: That's why we run Ollama as user, not systemd service

---

Good luck! The dual-tier prompting system is a key feature - validate it works as designed. 🎯

