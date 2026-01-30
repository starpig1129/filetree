import React, { useState, useEffect } from 'react';
import { LandingPage } from './pages/LandingPage';
import { UserPage } from './pages/UserPage';
import { AdminPage } from './pages/AdminPage';
import { Starfield } from './components/Starfield';

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
    is_locked?: boolean;
  }>;
  urls?: Array<{ url: string; created: string; is_locked?: boolean }>;
  error?: string;
}

const App: React.FC = () => {
  const [data, setData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const currentPath = window.location.pathname;

  // Simple SPA routing
  const isAdminPath = currentPath === '/admin';
  const username = (currentPath === '/' || isAdminPath) ? null : currentPath.split('/')[1];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (!username) {
          const res = await fetch('/api/init');
          const users = await res.json();
          setData({ users });
        } else {
          const res = await fetch(`/api/user/${username}`);
          if (res.ok) {
            const userData = await res.json();
            setData(userData);
          } else {
            setData({ error: '目錄不存在' });
          }
        }
      } catch (err) {
        console.error('Fetch error:', err);
        setData({ error: '連線中斷' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-space-black relative">
        <Starfield />
        <div className="relative z-10 text-quantum-cyan animate-pulse tracking-[0.4em] font-bold text-xs uppercase">
          正在載入系統...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative text-white/90 selection:bg-quantum-cyan/30 bg-space-black">
      <Starfield />
      <main className="container mx-auto px-4 py-8 relative z-10">
        {isAdminPath ? (
          <AdminPage />
        ) : !username ? (
          <LandingPage data={data || { users: [] }} />
        ) : (
          <UserPage data={data || { user: { username: '' }, usage: 0, files: [], urls: [] }} />
        )}
      </main>
      
      <footer className="text-center py-12 text-white/20 text-[10px] font-bold tracking-[0.3em] uppercase relative z-10">
        FileNexus - Secure File Bridge Hub
      </footer>
    </div>
  );
};

export default App;
