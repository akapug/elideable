import React, { useState } from 'react';
import { generateGreeting } from './greetings.py';
import { formatGreeting } from './GreetingFormatter.kt';

export default function App() {
  const [greeting, setGreeting] = useState('');

  const handleClick = async () => {
    const baseGreeting = await generateGreeting();
    const formatted = await formatGreeting(baseGreeting);
    setGreeting(formatted);
  };

  return (
    <div className="app">
      <button onClick={handleClick}>Say Hello</button>
      {greeting && <p>{greeting}</p>}
    </div>
  );
}