import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  File, FileText, Image as ImageIcon, Music, Video, 
  ExternalLink, Download, Share2, Trash2, 
  ChevronLeft,  Lock, Unlock, CheckSquare, Square,
  Cpu, Zap, Activity, ShieldCheck, Orbit, QrCode, X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Starfield } from '../components/Starfield';

interface FileItem {
  name: string;
  size: number;
  size_bytes: number;
  expired: boolean;
  remaining_days: number;
  remaining_hours: number;
  is_locked?: boolean;
}

interface UrlItem {
  url: string;
  created: string;
  is_locked?: boolean;
}

interface UserPageProps {
  data: {
    user?: { username: string };
    usage?: number;
    files?: FileItem[];
    urls?: UrlItem[];
    error?: string;
  };
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext!)) return ImageIcon;
  if (['mp4', 'webm', 'mov'].includes(ext!)) return Video;
  if (['mp3', 'wav', 'ogg'].includes(ext!)) return Music;
  if (['pdf', 'doc', 'docx', 'txt'].includes(ext!)) return FileText;
  return File;
};

export const UserPage: React.FC<UserPageProps> = ({ data }) => {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const toggleSelect = (name: string) => {
    setSelectedFiles(prev => 
      prev.includes(name) ? prev.filter(f => f !== name) : [...prev, name]
    );
  };

  const handleUnlock = async (pwd: string) => {
    try {
      const res = await fetch(`/api/user/${data.user?.username}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd })
      });
      if (res.ok) {
        setIsAuthenticated(true);
        setPassword(pwd);
        setShowAuthModal(false);
      } else {
        alert("密鑰驗證失敗，權限遭到拒絕。");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleItemLock = async (type: 'file' | 'url', itemId: string, currentStatus: boolean) => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    try {
      const res = await fetch(`/api/user/${data.user?.username}/toggle-lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          item_type: type,
          item_id: itemId,
          is_locked: !currentStatus
        })
      });
      if (res.ok) {
        window.location.reload(); // Quickest way to sync state
      } else {
        alert("更新鎖定狀態失敗。");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`確定要移除「${filename}」嗎？`)) return;
    try {
      const res = await fetch(`/api/files/${data.user?.username}/${filename}`, { method: 'DELETE' });
      if (res.ok) window.location.reload();
      else alert('移除失敗');
    } catch (err) {
      console.error(err);
    }
  };

  const handleShare = async (filename: string) => {
    try {
      const res = await fetch(`/api/share/${data.user?.username}/${filename}`, { method: 'POST' });
      const result = await res.json();
      if (res.ok) {
        const shareUrl = `${window.location.origin}/api/download-shared/${result.token}`;
        navigator.clipboard.writeText(shareUrl);
        alert('分享連結已複製到剪貼簿！');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getLifecycleColor = (file: FileItem) => {
    if (file.expired) return 'text-red-400';
    if (file.remaining_days < 5) return 'text-neural-violet';
    return 'text-quantum-cyan';
  };

  return (
    <div className="relative min-h-screen p-[clamp(1rem,3vw,2rem)] md:p-[clamp(1.5rem,4vw,3.5rem)] space-y-[clamp(1.5rem,4vh,4rem)] overflow-hidden">
      <Starfield />
      
      {/* Background Ambient Elements - Deep compression */}
      <div className="absolute top-1/4 -right-20 w-[70vw] h-[50vh] max-w-240 max-h-180 bg-quantum-cyan/5 blur-[clamp(3rem,8vw,8rem)] rounded-full -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 -left-20 w-[60vw] h-[50vh] max-w-240 max-h-180 bg-neural-violet/5 blur-[clamp(3rem,8vw,8rem)] rounded-full -z-10 animate-pulse" style={{ animationDelay: '1s' }} />

      {/* Header Bar - More compact for 1080p */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
        <a href="/" className="group flex items-center gap-2 text-white/40 hover:text-quantum-cyan transition-colors cursor-pointer text-[clamp(0.6rem,0.9vw,0.8rem)] font-bold tracking-widest uppercase">
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" />
          回歸核心樞紐
        </a>
        
        <div className="flex items-center gap-3">
          <div className="px-4 sm:px-5 py-2 glass-card flex items-center gap-2 sm:gap-3 text-[clamp(0.5rem,0.75vw,0.7rem)] tracking-widest uppercase font-black text-stellar-white/60 shadow-lg">
            <Activity className="w-4 h-4 text-quantum-cyan animate-pulse shrink-0" aria-hidden="true" />
            核心載荷：{data.usage} MB
          </div>
          <button 
            onClick={() => isAuthenticated ? setIsAuthenticated(false) : setShowAuthModal(true)}
            aria-label={isAuthenticated ? "鎖定所有項目" : "全域解鎖觀測站"}
            className={cn(
                "p-2 sm:p-2.5 glass-card transition-all cursor-pointer border-white/5 focus-ring shadow-lg",
                isAuthenticated ? "text-quantum-cyan hover:bg-quantum-cyan/10" : "text-neural-violet hover:bg-neural-violet/10"
            )}
          >
            {isAuthenticated ? <Unlock className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" /> : <Lock className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Hero Section - Deep vertical compression to save screen real estate */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-[clamp(1.5rem,4vw,3rem)] text-center relative overflow-hidden group z-10"
      >
        <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-quantum-cyan to-transparent opacity-50" />
        <div className="flex flex-col md:flex-row items-center justify-center gap-[clamp(0.5rem,1.5vw,1.25rem)] mb-[clamp(0.75rem,1.5vh,1.5rem)]">
          <Orbit className="w-[clamp(1.25rem,3vw,2.25rem)] h-[clamp(1.25rem,3vw,2.25rem)] text-quantum-cyan animate-spin-slow opacity-20 hidden md:block" />
          <h1 className="text-[clamp(1.5rem,4.5vw,3.5rem)] font-bold tracking-tight text-white/90 leading-tight">
            {data.user?.username} <span className="text-quantum-cyan/80">觀測站</span>
          </h1>
          <Orbit className="w-[clamp(1.25rem,3vw,2.25rem)] h-[clamp(1.25rem,3vw,2.25rem)] text-quantum-cyan animate-spin-slow opacity-20" />
        </div>
        <div className="inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2 bg-white/5 rounded-full text-[clamp(0.45rem,0.7vw,0.6rem)] text-white/30 tracking-widest uppercase font-bold border border-white/5">
          <ShieldCheck className="w-3.5 h-3.5 text-quantum-cyan shrink-0" />
          實體核心將在 30 週期後解離。神經連結永遠保留。
        </div>
      </motion.div>

      {/* Files Section - Compact grid gap */}
      <section className="space-y-[clamp(1rem,1.5vh,1.5rem)] relative z-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[clamp(1.1rem,1.8vw,1.6rem)] font-bold flex items-center gap-3 text-stellar-white/80 tracking-tight">
            <div className="p-2 sm:p-2.5 bg-quantum-cyan/5 rounded-xl border border-quantum-cyan/10 shrink-0">
              <Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-quantum-cyan" />
            </div>
            數據扇區
          </h2>
          {selectedFiles.length > 0 && (
             <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               className="flex items-center gap-2 shrink-0"
             >
               <span className="text-[clamp(0.45rem,0.65vw,0.55rem)] text-white/30 uppercase tracking-widest hidden sm:block">鎖定 {selectedFiles.length} 節點</span>
               <button 
                 aria-label="備份選擇的節點"
                 className="p-1.5 glass-card hover:bg-quantum-cyan/20 text-quantum-cyan cursor-pointer border-white/5"
               >
                 <Download className="w-4 h-4" aria-hidden="true" />
               </button>
               <button 
                 aria-label="移除選擇的節點"
                 className="p-1.5 glass-card hover:bg-red-500/20 text-red-400 cursor-pointer border-white/5"
               >
                 <Trash2 className="w-4 h-4" aria-hidden="true" />
               </button>
             </motion.div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-[clamp(0.75rem,1.5vw,1.5rem)]">
          <AnimatePresence>
            {data.files?.map((file, idx) => {
              const Icon = getFileIcon(file.name);
              const isSelected = selectedFiles.includes(file.name);
              const isLocked = file.is_locked && !isAuthenticated;
              
              return (
                <motion.div
                  key={file.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => !isLocked && toggleSelect(file.name)}
                  className={cn(
                    "glass-card p-[clamp(1rem,1.5vw,1.25rem)] group cursor-pointer border-white/5 transition-all hover:bg-white/5 hover:border-quantum-cyan/20",
                    isSelected && "border-quantum-cyan/50 bg-quantum-cyan/5",
                    isLocked && "opacity-80"
                  )}
                >
                  <div className="relative aspect-square flex items-center justify-center bg-white/2 rounded-[clamp(1rem,1.5vw,1.5rem)] mb-[clamp(0.75rem,1vh,1.25rem)] overflow-hidden border border-white/5 group-hover:border-quantum-cyan/10 transition-colors">
                    <Icon className={cn(
                      "w-[clamp(2rem,5vw,3rem)] h-[clamp(2rem,5vw,3rem)] text-white/5 transition-all duration-500",
                      !isLocked && "group-hover:text-quantum-cyan/30 group-hover:scale-110",
                      isLocked && "blur-xl"
                    )} />
                    <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex flex-col gap-2">
                       {isAuthenticated && (
                           <button 
                            onClick={(e) => { e.stopPropagation(); toggleItemLock('file', file.name, !!file.is_locked); }}
                            className={cn("p-1 rounded-md transition-colors", file.is_locked ? "text-neural-violet bg-neural-violet/10" : "text-white/20 hover:text-white/40")}
                           >
                            {file.is_locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                           </button>
                       )}
                       {!isLocked && (isSelected ? <CheckSquare className="w-4 h-4 text-quantum-cyan" /> : <Square className="w-4 h-4 text-white/5 group-hover:text-white/20 transition-colors" />)}
                       {isLocked && <Lock className="w-5 h-5 text-neural-violet/40 animate-pulse" />}
                    </div>
                  </div>

                  <div className="space-y-[clamp(0.5rem,0.7vh,0.75rem)]">
                    <div className="space-y-0.5">
                      <h3 className={cn(
                        "font-semibold truncate text-[clamp(0.8rem,1vw,0.9rem)] text-white/80 tracking-tight",
                        isLocked && "blur-sm select-none"
                      )} title={file.name}>
                        {file.name}
                      </h3>
                      <p className="text-[clamp(0.5rem,0.65vw,0.6rem)] text-white/20 font-bold uppercase tracking-widest">{file.size} MB</p>
                    </div>

                    <div className="flex items-center justify-between pt-[clamp(0.5rem,0.7vh,0.75rem)] border-t border-white/5">
                      <div className={cn("text-[clamp(0.45rem,0.55vw,0.5rem)] uppercase tracking-[0.2em] font-bold", getLifecycleColor(file))}>
                        {file.expired ? '已解離' : `剩餘 ${file.remaining_days} 週期`}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0">
                        {!isLocked && (
                          <>
                            <button 
                            onClick={(e) => { e.stopPropagation(); handleShare(file.name); }} 
                            aria-label={`分享 ${file.name}`}
                            className="p-1.5 text-white/60 hover:text-quantum-cyan transition-colors cursor-pointer rounded-md"
                            >
                            <Share2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            </button>
                            <a 
                            href={`/api/download/${data.user?.username}/${file.name}`} 
                            aria-label={`下載 ${file.name}`}
                            className="p-1.5 text-white/60 hover:text-quantum-cyan transition-colors cursor-pointer rounded-md"
                            >
                            <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            </a>
                            <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(file.name); }} 
                            aria-label={`移除 ${file.name}`}
                            className="p-1.5 text-white/60 hover:text-red-400 transition-colors cursor-pointer rounded-md"
                            >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </section>

      {/* URLs Section - Compact layout */}
      <section className="space-y-4 relative z-10">
        <h2 className="text-[clamp(1.1rem,1.8vw,1.6rem)] font-bold flex items-center gap-3 text-stellar-white/80 tracking-tight">
          <div className="p-2 sm:p-2.5 bg-neural-violet/5 rounded-xl border border-neural-violet/10 shrink-0">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-neural-violet" />
          </div>
          神經連結
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-[clamp(0.5rem,1.2vw,1.25rem)]">
          {data.urls?.map((url, idx) => {
            const isLocked = url.is_locked && !isAuthenticated;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="glass-card p-[clamp(0.75rem,1.5vw,1.25rem)] flex items-center justify-between group hover:bg-white/5 transition-all border-white/5 hover:border-neural-violet/20"
              >
                <div className="flex-1 min-w-0 pr-4 space-y-0.5">
                  <a 
                    href={isLocked ? "#" : url.url} 
                    target={isLocked ? "_self" : "_blank"} 
                    rel="noopener noreferrer"
                    onClick={(e) => isLocked && e.preventDefault()}
                    className={cn(
                        "block font-semibold truncate transition-colors tracking-tight text-[clamp(0.7rem,0.9vw,0.8rem)]",
                        !isLocked && "text-neural-violet/70 hover:text-neural-violet",
                        isLocked && "text-white/10 blur-sm cursor-not-allowed"
                    )}
                  >
                    {url.url}
                  </a>
                  <p className="text-[clamp(0.45rem,0.6vw,0.55rem)] text-white/20 uppercase tracking-widest font-bold">同步於 {url.created}</p>
                </div>
                <div className="flex gap-2">
                  {isAuthenticated && (
                     <button 
                        onClick={() => toggleItemLock('url', url.url, !!url.is_locked)}
                        className={cn("p-2 rounded-lg transition-all cursor-pointer border border-white/5", url.is_locked ? "text-neural-violet bg-neural-violet/10" : "text-white/10 hover:text-white/20")}
                      >
                        {url.is_locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                  )}
                  {!isLocked && (
                    <>
                      <button 
                        onClick={() => setQrUrl(url.url)}
                        aria-label={`顯示 ${url.url} 的 QR Code`}
                        className="p-2 bg-white/5 rounded-lg text-white/20 group-hover:text-quantum-cyan hover:bg-quantum-cyan/10 transition-all cursor-pointer border border-white/5 shadow-lg"
                      >
                        <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
                      </button>
                      <a 
                        href={url.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`開啟連結 ${url.url}`}
                        className="p-2 bg-white/5 rounded-lg text-white/20 group-hover:text-neural-violet hover:bg-neural-violet/10 transition-all cursor-pointer border border-white/5 shadow-lg"
                      >
                        <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
                      </a>
                    </>
                  )}
                  {isLocked && <Lock className="w-4 h-4 text-neural-violet/20" />}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-120 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuthModal(false)}
              className="absolute inset-0 bg-space-black/90 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="glass-card p-8 w-full max-w-sm relative z-10 space-y-6 border-neural-violet/30"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-neural-violet/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-neural-violet/20">
                  <ShieldCheck className="w-6 h-6 text-neural-violet animate-pulse" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">存取授權請求</h3>
                <p className="text-white/30 text-[10px] uppercase font-black tracking-[0.2em]">輸入觀測站認證密鑰以解鎖矩陣</p>
              </div>

              <form onSubmit={(e) => { 
                e.preventDefault(); 
                const target = e.target as typeof e.target & {
                  pwd: { value: string };
                };
                handleUnlock(target.pwd.value); 
              }}>
                <input 
                  name="pwd"
                  type="password" 
                  autoFocus
                  placeholder="授權密鑰..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 outline-none focus:border-neural-violet focus:bg-white/10 transition-all text-white text-center font-medium tracking-widest"
                />
                <button 
                  type="submit"
                  className="btn-stellar w-full mt-6 py-4 bg-neural-violet/20 border-neural-violet/40 text-neural-violet uppercase text-xs font-black tracking-[0.3em]"
                >
                  啟動協議驗證
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR Code Modal */}
      <AnimatePresence>
        {qrUrl && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQrUrl(null)}
              className="absolute inset-0 bg-space-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-card p-8 w-full max-w-sm relative z-10 text-center space-y-6 border-quantum-cyan/20"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-quantum-cyan">神經傳輸模組：QR_GATEWAY</span>
                <button onClick={() => setQrUrl(null)} className="text-white/40 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 bg-white rounded-3xl shadow-[0_0_30px_rgba(34,211,238,0.2)] inline-block">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrUrl)}`}
                  alt="Neural QR Link"
                  className="w-48 h-48 sm:w-64 sm:h-64"
                />
              </div>

              <div className="space-y-2">
                <p className="text-white font-bold tracking-tight truncate text-sm px-4">{qrUrl}</p>
                <p className="text-white/30 text-[10px] uppercase font-black tracking-widest">掃描以跨維度傳輸</p>
              </div>

              <button 
                onClick={() => setQrUrl(null)}
                className="btn-stellar w-full py-3 bg-quantum-cyan/10 border-quantum-cyan/30 text-quantum-cyan uppercase text-xs font-black tracking-widest"
              >
                關閉傳輸窗
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
