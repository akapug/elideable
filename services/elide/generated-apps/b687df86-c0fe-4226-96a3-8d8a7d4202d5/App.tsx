import React, { useState, useEffect } from 'react';
import { generateGreeting } from './api/greetingService.py';
import { formatMessage } from './core/MessageFormatter.kt';
import { getCurrentTime } from './utils/timeUtils.js';

interface GreetingData {
  message: string;
  timestamp: string;
  language: string;
}

export default function App() {
  const [greeting, setGreeting] = useState<GreetingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGreeting() {
      try {
        const currentTime = getCurrentTime();
        const rawGreeting = await generateGreeting('World', 'en');
        const formattedMessage = formatMessage(rawGreeting, currentTime);
        
        setGreeting({
          message: formattedMessage,
          timestamp: currentTime,
          language: 'English'
        });
      } catch (error) {
        console.error('Error loading greeting:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadGreeting();
  }, []);

  if (loading) {
    return <div className="loading">Loading polyglot greeting...</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Elide Polyglot Hello World</h1>
        <div className="greeting-card">
          <p className="greeting-text">{greeting?.message}</p>
          <small className="greeting-meta">
            Generated at: {greeting?.timestamp} | Language: {greeting?.language}
          </small>
        </div>
        <div className="tech-stack">
          <span className="tech-badge tsx">TypeScript/React</span>
          <span className="tech-badge python">Python</span>
          <span className="tech-badge kotlin">Kotlin</span>
          <span className="tech-badge js">JavaScript</span>
        </div>
      </header>
    </div>
  );
}