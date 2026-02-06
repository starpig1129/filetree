import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Sparkles, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface User {
  username: string;
  folder: string;
}

interface PublicDirectoryProps {
  users: User[];
  isOpen: boolean;
  onToggle: () => void;
}

export const PublicDirectory: React.FC<PublicDirectoryProps> = ({ 
  users, 
  isOpen, 
  onToggle 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDesktop, setIsDesktop] = useState(false);

  // Track viewport size for responsive behavior
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // Extract current username from path (e.g., /starpig -> starpig)
  const currentUsername = location.pathname === '/' || location.pathname === '/admin' 
    ? null 
    : location.pathname.slice(1);

  const handleUserClick = (username: string) => {
    navigate(`/${username}`);
    // Close drawer on mobile after navigation
    if (!isDesktop) {
      onToggle();
    }
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={onToggle}
        className="lg:hidden fixed top-4 right-4 z-50 p-2.5 glass-card text-white/60 hover:text-neural-violet transition-colors"
        aria-label={isOpen ? '關閉目錄' : '開啟目錄'}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Cpu className="w-5 h-5" />}
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && !isDesktop && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onToggle}
            className="fixed inset-0 bg-space-black/80 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Directory Container */}
      <aside
        className={cn(
          "fixed right-0 top-0 h-full w-72 z-45 bg-space-deep/95 backdrop-blur-xl border-l border-white/5",
          "lg:relative lg:w-56 xl:w-64 lg:bg-transparent lg:border-0 lg:block",
          "flex flex-col py-6 px-4 lg:py-4 lg:px-2",
          "transition-transform duration-300 ease-in-out",
          // Mobile: slide in/out based on isOpen
          !isDesktop && (isOpen ? "translate-x-0" : "translate-x-full"),
          // Desktop: always visible
          isDesktop && "translate-x-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
          <h3 className="text-[9px] font-black text-white/40 uppercase tracking-[0.3em]">公開目錄</h3>
          <div className="px-2 py-0.5 bg-quantum-cyan/10 rounded-full border border-quantum-cyan/20 text-[8px] font-black text-quantum-cyan tracking-widest shrink-0">
            {users.length} ACTIVE
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1">
          <AnimatePresence>
            {users.length > 0 ? (
              users.map((user, idx) => {
                const isSelected = currentUsername === user.username;
                return (
                  <motion.button
                    key={user.username}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => handleUserClick(user.username)}
                    className={cn(
                      "w-full glass-card p-3 flex items-center justify-between transition-all group/item cursor-pointer text-left",
                      "border-white/5 hover:border-quantum-cyan/20 bg-space-deep/40 backdrop-blur-md",
                      isSelected && "border-quantum-cyan/50 bg-quantum-cyan/10 shadow-[0_0_20px_rgba(34,211,238,0.1)]"
                    )}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <Cpu className={cn(
                        "w-3.5 h-3.5 shrink-0 transition-colors",
                        isSelected ? "text-quantum-cyan" : "text-quantum-cyan/30 group-hover/item:text-quantum-cyan"
                      )} />
                      <div className="flex flex-col overflow-hidden">
                        <span className={cn(
                          "text-[10px] font-bold tracking-tight truncate transition-colors",
                          isSelected ? "text-quantum-cyan" : "text-white/60 group-hover/item:text-white"
                        )}>
                          {user.username}
                        </span>
                        <span className="text-[7px] text-white/20 uppercase tracking-widest">
                          Index {idx.toString().padStart(3, '0')}
                        </span>
                      </div>
                    </div>
                    <Sparkles className={cn(
                      "w-3.5 h-3.5 shrink-0 transition-all",
                      isSelected ? "text-quantum-cyan/50" : "text-white/5 group-hover/item:text-quantum-cyan/30"
                    )} />
                  </motion.button>
                );
              })
            ) : (
              <div className="text-center py-6 border border-dashed border-white/5 rounded-2xl opacity-30">
                <p className="text-[8px] font-black uppercase tracking-[0.2em]">無活躍節點</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </aside>
    </>
  );
};
