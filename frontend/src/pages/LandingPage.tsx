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
        body.append('files', file);
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

      {/* Main Content Container */}
      <div className="w-full max-w-screen-2xl px-6 md:px-12 relative z-10">
        
        {/* Title Section - Centered relative to the Middle Column */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16 space-y-4"
        >
          <div className="flex items-center justify-center gap-6">
            <h1 className="text-6xl md:text-8xl font-bold tracking-tighter animate-stellar-text">
              StellarNexus
            </h1>
            <Orbit className="w-16 h-16 text-quantum-cyan animate-spin-slow opacity-80" />
          </div>
          <p className="text-quantum-cyan/40 tracking-[0.8em] font-light uppercase text-xs md:text-sm pl-4">
            Galactic Neural Matrix 🌌
          </p>
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* Left Column: Future Menu Placeholder */}
          <div className="hidden xl:flex xl:col-span-3 flex-col gap-6 opacity-30 pointer-events-none">
            <div className="flex items-center gap-3 pb-4 border-b border-white/5">
              <div className="w-2 h-2 rounded-full bg-white/20 animate-pulse" />
              <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.5em]">Future Protocols</h3>
            </div>
            <div className="space-y-4">
              <div className="h-16 rounded-2xl border border-white/5 bg-white/2" />
              <div className="h-16 rounded-2xl border border-white/5 bg-white/2" />
              <div className="h-16 rounded-2xl border border-white/5 bg-white/2" />
            </div>
          </div>
          
          {/* Center Column: Title & Input Pod */}
          <div className="xl:col-span-6 space-y-12">
            {/* Input Pod */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-1 relative group"
            >
              <div className="neural-border rounded-4xl p-8 md:p-12 space-y-8 bg-space-black/80 backdrop-blur-3xl relative overflow-hidden">
                <div className="absolute inset-0 bg-linear-to-br from-quantum-cyan/5 via-transparent to-neural-violet/5 opacity-50" />
                
                <div className="relative z-10">
                  <div className="text-center space-y-2 mb-10">
                    <h2 className="text-3xl font-bold flex items-center justify-center gap-4">
                      <Cpu className="w-8 h-8 text-quantum-cyan" />
                      數據初始化樞紐
                      <Activity className="w-6 h-6 text-neural-violet animate-pulse" />
                    </h2>
                    <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] font-bold">Galactic Synchronization Gateway</p>
                  </div>

                  {/* Selector & Form */}
                  <div className="space-y-8">
                    <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                      <button 
                        onClick={() => setUploadType('url')}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-3 py-5 rounded-xl transition-all duration-300 cursor-pointer font-black uppercase tracking-[0.2em] text-[10px]",
                          uploadType === 'url' ? "bg-white/10 text-quantum-cyan shadow-[0_0_20px_rgba(34,211,238,0.2)] border border-white/10" : "text-white/20 hover:text-white/40"
                        )}
                      >
                        <Link2 className="w-4 h-4" /> 網絡連結
                      </button>
                      <button 
                        onClick={() => setUploadType('file')}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-3 py-5 rounded-xl transition-all duration-300 cursor-pointer font-black uppercase tracking-[0.2em] text-[10px]",
                          uploadType === 'file' ? "bg-white/10 text-quantum-cyan shadow-[0_0_20px_rgba(34,211,238,0.2)] border border-white/10" : "text-white/20 hover:text-white/40"
                        )}
                      >
                        <FileUp className="w-4 h-4" /> 實體資料
                      </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                      <div className="min-h-40 flex flex-col justify-center">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={uploadType}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="space-y-4"
                          >
                            <label className="text-[10px] font-black text-stellar-label uppercase tracking-[0.4em] ml-2 opacity-60">數據源標記</label>
                            {uploadType === 'url' ? (
                              <input 
                                type="url" 
                                required
                                value={formData.content}
                                onChange={(e) => setFormData(p => ({ ...p, content: e.target.value }))}
                                placeholder="輸入同步網址或協議節點..."
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-8 py-6 outline-none focus:border-quantum-cyan focus:bg-white/10 transition-all text-white text-lg font-medium shadow-inner"
                              />
                            ) : (
                              <div 
                                onClick={() => document.getElementById('file-input')?.click()}
                                className="w-full h-44 rounded-2xl border-2 border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center space-y-4 cursor-pointer hover:border-quantum-cyan/40 hover:bg-quantum-cyan/5 transition-all group/drop"
                              >
                                <input id="file-input" type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                                <div className="p-4 bg-white/5 rounded-full border border-white/5 group-hover/drop:scale-110 transition-transform">
                                  <FileUp className="w-8 h-8 text-white/20 group-hover/drop:text-quantum-cyan transition-colors" />
                                </div>
                                <div className="text-center">
                                  <p className="text-white/80 font-bold tracking-tight">{file ? file.name : '點擊或拖曳數據核心'}</p>
                                  <p className="text-white/20 text-[10px] uppercase tracking-widest mt-1">支持任何星際編碼格式</p>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </div>
                      
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-stellar-label uppercase tracking-[0.4em] ml-2 opacity-60">訪問授權密鑰</label>
                        <div className="relative">
                          <input 
                            type="password" 
                            required
                            value={formData.password}
                            onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))}
                            placeholder="輸入觀測站認證密鑰..."
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-8 py-6 outline-none focus:border-quantum-cyan focus:bg-white/10 transition-all text-white text-lg font-medium shadow-inner"
                          />
                          <ShieldCheck className="absolute right-8 top-1/2 -translate-y-1/2 w-6 h-6 text-white/20" />
                        </div>
                      </div>

                      <button 
                        disabled={isSyncing}
                        className="btn-stellar w-full flex items-center justify-center gap-6 py-8 hover:scale-[1.01] active:scale-[0.99] shadow-[0_0_40px_rgba(34,211,238,0.15)] bg-quantum-cyan/10 border-quantum-cyan/30"
                      >
                        <span className="tracking-[0.8em] uppercase font-black text-white text-base pl-2">
                          {isSyncing ? '矩陣同步中...' : '發射數據至網格'}
                        </span>
                        <Zap className={cn("w-6 h-6 text-quantum-cyan", isSyncing && "animate-spin")} />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Observation Decks Sidebar */}
          <div className="xl:col-span-3 space-y-8 lg:sticky lg:top-12">
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.5em]">已偵測節點</h3>
              <div className="px-3 py-1 bg-quantum-cyan/10 rounded-full border border-quantum-cyan/20 text-[9px] font-black text-quantum-cyan tracking-widest">
                {data.users?.length || 0} ACTIVE
              </div>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 lg:pr-4">
              {data.users && data.users.length > 0 ? (
                data.users.map((user, idx) => (
                  <motion.a 
                    key={idx}
                    href={`/${user.username}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="glass-card p-5 flex items-center justify-between hover:bg-quantum-cyan/2 transition-all group/item border-white/5 hover:border-quantum-cyan/20 bg-space-deep/40 backdrop-blur-md"
                  >
                    <div className="flex items-center gap-4">
                      <Cpu className="w-5 h-5 text-quantum-cyan/40 group-hover/item:text-quantum-cyan transition-colors" />
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-white/70 group-hover/item:text-white transition-colors tracking-tight">{user.username}</span>
                        <span className="text-[8px] text-white/20 uppercase tracking-widest">Sector {idx.toString().padStart(3, '0')}</span>
                      </div>
                    </div>
                    <Sparkles className="w-4 h-4 text-white/5 group-hover/item:text-quantum-cyan/40 transition-all" />
                  </motion.a>
                ))
              ) : (
                <div className="text-center py-10 border border-dashed border-white/5 rounded-3xl opacity-20">
                  <p className="text-[9px] font-black uppercase tracking-[0.3em]">無活躍節點</p>
                </div>
              )}
            </div>
            
            <a 
              href="/admin" 
              className="flex items-center justify-center gap-3 w-full py-5 glass-card bg-neural-violet/5 border-neural-violet/20 hover:bg-neural-violet/10 hover:border-neural-violet/40 transition-all group text-[9px] font-black text-neural-violet/60 hover:text-neural-violet uppercase tracking-[0.4em]"
            >
              <ShieldCheck className="w-4 h-4 group-hover:animate-pulse" /> 指揮中心入口
            </a>
          </div>

        </div>
      </div>
    </div>
  );
};
