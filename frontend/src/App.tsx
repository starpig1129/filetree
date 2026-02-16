import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams, useLocation, Link } from 'react-router-dom';
import { Menu, Users } from 'lucide-react';
const LandingPage = React.lazy(() => import('./pages/LandingPage').then(module => ({ default: module.LandingPage })));
const UserPage = React.lazy(() => import('./pages/UserPage').then(module => ({ default: module.UserPage })));
const AdminPage = React.lazy(() => import('./pages/AdminPage').then(module => ({ default: module.AdminPage })));
const HelpPage = React.lazy(() => import('./pages/HelpPage').then(module => ({ default: module.HelpPage })));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage').then(module => ({ default: module.NotFoundPage })));
const SharePage = React.lazy(() => import('./pages/SharePage').then(module => ({ default: module.SharePage })));
import { Starfield } from './components/Starfield';
import { AuraField } from './components/AuraField';
import { Sidebar } from './components/Sidebar';
import { PublicDirectory } from './components/PublicDirectory';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { cn } from './lib/utils';

interface UserData {
  users?: Array<{ username: string; folder: string }>;
  user?: { username: string; show_in_list?: boolean };
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
    if (!username) return;
    
    let isMounted = true;
    
    // Set loading state only if needed, and wrap in a timeout if necessary to avoid immediate update during render
    // But better: just set it. The warning might be because we are in an effect triggered by username change,
    // which might be during a render. But usually this is fine.
    // Let's try to just fetch.
    
    setUserLoading(true);
    
    fetch(`/api/user/${username}`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('User not found');
      })
      .then((data) => {
        if (isMounted) setUserData(data);
      })
      .catch(() => {
        if (isMounted) setUserData({ error: '目錄不存在' });
      })
      .finally(() => {
        if (isMounted) setUserLoading(false);
      });
      
    return () => {
      isMounted = false;
    };
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
    <div className="h-dvh flex flex-col relative overflow-hidden bg-transparent">
      <header className="glass-header-premium lg:hidden">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 bg-linear-to-br from-quantum-cyan to-digital-violet rounded-xl flex items-center justify-center p-2 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-quantum-cyan/20">
                <svg className="w-full h-full text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2H10a2 2 0 00-2 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v10a2 2 0 002 2h3m8-11h.01" />
                </svg>
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-gray-900 to-gray-500 dark:from-white dark:to-gray-400">
                FileNexus
              </span>
            </Link>
          </div>
          <button
            onClick={() => setDirectoryOpen(!directoryOpen)}
            className="p-2 rounded-xl bg-white/60 dark:bg-white/5 text-gray-600 dark:text-neural-violet hover:bg-purple-500/10 transition-colors border border-white/20"
            aria-label="目錄"
          >
            <Users className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Sidebar - Navigation */}
        <Sidebar 
          isOpen={sidebarOpen} 
          onToggle={() => setSidebarOpen(!sidebarOpen)} 
        />

        {/* Center Content */}
        <main className={cn(
          "flex-1 min-w-0 flex flex-col transition-all duration-300 relative",
          location.pathname !== '/' && "p-4 lg:p-6 xl:p-8",
          (isDashboard || location.pathname === '/') ? "overflow-hidden" : "overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        )}>
          <MainContent 
            users={users} 
            config={config} 
            loading={loading} 
          />
        </main>

        {/* Right Sidebar - Public Directory */}
        <PublicDirectory
          users={users}
          isOpen={directoryOpen}
          onToggle={() => setDirectoryOpen(!directoryOpen)}
        />
      </div>
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
    const fetchInit = () => {
      fetch('/api/init')
        .then((res) => res.json())
        .then((data) => {
          // data.users is array, data.config is object
          setUsers(data.users || []);
          setConfig(data.config || {});
        })
        .catch((err) => console.error('Fetch error:', err))
        .finally(() => setLoading(false));
    };

    fetchInit();

    // WebSocket for realtime user list updates
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Direct endpoint on app.py to bypass router issues
    const wsUrl = `${protocol}//${window.location.host}/ws/global`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('Connected to global WS');
    };

    socket.onmessage = (event) => {
      if (event.data === 'USER_LIST_UPDATE') {
        fetchInit();
      }
    };

    socket.onclose = () => {
      console.log('Global WS closed');
    };

    return () => {
      if (socket) socket.close();
    };
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen relative text-gray-900 dark:text-white/90 selection:bg-quantum-cyan/30">
        {/* Background Layer - Dynamic based on theme */}
        {theme === 'dark' ? <Starfield /> : <AuraField />}

        <React.Suspense fallback={
           <div className="flex items-center justify-center min-h-screen">
             <div className="text-quantum-cyan animate-pulse tracking-[0.4em] font-bold text-xs uppercase">
               LOADING...
             </div>
           </div>
        }>
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
            
            <Route path="/help" element={
              <MainLayout users={users} config={config} loading={loading} />
            } />

            <Route path="/share/:token" element={<SharePage />} />

            {/* Catch-all 404 route */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </React.Suspense>

        <footer className="text-center py-0 lg:py-2 text-gray-400 dark:text-white/20 text-[0.625rem] font-bold tracking-[0.3em] uppercase fixed bottom-2 w-full z-10">
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

