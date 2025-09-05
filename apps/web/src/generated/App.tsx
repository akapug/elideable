import React, { useState, useEffect } from 'react';
import Editor from './components/Editor';
import Preview from './components/Preview';
import TagList from './components/TagList';
// Real polyglot execution via Elide runtime simulation
async function extractTags(text: string): Promise<string[]> {
  const response = await fetch('http://localhost:8787/api/polyglot/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: 'python',
      code: `
def extractTags(text):
    import re
    tags = re.findall(r'#(\\w+)', text)
    return tags
      `,
      function: 'extractTags',
      args: [text]
    })
  });
  const result = await response.json();
  return result.result || [];
}

async function saveNote(note: any): Promise<any> {
  const response = await fetch('http://localhost:8787/api/polyglot/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: 'kotlin',
      code: `
data class Note(val id: String?, val content: String, val tags: List<String>, val timestamp: String?)

fun saveNote(note: Note): Note {
    // In real Elide, this would use Kotlin data persistence
    return note.copy(
        id = note.id ?: System.currentTimeMillis().toString(),
        timestamp = java.time.Instant.now().toString()
    )
}
      `,
      function: 'saveNote',
      args: [note]
    })
  });
  const result = await response.json();
  return result.result;
}

interface Note {
  id: string;
  content: string;
  tags: string[];
}

function App() {
  const [note, setNote] = useState<Note>({ id: '', content: '', tags: [] });
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    const initialNotes = loadNotes();
    setNotes(initialNotes);
  }, []);

  const handleEditorChange = async (content: string) => {
    const newTags = await extractTags(content);
    setNote({ ...note, content, tags: newTags });
  };

  const handleSaveNote = () => {
    saveNote(note);
    setNotes([...notes, note]);
  };

  const handleTagSelect = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const filteredNotes = notes.filter(note =>
    selectedTags.every(tag => note.tags.includes(tag))
  );

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ color: '#333', marginBottom: '10px' }}>📝 Polyglot Notes App</h1>
      <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
        React/TypeScript (UI) + Python (text processing) + Kotlin (backend) + JavaScript (utils)
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div>
          <h3 style={{ margin: '0 0 10px 0' }}>✏️ Editor</h3>
          <Editor onChange={handleEditorChange} />
        </div>
        <div>
          <h3 style={{ margin: '0 0 10px 0' }}>👁️ Preview</h3>
          <Preview content={note.content} />
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 10px 0' }}>🏷️ Tags (Python extraction)</h3>
        <TagList
          tags={Array.from(new Set(notes.flatMap(note => note.tags)))}
          selectedTags={selectedTags}
          onTagSelect={handleTagSelect}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={handleSaveNote}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          💾 Save Note (Kotlin backend)
        </button>
      </div>

      <div>
        <h3 style={{ margin: '0 0 10px 0' }}>📚 Notes ({filteredNotes.length})</h3>
        <div style={{ display: 'grid', gap: '10px' }}>
          {filteredNotes.map(note => (
            <div
              key={note.id}
              style={{
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: '#f8f9fa',
                cursor: 'pointer'
              }}
              onClick={() => setNote(note)}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                {note.content.substring(0, 50) || 'Empty note'}...
              </div>
              <div>
                {note.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      backgroundColor: '#007bff',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      marginRight: '5px'
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
