import React, { useState, useEffect } from 'react';
import { ForestBackground } from './components/ForestBackground';
import { LandingPage } from './pages/LandingPage';
import { UserPage } from './pages/UserPage';

interface UserData {
  users?: Array<{ username: string; folder: string }>;
  user?: { username: string };
  usage?: number;
  files?: Array<{
    name: string;
    size: number;
    size_bytes: number;
    created: string;
    remaining_days: number;
    remaining_hours: number;
    expired: boolean;
  }>;
  urls?: Array<{ url: string; created: string }>;
  error?: string;
}

const App: React.FC = () => {
  const [data, setData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const currentPath = window.location.pathname;

  // Simple SPA routing
  const username = currentPath === '/' ? null : currentPath.split('/')[1];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (!username) {
          // Landing page: fetch all users
          const res = await fetch('/api/init');
          const users = await res.json();
          setData({ users });
        } else {
          // User page: fetch user dashboard
          const res = await fetch(`/api/user/${username}`);
          if (res.ok) {
            const userData = await res.json();
            setData(userData);
          } else {
            setData({ error: 'User not found' });
          }
        }
      } catch (err) {
        console.error('Fetch error:', err);
        setData({ error: 'Connection failed' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-forest-midnight">
        <div className="text-accent-mint animate-pulse tracking-[0.3em] font-light">
          穿越數位森林中... 🌿
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative text-white/90 selection:bg-accent-mint/30">
      <ForestBackground />
      <main className="container mx-auto px-4 py-8">
        {!username ? (
          <LandingPage data={data || { users: [] }} />
        ) : (
          <UserPage data={data || { user: { username: '' }, usage: 0, files: [], urls: [] }} />
        )}
      </main>
      
      <footer className="text-center py-12 text-white/40 text-sm font-light tracking-widest uppercase">
        Deep in the digital woods... 🌿
      </footer>
    </div>
  );
};

export default App;
