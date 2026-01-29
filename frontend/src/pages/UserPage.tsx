import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  File, FileText, Image as ImageIcon, Music, Video, 
  ExternalLink, Download, Share2, Trash2, 
  ChevronLeft, Lock, Unlock, CheckSquare, Square,
  Cpu, Zap, Activity, ShieldCheck, Orbit
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
}

interface UrlItem {
  url: string;
  created: string;
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
  const [isLocked, setIsLocked] = useState(false);

  const toggleSelect = (name: string) => {
    setSelectedFiles(prev => 
      prev.includes(name) ? prev.filter(f => f !== name) : [...prev, name]
    );
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
            onClick={() => setIsLocked(!isLocked)}
            aria-label={isLocked ? "解鎖存取" : "鎖定存取"}
            className="p-2 sm:p-2.5 glass-card hover:bg-white/5 text-neural-violet transition-all cursor-pointer border-white/5 focus-ring shadow-lg"
          >
            {isLocked ? <Lock className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" /> : <Unlock className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />}
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
              
              return (
                <motion.div
                  key={file.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => toggleSelect(file.name)}
                  className={cn(
                    "glass-card p-[clamp(1rem,1.5vw,1.25rem)] group cursor-pointer border-white/5 transition-all hover:bg-white/5 hover:border-quantum-cyan/20",
                    isSelected && "border-quantum-cyan/50 bg-quantum-cyan/5"
                  )}
                >
                  <div className="relative aspect-square flex items-center justify-center bg-white/2 rounded-[clamp(1rem,1.5vw,1.5rem)] mb-[clamp(0.75rem,1vh,1.25rem)] overflow-hidden border border-white/5 group-hover:border-quantum-cyan/10 transition-colors">
                    <Icon className="w-[clamp(2rem,5vw,3rem)] h-[clamp(2rem,5vw,3rem)] text-white/5 group-hover:text-quantum-cyan/30 transition-all duration-500 group-hover:scale-110" />
                    <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
                      {isSelected ? <CheckSquare className="w-4 h-4 text-quantum-cyan" /> : <Square className="w-4 h-4 text-white/5 group-hover:text-white/20 transition-colors" />}
                    </div>
                  </div>

                  <div className="space-y-[clamp(0.5rem,0.7vh,0.75rem)]">
                    <div className="space-y-0.5">
                      <h3 className="font-semibold truncate text-[clamp(0.8rem,1vw,0.9rem)] text-white/80 tracking-tight" title={file.name}>
                        {file.name}
                      </h3>
                      <p className="text-[clamp(0.5rem,0.65vw,0.6rem)] text-white/20 font-bold uppercase tracking-widest">{file.size} MB</p>
                    </div>

                    <div className="flex items-center justify-between pt-[clamp(0.5rem,0.7vh,0.75rem)] border-t border-white/5">
                      <div className={cn("text-[clamp(0.45rem,0.55vw,0.5rem)] uppercase tracking-[0.2em] font-bold", getLifecycleColor(file))}>
                        {file.expired ? '已解離' : `剩餘 ${file.remaining_days} 週期`}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0">
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
          {data.urls?.map((url, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card p-[clamp(0.75rem,1.5vw,1.25rem)] flex items-center justify-between group hover:bg-white/5 transition-all border-white/5 hover:border-neural-violet/20"
            >
              <div className="flex-1 min-w-0 pr-4 space-y-0.5">
                <a 
                  href={url.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block font-semibold truncate text-neural-violet/70 hover:text-neural-violet transition-colors tracking-tight text-[clamp(0.7rem,0.9vw,0.8rem)]"
                >
                  {url.url}
                </a>
                <p className="text-[clamp(0.45rem,0.6vw,0.55rem)] text-white/20 uppercase tracking-widest font-bold">同步於 {url.created}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  aria-label={`開啟連結 ${url.url}`}
                  className="p-2 bg-white/5 rounded-lg text-white/20 group-hover:text-neural-violet hover:bg-neural-violet/10 transition-all cursor-pointer border border-white/5 focus-ring shadow-lg"
                >
                  <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};
