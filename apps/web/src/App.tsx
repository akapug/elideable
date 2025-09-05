import { useState } from 'react';
import './index.css';

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
      content: 'Hi! I\'m Elovable, your AI app builder. Describe the app you\'d like to create and I\'ll generate it for you.',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('Create a notes app with tags, editor, and preview.');
  const [busy, setBusy] = useState(false);

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
      const resp = await fetch('http://localhost:8787/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMessage.content }),
      });
      const json = await resp.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: json.plan?.message || JSON.stringify(json, null, 2),
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
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
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Describe your app..."
                    className="flex-1 px-4 py-3 bg-slate-800/80 border border-slate-700/50 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    disabled={busy}
                  />
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
              <div className="w-full h-full bg-slate-800/50 rounded-xl border border-slate-700/50 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <div className="text-4xl mb-4">🚀</div>
                  <div className="text-lg font-medium mb-2">Your app will appear here</div>
                  <div className="text-sm">Start by describing what you want to build</div>
                </div>
              </div>
            </div>
          </Pane>
        </div>
        <div className="col-span-3">
          <Pane title="Files">
            <div className="p-4 text-slate-400 text-sm">
              <div className="text-center">
                <div className="text-2xl mb-2">📁</div>
                <div>Generated files will appear here</div>
              </div>
            </div>
          </Pane>
        </div>
      </div>
    </div>
  );
}
