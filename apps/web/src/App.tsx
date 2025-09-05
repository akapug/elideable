import React, { useState, useEffect } from 'react';
import './index.css';

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
    <div className="h-full w-full">
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
    <div className="flex flex-col h-full border border-slate-700/50 rounded-lg overflow-hidden bg-slate-900/50 backdrop-blur-sm">
      <div className="px-4 py-3 text-sm font-medium bg-slate-800/80 border-b border-slate-700/50 text-slate-200">
        {title}
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser 
          ? 'bg-blue-600 text-white' 
          : 'bg-slate-800 text-slate-100 border border-slate-700/50'
      }`}>
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
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

  const [fileTree, setFileTree] = useState<Array<{type: 'file' | 'dir'; path: string}>>([]);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [selectedModel, setSelectedModel] = useState('google/gemini-2.0-flash-exp:free');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentAppId, setCurrentAppId] = useState<string | null>(null);

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

  async function sendMessage() {
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

    try {
      // Step 1: Generate the plan
      const resp = await fetch('http://localhost:8787/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMessage.content, model: selectedModel }),
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

      // Speak the response
      if (parsedResult.plan?.summary) {
        speakText(parsedResult.plan.summary);
      }
    } catch (e) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${String(e)}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="grid grid-cols-12 gap-4 p-4 h-full">
        <div className="col-span-3">
          <Pane title="Chat">
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-auto p-4 space-y-1">
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
                  <button
                    onClick={sendMessage}
                    disabled={busy || !input.trim()}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors"
                  >
                    Send
                  </button>

                </div>
              </div>
            </div>
          </Pane>
        </div>
        <div className="col-span-6">
          <Pane title="Live Preview">
            <div className="p-4 h-full">
              <div className="w-full h-full bg-slate-800/50 rounded-xl border border-slate-700/50 text-slate-200">
                <GeneratedPreview previewUrl={previewUrl || undefined} />
              </div>
            </div>
          </Pane>
        </div>
        <div className="col-span-3">
          <Pane title="Files">
            <div className="p-4 text-slate-400 text-sm">
              {fileTree.length ? (
                <ul className="space-y-1">
                  {fileTree.map((n) => (
                    <li key={n.path} className="flex items-center gap-2">
                      <span>{n.type === 'dir' ? '📁' : '📄'}</span>
                      {n.type === 'file' ? (
                        <button
                          onClick={() => openFileInSystem(n.path)}
                          className="text-left hover:text-blue-400 hover:underline cursor-pointer transition-colors"
                          title="Click to open in system editor"
                        >
                          {n.path}
                        </button>
                      ) : (
                        <span>{n.path}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center">
                  <div className="text-2xl mb-2">📁</div>
                  <div>Generated files will appear here</div>
                </div>
              )}
            </div>
          </Pane>
        </div>
      </div>
    </div>
  );
}
