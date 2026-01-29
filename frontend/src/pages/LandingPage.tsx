import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, FileUp, Sparkles, Cpu, Orbit, Zap, Activity, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import { Starfield } from '../components/Starfield';

interface LandingPageProps {
  data: {
    users?: Array<{ username: string; folder: string }>;
    error?: string;
  };
}

export const LandingPage: React.FC<LandingPageProps> = ({ data }) => {
  const [uploadType, setUploadType] = useState<'url' | 'file'>('url');
  const [formData, setFormData] = useState({ content: '', password: '' });
  const [isSyncing, setIsSyncing] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    
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
        else alert(result.detail || '初始化失敗');
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
        else alert(result.detail || '初始化失敗');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center p-4">
      <Starfield />
      
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-quantum-cyan/5 blur-[120px] rounded-full -z-10 animate-pulse" />

      {/* Main Content */}
      <div className="w-full max-w-4xl space-y-12 relative z-10">
        
        {/* Title Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="flex items-center justify-center gap-6">
            <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-transparent bg-clip-text bg-linear-to-r from-white via-quantum-cyan to-neural-violet animate-neural-flow bg-size-[200%_auto]">
              StellarNexus
            </h1>
            <Orbit className="w-16 h-16 text-quantum-cyan animate-spin-slow" />
          </div>
          <p className="text-quantum-cyan/60 tracking-[0.3em] font-light uppercase text-sm">
            Galactic Neural Matrix 🌌
          </p>
        </motion.div>

        {/* Input Pod */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-1 relative group"
        >
          <div className="neural-border rounded-4xl p-8 md:p-12 space-y-8 bg-space-black/80 backdrop-blur-3xl">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold flex items-center justify-center gap-3">
                <Cpu className="w-6 h-6 text-quantum-cyan" />
                數據初始化站
                <Activity className="w-6 h-6 text-neural-violet animate-pulse" />
              </h2>
              <p className="text-stellar-white/40 text-sm italic">在這裡上傳您的數位核心節點...</p>
            </div>

            {/* Selector */}
            <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
              <button 
                onClick={() => setUploadType('url')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-4 rounded-xl transition-all duration-300 cursor-pointer",
                  uploadType === 'url' ? "bg-white/10 text-quantum-cyan shadow-inner border border-white/10" : "text-white/40 hover:text-white/60"
                )}
              >
                <Link2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                網絡節點
              </button>
              <button 
                onClick={() => setUploadType('file')}
                aria-pressed={uploadType === 'file'}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-4 rounded-xl transition-all duration-300 cursor-pointer focus-ring",
                  uploadType === 'file' ? "bg-white/10 text-quantum-cyan shadow-inner border border-white/10" : "text-white/40 hover:text-white/60"
                )}
              >
                <FileUp className="w-5 h-5 shrink-0" aria-hidden="true" />
                實體核心
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={uploadType}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {uploadType === 'url' ? (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-quantum-cyan/60 ml-2 uppercase tracking-widest">Entry Link</label>
                      <input 
                        type="url" 
                        id="url-input"
                        required
                        aria-label="網絡連結 (URL)"
                        value={formData.content}
                        onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                        placeholder="輸入要同步的網址或協議數據..."
                        className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 outline-none focus-ring transition-all text-stellar-white placeholder:text-white/10"
                      />
                    </div>
                  ) : (
                    <div 
                      onClick={() => document.getElementById('file-input')?.click()}
                      className="w-full h-48 rounded-2xl border border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center space-y-4 cursor-pointer hover:border-quantum-cyan/40 hover:bg-quantum-cyan/5 transition-all group/drop focus-ring"
                      role="button"
                      aria-label="點擊或拖曳上傳檔案"
                    >
                      <input 
                        id="file-input"
                        type="file" 
                        className="hidden" 
                        aria-hidden="true"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                      />
                      <FileUp className="w-12 h-12 text-white/10 group-hover/drop:text-quantum-cyan/60 group-hover/drop:scale-110 transition-all" aria-hidden="true" />
                      <div className="text-center">
                        <p className="text-white/40 font-medium">
                          {file ? file.name : '將核心數據拖曳至此'}
                        </p>
                        <p className="text-white/20 text-xs text-balance px-4">支持各種星際網絡協議檔案</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
              
              <div className="space-y-2">
                <label className="text-xs font-medium text-neural-violet/60 ml-2 uppercase tracking-widest">Access Key</label>
                <div className="relative">
                  <input 
                    type="password" 
                    id="password-input"
                    required
                    aria-label="觀測站訪問授權 (密碼)"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="輸入您的觀測站訪問授權..."
                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 outline-none focus-ring transition-all text-stellar-white placeholder:text-white/10"
                  />
                  <ShieldCheck className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/10" aria-hidden="true" />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isSyncing}
                aria-busy={isSyncing}
                className="btn-stellar w-full flex items-center justify-center gap-3 py-5 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 focus-ring"
              >
                <span className="tracking-widest uppercase font-bold text-sm">
                  {isSyncing ? '同步中...' : '發射至網格'}
                </span>
                <Zap className={cn("w-5 h-5 text-quantum-cyan animate-pulse", isSyncing && "animate-spin")} />
              </button>
            </form>
          </div>
        </motion.div>

        {/* Observation Decks */}
        {data.users && data.users.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <h3 className="text-center text-quantum-cyan/40 text-[10px] tracking-[0.5em] uppercase font-bold">已建立的觀測站</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.users.map((user, idx) => (
                <a 
                  key={idx}
                  href={`/${user.username}`}
                  className="glass-card p-5 flex items-center justify-between hover:bg-white/5 transition-all group/item border-white/5 hover:border-quantum-cyan/20"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-quantum-cyan/5 rounded-full border border-quantum-cyan/10 group-hover/item:scale-110 transition-transform">
                      <Cpu className="w-5 h-5 text-quantum-cyan" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-white/40 uppercase tracking-tighter">Sector {idx.toString().padStart(3, '0')}</span>
                      <span className="font-semibold text-stellar-white tracking-tight">{user.username} 的核心</span>
                    </div>
                  </div>
                  <Sparkles className="w-4 h-4 text-white/5 group-hover/item:text-quantum-cyan/40 transition-colors" />
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
