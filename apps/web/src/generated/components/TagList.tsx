import React from 'react';

interface TagListProps {
  tags: string[];
  selectedTags: string[];
  onTagSelect: (tag: string) => void;
}

const TagList: React.FC<TagListProps> = ({ tags, selectedTags, onTagSelect }) => {
  return (
    <div style={{ padding: '10px', borderTop: '1px solid #ccc' }}>
      <h3>Tags</h3>
      {tags.map(tag => (
        <button
          key={tag}
          onClick={() => onTagSelect(tag)}
          style={{
            marginRight: '5px',
            padding: '5px 10px',
            backgroundColor: selectedTags.includes(tag) ? 'lightblue' : 'white',
            border: '1px solid #ccc',
            cursor: 'pointer',
          }}
        >
          {tag}
        </button>
      ))}
    </div>
  );
};

export default TagList;
