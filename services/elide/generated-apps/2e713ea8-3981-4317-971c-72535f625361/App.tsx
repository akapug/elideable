import React, { useEffect, useState } from 'react';
import { generateAsciiLogo } from './ascii/generator.py';
import { formatAsciiArt } from './utils/Formatter.kt';

export default function App() {
  const [asciiLogo, setAsciiLogo] = useState<string>('');

  useEffect(() => {
    const loadLogo = async () => {
      const rawAscii = await generateAsciiLogo();
      const formatted = await formatAsciiArt(rawAscii);
      setAsciiLogo(formatted);
    };
    loadLogo();
  }, []);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#1a1a1a',
      color: '#00ff00'
    }}>
      <pre style={{ 
        fontFamily: 'monospace',
        fontSize: '12px',
        whiteSpace: 'pre'
      }}>
        {asciiLogo}
      </pre>
    </div>
  );
}