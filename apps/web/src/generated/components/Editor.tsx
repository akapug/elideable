import React, { useState } from 'react';

interface EditorProps {
  onChange: (content: string) => void;
}

const Editor: React.FC<EditorProps> = ({ onChange }) => {
  const [content, setContent] = useState('');

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(event.target.value);
    onChange(event.target.value);
  };

  return (
    <textarea
      value={content}
      onChange={handleChange}
      style={{ flex: 1, padding: '10px', border: '1px solid #ccc' }}
    />
  );
};

export default Editor;
