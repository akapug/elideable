import React, { useState, useEffect } from 'react';
import './index.css';

function CodeEditor({ currentAppId, fileTree }: { currentAppId: string | null, fileTree: Array<{type: 'file' | 'dir'; path: string}> }) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
      'js': '📜', 'ts': '📘', 'tsx': '⚛️', 'jsx': '⚛️',
      'html': '🌐', 'css': '🎨', 'json': '📋',
      'md': '📝', 'txt': '📄', 'py': '🐍',
      'kt': '🔷', 'java': '☕', 'yaml': '⚙️', 'yml': '⚙️'
    };
    return iconMap[ext || ''] || '📄';
  };

  const loadFile = async (filePath: string) => {
    if (!currentAppId) return;
    setLoading(true);
    try {
      const resp = await fetch(`http://localhost:8787/api/files/content?appId=${currentAppId}&filePath=${encodeURIComponent(filePath)}`);
      const content = await resp.text();
      setFileContent(content);
      setSelectedFile(filePath);
    } catch (error) {
      console.error('Failed to load file:', error);
      setFileContent('// Failed to load file');
    } finally {
      setLoading(false);
    }
  };

  const saveFile = async () => {
    if (!currentAppId || !selectedFile) return;
    try {
      await fetch(`http://localhost:8787/api/files/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: currentAppId, filePath: selectedFile, content: fileContent })
      });
      alert('File saved successfully!');
    } catch (error) {
      console.error('Failed to save file:', error);
      alert('Failed to save file');
    }
  };

  if (!currentAppId) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 bg-gradient-to-br from-slate-900/50 to-slate-800/50">
        <div className="text-center">
          <div className="text-4xl mb-3">💻</div>
          <div className="text-sm font-medium">No app selected</div>
          <div className="text-xs text-slate-500 mt-1">Generate an app to view code</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* File Tree */}
      <div className="w-1/3 bg-slate-800/50 border-r border-slate-700/50 overflow-y-auto">
        <div className="p-3 border-b border-slate-700/50 bg-slate-800/80">
          <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2">
            <span>📁</span>
            <span>Files</span>
          </h3>
        </div>
        <div className="p-2">
          {fileTree.length === 0 ? (
            <div className="text-xs text-slate-500 p-2 text-center">No files yet</div>
          ) : (
            fileTree.map((item, index) => (
              <div key={index} className="mb-0.5">
                {item.type === 'file' ? (
                  <button
                    onClick={() => loadFile(item.path)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-150 flex items-center gap-2 ${
                      selectedFile === item.path
                        ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                        : 'text-slate-300 hover:bg-slate-700/50 border border-transparent'
                    }`}
                  >
                    <span className="text-base">{getFileIcon(item.path)}</span>
                    <span className="font-mono text-xs truncate">{item.path.split('/').pop()}</span>
                  </button>
                ) : (
                  <div className="px-3 py-2 text-sm text-slate-400 flex items-center gap-2">
                    <span>📁</span>
                    <span className="font-mono text-xs">{item.path.split('/').pop()}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Code Editor */}
      <div className="flex-1 flex flex-col bg-slate-900/30">
        {selectedFile && (
          <div className="flex items-center justify-between p-3 bg-slate-800/80 border-b border-slate-700/50">
            <div className="flex items-center gap-2">
              <span className="text-base">{getFileIcon(selectedFile)}</span>
              <span className="text-sm text-slate-200 font-mono">{selectedFile}</span>
            </div>
            <button
              onClick={saveFile}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 font-medium"
            >
              💾 Save
            </button>
          </div>
        )}
        <div className="flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              <div className="text-center">
                <div className="flex space-x-1.5 justify-center mb-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
                <div className="text-sm">Loading file...</div>
              </div>
            </div>
          ) : selectedFile ? (
            <textarea
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              className="w-full h-full bg-slate-900/80 text-slate-200 font-mono text-sm p-4 border border-slate-700/50 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              placeholder="File content will appear here..."
              spellCheck={false}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              <div className="text-center">
                <div className="text-4xl mb-3">👈</div>
                <div className="text-sm font-medium">Select a file to edit</div>
                <div className="text-xs text-slate-500 mt-1">Choose from the file tree</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GeneratedPreview({ previewUrl, currentAppId }: { previewUrl?: string, currentAppId?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (previewUrl) {
      setLoading(true);
      setError(null);

      // Give the Elide app a moment to start up
      const timer = setTimeout(() => {
        setLoading(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [previewUrl]);

  if (!previewUrl) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 bg-gradient-to-br from-slate-900/50 to-slate-800/50">
        <div className="text-center max-w-md px-6">
          <div className="text-6xl mb-4">🚀</div>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">No app yet</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Describe the app you'd like to create in the chat, and watch it come to life here in real-time!
          </p>
          <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div className="text-xs text-slate-400 text-left space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-blue-400">💡</span>
                <span>Try: "Create a todo app with drag and drop"</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-purple-400">💡</span>
                <span>Or: "Build a weather dashboard with charts"</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 bg-gradient-to-br from-slate-900/50 to-slate-800/50">
        <div className="text-center">
          <div className="flex space-x-1.5 justify-center mb-3">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce shadow-lg shadow-blue-500/50"></div>
            <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce shadow-lg shadow-purple-500/50" style={{animationDelay: '0.1s'}}></div>
            <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce shadow-lg shadow-pink-500/50" style={{animationDelay: '0.2s'}}></div>
          </div>
          <div className="text-sm font-medium">Starting Elide app...</div>
          <div className="text-xs text-slate-500 mt-1">This may take a moment</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      {/* Action Buttons Bar */}
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        <button
          onClick={() => {
            if (!currentAppId) return;
            const url = `http://localhost:8787/api/export.zip?appId=${encodeURIComponent(currentAppId)}`;
            window.open(url, '_blank');
          }}
          className="bg-amber-600/90 hover:bg-amber-500 backdrop-blur-sm text-white px-3 py-2 rounded-lg text-xs font-medium border border-amber-500/30 hover:border-amber-400/50 transition-all duration-200 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 flex items-center gap-1.5"
          title="Export current app as .zip"
        >
          <span>📦</span>
          <span>Export</span>
        </button>

        <button
          onClick={async () => {
            if (!previewUrl) return;
            const repoUrl = window.prompt('GitHub repo URL (e.g. git@github.com:owner/repo.git or https://github.com/owner/repo.git):');
            if (!repoUrl) return;
            const branch = window.prompt('Branch to deploy to (default: gh-pages):') || 'gh-pages';
            try {
              const resp = await fetch('http://localhost:8787/api/deploy/github-pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appId: currentAppId || undefined, repoUrl, branch })
              });
              const data = await resp.json();
              if (!resp.ok) throw new Error(data?.error || 'Deploy failed');
              const url = data?.url || '(check your repo settings for Pages URL)';
              window.alert(`Pushed to ${branch}. If Pages is enabled, your site should be at:\n${url}`);
            } catch (e: any) {
              window.alert(`Deploy error: ${e?.message || e}`);
            }
          }}
          className="bg-green-600/90 hover:bg-green-500 backdrop-blur-sm text-white px-3 py-2 rounded-lg text-xs font-medium border border-green-500/30 hover:border-green-400/50 transition-all duration-200 shadow-lg shadow-green-500/20 hover:shadow-green-500/30 flex items-center gap-1.5"
          title="Deploy to GitHub Pages (beta)"
        >
          <span>🐙</span>
          <span>GitHub</span>
        </button>

        <button
          onClick={async () => {
            if (!previewUrl) return;
            const proj = window.prompt('Cloudflare Pages project name (letters, numbers, dashes):');
            if (!proj) return;
            try {
              const resp = await fetch('http://localhost:8787/api/deploy/cloudflare-pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appId: currentAppId || undefined, projectName: proj })
              });
              const data = await resp.json();
              if (!resp.ok) throw new Error(data?.error || 'Deploy failed');
              const url = data?.url || '(no url parsed)';
              window.alert(`Deployed to Cloudflare Pages:\n${url}`);
            } catch (e: any) {
              window.alert(`Deploy error: ${e?.message || e}`);
            }
          }}
          className="bg-sky-600/90 hover:bg-sky-500 backdrop-blur-sm text-white px-3 py-2 rounded-lg text-xs font-medium border border-sky-500/30 hover:border-sky-400/50 transition-all duration-200 shadow-lg shadow-sky-500/20 hover:shadow-sky-500/30 flex items-center gap-1.5"
          title="Deploy to Cloudflare Pages (beta)"
        >
          <span>⛅</span>
          <span>Cloudflare</span>
        </button>

        <button
          onClick={() => window.open(previewUrl, '_blank')}
          className="bg-slate-700/90 hover:bg-slate-600 backdrop-blur-sm text-slate-200 px-3 py-2 rounded-lg text-xs font-medium border border-slate-600/50 hover:border-slate-500 transition-all duration-200 shadow-lg flex items-center gap-1.5"
          title="Open in new tab"
        >
          <span>🔗</span>
          <span>Open</span>
        </button>
      </div>



      <div className="w-full h-full bg-white text-black rounded-lg shadow-inner">
        <iframe
          key={previewUrl || 'preview'}
          src={previewUrl}
          className="w-full h-full border-0 rounded-lg bg-white"
          title="Generated Elide App Preview"
          onError={() => setError('Failed to load preview')}
        />
      </div>
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function Pane({ title, children }: { title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full border border-slate-700/50 rounded-xl overflow-hidden bg-slate-900/50 backdrop-blur-sm shadow-xl resize">
      <div className="px-4 py-3 text-sm font-medium bg-slate-800/80 border-b border-slate-700/50 text-slate-200">
        {title}
      </div>
      <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">{children}</div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const [expanded, setExpanded] = useState(false);

  // Truncate long messages
  const maxLength = 2000;
  const content = message.content;
  const shouldTruncate = content.length > maxLength;
  const displayContent = shouldTruncate && !expanded
    ? content.slice(0, maxLength) + '...'
    : content;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-lg transition-all duration-200 hover:shadow-xl ${
        isUser
          ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white'
          : 'bg-slate-800/90 text-slate-100 border border-slate-700/50 backdrop-blur-sm'
      }`}>
        <div className="text-sm whitespace-pre-wrap break-words overflow-hidden leading-relaxed">
          {displayContent}
        </div>
        {shouldTruncate && (
          <button
            onClick={() => setExpanded(!expanded)}
            className={`text-xs mt-2 underline ${isUser ? 'text-blue-100' : 'text-slate-400'} hover:opacity-80 transition-opacity`}
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
        <div className={`text-xs mt-1.5 opacity-70 ${isUser ? 'text-blue-100' : 'text-slate-400'}`}>
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '👋 Hi! I\'m Elideable, your AI app builder.\n\nDescribe the app you\'d like to create and I\'ll generate it instantly with polyglot Elide code.\n\nTry something like:\n• "Create a todo app with drag and drop"\n• "Build a weather dashboard"\n• "Make a notes app with markdown preview"',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const [fileTree, setFileTree] = useState<Array<{type: 'file' | 'dir'; path: string}>>([]);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [selectedModel, setSelectedModel] = useState('anthropic/claude-sonnet-4.5');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentAppId, setCurrentAppId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [backendInfo, setBackendInfo] = useState<{provider: string; local: boolean; model?: string} | null>(null);
  const [showApps, setShowApps] = useState(false);
  const [appsList, setAppsList] = useState<Array<{appId: string; name: string; updatedAt: number}>>([]);

  async function fetchAppsList() {
    try {
      const r = await fetch('http://localhost:8787/api/apps');
      const j = await r.json();
      setAppsList(j.apps || []);
    } catch {}
  }

  async function openApp(appId: string) {
    try {
      const r = await fetch('http://localhost:8787/api/preview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId })
      });
      const j = await r.json();
      if (j?.url) {
        setCurrentAppId(appId);
        setPreviewUrl(j.url);
        await refreshTree();
        setShowApps(false);
      }
    } catch (e) { console.error(e); }
  }


  const models = [
    // Local Ollama Models
    {
      id: 'ollama:qwen2.5-coder:7b-instruct-q4_K_M',
      name: 'Qwen 2.5 Coder 7B',
      provider: 'Local',
      tooltip: 'Fast local inference (~5-10s per response). Uses simple prompts optimized for smaller models.'
    },
    {
      id: 'ollama:qwen2.5-coder:32b-instruct-q4_K_M',
      name: 'Qwen 2.5 Coder 32B',
      provider: 'Local',
      tooltip: 'High-quality local inference (~30-60s per response). Requires significant RAM. Uses simple prompts optimized for local execution.'
    },
    // Free OpenRouter Models
    { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', provider: 'OpenRouter' },
    { id: 'deepseek/deepseek-chat-v3.1:free', name: 'DeepSeek Chat v3.1 (Free)', provider: 'OpenRouter' },
    // SOTA Models (via OpenRouter)
    { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', provider: 'OpenRouter' },
    { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5', provider: 'OpenRouter' },
    { id: 'google/gemini-2.5-flash-preview-09-2025', name: 'Gemini 2.5 Flash Preview', provider: 'OpenRouter' },
    { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'OpenRouter' },
    { id: 'openai/gpt-5-codex', name: 'GPT-5 Codex', provider: 'OpenRouter' },
    { id: 'x-ai/grok-code-fast-1', name: 'Grok Code Fast', provider: 'OpenRouter' },
    // Experimental
    { id: 'google/gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image (Experimental)', provider: 'OpenRouter' },
  ];

  async function refreshTree() {
    try {
      const url = currentAppId
        ? `http://localhost:8787/api/files/tree?appId=${currentAppId}`
        : 'http://localhost:8787/api/files/tree';
      const resp = await fetch(url);
      const json = await resp.json();
      setFileTree(json.tree || []);
    } catch {}
  }

  async function openFileInSystem(filePath: string) {
    if (!currentAppId) return;

    try {
      // Request the backend to open the file in the system editor
      await fetch(`http://localhost:8787/api/files/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: currentAppId, filePath }),
      });
    } catch (error) {
      console.error('Failed to open file:', error);
      // Fallback: try to fetch and display the file content
      try {
        const resp = await fetch(`http://localhost:8787/api/files/content?appId=${currentAppId}&filePath=${encodeURIComponent(filePath)}`);
        const content = await resp.text();

        // Create a new window with the file content
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(`
            <html>
              <head><title>${filePath}</title></head>
              <body>
                <h3>${filePath}</h3>
                <pre style="background: #f5f5f5; padding: 20px; overflow: auto;">${content}</pre>
              </body>
            </html>
          `);
        }
      } catch (fallbackError) {
        console.error('Fallback failed:', fallbackError);
        alert(`Could not open file: ${filePath}`);
      }
    }
  }

  useEffect(() => {
    refreshTree();
    // Check for speech recognition support
    setSpeechSupported('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

    // Fetch backend health to determine provider/model
    fetch('http://localhost:8787/health').then(r => r.json()).then(info => {
      setBackendInfo(info);
      if (info?.local) {
        const id = `ollama:${info.model || 'gemma2:2b-instruct-q8_0'}`;
        setSelectedModel(id);
      }
    }).catch(() => {});
  }, []);

  function startListening() {
    if (!speechSupported) return;

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };

    recognition.start();
  }

  function speakText(text: string) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
    }
  }

  function cancelRequest() {
    if (abortController) {
      abortController.abort();
    }
  }

  async function applyPlan(json: any) {
    const creatingMessage: Message = {
      id: (Date.now() + 2).toString(),
      role: 'assistant',
      content: '🚀 Creating your app...',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, creatingMessage]);

    try {
      const applyResp = await fetch('http://localhost:8787/api/ai/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: json.diffs,
          appName: input.substring(0, 50),
          appId: currentAppId || undefined
        })
      });

      if (!applyResp.ok) {
        throw new Error(`Apply failed: HTTP ${applyResp.status}`);
      }

      const applyData = await applyResp.json();
      console.log('Applied', applyData);

      if (applyData.previewUrl) {
        setPreviewUrl(applyData.previewUrl);
        setCurrentAppId(applyData.appId);

        const successMessage: Message = {
          id: (Date.now() + 3).toString(),
          role: 'assistant',
          content: `✅ App created successfully! Your polyglot Elide app is now running in the preview.`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, successMessage]);

        // Refresh the file tree
        await refreshTree();
      } else if (applyData.error) {
        const errorMessage: Message = {
          id: (Date.now() + 3).toString(),
          role: 'assistant',
          content: `❌ Error creating app: ${applyData.error}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (applyError) {
      console.error('Apply error:', applyError);
      const errorMessage: Message = {
        id: (Date.now() + 3).toString(),
        role: 'assistant',
        content: `❌ Error creating app: ${String(applyError)}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }

  // Poll for live file tree updates while an app is active
  useEffect(() => {
    if (!currentAppId) return;
    const id = setInterval(() => { refreshTree(); }, 3000);
    return () => clearInterval(id);
  }, [currentAppId]);

  async function sendMessage(mode: 'chat' | 'edit' = 'edit') {
    if (!input.trim() || busy) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setBusy(true);

    // Create abort controller for cancellation
    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Prepare chat history (last 10 messages, excluding the current one)
      const chatHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Check if using local Ollama model for streaming
      const useStreaming = selectedModel.startsWith('ollama:');

      if (useStreaming) {
        // Streaming mode for local models
        const streamingMessageId = Date.now().toString() + '-streaming';
        const streamingMessage: Message = {
          id: streamingMessageId,
          role: 'assistant',
          content: '🤖 Thinking',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, streamingMessage]);

        const resp = await fetch('http://localhost:8787/api/ai/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: userMessage.content,
            model: selectedModel,
            mode,
            appId: currentAppId || undefined,
            history: chatHistory,
            stream: true
          }),
          signal: controller.signal
        });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const reader = resp.body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim());

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));

                  if (data.type === 'progress') {
                    accumulatedContent += data.content;
                    setMessages(prev => prev.map(msg =>
                      msg.id === streamingMessageId
                        ? { ...msg, content: '🤖 ' + accumulatedContent }
                        : msg
                    ));
                  } else if (data.type === 'complete') {
                    // Remove streaming message and handle result
                    setMessages(prev => prev.filter(msg => msg.id !== streamingMessageId));

                    const result = data.result;
                    const aiMessage: Message = {
                      id: Date.now().toString(),
                      role: 'assistant',
                      content: result.plan?.message || 'Generated plan.',
                      timestamp: new Date()
                    };
                    setMessages(prev => [...prev, aiMessage]);

                    if (result.diffs && result.diffs.length > 0) {
                      await applyPlan(result);
                    }
                  } else if (data.type === 'error') {
                    setMessages(prev => prev.filter(msg => msg.id !== streamingMessageId));
                    throw new Error(data.error);
                  }
                } catch (e) {
                  console.warn('Failed to parse SSE data:', e);
                }
              }
            }
          }
        }
      } else {
        // Non-streaming mode for remote models
        const resp = await fetch('http://localhost:8787/api/ai/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: userMessage.content,
            model: selectedModel,
            mode,
            appId: currentAppId || undefined,
            history: chatHistory
          }),
          signal: controller.signal
        });

        const json = await resp.json();

        // Parse JSON from markdown code blocks or raw JSON if needed
        let parsedResult = json;
        if (json.plan?.message && typeof json.plan.message === 'string') {
          // Try markdown code block first
          const jsonMatch = json.plan.message.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[1]);
              parsedResult = { plan: parsed, diffs: [] };
            } catch (e) {
              console.warn('Failed to parse JSON from markdown:', e);
            }
          } else {
            // Try parsing as raw JSON
            try {
              const parsed = JSON.parse(json.plan.message);
              parsedResult = { plan: parsed, diffs: [] };
            } catch (e) {
              console.warn('Failed to parse raw JSON from response:', e);
            }
          }
        }



        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: parsedResult.plan?.summary || parsedResult.plan?.message || JSON.stringify(parsedResult, null, 2),
          timestamp: new Date()
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Step 2: If we have diffs, automatically create the app
        if (json.diffs && json.diffs.length > 0) {
          await applyPlan(json);
        }

        // Speak the response
        if (parsedResult.plan?.summary) {
          speakText(parsedResult.plan.summary);
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        const cancelMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '🚫 Request cancelled by user',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, cancelMessage]);
      } else {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Error: ${String(e)}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setBusy(false);
      setAbortController(null);
    }
  }

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-2xl">⚡</span>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Elideable
              </h1>
              <p className="text-xs text-slate-400">Chat to App, Instantly</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                // Reset to new project
                setMessages([]);
                setCurrentAppId(null);
                setPreviewUrl(null);
                setFileTree([]);
              }}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600/80 hover:bg-blue-600 border border-blue-500/50 hover:border-blue-400 transition-all duration-200 flex items-center gap-2"
              title="Start a new project"
            >
              <span>✨</span>
              <span>New Project</span>
            </button>
            <button
              onClick={async () => { setShowApps(true); try { await fetchAppsList(); } catch {} }}
              className="px-4 py-2 text-sm rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 hover:border-slate-600 transition-all duration-200 flex items-center gap-2"
              title="View all apps"
            >
              <span>📱</span>
              <span>My Apps</span>
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-4 p-4 flex-1 overflow-hidden max-h-[calc(100vh-80px)]">
        <div className="col-span-4 flex flex-col overflow-hidden">
          <Pane title={<span className="flex items-center gap-2"><span>💬</span> Chat</span>}>
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {messages.map(message => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                {busy && (
                  <div className="flex justify-start mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-slate-800/90 border border-slate-700/50 rounded-2xl px-4 py-3 shadow-lg backdrop-blur-sm">
                      <div className="flex items-center space-x-3">
                        <div className="flex space-x-1.5">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce shadow-sm shadow-blue-400/50"></div>
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce shadow-sm shadow-purple-400/50" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce shadow-sm shadow-pink-400/50" style={{animationDelay: '0.2s'}}></div>
                        </div>
                        <span className="text-sm text-slate-300 font-medium">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-slate-700/50 bg-slate-900/50">
                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">AI Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700/50 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all cursor-pointer hover:border-slate-600"
                    disabled={busy}
                  >
                    {models.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.provider === 'Local' ? '🟢 ' : ''}{model.name} ({model.provider})
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const currentModel = models.find(m => m.id === selectedModel);
                    if (currentModel?.tooltip) {
                      return (
                        <div className="mt-2 text-xs text-slate-400 flex items-start gap-1.5">
                          <span className="text-green-400 mt-0.5">●</span>
                          <span>{currentModel.tooltip}</span>
                        </div>
                      );
                    } else if (selectedModel.startsWith('ollama:')) {
                      return (
                        <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
                          <span className="text-green-400">●</span>
                          <span>Running locally via Ollama (simple prompts, 2min timeout)</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                      placeholder="Describe your app... (e.g., 'Create a todo app with drag and drop')"
                      className="flex-1 px-4 py-3 bg-slate-800/80 border border-slate-700/50 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all hover:border-slate-600"
                      disabled={busy}
                    />
                    {speechSupported && (
                      <button
                        onClick={startListening}
                        disabled={busy || isListening}
                        className={`px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg ${
                          isListening
                            ? 'bg-red-600 hover:bg-red-500 animate-pulse shadow-red-500/20'
                            : 'bg-purple-600 hover:bg-purple-500 shadow-purple-500/20 hover:shadow-purple-500/30'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title="Voice input"
                      >
                        {isListening ? '🎤 Listening...' : '🎤'}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {busy ? (
                      <button
                        onClick={cancelRequest}
                        className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg shadow-red-500/20 hover:shadow-red-500/30"
                        title="Cancel current request"
                      >
                        ⏹ Cancel
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => sendMessage('chat')}
                          disabled={!input.trim()}
                          className="px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Chat with AI (no code generation)"
                        >
                          💬 Chat
                        </button>
                        <button
                          onClick={() => sendMessage('edit')}
                          disabled={!input.trim()}
                          className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                          title={currentAppId ? "Edit current app" : "Generate new app"}
                        >
                          {currentAppId ? '✏️ Edit App' : '✨ Generate App'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Pane>
        </div>
        <div className="col-span-8">
          <Pane title={(
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{viewMode === 'preview' ? '👁️ Live Preview' : '💻 Code Editor'}</span>
                {currentAppId && (
                  <span className="px-2 py-0.5 text-xs bg-slate-700/50 rounded-full text-slate-400 font-mono">
                    {currentAppId.slice(0,8)}
                  </span>
                )}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setViewMode('preview')}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all duration-200 ${
                    viewMode==='preview'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                      : 'bg-slate-700/50 hover:bg-slate-600 text-slate-300'
                  }`}
                >
                  Preview
                </button>
                <button
                  onClick={() => setViewMode('code')}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all duration-200 ${
                    viewMode==='code'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                      : 'bg-slate-700/50 hover:bg-slate-600 text-slate-300'
                  }`}
                >
                  Code
                </button>
              </div>
            </div>
          )}>
            {viewMode === 'preview' ? (
              <GeneratedPreview previewUrl={previewUrl || undefined} currentAppId={currentAppId || undefined} />
            ) : (
              <CodeEditor
                fileTree={fileTree}
                currentAppId={currentAppId}
                onRefreshTree={refreshTree}
              />
            )}
          </Pane>
        </div>
      </div>

      {/* Apps Dashboard Overlay */}
      {showApps && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/50 rounded-xl w-[680px] max-h-[70vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50 bg-slate-800/50">
              <div className="flex items-center gap-2">
                <span className="text-xl">📱</span>
                <h3 className="text-base font-semibold text-slate-200">My Apps</h3>
              </div>
              <button
                className="text-slate-400 hover:text-slate-200 transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700/50"
                onClick={() => setShowApps(false)}
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(70vh-80px)]">
              {appsList.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🚀</div>
                  <div className="text-slate-400 text-sm">No apps yet</div>
                  <div className="text-slate-500 text-xs mt-1">Generate your first app to get started!</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {appsList.map(a => (
                    <div
                      key={a.appId}
                      className="flex items-center justify-between bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/30 hover:border-slate-600/50 rounded-lg p-3 transition-all duration-200 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-slate-100 text-sm font-medium truncate group-hover:text-blue-300 transition-colors">
                          {a.name}
                        </div>
                        <div className="text-slate-400 text-xs mt-1 flex items-center gap-2">
                          <span className="font-mono bg-slate-700/50 px-1.5 py-0.5 rounded">{a.appId.slice(0,8)}</span>
                          <span>•</span>
                          <span>{new Date(a.updatedAt).toLocaleString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => openApp(a.appId)}
                        className="ml-3 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
                      >
                        Open
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
