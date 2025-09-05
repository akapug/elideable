import React, { useState } from 'react';

interface EditorProps {
  content?: string;
  onChange: (content: string) => void;
}

const Editor: React.FC<EditorProps> = ({ content = '', onChange }) => {
  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  return (
    <textarea
      value={content}
      onChange={handleChange}
      placeholder="Type your note here... Use #hashtags for tags"
      style={{
        width: '100%',
        height: '120px',
        padding: '10px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif'
      }}
    />
  );
};

export default Editor;
