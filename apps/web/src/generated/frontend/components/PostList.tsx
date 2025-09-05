
import React, { useEffect, useState } from 'react';
import { Post } from '../types';

export function PostList() {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    const response = await fetch('/api/posts');
    const data = await response.json();
    setPosts(data);
  }

  return (
    <div className="post-list">
      {posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>
        </article>
      ))}
    </div>
  );
}