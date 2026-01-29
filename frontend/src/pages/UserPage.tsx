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
    <div className="relative min-h-screen p-4 md:p-8 space-y-12">
      <Starfield />
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
        <a href="/" className="group flex items-center gap-2 text-white/40 hover:text-quantum-cyan transition-colors cursor-pointer text-sm font-medium tracking-widest uppercase">
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          回歸核心樞紐
        </a>
        
        <div className="flex items-center gap-4">
          <div className="px-6 py-3 glass-card flex items-center gap-3 text-xs tracking-widest uppercase font-bold text-stellar-white/60">
            <Activity className="w-4 h-4 text-quantum-cyan animate-pulse" aria-hidden="true" />
            核心載荷：{data.usage} MB
          </div>
          <button 
            onClick={() => setIsLocked(!isLocked)}
            aria-label={isLocked ? "解鎖存取" : "鎖定存取"}
            className="p-3 glass-card hover:bg-white/5 text-neural-violet transition-all cursor-pointer border-white/5 focus-ring"
          >
            {isLocked ? <Lock className="w-5 h-5" aria-hidden="true" /> : <Unlock className="w-5 h-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-12 text-center relative overflow-hidden group z-10"
      >
        <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-quantum-cyan to-transparent opacity-50" />
        <div className="flex items-center justify-center gap-4 mb-4">
          <Orbit className="w-8 h-8 text-quantum-cyan animate-spin-slow opacity-20" />
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white/90">
            {data.user?.username} <span className="text-quantum-cyan/80">觀測站</span>
          </h1>
          <Orbit className="w-8 h-8 text-quantum-cyan animate-spin-slow opacity-20" />
        </div>
        <div className="inline-flex items-center gap-3 px-5 py-2 bg-white/5 rounded-full text-[10px] text-white/30 tracking-[0.2em] uppercase font-bold">
          <ShieldCheck className="w-4 h-4 text-quantum-cyan" />
          實體核心將在 30 週期後自動解離。神經連結則永久保留。
        </div>
      </motion.div>

      {/* Files Section */}
      <section className="space-y-6 relative z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-4 text-stellar-white/80 tracking-tight">
            <div className="p-3 bg-quantum-cyan/5 rounded-2xl border border-quantum-cyan/10">
              <Cpu className="w-6 h-6 text-quantum-cyan" />
            </div>
            數據扇區
          </h2>
          {selectedFiles.length > 0 && (
             <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               className="flex items-center gap-3"
             >
               <span className="text-xs text-white/30 uppercase tracking-widest">已鎖定 {selectedFiles.length} 節點</span>
               <button 
                 aria-label="備份選擇的節點"
                 className="p-2 glass-card hover:bg-quantum-cyan/20 text-quantum-cyan cursor-pointer border-white/5 transition-colors focus-ring"
               >
                 <Download className="w-5 h-5" aria-hidden="true" />
               </button>
               <button 
                 aria-label="移除選擇的節點"
                 className="p-2 glass-card hover:bg-red-500/20 text-red-400 cursor-pointer border-white/5 transition-colors focus-ring"
               >
                 <Trash2 className="w-5 h-5" aria-hidden="true" />
               </button>
             </motion.div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                    "glass-card p-6 group cursor-pointer border-white/5 transition-all hover:bg-white/5 hover:border-quantum-cyan/20",
                    isSelected && "border-quantum-cyan/50 bg-quantum-cyan/5"
                  )}
                >
                  <div className="relative aspect-square flex items-center justify-center bg-white/2 rounded-3xl mb-6 overflow-hidden border border-white/5 group-hover:border-quantum-cyan/10 transition-colors">
                    <Icon className="w-16 h-16 text-white/5 group-hover:text-quantum-cyan/30 transition-all duration-500 group-hover:scale-110" />
                    <div className="absolute top-4 right-4">
                      {isSelected ? <CheckSquare className="w-5 h-5 text-quantum-cyan" /> : <Square className="w-5 h-5 text-white/5 group-hover:text-white/20 transition-colors" />}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="font-semibold truncate text-white/80 tracking-tight" title={file.name}>
                        {file.name}
                      </h3>
                      <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">{file.size} MB</p>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <div className={cn("text-[9px] uppercase tracking-[0.2em] font-bold", getLifecycleColor(file))}>
                        {file.expired ? '已解離' : `剩餘 ${file.remaining_days} 週期`}
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleShare(file.name); }} 
                          aria-label={`分享 ${file.name}`}
                          className="p-2 text-white/20 hover:text-quantum-cyan transition-colors cursor-pointer focus-ring rounded-lg"
                        >
                          <Share2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <a 
                          href={`/api/download/${data.user?.username}/${file.name}`} 
                          aria-label={`下載 ${file.name}`}
                          className="p-2 text-white/20 hover:text-quantum-cyan transition-colors cursor-pointer focus-ring rounded-lg"
                        >
                          <Download className="w-4 h-4" aria-hidden="true" />
                        </a>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(file.name); }} 
                          aria-label={`移除 ${file.name}`}
                          className="p-2 text-white/20 hover:text-red-400 transition-colors cursor-pointer focus-ring rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
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

      {/* URLs Section */}
      <section className="space-y-6 relative z-10">
        <h2 className="text-2xl font-bold flex items-center gap-4 text-stellar-white/80 tracking-tight">
          <div className="p-3 bg-neural-violet/5 rounded-2xl border border-neural-violet/10">
            <Zap className="w-6 h-6 text-neural-violet" />
          </div>
          神經連結
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.urls?.map((url, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card p-6 flex items-center justify-between group hover:bg-white/5 transition-all border-white/5 hover:border-neural-violet/20"
            >
              <div className="flex-1 min-w-0 pr-4 space-y-1">
                <a 
                  href={url.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block font-semibold truncate text-neural-violet/70 hover:text-neural-violet transition-colors tracking-tight text-sm"
                >
                  {url.url}
                </a>
                <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">同步於 {url.created}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  aria-label={`開啟連結 ${url.url}`}
                  className="p-3 bg-white/5 rounded-xl text-white/20 group-hover:text-neural-violet hover:bg-neural-violet/10 transition-all cursor-pointer border border-white/5 focus-ring"
                >
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};
