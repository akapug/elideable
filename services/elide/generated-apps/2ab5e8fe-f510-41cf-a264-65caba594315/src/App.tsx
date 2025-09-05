
import React from 'react';

export default function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h1>Hello, Elide!</h1>
      <p>This is a simple polyglot app running on Elide.</p>
      <p>Generated at: {new Date().toLocaleString()}</p>
    </div>
  );
}
