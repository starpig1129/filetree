import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  File, FileText, Image as ImageIcon, Music, Video, 
  ExternalLink, Download, Share2, Trash2, 
  ChevronLeft, Info, Lock, Unlock, CheckSquare, Square
} from 'lucide-react';
import { cn } from '../lib/utils';

interface FileItem {
  name: string;
  size: string;
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
    user: { username: string };
    usage: number;
    files: FileItem[];
    urls: UrlItem[];
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

  const getLifecycleColor = (file: FileItem) => {
    if (file.expired) return 'text-red-400';
    if (file.remaining_days < 5) return 'text-accent-amber';
    return 'text-accent-mint';
  };

  return (
    <div className="space-y-12">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <a href="/" className="group flex items-center gap-2 text-white/60 hover:text-accent-mint transition-colors cursor-pointer">
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          回到森林入口
        </a>
        
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 glass-card flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-accent-mint animate-pulse" />
            已使用空間：{data.usage} MB
          </div>
          <button 
            onClick={() => setIsLocked(!isLocked)}
            className="p-3 glass-card hover:bg-white/5 text-accent-mint transition-all cursor-pointer"
          >
            {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-12 text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-accent-mint to-transparent opacity-20" />
        <h1 className="text-4xl md:text-5xl font-heading mb-4">
          {data.user.username} 的臨時樹屋
        </h1>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full text-xs text-white/40">
          <Info className="w-4 h-4" />
          檔案種子將在 30 天後自動枯萎。網址種子則永久保存。
        </div>
      </motion.div>

      {/* Files Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-accent-mint/10 rounded-lg">
              <File className="w-6 h-6 text-accent-mint" />
            </div>
            檔案分支
          </h2>
          {selectedFiles.length > 0 && (
             <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               className="flex items-center gap-3"
             >
               <span className="text-sm text-white/40">已選擇 {selectedFiles.length} 個檔案</span>
               <button className="p-2 glass-card hover:bg-red-500/20 text-red-400 cursor-pointer">
                 <Trash2 className="w-5 h-5" />
               </button>
               <button className="p-2 glass-card hover:bg-accent-mint/20 text-accent-mint cursor-pointer">
                 <Download className="w-5 h-5" />
               </button>
             </motion.div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {data.files.map((file, idx) => {
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
                    "glass-card p-6 group cursor-pointer border-transparent transition-all hover:bg-white/5",
                    isSelected && "border-accent-mint/50 bg-accent-mint/5"
                  )}
                >
                  <div className="relative aspect-square flex items-center justify-center bg-white/5 rounded-2xl mb-6 overflow-hidden">
                    <Icon className="w-16 h-16 text-white/10 group-hover:text-accent-mint/40 transition-colors" />
                    <div className="absolute top-4 right-4">
                      {isSelected ? <CheckSquare className="w-5 h-5 text-accent-mint" /> : <Square className="w-5 h-5 text-white/10 group-hover:text-white/30" />}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="font-medium truncate text-white/80" title={file.name}>
                        {file.name}
                      </h3>
                      <p className="text-xs text-white/30">{file.size} MB</p>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <div className={cn("text-[10px] uppercase tracking-widest font-bold", getLifecycleColor(file))}>
                        {file.expired ? '已枯萎' : `剩餘 ${file.remaining_days} 天`}
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 hover:text-accent-mint cursor-pointer" title="分享"><Share2 className="w-4 h-4" /></button>
                        <button className="p-2 hover:text-accent-mint cursor-pointer" title="下載"><Download className="w-4 h-4" /></button>
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
      <section className="space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <div className="p-2 bg-accent-amber/10 rounded-lg">
            <ExternalLink className="w-6 h-6 text-accent-amber" />
          </div>
          網址藤蔓
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.urls.map((url, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card p-6 flex items-center justify-between group hover:bg-white/5 transition-all"
            >
              <div className="flex-1 min-w-0 pr-4 space-y-1">
                <a 
                  href={url.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block font-medium truncate text-accent-amber/80 hover:text-accent-amber transition-colors"
                >
                  {url.url}
                </a>
                <p className="text-[10px] text-white/20 uppercase tracking-tighter">種植於 {url.created}</p>
              </div>
              <div className="flex gap-2">
                <button className="p-3 bg-white/5 rounded-xl hover:text-accent-amber transition-all cursor-pointer">
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};
