import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, FileUp, Sparkles, TreeDeciduous } from 'lucide-react';
import { cn } from '../lib/utils';

interface LandingPageProps {
  data: {
    users?: Array<{ username: string; folder: string }>;
    error?: string;
  };
}

export const LandingPage: React.FC<LandingPageProps> = ({ data }) => {
  const [uploadType, setUploadType] = useState<'url' | 'file'>('url');
  const [formData, setFormData] = useState({ content: '', password: '' });
  const [isPlanting, setIsPlanting] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPlanting(true);
    
    try {
      if (uploadType === 'url') {
        const body = new FormData();
        body.append('url', formData.content);
        body.append('password', formData.password);
        
        const res = await fetch('/api/upload_url', {
          method: 'POST',
          body
        });
        const result = await res.json();
        if (res.ok) window.location.href = result.redirect;
        else alert(result.detail || '種植失敗');
      } else if (file) {
        const body = new FormData();
        body.append('files[]', file);
        body.append('password', formData.password);
        
        const res = await fetch('/api/upload', {
          method: 'POST',
          body
        });
        const result = await res.json();
        if (res.ok) window.location.href = result.redirect;
        else alert(result.detail || '種植失敗');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsPlanting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-12">
      {/* Title Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="flex items-center justify-center gap-4">
          <h1 className="text-6xl md:text-8xl font-heading text-transparent bg-clip-text bg-linear-to-r from-accent-mint via-white to-accent-mint animate-gradient">
            FileTree
          </h1>
          <TreeDeciduous className="w-12 h-12 text-accent-mint animate-bounce" />
        </div>
        <p className="text-accent-mint/60 tracking-[0.2em] font-light">
          數位生態系統 🌱
        </p>
      </motion.div>

      {/* Main Seed Pod */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-2xl p-8 md:p-12 relative overflow-hidden group"
      >
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-accent-mint/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        
        <div className="relative z-10 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-accent-mint" />
              森林種植站
              <Sparkles className="w-5 h-5 text-accent-mint" />
            </h2>
            <p className="text-white/40 text-sm">在這裡種下您的數位種子...</p>
          </div>

          {/* Toggle */}
          <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10">
            <button 
              onClick={() => setUploadType('url')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 cursor-pointer",
                uploadType === 'url' ? "bg-accent-mint text-forest-midnight shadow-lg" : "hover:bg-white/5 text-white/60"
              )}
            >
              <Link2 className="w-5 h-5" />
              網址種子
            </button>
            <button 
              onClick={() => setUploadType('file')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 cursor-pointer",
                uploadType === 'file' ? "bg-accent-mint text-forest-midnight shadow-lg" : "hover:bg-white/5 text-white/60"
              )}
            >
              <FileUp className="w-5 h-5" />
              檔案種子
            </button>
          </div>

          {/* Form Content */}
          <AnimatePresence mode="wait">
            <form onSubmit={handleSubmit} className="space-y-6">
              {uploadType === 'url' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60 ml-2">網址 URL</label>
                  <input 
                    type="text" 
                    required
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="輸入要種植的網址或文字..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-hidden focus:border-accent-mint/50 focus:ring-2 focus:ring-accent-mint/20 transition-all"
                  />
                </div>
              ) : (
                <div 
                  onClick={() => document.getElementById('file-input')?.click()}
                  className="w-full h-48 rounded-2xl border-2 border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center space-y-4 cursor-pointer hover:border-accent-mint/40 hover:bg-accent-mint/5 transition-all group/drop"
                >
                  <input 
                    id="file-input"
                    type="file" 
                    className="hidden" 
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <FileUp className="w-12 h-12 text-white/20 group-hover/drop:text-accent-mint/60 group-hover/drop:scale-110 transition-all" />
                  <div className="text-center">
                    <p className="text-white/60 font-medium">
                      {file ? file.name : '將檔案拖曳至此處'}
                    </p>
                    <p className="text-white/30 text-xs">或點擊瀏覽本地森林檔案</p>
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60 ml-2">樹屋鑰匙</label>
                <input 
                  type="password" 
                  required
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="輸入您的專屬鑰匙..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-hidden focus:border-accent-mint/50 focus:ring-2 focus:ring-accent-mint/20 transition-all"
                />
              </div>
 
              <button 
                type="submit"
                disabled={isPlanting}
                className="btn-accent w-full flex items-center justify-center gap-2 group/btn relative overflow-hidden disabled:opacity-50"
              >
                <span className="relative z-10">{isPlanting ? '種植中...' : '開始種植'}</span>
                <Sparkles className="w-5 h-5 relative z-10 group-hover/btn:animate-spin" />
                <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
              </button>
            </form>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* User List Section */}
      {data.users && data.users.length > 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full max-w-4xl space-y-6"
        >
          <h3 className="text-center text-white/40 text-sm tracking-widest uppercase">現有的樹屋</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.users.map((user, idx) => (
              <a 
                key={idx}
                href={`/${user.username}`}
                className="glass-card p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer border-transparent hover:border-accent-mint/20"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent-mint/10 rounded-lg">
                    <TreeDeciduous className="w-5 h-5 text-accent-mint" />
                  </div>
                  <span className="font-medium text-white/80">{user.username} 的樹屋</span>
                </div>
                <Sparkles className="w-4 h-4 text-white/20" />
              </a>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};
