import React, { useState, useEffect } from 'react';
import './index.css';

function CodeEditor({ currentAppId, fileTree }: { currentAppId: string | null, fileTree: Array<{type: 'file' | 'dir'; path: string}> }) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

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
      <div className="h-full flex items-center justify-center text-slate-400">
        No app selected. Generate an app first!
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* File Tree */}
      <div className="w-1/3 bg-slate-800 border-r border-slate-700 overflow-y-auto">
        <div className="p-3 border-b border-slate-700">
          <h3 className="text-sm font-medium text-slate-200">Files</h3>
        </div>
        <div className="p-2">
          {fileTree.map((item, index) => (
            <div key={index} className="mb-1">
              {item.type === 'file' ? (
                <button
                  onClick={() => loadFile(item.path)}
                  className={`w-full text-left px-2 py-1 text-sm rounded hover:bg-slate-700 ${
                    selectedFile === item.path ? 'bg-slate-700 text-blue-400' : 'text-slate-300'
                  }`}
                >
                  📄 {item.path.split('/').pop()}
                </button>
              ) : (
                <div className="px-2 py-1 text-sm text-slate-400">
                  📁 {item.path.split('/').pop()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Code Editor */}
      <div className="flex-1 flex flex-col">
        {selectedFile && (
          <div className="flex items-center justify-between p-3 bg-slate-800 border-b border-slate-700">
            <span className="text-sm text-slate-200">{selectedFile}</span>
            <button
              onClick={saveFile}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded"
            >
              Save
            </button>
          </div>
        )}
        <div className="flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              Loading...
            </div>
          ) : selectedFile ? (
            <textarea
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              className="w-full h-full bg-slate-900 text-slate-200 font-mono text-sm p-4 border border-slate-700 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="File content will appear here..."
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              Select a file to edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GeneratedPreview({ previewUrl }: { previewUrl?: string }) {
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
      <div className="h-full flex items-center justify-center text-slate-400">
        No generated app yet. Describe an app to get started!
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <div className="text-center">
          <div className="flex space-x-1 justify-center mb-2">
            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          </div>
          <div>Starting Elide app...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      {/* Open in New Tab Button */}
      <button
        onClick={() => window.open(previewUrl, '_blank')}
        className="absolute top-2 right-2 z-10 bg-slate-800/90 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded-md text-xs font-medium border border-slate-600/50 hover:border-slate-500 transition-colors"
        title="Open in new tab"
      >
        🔗 Open in New Tab
      </button>

      <iframe
        src={previewUrl}
        className="w-full h-full border-0 rounded-lg"
        title="Generated Elide App Preview"
        onError={() => setError('Failed to load preview')}
      />
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

function Pane({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full border border-slate-700/50 rounded-lg overflow-hidden bg-slate-900/50 backdrop-blur-sm resize">
      <div className="px-4 py-3 text-sm font-medium bg-slate-800/80 border-b border-slate-700/50 text-slate-200 cursor-move">
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
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser
          ? 'bg-blue-600 text-white'
          : 'bg-slate-800 text-slate-100 border border-slate-700/50'
      }`}>
        <div className="text-sm whitespace-pre-wrap break-words overflow-hidden">
          {displayContent}
        </div>
        {shouldTruncate && (
          <button
            onClick={() => setExpanded(!expanded)}
            className={`text-xs mt-2 underline ${isUser ? 'text-blue-100' : 'text-slate-400'} hover:opacity-80`}
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
        <div className={`text-xs mt-1 ${isUser ? 'text-blue-100' : 'text-slate-400'}`}>
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
      content: 'Hi! I\'m Elideable, your AI app builder. Describe the app you\'d like to create and I\'ll generate polyglot Elide code for you.',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('Create a notes app with tags, editor, and preview.');
  const [busy, setBusy] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const [fileTree, setFileTree] = useState<Array<{type: 'file' | 'dir'; path: string}>>([]);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-20250514');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentAppId, setCurrentAppId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');

  const models = [
    // OpenRouter Free Models
    { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', provider: 'OpenRouter' },
    { id: 'deepseek/deepseek-v3:free', name: 'DeepSeek V3 (Free)', provider: 'OpenRouter' },
    { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B (Free)', provider: 'OpenRouter' },
    { id: 'microsoft/phi-3-mini-128k-instruct:free', name: 'Phi-3 Mini (Free)', provider: 'OpenRouter' },
    { id: 'google/gemini-flash-1.5:free', name: 'Gemini 1.5 Flash (Free)', provider: 'OpenRouter' },
    // Direct API Models
    { id: 'claude-sonnet-4-20250514', name: 'Claude 4.0 Sonnet', provider: 'Anthropic Direct' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'Anthropic Direct' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google Direct' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google Direct' },
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
      // Step 1: Generate the plan
      const resp = await fetch('http://localhost:8787/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMessage.content, model: selectedModel, mode, appId: currentAppId || undefined }),
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
              appName: userMessage.content.substring(0, 50)
            }),
            signal: controller.signal
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

      // Speak the response
      if (parsedResult.plan?.summary) {
        speakText(parsedResult.plan.summary);
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
    <div className="h-screen w-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="grid grid-cols-12 gap-4 p-4 h-full">
        <div className="col-span-4">
          <Pane title="Chat">
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto p-4 space-y-1 max-h-[calc(100vh-300px)]">
                {messages.map(message => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                {busy && (
                  <div className="flex justify-start mb-4">
                    <div className="bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                        <span className="text-sm text-slate-400">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-slate-700/50">
                <div className="mb-3">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/50 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    disabled={busy}
                  >
                    {models.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name} ({model.provider})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Describe your app..."
                    className="flex-1 px-4 py-3 bg-slate-800/80 border border-slate-700/50 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    disabled={busy}
                  />
                  {speechSupported && (
                    <button
                      onClick={startListening}
                      disabled={busy || isListening}
                      className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                        isListening
                          ? 'bg-red-600 hover:bg-red-500 animate-pulse'
                          : 'bg-purple-600 hover:bg-purple-500'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      title="Voice input"
                    >
                      {isListening ? '🎤 Listening...' : '🎤'}
                    </button>
                  )}
                  {busy ? (
                    <button
                      onClick={cancelRequest}
                      className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-medium transition-colors"
                      title="Cancel current request"
                    >
                      Cancel
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => sendMessage('edit')}
                        disabled={!input.trim()}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors"
                      >
                        Send
                      </button>
                      <button
                        onClick={() => sendMessage('chat')}
                        disabled={!input.trim()}
                        className="px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors"
                        title="Chat-only (no file writes); plan or discuss before building"
                      >
                        Chat
                      </button>
                    </>
                  )}

                </div>
              </div>
            </div>
          </Pane>
        </div>
        <div className="col-span-8">
          <Pane title={
            <div className="flex items-center justify-between w-full">
              <span>{viewMode === 'preview' ? 'Live Preview' : 'Code Editor'}</span>
              <div className="flex bg-slate-700 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('preview')}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    viewMode === 'preview'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Preview
                </button>
                <button
                  onClick={() => setViewMode('code')}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    viewMode === 'code'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Code
                </button>
              </div>
            </div>
          }>
            <div className="p-4 h-full">
              <div className="w-full h-full bg-slate-800/50 rounded-xl border border-slate-700/50 text-slate-200">
                {viewMode === 'preview' ? (
                  <GeneratedPreview previewUrl={previewUrl || undefined} />
                ) : (
                  <CodeEditor currentAppId={currentAppId} fileTree={fileTree} />
                )}
              </div>
            </div>
          </Pane>
        </div>
      </div>
    </div>
  );
}
