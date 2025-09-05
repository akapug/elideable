
import React from 'react';
import { useQuery } from 'react-query';
import { BlogPreview } from './BlogPreview';

export function BlogList() {
  const { data: posts, isLoading } = useQuery('posts', fetchPosts);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="blog-list">
      {posts?.map(post => (
        <BlogPreview
          key={post.id}
          post={post}
        />
      ))}
    </div>
  );
}