import React from 'react';

interface PreviewProps {
  content: string;
}

const Preview: React.FC<PreviewProps> = ({ content }) => {
  return (
    <div
      style={{ flex: 1, padding: '10px', border: '1px solid #ccc', overflow: 'auto' }}
    >
      {content}
    </div>
  );
};

export default Preview;
