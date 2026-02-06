import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Cpu, FileUp, Menu, X, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

const navItems: NavItem[] = [
  { id: 'upload', label: '資料上傳中心', icon: FileUp, path: '/' },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
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

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (path: string) => {
    navigate(path);
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
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 glass-card text-white/60 hover:text-quantum-cyan transition-colors"
        aria-label={isOpen ? '關閉選單' : '開啟選單'}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Overlay */}
      {isOpen && !isDesktop && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onToggle}
          className="fixed inset-0 bg-space-black/80 backdrop-blur-sm z-40"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-64 z-45 bg-space-deep/95 backdrop-blur-xl border-r border-white/5",
          "lg:relative lg:w-56 xl:w-64 lg:bg-transparent lg:border-0 lg:block",
          "flex flex-col py-6 px-4 lg:py-4 lg:px-2",
          "transition-transform duration-300 ease-in-out",
          // Mobile: slide in/out based on isOpen
          !isDesktop && (isOpen ? "translate-x-0" : "-translate-x-full"),
          // Desktop: always visible
          isDesktop && "translate-x-0"
        )}
      >
        {/* Logo / Header */}
        <div className="flex items-center gap-3 px-3 mb-8 lg:mb-6">
          <div className="w-8 h-8 bg-quantum-cyan/10 rounded-xl flex items-center justify-center border border-quantum-cyan/20">
            <Cpu className="w-4 h-4 text-quantum-cyan" />
          </div>
          <span className="text-sm font-bold text-white/80 tracking-tight hidden sm:block">FileNexus</span>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-2">
          <div className="px-3 mb-3">
            <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">功能選單</span>
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.path)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 cursor-pointer group",
                  "text-left text-sm font-medium tracking-tight",
                  active
                    ? "bg-quantum-cyan/10 text-quantum-cyan border border-quantum-cyan/30 shadow-[0_0_15px_rgba(34,211,238,0.1)]"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent"
                )}
              >
                <Icon className={cn(
                  "w-4 h-4 shrink-0 transition-colors",
                  active ? "text-quantum-cyan" : "text-white/20 group-hover:text-white/40"
                )} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Admin Link */}
        <div className="pt-4 border-t border-white/5">
          <button
            onClick={() => handleNavClick('/admin')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer group",
              "text-left text-xs font-medium tracking-wide",
              location.pathname === '/admin'
                ? "bg-neural-violet/10 text-neural-violet border border-neural-violet/30"
                : "text-white/20 hover:text-neural-violet/60 hover:bg-neural-violet/5 border border-transparent"
            )}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>管理員</span>
          </button>
        </div>
      </aside>
    </>
  );
};
