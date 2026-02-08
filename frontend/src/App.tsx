import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams, useLocation } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { UserPage } from './pages/UserPage';
import { AdminPage } from './pages/AdminPage';
import { HelpPage } from './pages/HelpPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { Starfield } from './components/Starfield';
import { Sidebar } from './components/Sidebar';
import { PublicDirectory } from './components/PublicDirectory';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { cn } from './lib/utils';

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

// Main content wrapper that handles data fetching based on route
const MainContent: React.FC<{
  users: Array<{ username: string; folder: string }>;
  config: { allowed_extensions?: string[] };
  loading: boolean;
}> = ({ users, config, loading }) => {
  const { username } = useParams<{ username: string }>();
  const location = useLocation();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userLoading, setUserLoading] = useState(false);

  // Fetch user data when username changes
  useEffect(() => {
    if (username) {
      setUserLoading(true);
      fetch(`/api/user/${username}`)
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('User not found');
        })
        .then((data) => setUserData(data))
        .catch(() => setUserData({ error: '目錄不存在' }))
        .finally(() => setUserLoading(false));
    }
  }, [username]);

  if (loading || userLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-quantum-cyan animate-pulse tracking-[0.4em] font-bold text-xs uppercase">
          正在載入系統...
        </div>
      </div>
    );
  }

  // Home page - show upload center
  if (location.pathname === '/') {
    return <LandingPage data={{ users, config }} />;
  }

  // Help page
  if (location.pathname === '/help') {
    return <HelpPage />;
  }

  // User page - check if user exists
  if (username) {
    // If user not found, show 404
    if (userData?.error) {
      return <NotFoundPage />;
    }
    return (
      <UserPage
        data={userData || { user: { username }, usage: 0, files: [], urls: [] }}
      />
    );
  }

  return null;
};

// Admin route wrapper
const AdminRoute: React.FC = () => {
  return <AdminPage />;
};

// Layout wrapper for main SPA layout (excludes admin)
const MainLayout: React.FC<{
  users: Array<{ username: string; folder: string }>;
  config: { allowed_extensions?: string[] };
  loading: boolean;
}> = ({ users, config, loading }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const location = useLocation();

  // Determine if we constitute a "dashboard" view (UserPage) that needs independent scrolling panes
  // The Landing Page (/) and Help Page (/help) should behave like standard scrollable documents
  const isDashboard = location.pathname !== '/' && location.pathname !== '/help';

  // Close mobile drawers on window resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
        setDirectoryOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="h-screen flex relative overflow-hidden bg-gray-50 dark:bg-space-black">
      {/* Left Sidebar - Navigation */}
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Center Content */}
      {/* 
        For Dashboard (UserPage): overflow-hidden (let page handle scroll zones), fixed height
        For Others: overflow-y-auto (standard document scroll)
      */}
      <main className={cn(
        "flex-1 min-w-0 flex flex-col p-4 lg:p-6 xl:p-8 transition-all duration-300",
        isDashboard ? "overflow-hidden h-full" : "overflow-y-auto h-full"
      )}>
        <MainContent users={users} config={config} loading={loading} />
      </main>

      {/* Right Sidebar - Public Directory */}
      <PublicDirectory
        users={users}
        isOpen={directoryOpen}
        onToggle={() => setDirectoryOpen(!directoryOpen)}
      />
    </div>
  );
};

/**
 * Inner app component that uses theme context.
 */
const AppContent: React.FC = () => {
  const { theme } = useTheme();
  const [users, setUsers] = useState<Array<{ username: string; folder: string }>>([]);
  const [config, setConfig] = useState<{ allowed_extensions?: string[] }>({});
  const [loading, setLoading] = useState(true);

  // Fetch initial user list and config
  useEffect(() => {
    fetch('/api/init')
      .then((res) => res.json())
      .then((data) => {
        // data.users is array, data.config is object
        setUsers(data.users || []);
        setConfig(data.config || {});
      })
      .catch((err) => console.error('Fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen relative text-gray-900 dark:text-white/90 selection:bg-quantum-cyan/30 bg-gray-50 dark:bg-space-black">
        {/* Only show Starfield in dark mode */}
        {theme === 'dark' && <Starfield />}

        <Routes>
          {/* Admin page has its own layout */}
          <Route path="/admin" element={
            <main className="container mx-auto px-4 py-8 relative z-10">
              <AdminRoute />
            </main>
          } />

          {/* All other routes use the main SPA layout */}
          <Route path="/:username" element={
            <MainLayout users={users} config={config} loading={loading} />
          } />
          <Route path="/" element={
            <MainLayout users={users} config={config} loading={loading} />
          } />

          {/* Catch-all 404 route */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>

        <footer className="text-center py-6 lg:py-12 text-gray-400 dark:text-white/20 text-[10px] font-bold tracking-[0.3em] uppercase relative z-10">
          FileNexus - Secure File Bridge Hub
        </footer>
      </div>
    </BrowserRouter>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;

