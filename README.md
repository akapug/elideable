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

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and **pnpm**
- **AI API Keys** (choose one or more):
  - **Anthropic API Key** (recommended for best results)
  - **Google AI API Key**
  - **OpenRouter API Key** (for free models)

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd elideable
pnpm install
```

### 2. Configure API Keys

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

### 3. Start the Platform

```bash
pnpm dev
```

This starts:
- **Web UI**: http://localhost:5173
- **Elide API**: http://localhost:8787

### 4. Create Your First App

1. Open http://localhost:5173
2. Select your preferred AI model (Claude 4.0 Sonnet recommended)
3. Describe your app: *"Create a todo app with drag and drop"*
4. Watch your polyglot app generate and run instantly!

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

| Provider | Model | Best For | Cost |
|----------|-------|----------|------|
| Anthropic | Claude 4.0 Sonnet | Complex apps, best code quality | Paid |
| Anthropic | Claude 3.5 Haiku | Fast prototypes | Paid |
| Google | Gemini 2.0 Flash | Balanced performance | Free tier |
| OpenRouter | Various | Experimentation | Free options |

## 🛠️ Development

### Project Structure
- `apps/web/` - Frontend React application
- `services/elide/` - Backend API service with polyglot runtime
- Generated apps are stored in `services/elide/apps/`

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

