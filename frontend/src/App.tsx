import React from 'react';
import { ForestBackground } from './components/ForestBackground';
import { LandingPage } from './pages/LandingPage';
import { UserPage } from './pages/UserPage';

declare global {
  interface Window {
    __PAGE__: 'landing' | 'user';
    __INITIAL_DATA__: any;
  }
}

const App: React.FC = () => {
  const page = window.__PAGE__ || 'landing';
  const data = window.__INITIAL_DATA__ || {};

  return (
    <div className="min-h-screen relative text-white/90 selection:bg-accent-mint/30">
      <ForestBackground />
      <main className="container mx-auto px-4 py-8">
        {page === 'landing' ? (
          <LandingPage data={data} />
        ) : (
          <UserPage data={data} />
        )}
      </main>
      
      <footer className="text-center py-12 text-white/40 text-sm font-light tracking-widest">
        DEEP IN THE DIGITAL WOODS... 🌿
      </footer>
    </div>
  );
};

export default App;
