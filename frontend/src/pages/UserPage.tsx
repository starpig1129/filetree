import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SecurityInitializationModal } from '../components/SecurityInitializationModal';
import {
  File, FileText, Image as ImageIcon, Music, Video,
  ExternalLink, Download, Share2, Trash2, Eye,
  Lock, Unlock, CheckSquare, Square,
  Cpu, Zap, Activity, ShieldCheck, Orbit, QrCode, X
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { cn } from '../lib/utils';
import { FilePreviewModal } from '../components/FilePreviewModal';

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
    user?: { username: string; is_locked?: boolean; first_login?: boolean };
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

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const UserPage: React.FC<UserPageProps> = ({ data }) => {
  const [dashboardData, setDashboardData] = useState(data);
  const [selectedItems, setSelectedItems] = useState<{ type: 'file' | 'url', id: string }[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ name: string, size: string, url: string } | null>(null);
  const [showForcedPasswordChange, setShowForcedPasswordChange] = useState(false);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);

  const refreshDashboard = React.useCallback(async (authToken: string) => {
    try {
      const res = await fetch(`/api/user/${data.user?.username}?token=${authToken}`);
      if (res.ok) {
        const newData = await res.json();
        setDashboardData(newData);
      }
    } catch (err) {
      console.error("Failed to refresh dashboard:", err);
    }
  }, [data.user?.username]);

  // Sync props to local state if they change (e.g. navigation)
  React.useEffect(() => {
    setDashboardData(data);
  }, [data]);

  // Real-time synchronization via WebSocket
  React.useEffect(() => {
    if (!dashboardData.user?.username) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/${dashboardData.user.username}`;
    let socket: WebSocket | null = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      if (event.data === "REFRESH") {
        refreshDashboard(token || "");
      }
    };

    socket.onclose = () => {
      // Small delay before reconnecting
      setTimeout(() => {
        socket = new WebSocket(wsUrl);
      }, 5000);
    };

    return () => {
      if (socket) socket.close();
    };
  }, [dashboardData.user?.username, token, refreshDashboard]);

  const toggleSelectItem = (type: 'file' | 'url', id: string) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.type === type && i.id === id);
      if (exists) {
        return prev.filter(i => !(i.type === type && i.id === id));
      } else {
        return [...prev, { type, id }];
      }
    });
  };

  const handleBatchAction = async (action: 'lock' | 'unlock' | 'delete') => {
    if (selectedItems.length === 0) return;
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    if (action === 'delete' && !confirm(`確定要批次刪除選中的 ${selectedItems.length} 個項目嗎？此操作不可恢復！`)) {
      return;
    }

    setIsBatchSyncing(true);
    try {
      // Group by type for simpler API handling (or we can update API to handle mixed types)
      // Our API currently handles one type at a time, so we'll do sequential or update it.
      // Let's assume we do it by dominant type or sequential for now.
      const files = selectedItems.filter(i => i.type === 'file').map(i => i.id);
      const urls = selectedItems.filter(i => i.type === 'url').map(i => i.id);

      const perform = async (type: 'file' | 'url', ids: string[]) => {
        if (ids.length === 0) return;
        return fetch(`/api/user/${dashboardData.user?.username}/batch-action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            password,
            item_type: type,
            item_ids: ids,
            action
          })
        });
      };

      // Optimistic UI Update
      setDashboardData(prev => ({
        ...prev,
        files: prev.files?.filter(f => !files.includes(f.name)),
        urls: prev.urls?.filter(u => !urls.includes(u.url))
      }));
      setSelectedItems([]);

      await Promise.all([perform('file', files), perform('url', urls)]);
    } catch (err) {
      console.error(err);
      alert("批次操作失敗，將重新整理頁面。");
      window.location.reload();
    } finally {
      setIsBatchSyncing(false);
    }
  };

  const handleUnlock = async (pwd: string) => {
    try {
      const res = await fetch(`/api/user/${data.user?.username}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd })
      });
      if (res.ok) {
        const result = await res.json();
        setIsAuthenticated(true);
        setPassword(pwd);
        if (result.token) {
          setToken(result.token);
          // Refresh data with token to see hidden files
          await refreshDashboard(result.token);
        }
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

    // Optimistic UI Update
    setDashboardData(prev => ({
      ...prev,
      files: prev.files?.filter(f => f.name !== filename)
    }));

    try {
      const body = new FormData();
      body.append('filename', filename);
      if (token) body.append('token', token);

      const res = await fetch(`/api/user/${data.user?.username}/delete`, {
        method: 'POST',
        body
      });
      if (!res.ok) {
        throw new Error("Delete failed");
      }
    } catch (err) {
      console.error(err);
      alert('移除失敗，將重新整理頁面');
      window.location.reload();
    }
  };

  const handleShare = async (filename: string) => {
    try {
      const body = new FormData();
      if (token) body.append('token', token);

      const res = await fetch(`/api/share/${data.user?.username}/${filename}`, {
        method: 'POST',
        body: token ? body : undefined
      });
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
    <div className="relative min-h-[calc(100vh-8rem)] space-y-[clamp(1.5rem,4vh,4rem)] overflow-hidden">

      {/* Background Ambient Elements */}
      <div className="absolute top-1/4 -right-20 w-[70vw] h-[50vh] max-w-240 max-h-180 bg-quantum-cyan/5 blur-[clamp(3rem,8vw,8rem)] rounded-full -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 -left-20 w-[60vw] h-[50vh] max-w-240 max-h-180 bg-neural-violet/5 blur-[clamp(3rem,8vw,8rem)] rounded-full -z-10 animate-pulse" style={{ animationDelay: '1s' }} />

      {/* Header Bar */}
      <div className="flex items-center justify-end gap-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="px-4 sm:px-5 py-2 glass-card flex items-center gap-2 sm:gap-3 text-[clamp(0.5rem,0.75vw,0.7rem)] tracking-widest uppercase font-black text-gray-500 dark:text-stellar-white/60 shadow-lg">
            <Activity className="w-4 h-4 text-cyan-600 dark:text-quantum-cyan animate-pulse shrink-0" aria-hidden="true" />
            已使用空間：{dashboardData.usage} MB
          </div>
          <button
            onClick={() => isAuthenticated ? setIsAuthenticated(false) : setShowAuthModal(true)}
            aria-label={isAuthenticated ? "鎖定目錄" : "解鎖目錄"}
            className={cn(
              "p-2 sm:p-2.5 glass-card transition-all cursor-pointer border-gray-200 dark:border-white/5 focus-ring shadow-lg",
              isAuthenticated ? "text-cyan-600 dark:text-quantum-cyan hover:bg-cyan-50 dark:hover:bg-quantum-cyan/10" : "text-violet-500 dark:text-neural-violet hover:bg-violet-50 dark:hover:bg-neural-violet/10"
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
        <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-cyan-500 dark:via-quantum-cyan to-transparent opacity-50" />
        <div className="flex flex-col md:flex-row items-center justify-center gap-[clamp(0.5rem,1.5vw,1.25rem)] mb-[clamp(0.75rem,1.5vh,1.5rem)]">
          <Orbit className="w-[clamp(1.25rem,3vw,2.25rem)] h-[clamp(1.25rem,3vw,2.25rem)] text-cyan-500 dark:text-quantum-cyan animate-spin-slow opacity-20 hidden md:block" />
          <h1 className="text-[clamp(1.5rem,4.5vw,3.5rem)] font-bold tracking-tight text-gray-900 dark:text-white/90 leading-tight">
            {dashboardData.user?.username} <span className="text-cyan-600 dark:text-quantum-cyan/80">個人目錄</span>
            <span className="text-[10px] opacity-10 ml-2 font-mono">v2.1.5-build</span>
          </h1>
          <Orbit className="w-[clamp(1.25rem,3vw,2.25rem)] h-[clamp(1.25rem,3vw,2.25rem)] text-cyan-500 dark:text-quantum-cyan animate-spin-slow opacity-20" />
        </div>
        <div className="inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2 bg-gray-100 dark:bg-white/5 rounded-full text-[clamp(0.45rem,0.7vw,0.6rem)] text-gray-500 dark:text-white/30 tracking-widest uppercase font-bold border border-gray-200 dark:border-white/5">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-600 dark:text-quantum-cyan shrink-0" />
          檔案 30 天後自動刪除，連結與筆記永久保留。
        </div>
      </motion.div>

      {/* Files Section - Compact grid gap */}
      <section className="space-y-[clamp(1rem,1.5vh,1.5rem)] relative z-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[clamp(1.1rem,1.8vw,1.6rem)] font-bold flex items-center gap-3 text-gray-800 dark:text-stellar-white/80 tracking-tight">
            <div className="p-2 sm:p-2.5 bg-cyan-50 dark:bg-quantum-cyan/5 rounded-xl border border-cyan-100 dark:border-quantum-cyan/10 shrink-0">
              <Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600 dark:text-quantum-cyan" />
            </div>
            檔案列表
          </h2>
          {selectedItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="flex items-center gap-2 shrink-0 bg-white dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm"
            >
              <button
                onClick={() => handleBatchAction('lock')}
                disabled={isBatchSyncing}
                className="p-2 hover:bg-violet-50 dark:hover:bg-neural-violet/20 text-violet-500 dark:text-neural-violet cursor-pointer transition-colors rounded-lg flex items-center gap-2"
                title="批次鎖定"
              >
                <Lock className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleBatchAction('unlock')}
                disabled={isBatchSyncing}
                className="p-2 hover:bg-cyan-50 dark:hover:bg-quantum-cyan/20 text-cyan-600 dark:text-quantum-cyan cursor-pointer transition-colors rounded-lg flex items-center gap-2"
                title="批次解鎖"
              >
                <Unlock className="w-4 h-4" />
              </button>
              <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />
              <button
                onClick={() => handleBatchAction('delete')}
                disabled={isBatchSyncing}
                className="p-2 hover:bg-red-50 dark:hover:bg-red-500/20 text-red-500 dark:text-red-400 cursor-pointer transition-colors rounded-lg flex items-center gap-2"
                title="批次刪除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-[clamp(0.75rem,1.5vw,1.5rem)]">
          <AnimatePresence>
            {dashboardData.files?.map((file, idx) => {
              const Icon = getFileIcon(file.name);
              const isSelected = !!selectedItems.find(i => i.type === 'file' && i.id === file.name);
              const isLocked = file.is_locked && !isAuthenticated;

              return (
                <motion.div
                  key={file.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "glass-card p-[clamp(1rem,1.5vw,1.25rem)] group cursor-pointer border-gray-200 dark:border-white/5 transition-all hover:bg-gray-50 dark:hover:bg-white/5 hover:border-cyan-200 dark:hover:border-quantum-cyan/20",
                    isSelected && "border-cyan-500 dark:border-quantum-cyan/50 bg-cyan-50 dark:bg-quantum-cyan/5",
                    isLocked && "opacity-80"
                  )}
                >
                  <div
                    onClick={(e) => {
                      if (!isLocked) {
                        e.stopPropagation();
                        setPreviewFile({
                          name: file.name,
                          size: formatSize(file.size_bytes),
                          url: `/api/download/${data.user?.username}/${encodeURIComponent(file.name)}${token ? `?token=${token}` : ''}`
                        });
                      }
                    }}
                    className="relative aspect-square flex items-center justify-center bg-gray-50 dark:bg-white/2 rounded-[clamp(1rem,1.5vw,1.5rem)] mb-[clamp(0.75rem,1vh,1.25rem)] overflow-hidden border border-gray-100 dark:border-white/5 group-hover:border-cyan-200 dark:group-hover:border-quantum-cyan/10 transition-colors"
                  >
                    {/* Thumbnail Preview Logic - Using extension check for robustness */}
                    {!isLocked && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(file.name.split('.').pop()?.toLowerCase() || '') ? (
                      <img
                        src={`/api/download/${data.user?.username}/${encodeURIComponent(file.name)}${token ? `?token=${token}` : ''}`}
                        alt={file.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                        onError={(e) => {
                          // Fallback to Icon if image fails to load
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Icon className={cn(
                        "w-[clamp(2rem,5vw,3rem)] h-[clamp(2rem,5vw,3rem)] text-gray-300 dark:text-white/5 transition-all duration-500",
                        !isLocked && "group-hover:text-cyan-400 dark:group-hover:text-quantum-cyan/30 group-hover:scale-110",
                        isLocked && "blur-xl"
                      )} />
                    )}

                    <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex flex-col gap-2">
                      {isAuthenticated && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleItemLock('file', file.name, !!file.is_locked); }}
                          className={cn("p-1 rounded-md transition-colors", file.is_locked ? "text-violet-500 dark:text-neural-violet bg-violet-50 dark:bg-neural-violet/10" : "text-gray-400 dark:text-white/20 hover:text-gray-600 dark:hover:text-white/40")}
                        >
                          {file.is_locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                      )}
                      {!isLocked && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSelectItem('file', file.name); }}
                          className="transition-transform active:scale-95"
                        >
                          {isSelected ? <CheckSquare className="w-4 h-4 text-cyan-600 dark:text-quantum-cyan" /> : <Square className="w-4 h-4 text-gray-300 dark:text-white/5 group-hover:text-gray-400 dark:group-hover:text-white/20 transition-colors" />}
                        </button>
                      )}
                      {isLocked && <Lock className="w-5 h-5 text-violet-300 dark:text-neural-violet/40 animate-pulse" />}
                    </div>
                  </div>

                  <div className="space-y-[clamp(0.5rem,0.7vh,0.75rem)]">
                    <div className="space-y-0.5">
                      <h3 className={cn(
                        "font-semibold truncate text-[clamp(0.8rem,1vw,0.9rem)] text-gray-800 dark:text-white/80 tracking-tight",
                        isLocked && "blur-sm select-none"
                      )} title={file.name}>
                        {file.name}
                      </h3>
                      <p className="text-[clamp(0.5rem,0.65vw,0.6rem)] text-gray-400 dark:text-white/20 font-bold uppercase tracking-widest">{file.size} MB</p>
                    </div>

                    <div className="flex items-center justify-between pt-[clamp(0.5rem,0.7vh,0.75rem)] border-t border-gray-100 dark:border-white/5">
                      <div className={cn("text-[clamp(0.45rem,0.55vw,0.5rem)] uppercase tracking-[0.2em] font-bold", getLifecycleColor(file))}>
                        {file.expired ? '已刪除' : `剩餘 ${file.remaining_days} 天`}
                      </div>
                      <div className="flex gap-1 opacity-40 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0">
                        {!isLocked && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); setPreviewFile({
                                  name: file.name,
                                  size: formatSize(file.size_bytes),
                                  url: `/api/download/${data.user?.username}/${encodeURIComponent(file.name)}${token ? `?token=${token}` : ''}`
                                });
                              }}
                              aria-label={`預覽 ${file.name}`}
                              className="p-1.5 text-gray-400 dark:text-white/60 hover:text-cyan-600 dark:hover:text-quantum-cyan transition-colors cursor-pointer rounded-md"
                            >
                              <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleShare(file.name); }}
                              aria-label={`分享 ${file.name}`}
                              className="p-1.5 text-gray-400 dark:text-white/60 hover:text-cyan-600 dark:hover:text-quantum-cyan transition-colors cursor-pointer rounded-md"
                            >
                              <Share2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            </button>
                            <a
                              href={`/api/download/${data.user?.username}/${file.name}${token ? `?token=${token}` : ''}`}
                              aria-label={`下載 ${file.name}`}
                              className="p-1.5 text-gray-400 dark:text-white/60 hover:text-cyan-600 dark:hover:text-quantum-cyan transition-colors cursor-pointer rounded-md"
                            >
                              <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            </a>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(file.name); }}
                              aria-label={`移除 ${file.name}`}
                              className="p-1.5 text-gray-400 dark:text-white/60 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer rounded-md"
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
        <h2 className="text-[clamp(1.1rem,1.8vw,1.6rem)] font-bold flex items-center gap-3 text-gray-800 dark:text-stellar-white/80 tracking-tight">
          <div className="p-2 sm:p-2.5 bg-violet-50 dark:bg-neural-violet/5 rounded-xl border border-violet-100 dark:border-neural-violet/10 shrink-0">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-violet-600 dark:text-neural-violet" />
          </div>
          筆記 / 連結
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-[clamp(0.5rem,1.2vw,1.25rem)]">
          {dashboardData.urls?.map((url, idx) => {
            const isLocked = url.is_locked && !isAuthenticated;
            const isSelected = !!selectedItems.find(i => i.type === 'url' && i.id === url.url);

            return (
              <motion.div
                key={`${url.url}-${idx}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={cn(
                  "glass-card p-[clamp(0.75rem,1.5vw,1.25rem)] flex items-center justify-between group hover:bg-gray-50 dark:hover:bg-white/5 transition-all border-gray-200 dark:border-white/5 hover:border-violet-200 dark:hover:border-neural-violet/20",
                  isSelected && "border-violet-400 dark:border-neural-violet/50 bg-violet-50 dark:bg-neural-violet/5"
                )}
              >
                <div className="flex-1 min-w-0 pr-4 space-y-0.5">
                  {(() => {
                    const isActualUrl = url.url.startsWith('http://') || url.url.startsWith('https://') || url.url.startsWith('www.');
                    const displayUrl = isActualUrl ? url.url : (url.url.length > 50 ? url.url.substring(0, 50) + '...' : url.url);

                    return isActualUrl ? (
                      <a
                        href={isLocked ? "#" : (url.url.startsWith('www.') ? `https://${url.url}` : url.url)}
                        target={isLocked ? "_self" : "_blank"}
                        rel="noopener noreferrer"
                        onClick={(e) => isLocked && e.preventDefault()}
                        className={cn(
                          "block font-semibold truncate transition-colors tracking-tight text-[clamp(0.7rem,0.9vw,0.8rem)]",
                          !isLocked && "text-violet-600 dark:text-neural-violet/70 hover:text-violet-700 dark:hover:text-neural-violet",
                          isLocked && "text-gray-300 dark:text-white/10 blur-sm cursor-not-allowed"
                        )}
                      >
                        {displayUrl}
                      </a>
                    ) : (
                      <div
                        className={cn(
                          "block font-semibold truncate transition-all tracking-tight text-[clamp(0.7rem,0.9vw,0.8rem)]",
                          !isLocked && "text-gray-700 dark:text-white/60",
                          isLocked && "text-gray-300 dark:text-white/5 blur-sm select-none"
                        )}
                        title={url.url}
                      >
                        {displayUrl}
                      </div>
                    );
                  })()}
                  <p className="text-[clamp(0.45rem,0.6vw,0.55rem)] text-gray-400 dark:text-white/20 uppercase tracking-widest font-bold">同步於 {url.created}</p>
                </div>
                <div className="flex gap-2">
                  {isAuthenticated && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleSelectItem('url', url.url)}
                        className="p-2 text-gray-300 dark:text-white/10 hover:text-gray-500 dark:hover:text-white/30 transition-colors"
                      >
                        {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-violet-600 dark:text-neural-violet" /> : <Square className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => toggleItemLock('url', url.url, !!url.is_locked)}
                        className={cn("p-2 rounded-lg transition-all cursor-pointer border border-gray-100 dark:border-white/5", url.is_locked ? "text-violet-600 dark:text-neural-violet bg-violet-50 dark:bg-neural-violet/10" : "text-gray-300 dark:text-white/10 hover:text-gray-500 dark:hover:text-white/20")}
                      >
                        {url.is_locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                  {!isLocked && (
                    <>
                      {(() => {
                        const isActualUrl = url.url.startsWith('http://') || url.url.startsWith('https://') || url.url.startsWith('www.');
                        return (
                          <>
                            <button
                              onClick={() => setQrUrl(url.url)}
                              aria-label={`顯示內容的 QR Code`}
                              className="p-2 bg-gray-50 dark:bg-white/5 rounded-lg text-gray-400 dark:text-white/20 group-hover:text-cyan-600 dark:group-hover:text-quantum-cyan hover:bg-cyan-50 dark:hover:bg-quantum-cyan/10 transition-all cursor-pointer border border-gray-200 dark:border-white/5 shadow-sm dark:shadow-lg"
                            >
                              <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
                            </button>
                            {isActualUrl && (
                              <a
                                href={url.url.startsWith('www.') ? `https://${url.url}` : url.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`開啟連結 ${url.url}`}
                                className="p-2 bg-gray-50 dark:bg-white/5 rounded-lg text-gray-400 dark:text-white/20 group-hover:text-violet-600 dark:group-hover:text-neural-violet hover:bg-violet-50 dark:hover:bg-neural-violet/10 transition-all cursor-pointer border border-gray-200 dark:border-white/5 shadow-sm dark:shadow-lg"
                              >
                                <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
                              </a>
                            )}
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(url.url);
                                alert("內容已複製到剪貼簿！");
                              }}
                              aria-label="複製內容"
                              className="p-2 bg-gray-50 dark:bg-white/5 rounded-lg text-gray-400 dark:text-white/20 group-hover:text-cyan-600 dark:group-hover:text-quantum-cyan hover:bg-cyan-50 dark:hover:bg-quantum-cyan/10 transition-all cursor-pointer border border-gray-200 dark:border-white/5 shadow-sm dark:shadow-lg"
                            >
                              <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => {
                                // Direct calling batch action logic for consistency + optimistic update
                                toggleSelectItem('url', url.url);
                                // We need to wait a tick for state to update? 
                                // Actually, standard setState is async. 
                                // Better to just call a dedicated single delete helper or manually invoke fetch.
                                // Let's manually invoke to avoid selection state complexity.

                                if (!isAuthenticated) { setShowAuthModal(true); return; }
                                if (!confirm("確定要刪除此連結/筆記嗎？")) return;

                                // Optimistic Update
                                setDashboardData(prev => ({
                                  ...prev,
                                  urls: prev.urls?.filter(u => u.url !== url.url)
                                }));

                                fetch(`/api/user/${dashboardData.user?.username}/batch-action`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    password,
                                    item_type: 'url',
                                    item_ids: [url.url],
                                    action: 'delete'
                                  })
                                }).then(res => {
                                  if (!res.ok) { alert("刪除失敗"); window.location.reload(); }
                                });
                              }}
                              aria-label="刪除"
                              className="p-2 bg-gray-50 dark:bg-white/5 rounded-lg text-gray-400 dark:text-white/20 group-hover:text-red-500 dark:group-hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all cursor-pointer border border-gray-200 dark:border-white/5 shadow-sm dark:shadow-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
                            </button>
                          </>
                        );
                      })()}
                    </>
                  )}
                  {isLocked && <Lock className="w-4 h-4 text-violet-300 dark:text-neural-violet/20" />}
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
              className="absolute inset-0 bg-white/80 dark:bg-space-black/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="glass-card p-8 w-full max-w-sm relative z-10 space-y-6 border-violet-200 dark:border-neural-violet/30 shadow-2xl"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-violet-50 dark:bg-neural-violet/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-violet-100 dark:border-neural-violet/20">
                  <ShieldCheck className="w-6 h-6 text-violet-600 dark:text-neural-violet animate-pulse" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">存取授權請求</h3>
                <p className="text-gray-500 dark:text-white/30 text-[10px] uppercase font-black tracking-[0.2em]">請輸入密碼解鎖目錄</p>
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
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-5 py-4 outline-none focus:border-violet-500 dark:focus:border-neural-violet focus:bg-white dark:focus:bg-white/10 transition-all text-gray-900 dark:text-white text-center font-medium tracking-widest placeholder:text-gray-400 dark:placeholder:text-white/20"
                />
                <button
                  type="submit"
                  className="btn-stellar w-full mt-6 py-4 bg-violet-50 dark:bg-neural-violet/20 border-violet-200 dark:border-neural-violet/40 text-violet-600 dark:text-neural-violet uppercase text-xs font-black tracking-[0.3em] hover:bg-violet-100 dark:hover:bg-neural-violet/30 transition-colors"
                >
                  解鎖
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
              className="absolute inset-0 bg-white/80 dark:bg-space-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-card p-8 w-full max-w-sm relative z-10 text-center space-y-6 border-cyan-200 dark:border-quantum-cyan/20 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-600 dark:text-quantum-cyan">神經傳輸模組：QR_GATEWAY</span>
                <button onClick={() => setQrUrl(null)} className="text-gray-400 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 bg-white rounded-3xl shadow-[0_0_30px_rgba(34,211,238,0.2)] inline-block">
                <QRCodeCanvas
                  value={qrUrl}
                  size={250}
                  level="H"
                  includeMargin={false}
                  imageSettings={{
                    src: "/favicon.svg",
                    x: undefined,
                    y: undefined,
                    height: 40,
                    width: 40,
                    excavate: true,
                  }}
                />
              </div>

              <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar px-4">
                <p className="text-gray-900 dark:text-white font-bold tracking-tight wrap-break-word text-xs leading-relaxed">{qrUrl}</p>
                <p className="text-gray-400 dark:text-white/30 text-[10px] uppercase font-black tracking-widest pt-2">掃描以獲取內容</p>
              </div>

              <button
                onClick={() => setQrUrl(null)}
                className="btn-stellar w-full py-3 bg-cyan-50 dark:bg-quantum-cyan/10 border-cyan-200 dark:border-quantum-cyan/30 text-cyan-600 dark:text-quantum-cyan uppercase text-xs font-black tracking-widest hover:bg-cyan-100 dark:hover:bg-quantum-cyan/20 transition-colors"
              >
                關閉視窗
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <SecurityInitializationModal
        isOpen={showForcedPasswordChange}
        username={dashboardData.user?.username || ""}
        oldPassword={password}
        onSuccess={async (newKey) => {
          alert("密碼更新成功！系統已進入高度安全模式。");
          setPassword(newKey);
          setShowForcedPasswordChange(false);
          await refreshDashboard(token || "");
        }}
      />

      {/* File Preview Modal */}
      <FilePreviewModal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        file={previewFile}
      />
    </div>
  );
};
