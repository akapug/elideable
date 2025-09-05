
import React from 'react';
import { PostList } from './components/PostList';
import { Header } from './components/Header';
import { CreatePost } from './components/CreatePost';

export function App() {
  return (
    <div className="blog-app">
      <Header />
      <main>
        <CreatePost />
        <PostList />
      </main>
    </div>
  );
}