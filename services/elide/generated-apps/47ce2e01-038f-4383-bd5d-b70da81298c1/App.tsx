import React, { useState, useEffect } from 'react';
import { processGreeting } from './api/processor.py';
import { validateMessage } from './core/MessageValidator.kt';
import { formatTimestamp } from './utils/helpers.js';

function App() {
  const [greeting, setGreeting] = useState<string>('');
  const [timestamp, setTimestamp] = useState<string>('');

  useEffect(() => {
    const loadGreeting = async () => {
      const processed = await processGreeting('Hello World');
      const isValid = validateMessage(processed);
      
      if (isValid) {
        setGreeting(processed);
        setTimestamp(formatTimestamp(new Date()));
      }
    };
    
    loadGreeting();
  }, []);

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>{greeting}</h1>
      <p>Generated at: {timestamp}</p>
      <p>Powered by Elide polyglot runtime 🚀</p>
    </div>
  );
}

export default App;