
import React, { useEffect, useState } from 'react';

export default function App() {
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    fetchGreeting();
  }, []);

  async function fetchGreeting() {
    const response = await fetch('/api/greeting');
    const data = await response.json();
    setGreeting(data.message);
  }

  return (
    <div className="App">
      <h1>{greeting}</h1>
    </div>
  );
}
