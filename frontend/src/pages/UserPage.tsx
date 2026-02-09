import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SecurityInitializationModal } from '../components/SecurityInitializationModal';
import {
  Lock, Unlock,
  Cpu, Zap, Activity, X, Settings
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '../lib/utils';
import { FilePreviewModal } from '../components/FilePreviewModal';
import { FileView } from '../components/dashboard/FileView';
import type { FileItem } from '../components/dashboard/FileView';
import { UrlView } from '../components/dashboard/UrlView';
import type { UrlItem } from '../components/dashboard/UrlView';

interface UserPageProps {
  data: {
    user?: { username: string; is_locked?: boolean; first_login?: boolean; show_in_list?: boolean };
    usage?: number;
    files?: FileItem[];
    urls?: UrlItem[];
    error?: string;
  };
}

export const UserPage: React.FC<UserPageProps> = ({ data }) => {
  const [dashboardData, setDashboardData] = useState(data);
  const [selectedItems, setSelectedItems] = useState<{ type: 'file' | 'url', id: string }[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ name: string, size: string, url: string } | null>(null);
  const [showForcedPasswordChange, setShowForcedPasswordChange] = useState(false);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'files' | 'urls'>('files');

  const refreshDashboard = React.useCallback(async (authToken: string) => {
    try {
      const res = await fetch(`/api/user/${data.user?.username}?token=${authToken}&t=${Date.now()}`);
      if (res.ok) {
        const newData = await res.json();
        setDashboardData(newData);
      }
    } catch (err) {
      console.error("Failed to refresh dashboard:", err);
    }
  }, [data.user?.username]);

  // Sync props to local state if they change (e.g. navigation), 
  // but be careful not to overwrite valid local updates with stale props
  // We only update if the username or basic structure changed, or if it's the first load
  React.useEffect(() => {
    if (data.user?.username !== dashboardData.user?.username) {
       setDashboardData(data);
    }
  }, [data, dashboardData.user?.username]);

  // Real-time synchronization via WebSocket
  React.useEffect(() => {
    if (!data.user?.username) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/${data.user.username}`;
    let socket: WebSocket | null = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      if (event.data === "REFRESH") {
        refreshDashboard(token || "");
      }
    };

    return () => {
      if (socket) {
        socket.close();
        socket = null;
      }
    };
  }, [data.user?.username, token, refreshDashboard]);

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
      alert("批次操作失敗，正在重新載入資料。");
      await refreshDashboard(token || "");
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

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    handleUnlock(password);
  };

  const toggleItemLock = async (type: 'file' | 'url', itemId: string, currentStatus: boolean) => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    // Optimistic UI update to avoid page reload
    const newLockStatus = !currentStatus;
    if (type === 'file') {
      setDashboardData(prev => ({
        ...prev,
        files: prev.files?.map(f => f.name === itemId ? { ...f, is_locked: newLockStatus } : f)
      }));
    } else {
      setDashboardData(prev => ({
        ...prev,
        urls: prev.urls?.map(u => u.url === itemId ? { ...u, is_locked: newLockStatus } : u)
      }));
    }

    try {
      const res = await fetch(`/api/user/${data.user?.username}/toggle-lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          item_type: type,
          item_id: itemId,
          is_locked: newLockStatus
        })
      });
      if (!res.ok) {
        // Revert optimistic update on failure
        alert("更新鎖定狀態失敗。");
        await refreshDashboard(token || "");
      }
    } catch (err) {
      console.error(err);
      // Revert optimistic update on error
      await refreshDashboard(token || "");
    }
  };

  const handleDelete = async (filename: string) => {
    // Require authentication before deletion
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    if (!confirm(`確定要移除「${filename}」嗎？`)) return;

    // Optimistic UI Update
    setDashboardData(prev => ({
      ...prev,
      files: prev.files?.filter(f => f.name !== filename)
    }));

    try {
      const res = await fetch(`/api/user/${data.user?.username}/batch-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          item_type: 'file',
          item_ids: [filename],
          action: 'delete'
        })
      });
      if (!res.ok) throw new Error("Delete failed");
    } catch (err) {
      console.error(err);
      alert('移除失敗，正在重新載入資料');
      await refreshDashboard(token || "");
    }
  };

  const handleUrlDelete = async (url: string) => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    if (!confirm(`確定要移除「${url}」嗎？`)) return;

    setDashboardData(prev => ({
      ...prev,
      urls: prev.urls?.filter(u => u.url !== url)
    }));

    try {
      const res = await fetch(`/api/user/${data.user?.username}/batch-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          item_type: 'url',
          item_ids: [url],
          action: 'delete'
        })
      });
      if (!res.ok) throw new Error("Delete failed");
    } catch (err) {
      console.error(err);
      alert('移除失敗，正在重新載入資料');
      await refreshDashboard(token || "");
    }
  };

  const handleRename = async (oldName: string, newName: string): Promise<boolean> => {
    if (!isAuthenticated) {
        setShowAuthModal(true);
        return false;
    }

    try {
        const body = new FormData();
        body.append('password', password);
        body.append('old_name', oldName);
        body.append('new_name', newName);

        const res = await fetch(`/api/user/${data.user?.username}/rename-file`, {
            method: 'POST',
            body
        });

        if (res.ok) {
            // Optimistic update
            setDashboardData(prev => ({
                ...prev,
                files: prev.files?.map(f => f.name === oldName ? { ...f, name: newName } : f)
            }));
            return true;
        } else {
            const err = await res.json();
            alert(err.detail || "重新命名失敗");
            return false;
        }
    } catch (e) {
        console.error(e);
        alert("系統錯誤");
        return false;
    }
  };

  const handleUpdateProfile = async (showInList: boolean) => {
      if (!isAuthenticated) return;
      try {
          const body = new FormData();
          body.append('username', data.user?.username || '');
          body.append('password', password);
          body.append('show_in_list', String(showInList));
          
          const res = await fetch('/api/user/update-profile', {
              method: 'POST',
              body
          });
          
          if (res.ok) {
              setDashboardData(prev => ({
                  ...prev,
                  user: { ...prev.user!, show_in_list: showInList }
              }));
          } else {
              alert('更新失敗');
          }
      } catch {
          alert('連線錯誤');
      }
  };

  const handleShare = async (filename: string) => {
    try {
      const body = new FormData();
      if (token) body.append('token', token);

      // Safari requires clipboard write to be in the same user gesture context.
      // Using ClipboardItem with a blob promise allows us to "reserve" the
      // clipboard write permission before the async fetch completes.
      let copySuccess = false;
      let shareUrlResult: string | null = null;

      // Check if ClipboardItem is supported (Safari 13.1+, Chrome 76+)
      const supportsClipboardItem = typeof ClipboardItem !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.write === 'function';

      if (supportsClipboardItem) {
        // Create a promise that will resolve with the share URL after fetch
        const textPromise = (async () => {
          const res = await fetch(`/api/share/${data.user?.username}/${encodeURIComponent(filename)}`, {
            method: 'POST',
            body
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.detail || '未知錯誤');
          }

          const result = await res.json();
          shareUrlResult = `${window.location.origin}/api/download-shared/${result.token}`;
          return new Blob([shareUrlResult], { type: 'text/plain' });
        })();

        try {
          // This must be called synchronously in the user gesture context
          await navigator.clipboard.write([
            new ClipboardItem({ 'text/plain': textPromise })
          ]);
          copySuccess = true;
        } catch (clipboardErr) {
          console.log('ClipboardItem write failed:', clipboardErr);
          // If ClipboardItem failed but we got the URL, try fallback
          if (shareUrlResult) {
            copySuccess = false; // Will try fallback below
          } else {
            // Need to fetch the URL separately for fallback
            const res = await fetch(`/api/share/${data.user?.username}/${encodeURIComponent(filename)}`, {
              method: 'POST',
              body
            });
            if (!res.ok) {
              const errorData = await res.json().catch(() => ({}));
              alert(`分享失敗：${errorData.detail || '未知錯誤'}`);
              return;
            }
            const result = await res.json();
            shareUrlResult = `${window.location.origin}/api/download-shared/${result.token}`;
          }
        }
      } else {
        // Older browser path - fetch first, then try clipboard
        const res = await fetch(`/api/share/${data.user?.username}/${encodeURIComponent(filename)}`, {
          method: 'POST',
          body
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          alert(`分享失敗：${errorData.detail || '未知錯誤'}`);
          return;
        }

        const result = await res.json();
        shareUrlResult = `${window.location.origin}/api/download-shared/${result.token}`;

        // Try async clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
          try {
            await navigator.clipboard.writeText(shareUrlResult);
            copySuccess = true;
          } catch {
            console.log('Async clipboard failed, trying fallback');
          }
        }
      }

      // Fallback for older browsers or when clipboard APIs fail
      if (!copySuccess && shareUrlResult) {
        try {
          const textarea = document.createElement('textarea');
          textarea.value = shareUrlResult;
          textarea.style.position = 'fixed';
          textarea.style.left = '0';
          textarea.style.top = '0';
          textarea.style.opacity = '0';
          textarea.setAttribute('readonly', '');
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          copySuccess = document.execCommand('copy');
          document.body.removeChild(textarea);
        } catch {
          console.log('Fallback clipboard also failed');
        }
      }

      if (copySuccess) {
        alert('分享連結已複製到剪貼簿！');
      } else if (shareUrlResult) {
        // Show dialog for manual copy
        setShareUrl(shareUrlResult);
      } else {
        alert('分享功能發生錯誤，請稍後再試。');
      }
    } catch (err) {
      console.error(err);
      alert('分享功能發生錯誤，請稍後再試。');
    }
  };


  return (
    <div className="h-full flex flex-col relative text-gray-900 dark:text-gray-100 font-sans selection:bg-cyan-500/30">
      
      {/* Background Ambient Elements - Contained to avoid overflow issues */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-[20%] -right-[10%] w-[70vw] h-[70vw] bg-radial-gradient from-quantum-cyan/10 to-transparent blur-[5rem] opacity-60 dark:opacity-40 animate-pulse-slow" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[60vw] h-[60vw] bg-radial-gradient from-neural-violet/10 to-transparent blur-[5rem] opacity-60 dark:opacity-40 animate-pulse-slow delay-1000" />
      </div>

      {/* Top App Bar - Compact & Functional */}
      <header className="shrink-0 px-4 pt-16 pb-3 lg:px-8 lg:py-5 flex flex-col gap-4 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 lg:gap-4 group cursor-default">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="p-2 sm:p-2.5 bg-white/80 dark:bg-white/5 backdrop-blur-xl rounded-xl border border-white/20 shadow-lg relative">
              <div className="text-cyan-600 dark:text-quantum-cyan font-bold">FN</div>
              </div>
            </div>
              <div>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
                {dashboardData.user?.username}
                <span className="text-cyan-600 dark:text-quantum-cyan opacity-80 font-light hidden sm:inline">FileNexus</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Usage Pill */}
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/60 dark:bg-black/20 backdrop-blur-md rounded-full border border-gray-200 dark:border-white/10 shadow-sm">
              <Activity className="w-3.5 h-3.5 text-cyan-500 animate-pulse" />
              <span className="text-xs font-bold text-gray-600 dark:text-gray-300 tracking-wide">
                {dashboardData.usage} <span className="opacity-60">MB USED</span>
              </span>
            </div>

            <div className="h-8 w-px bg-gray-200 dark:bg-white/10 hidden sm:block" />

            {/* Auth/Lock Button */}
            <button
              onClick={() => isAuthenticated ? setIsAuthenticated(false) : setShowAuthModal(true)}
              className={cn(
                "p-2.5 sm:px-5 sm:py-2.5 rounded-xl flex items-center gap-2 transition-all duration-300 font-bold text-sm shadow-lg backdrop-blur-md border",
                isAuthenticated 
                  ? "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border-cyan-500/20" 
                  : "bg-white/80 dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10"
              )}
              title={isAuthenticated ? "鎖定工作階段" : "解鎖隱私內容"}
            >
              {isAuthenticated ? (
                <>
                  <Unlock className="w-5 h-5" />
                  <span className="hidden sm:inline">UNLOCKED</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span className="hidden sm:inline">LOCKED</span>
                </>
              )}
            </button>

            {/* Settings Button */}
            <button
              onClick={() => isAuthenticated ? setShowSettingsModal(true) : setShowAuthModal(true)}
              className="p-2.5 rounded-xl bg-white/80 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-lg hover:bg-gray-50 dark:hover:bg-white/10 transition-all"
              title="使用者設定"
            >
              <Settings className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('files')}
              className={cn(
                "px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 relative overflow-hidden",
                activeTab === 'files' 
                  ? "bg-white dark:bg-white/10 text-cyan-600 dark:text-quantum-cyan shadow-lg shadow-cyan-500/10 ring-1 ring-black/5 dark:ring-white/10" 
                  : "text-gray-500 dark:text-gray-400 hover:bg-white/40 dark:hover:bg-white/5"
              )}
            >
              <Cpu className="w-4 h-4" />
              檔案列表
              {activeTab === 'files' && (
                <motion.div layoutId="activeTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('urls')}
              className={cn(
                "px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 relative overflow-hidden",
                activeTab === 'urls' 
                  ? "bg-white dark:bg-white/10 text-violet-600 dark:text-violet-400 shadow-lg shadow-violet-500/10 ring-1 ring-black/5 dark:ring-white/10" 
                  : "text-gray-500 dark:text-gray-400 hover:bg-white/40 dark:hover:bg-white/5"
              )}
            >
              <Zap className="w-4 h-4" />
              筆記 / 連結
              {activeTab === 'urls' && (
                <motion.div layoutId="activeTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500" />
              )}
            </button>
        </div>
      </header>

      {/* Main Content Area - Conditional Rendering */}
      <main className="flex-1 min-h-0 px-2 pb-2 lg:px-6 lg:pb-6 relative z-10 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'files' ? (
            <motion.div 
              key="files"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full"
            >
              <FileView 
                files={dashboardData.files || []}
                username={dashboardData.user?.username || ''}
                token={token}
                selectedItems={selectedItems}
                isAuthenticated={isAuthenticated}
                isBatchSyncing={isBatchSyncing}
                onToggleSelect={toggleSelectItem}
                onToggleLock={toggleItemLock}
                onBatchAction={handleBatchAction}
                onPreview={(file) => setPreviewFile(file)}
                onShare={handleShare}
                onDelete={handleDelete}
                onRename={handleRename}
              />
            </motion.div>
          ) : (
            <motion.div 
              key="urls"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full"
            >
              <UrlView
                urls={dashboardData.urls || []}
                selectedItems={selectedItems}
                isAuthenticated={isAuthenticated}
                onToggleSelect={toggleSelectItem}
                onToggleLock={toggleItemLock}
                onQrCode={setQrUrl}
                onDelete={handleUrlDelete}
                onCopy={(url) => { navigator.clipboard?.writeText(url).then(() => alert("已複製！")); }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-white dark:bg-space-black border border-gray-200 dark:border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-cyan-500 to-violet-500" />
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-cyan-600 dark:text-quantum-cyan" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">身分驗證</h2>
                <p className="text-gray-500 dark:text-gray-400">請輸入密碼以解鎖隱私內容</p>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="輸入密碼..."
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-hidden transition-all text-center text-lg tracking-widest"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(false)}
                    className="px-4 py-3 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    解鎖
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Code Modal target */}
      <AnimatePresence>
        {qrUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setQrUrl(null)}
          >
            <motion.div
              initial={{ scale: 0.5, rotateY: 90 }}
              animate={{ scale: 1, rotateY: 0 }}
              exit={{ scale: 0.5, rotateY: 90 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white p-8 rounded-3xl shadow-2xl relative max-w-sm w-full text-center"
            >
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-1">掃描 QR Code</h3>
                <p className="text-sm text-gray-500 break-all line-clamp-2">{qrUrl}</p>
              </div>
              
              <div className="bg-white p-2 rounded-xl border-2 border-dashed border-gray-200 inline-block mb-6">
                 <QRCodeSVG value={qrUrl} size={200} />
              </div>

              <div className="flex gap-3">
                 <button
                   onClick={() => setQrUrl(null)}
                   className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                 >
                   關閉
                 </button>
                 <button
                   onClick={() => { navigator.clipboard.writeText(qrUrl); alert("連結已複製"); setQrUrl(null); }}
                   className="flex-1 py-3 bg-cyan-600 text-white font-bold rounded-xl hover:bg-cyan-500 shadow-lg shadow-cyan-500/30 transition-colors"
                 >
                   複製連結
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share URL Dialog for Mobile */}
      <AnimatePresence>
        {shareUrl && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShareUrl(null)}
              className="absolute inset-0 bg-white/80 dark:bg-space-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-card p-6 w-full max-w-md relative z-10 text-center space-y-4 border-cyan-200 dark:border-quantum-cyan/20 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-600 dark:text-quantum-cyan">分享連結</span>
                <button onClick={() => setShareUrl(null)} className="text-gray-400 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-gray-500 dark:text-white/40 text-xs">自動複製失敗，請長按下方連結手動複製</p>

              <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                <p
                  className="text-gray-900 dark:text-white font-mono text-xs break-all select-all leading-relaxed"
                  style={{ userSelect: 'all', WebkitUserSelect: 'all' }}
                >
                  {shareUrl}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // Try one more time with user gesture
                    navigator.clipboard?.writeText(shareUrl).then(() => {
                      alert('已複製！');
                      setShareUrl(null);
                    }).catch(() => {
                      alert('請長按上方連結手動複製');
                    });
                  }}
                  className="btn-stellar flex-1 py-3 bg-cyan-50 dark:bg-quantum-cyan/10 border-cyan-200 dark:border-quantum-cyan/30 text-cyan-600 dark:text-quantum-cyan uppercase text-xs font-black tracking-widest hover:bg-cyan-100 dark:hover:bg-quantum-cyan/20 transition-colors"
                >
                  再試一次
                </button>
                <button
                  onClick={() => setShareUrl(null)}
                  className="btn-stellar flex-1 py-3 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 uppercase text-xs font-black tracking-widest hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                >
                  關閉
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                onClick={() => setShowSettingsModal(false)}
            >
                <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-md bg-white dark:bg-space-black border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Settings className="w-5 h-5" />
                            使用者設定
                        </h2>
                        <button onClick={() => setShowSettingsModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-6">
                         <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-xl">
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white text-sm">公開目錄索引</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    允許您的個人頁面顯示在首頁的公開列表中。
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleUpdateProfile(true)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                        dashboardData.user?.show_in_list !== false
                                            ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 ring-2 ring-green-500/50"
                                            : "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
                                    )}
                                >
                                    顯示
                                </button>
                                <button
                                    onClick={() => handleUpdateProfile(false)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                        dashboardData.user?.show_in_list === false
                                            ? "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 ring-2 ring-red-500/50"
                                            : "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
                                    )}
                                >
                                    隱藏
                                </button>
                            </div>
                         </div>
                    </div>
                </motion.div>
            </motion.div>
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
