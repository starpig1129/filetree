import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUp, Sparkles, Cpu, Orbit, Zap, Activity, ShieldCheck } from 'lucide-react';
import { SecurityInitializationModal } from '../components/SecurityInitializationModal';
import { cn } from '../lib/utils';
import { Starfield } from '../components/Starfield';
import Uppy from '@uppy/core';
import UppyDashboard from '../components/UppyDashboard';
import Tus from '@uppy/tus';

// Uppy styles
import '@uppy/core/css/style.min.css';
import '@uppy/dashboard/css/style.min.css';

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
  const [firstLoginUserInfo, setFirstLoginUserInfo] = useState<{username: string, oldPwd: string} | null>(null);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  // Initialize Uppy
  const [uppy] = useState(() => new Uppy({
    id: 'filenexus-uploader',
    autoProceed: false,
    debug: true,
    restrictions: {
      maxFileSize: 10 * 1024 * 1024 * 1024, // 10GB
    }
  }).use(Tus, {
    endpoint: '/api/upload/tus',
    chunkSize: 5 * 1024 * 1024, // 5MB chunks (Cloudflare limit is 100MB)
    retryDelays: [0, 1000, 3000, 5000],
    removeFingerprintOnSuccess: true,
  }));

  // Sync password to metadata
  React.useEffect(() => {
    uppy.setMeta({ password: formData.password });
  }, [formData.password, uppy]);

  // Handle success
  React.useEffect(() => {
    uppy.on('complete', async (result) => {
      if (result.successful && result.successful.length > 0) {
        // TUS doesn't return user info easily in 'complete', 
        // so we do a quick check via login or we can assume based on local data
        // For simplicity and correctness, let's verify if first_login is needed
        try {
          const body = new FormData();
          body.append('password', formData.password);
          const res = await fetch('/api/login', { method: 'POST', body });
          if (res.ok) {
            const user = await res.json();
            if (user.first_login) {
                setFirstLoginUserInfo({ username: user.username, oldPwd: formData.password });
                setRedirectPath(`/${user.username}`);
                return;
            }
            window.location.href = `/${user.username}`;
          }
        } catch (err) {
          console.error(err);
          alert('上傳成功！');
          window.location.reload();
        }
      }
    });
  }, [uppy, data.users, formData.content, formData.password]);

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
        if (res.ok) {
            if (result.first_login) {
                // Extract username from redirect path e.g. /starpig
                const username = result.redirect.split('/').pop() || "";
                setFirstLoginUserInfo({ username, oldPwd: formData.password });
                setRedirectPath(result.redirect);
            } else {
                window.location.href = result.redirect;
            }
        } else {
            alert(result.detail || '初始化失敗');
        }
      } else if (uploadType === 'file') {
        if (uppy.getFiles().length === 0) {
          alert('請先選擇檔案');
          setIsSyncing(false);
          return;
        }
        if (!formData.password) {
          alert('請輸入密碼');
          setIsSyncing(false);
          return;
        }
        await uppy.upload();
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
      
      {/* Background Glow - Dynamic sizing base on viewport height to save vertical rhythm */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] h-[90vh] max-w-300 max-h-200 bg-quantum-cyan/5 blur-[clamp(3rem,8vw,6rem)] rounded-full -z-10 animate-pulse" />

      {/* Main Content Container - Deep vertical compression for 1080p */}
      <div className="w-full max-w-screen-2xl px-4 sm:px-8 md:px-12 relative z-10 py-[clamp(1rem,4vh,3.5rem)] overflow-y-auto lg:overflow-visible">
        
        {/* Title Section - Shrinked dimensions to save space */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-[clamp(1rem,3vh,3rem)] space-y-2"
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-6">
            <h1 className="text-[clamp(1.8rem,5vw,4rem)] font-bold tracking-tighter animate-stellar-text leading-tight">
              FileNexus
            </h1>
            <Orbit className="w-[clamp(1.8rem,4vw,3rem)] h-[clamp(1.8rem,4vw,3rem)] text-quantum-cyan animate-spin-slow opacity-60" />
          </div>
          <p className="text-quantum-cyan/40 tracking-[clamp(0.2em,2vw,0.6em)] font-light uppercase text-[clamp(0.55rem,1vw,0.75rem)] pl-2 sm:pl-4">
            Modern File Management Hub 📁
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
          
          {/* Left Column: Future Menu Placeholder - Compacted */}
          <div className="hidden lg:flex lg:col-span-3 flex-col gap-4 opacity-20 pointer-events-none">
            <div className="flex items-center gap-3 pb-3 border-b border-white/5">
              <div className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" />
              <h3 className="text-[9px] font-black text-white/40 uppercase tracking-[0.4em]">功能預留</h3>
            </div>
            <div className="space-y-[clamp(0.75rem,2vh,1.5rem)]">
              <div className="h-12 rounded-xl border border-white/5 bg-white/2" />
              <div className="h-12 rounded-xl border border-white/5 bg-white/2" />
            </div>
          </div>
          
          {/* Center Column: Hub - Tightened spacing */}
          <div className="lg:col-span-6 space-y-[clamp(1rem,3vh,2rem)]">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-0.5 relative group"
            >
              <div className="neural-border rounded-4xl p-5 sm:p-6 md:p-[clamp(1.5rem,4vw,2.5rem)] space-y-[clamp(1.25rem,2.5vh,1.75rem)] bg-space-black/80 backdrop-blur-3xl relative overflow-hidden">
                <div className="absolute inset-0 bg-linear-to-br from-quantum-cyan/5 via-transparent to-neural-violet/5 opacity-50" />
                
                <div className="relative z-10">
                  <div className="text-center space-y-1 mb-[clamp(1.25rem,2.5vh,2rem)]">
                    <h2 className="text-[clamp(1.1rem,2vw,1.5rem)] font-bold flex items-center justify-center gap-3 leading-tight">
                      <Cpu className="w-5 h-5 sm:w-7 sm:h-7 text-quantum-cyan shrink-0" />
                      資料上傳中心
                      <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-neural-violet animate-pulse shrink-0" />
                    </h2>
                    <p className="text-white/30 text-[clamp(0.45rem,0.8vw,0.56rem)] uppercase tracking-[0.25em] font-bold">File Synchronization Gateway</p>
                  </div>

                  {/* Selector & Form */}
                  <div className="space-y-5 sm:space-y-6">
                    <div className="flex p-0.5 bg-white/5 rounded-xl border border-white/5">
                      <button 
                        onClick={() => setUploadType('url')}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-3 sm:py-4 rounded-lg transition-all duration-300 cursor-pointer font-black uppercase tracking-[0.15em] text-[9px] sm:text-xs",
                          uploadType === 'url' ? "bg-white/10 text-quantum-cyan shadow-lg border border-white/10" : "text-white/20 hover:text-white/40"
                        )}
                      >
                        <Zap className="w-3.5 h-3.5" /> 加密筆記
                      </button>
                      <button 
                        onClick={() => setUploadType('file')}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-3 sm:py-4 rounded-lg transition-all duration-300 cursor-pointer font-black uppercase tracking-[0.15em] text-[9px] sm:text-xs",
                          uploadType === 'file' ? "bg-white/10 text-quantum-cyan shadow-lg border border-white/10" : "text-white/20 hover:text-white/40"
                        )}
                      >
                        <FileUp className="w-3.5 h-3.5" /> 實體資料
                      </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-[clamp(1rem,2.5vh,1.5rem)]">
                      <div className="min-h-[clamp(7rem,12vh,9rem)] flex flex-col justify-center">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={uploadType}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="space-y-2"
                          >
                            <label className="text-[9px] font-black text-stellar-label uppercase tracking-[0.3em] ml-2 opacity-50">資料源</label>
                            {uploadType === 'url' ? (
                               <textarea 
                                 required
                                 value={formData.content}
                                 onChange={(e) => setFormData(p => ({ ...p, content: e.target.value }))}
                                 placeholder="輸入網址或任何想保存的文字資訊..."
                                 className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 sm:py-4 outline-none focus:border-quantum-cyan focus:bg-white/10 transition-all text-white text-sm sm:text-base font-medium shadow-inner min-h-[clamp(7rem,12vh,9rem)] resize-none"
                               />
                            ) : (
                               <div className="w-full rounded-xl overflow-hidden border border-white/10 bg-white/2">
                                 <UppyDashboard 
                uppy={uppy} 
                className="w-full"
                props={{
                  showProgressDetails: true,
                  note: 'Supports chunked & resumable uploads (powered by Tus)',
                  theme: 'dark',
                  hideUploadButton: true,
                  height: 300,
                  width: '100%'
                }}
              />
                               </div>
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-stellar-label uppercase tracking-[0.3em] ml-2 opacity-50">密碼</label>
                        <div className="relative">
                          <input 
                            type="password" 
                            required
                            value={formData.password}
                            onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))}
                            placeholder="輸入解鎖密碼..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 sm:py-4 outline-none focus:border-quantum-cyan focus:bg-white/10 transition-all text-white text-sm sm:text-base font-medium shadow-inner"
                          />
                          <ShieldCheck className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/10" />
                        </div>
                      </div>

                      <button 
                        type="submit"
                        disabled={isSyncing}
                        className="btn-stellar w-full flex items-center justify-center gap-3 py-4 sm:py-5 hover:scale-[1.01] active:scale-[0.99] shadow-lg bg-quantum-cyan/10 border-quantum-cyan/30 cursor-pointer"
                      >
                        <span className="tracking-[clamp(0.3em,1vw,0.6em)] uppercase font-black text-white text-xs sm:text-sm pl-2">
                          {isSyncing ? '資料處理中...' : (uploadType === 'file' ? '開始高速上傳' : '提交資料')}
                        </span>
                        <Zap className={cn("w-4 h-4 sm:w-5 sm:h-5 text-quantum-cyan", isSyncing && "animate-spin")} />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Node List Sidebar - More compact titles and max-height */}
          <div className="lg:col-span-3 space-y-4 lg:sticky lg:top-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <h3 className="text-[9px] font-black text-white/40 uppercase tracking-[0.4em]">公開目錄</h3>
              <div className="px-2 py-0.5 bg-quantum-cyan/10 rounded-full border border-quantum-cyan/20 text-[8px] font-black text-quantum-cyan tracking-widest shrink-0">
                {data.users?.length || 0} ACTIVE
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5 max-h-[clamp(12rem,35vh,25rem)] lg:max-h-[clamp(20rem,50vh,35rem)] overflow-y-auto custom-scrollbar pr-1.5 overflow-x-hidden">
              {data.users && data.users.length > 0 ? (
                data.users.map((user, idx) => (
                  <motion.a 
                    key={idx}
                    href={`/${user.username}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="glass-card p-3 flex items-center justify-between hover:bg-quantum-cyan/2 transition-all group/item border-white/5 hover:border-quantum-cyan/20 bg-space-deep/40 backdrop-blur-md"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <Cpu className="w-3.5 h-3.5 text-quantum-cyan/30 group-hover/item:text-quantum-cyan transition-colors shrink-0" />
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-[10px] font-bold text-white/60 group-hover/item:text-white transition-colors tracking-tight truncate">{user.username}</span>
                        <span className="text-[7px] text-white/20 uppercase tracking-widest">Index {idx.toString().padStart(3, '0')}</span>
                      </div>
                    </div>
                    <Sparkles className="w-3.5 h-3.5 text-white/5 group-hover/item:text-quantum-cyan/30 transition-all shrink-0" />
                  </motion.a>
                ))
              ) : (
                <div className="text-center py-6 border border-dashed border-white/5 rounded-2xl opacity-10">
                  <p className="text-[8px] font-black uppercase tracking-[0.2em]">無活躍節點</p>
                </div>
              )}
            </div>
            
            <a 
              href="/admin" 
              className="flex items-center justify-center gap-2.5 w-full py-3.5 glass-card bg-neural-violet/5 border-neural-violet/10 hover:bg-neural-violet/10 hover:border-neural-violet/30 transition-all group text-[8px] font-black text-neural-violet/50 hover:text-neural-violet uppercase tracking-[0.3em]"
            >
              <ShieldCheck className="w-3.5 h-3.5 group-hover:animate-pulse" /> 管理員登入
            </a>
          </div>

        </div>
      </div>
      <SecurityInitializationModal 
        isOpen={!!firstLoginUserInfo}
        username={firstLoginUserInfo?.username || ""}
        oldPassword={firstLoginUserInfo?.oldPwd || ""}
        onSuccess={() => {
            alert("安全性初始化完成，正在跳轉至專屬區域。");
            window.location.href = redirectPath || "/";
        }}
      />
    </div>
  );
};
