# 🚀 Elideable - Polyglot Chat-to-App Platform

**Elideable** = **Elide** + **Lovable** - A local implementation of the Lovable.dev experience with real polyglot runtime capabilities using Elide.

Transform natural language descriptions into working polyglot applications instantly! Just describe your app and watch it come to life with TypeScript, Python, Kotlin, and JavaScript working together seamlessly.

## ✨ Features

- 🎯 **Lovable.dev Experience**: Describe app → Get working app instantly
- 🌐 **Real Polyglot Runtime**: TypeScript + Python + Kotlin + JavaScript in one app
- 🔄 **Live Preview**: Interactive apps running in real-time
- 🤖 **Multiple AI Models**: Claude 4.0 Sonnet, Gemini 2.0 Flash, and more
- 📁 **File Management**: Generated code files with proper structure
- 🎨 **Modern UI**: Clean, responsive interface

## 📊 Current Status

### ✅ Working Features
- **Dual-tier prompting system**: Automatically selects optimal prompts based on model size
  - Simple, concrete prompts for small models (<3B params)
  - Advanced, comprehensive prompts for large models (7B+ params)
- **Local-only mode**: Offline via Ollama with multiple model support
  - Tested: `qwen2.5:1.5b-instruct-q8_0` (basic functionality)
  - Recommended: `qwen2.5-coder:7b-instruct-q4_K_M` (better code quality)
  - Advanced: `qwen2.5-coder:32b-instruct-q4_K_M` (production-quality code)
- **Apps dashboard**: View and switch between all locally-created apps
- **Successive edits**: Improve apps in-place rather than regenerating from scratch
- **Export functionality**: Download generated apps as .zip files
- **Live preview**: Apps run on port 9000 with cache-busting
- **File tree**: Real-time display of generated files

### 🔧 Architecture Improvements
- **Refactored backend**: Extracted helpers into `services/elide/lib/`
  - `lib/paths.mjs`: Project root and generated apps directory resolution
  - `lib/body.mjs`: JSON body parsing
  - `lib/context.mjs`: App context building for successive edits
  - `lib/zip.mjs`: Archive streaming for exports
- **Prompt modules**: Separate prompt strategies in `services/elide/prompts/`
  - `qwen-plan-v2.mjs`: Optimized for small models (<3B)
  - `advanced-plan.mjs`: Comprehensive for large models (7B+)
  - Auto-detection based on model name

### ⚠️ Known Issues
- **Qwen quality**: Small models (1.5B) struggle with multi-file generation and completeness
- **Elide beta10 HTTP bug**: Responses hang or return empty body (GitHub issue #1702)
- **Model downloads**: Large models require significant disk space and bandwidth

### 🎯 Next Steps (IN PROGRESS)
- **✅ Qwen 2.5 Coder 7B model downloaded** (4.7GB)
  - Downloaded to external drive at `/media/pug/dev-ext/ollama-models`
  - Ollama running as user with `OLLAMA_MODELS=/media/pug/dev-ext/ollama-models`
  - Ready for testing!
- **⏳ Qwen 2.5 Coder 32B model downloading** (19GB)
  - Currently at 95% (18GB/19GB) on external drive
  - Download throttled by Airbnb network bandwidth cap (~1.3 MB/s)
  - ETA: ~12-15 minutes
- **🧪 Test dual-tier prompting system** with 7B model
  - Start testing with 7B while 32B finishes downloading
  - Verify advanced prompt produces complete, multi-file apps
  - Compare quality vs 1.5B model
  - Test with: timer app, todo app, dream journal
  - Once 32B completes, run same tests for comparison
  - Will test on desktop with 96GB RAM
## �🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and **pnpm**
- **Ollama** 0.12+ installed locally
- **Local model** (recommended - download once):
```bash
# For laptops with 32GB RAM (recommended):
ollama pull qwen2.5-coder:7b-instruct-q4_K_M

# For desktops with 96GB RAM (best quality):
ollama pull qwen2.5-coder:32b-instruct-q4_K_M

# Lightweight option (basic functionality):
ollama pull qwen2.5:1.5b-instruct-q8_0
```
- Optional (online): API keys for **Anthropic**, **Google AI**, or **OpenRouter**

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd elideable
pnpm install
```

### 2. (Optional) Configure API Keys for online providers

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` and add your API keys:
```env
# Anthropic (Recommended - best code generation)
ANTHROPIC_API_KEY=your_anthropic_key_here

# Google AI (Alternative)
GOOGLE_AI_API_KEY=your_google_key_here

# OpenRouter (Free models available)
OPENROUTER_API_KEY=your_openrouter_key_here
```

**Get API Keys:**
- **Anthropic**: https://console.anthropic.com/
- **Google AI**: https://aistudio.google.com/app/apikey
- **OpenRouter**: https://openrouter.ai/keys

### 3. Local-Only Offline Quick Start (recommended)

1. Install Ollama and pull the model (one-time):
```bash
# Recommended for laptops (32GB RAM):
ollama pull qwen2.5-coder:7b-instruct-q4_K_M

# Or for desktops (96GB RAM):
ollama pull qwen2.5-coder:32b-instruct-q4_K_M
```

2. Start the backend in local mode (uses Ollama):
```bash
# For 7B model:
ELV_PROVIDER=local OLLAMA_MODEL=qwen2.5-coder:7b-instruct-q4_K_M OLLAMA_BASE_URL=http://127.0.0.1:11434 pnpm --filter ./services/elide dev

# For 32B model:
ELV_PROVIDER=local OLLAMA_MODEL=qwen2.5-coder:32b-instruct-q4_K_M OLLAMA_BASE_URL=http://127.0.0.1:11434 pnpm --filter ./services/elide dev
```

3. In a new terminal, start the Web UI:
```bash
pnpm --filter ./apps/web dev
```

4. Open http://localhost:5173 (or 5174 if 5173 is in use)

**Note**: The backend automatically selects the appropriate prompt strategy based on model size:
- Models with `7b`, `14b`, `32b`, or `coder` in the name use the advanced prompt
- Smaller models use the simple, concrete prompt

Tip: You can also run `pnpm dev` to start both, but ensure the backend gets the env vars above.
### 3. Start the Platform

```bash
pnpm dev
```

This starts:
- **Web UI**: http://localhost:5173
- **Elide API**: http://localhost:8787

### 4. Create Your First App

1. Open http://localhost:5173
2. If backend is in local mode, you'll see "Local (Ollama): <model>" selected and remote models disabled
3. Describe your app: *"Create a todo app with drag and drop"* (or any small page prompt)
4. The preview updates and the Files pane lists generated files

## 🎯 How It Works

1. **Describe**: Tell the AI what app you want to build
2. **Generate**: AI creates polyglot code using multiple languages
3. **Deploy**: App automatically deploys and runs locally
4. **Interact**: Use your working app immediately in the live preview

## 🔧 Architecture

```
elideable/
├── apps/web/          # React frontend (Vite + TypeScript)
├── services/elide/    # Elide polyglot runtime service
├── packages/shared/   # Shared utilities
└── generated-apps/    # Your created apps live here
```

## 🌟 Example Apps You Can Create

- **"Todo app with drag and drop"** → React + Python + Kotlin task manager
- **"Weather dashboard"** → TypeScript UI + Python weather API + Kotlin data processing
- **"Chat application"** → Real-time messaging with polyglot backend
- **"Image gallery with filters"** → Multi-language image processing pipeline
- **"Calculator with history"** → Mathematical operations across languages

## 🤖 Supported AI Models

| Provider | Model | Best For | Offline | RAM | Disk | Cost |
|----------|-------|----------|---------|-----|------|------|
| Local | Qwen 2.5 Coder 32B (Q4_K_M) | Production-quality code, complex apps | Yes | 24GB | 19GB | Free |
| Local | Qwen 2.5 Coder 7B (Q4_K_M) | Good code quality, laptop-friendly | Yes | 6-8GB | 4.7GB | Free |
| Local | Qwen 2.5 1.5B (Q8_0) | Basic prototyping, very lightweight | Yes | 2GB | 1.6GB | Free |
| Anthropic | Claude 4.0 Sonnet | Complex apps, best code quality | No | - | - | Paid |
| Anthropic | Claude 3.5 Haiku | Fast prototypes | No | - | - | Paid |
| Google | Gemini 2.0 Flash | Balanced performance | No | - | - | Free tier |
| OpenRouter | Various | Experimentation | No | - | - | Free options |

**Model Recommendations by Hardware:**
- **Laptop (32GB RAM, 14GB free disk)**: `qwen2.5-coder:7b-instruct-q4_K_M`
- **Desktop (96GB RAM)**: `qwen2.5-coder:32b-instruct-q4_K_M`
- **Low-end hardware**: `qwen2.5:1.5b-instruct-q8_0` (limited quality)

See `services/elide/prompts/README.md` for detailed benchmarking and testing instructions.

## 🔮 What's Next

### Immediate (In Progress)
- **Complete model downloads**: Qwen 2.5 Coder 7B and 32B models
  - Downloads paused at 79% (7B) and 77% (32B) due to network throttling
  - Models stored on external drive at `/media/pug/dev-ext/ollama-models`
  - Ollama configured to run as user with `OLLAMA_MODELS` env var
- **Test dual-tier prompting system**: Validate quality improvements with 7B model
- **Benchmark and document**: Compare 1.5B vs 7B vs 32B model quality

### Short Term
- **Phase 1 refactor**: Move endpoints to separate route files in `services/elide/routes/`
- **Improve successive edits**: Better context selection and diff generation
- **Auto-refresh preview**: Automatically switch to new apps when created

### Long Term
- **TypeScript bundling**: Add esbuild for TS compilation
- **Deeper polyglot**: Enable Python, Kotlin, and multi-language interop
- **Deployment options**: Cloudflare Pages, GitHub Pages, Railway
- **Elide beta10 fixes**: Wait for upstream HTTP serving bug fix

## Known Limitations

- **Serving layer**: Elide v1.0.0-beta10 prints "ERROR" while serving directories but still responds; awaiting upstream fix (GitHub issue #1702)
- **Planner**: Local tolerant planner accepts JSON/HTML or uses heuristics; perfect JSON diffs not guaranteed with tiny models
- **Polyglot**: Focused on static HTML/CSS/vanilla JS for now; deeper polyglot interop and TS bundling can be added
- **Remote models**: Disabled when backend reports local mode. Enable by providing API keys and running backend in non-local provider mode
- **Model quality**: Small models (<3B) struggle with multi-file generation and completeness; use 7B+ for production work


## 🛠️ Development

### Project Structure
- `apps/web/` - Frontend React application
- `services/elide/` - Backend API service with polyglot runtime
- Generated apps are stored in `generated-apps/`

### Available Scripts
```bash
pnpm dev          # Start both frontend and backend
pnpm dev:web      # Start only frontend
pnpm dev:elide    # Start only backend
pnpm build        # Build for production
```

### Adding New AI Providers
Edit `services/elide/elide.mjs` to add new AI model integrations.

## 🐛 Troubleshooting

**"Failed to fetch" errors:**
- Ensure API keys are set in `.env`
- Check that both services are running (`pnpm dev`)

**Apps not generating:**
- Try Claude 4.0 Sonnet for best results
- Check server logs in terminal for detailed errors

**Preview not loading:**
- Generated apps run on random ports (9000+)
- Check browser console for specific errors

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Test with different AI models
5. Submit a pull request

## 📄 License

MIT License - feel free to use this for your own projects!

## 🙏 Acknowledgments

- **Lovable.dev** - Inspiration for the chat-to-app experience
- **Elide** - Polyglot runtime capabilities
- **Anthropic Claude** - Exceptional code generation
- **Vite** - Lightning-fast development experience

