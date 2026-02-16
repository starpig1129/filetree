import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SecurityInitializationModal } from '../components/SecurityInitializationModal';
import {
  Lock, Unlock,
  Cpu, Zap, Activity, X, Settings, ChevronRight, Folder as FolderIcon,
  LayoutGrid, List, CheckSquare, Square
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '../lib/utils';
import { FilePreviewModal } from '../components/FilePreviewModal';
import { FileView } from '../components/dashboard/FileView';
import type { FileItemData } from '../components/dashboard/FileItem';
import { UrlView } from '../components/dashboard/UrlView';
import type { UrlItem } from '../components/dashboard/UrlView';
import { useWebSocket } from '../hooks/useWebSocket';
import { FolderSidebar } from '../components/dashboard/FolderSidebar';
import type { Folder } from '../components/dashboard/FolderSidebar';
import { BatchActionBar } from '../components/dashboard/BatchActionBar';

interface UserPageProps {
  data: {
    user?: { username: string; is_locked?: boolean; first_login?: boolean; show_in_list?: boolean };
    usage?: number;
    files?: FileItemData[];
    urls?: UrlItem[];
    folders?: Folder[];
    error?: string;
  };
}

export const UserPage: React.FC<UserPageProps> = ({ 
  data 
}) => {
  const [dashboardData, setDashboardData] = useState(data);
  const [selectedItems, setSelectedItems] = useState<{ type: 'file' | 'url' | 'folder'; id: string }[]>([]);
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
  const [isPacking, setIsPacking] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'files' | 'urls'>('files');
  const [activeFileFolderId, setActiveFileFolderId] = useState<string | null>(null);
  const [activeUrlFolderId, setActiveUrlFolderId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDesktop, setIsDesktop] = useState(true);

  // Responsive check
  React.useEffect(() => {
    const checkDesktop = () => {
      const isLg = window.matchMedia('(min-width: 1024px)').matches;
      setIsDesktop(isLg);
      // Auto-collapse on mobile, auto-expand on desktop initial load
      if (!isLg) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const filteredFiles = React.useMemo(() => {
    if (activeFileFolderId === null) return dashboardData.files || [];
    return (dashboardData.files || []).filter(f => f.folder_id === activeFileFolderId);
  }, [dashboardData.files, activeFileFolderId]);

  const filteredUrls = React.useMemo(() => {
    if (activeUrlFolderId === null) return dashboardData.urls || [];
    return (dashboardData.urls || []).filter(u => u.folder_id === activeUrlFolderId);
  }, [dashboardData.urls, activeUrlFolderId]);

  const getBreadcrumbs = React.useCallback((folderId: string | null) => {
    if (!folderId) return [];
    const crumbs: Folder[] = [];
    let currentId: string | null = folderId;
    while (currentId) {
      const folder = dashboardData.folders?.find(f => f.id === currentId);
      if (folder) {
        crumbs.unshift(folder);
        currentId = folder.parent_id || null;
      } else {
        currentId = null;
      }
    }
    return crumbs;
  }, [dashboardData.folders]);

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
  const wsUrl = React.useMemo(() => {
    if (!data.user?.username) return null;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/api/ws/${data.user.username}`;
  }, [data.user?.username]);

  const handleWebSocketMessage = React.useCallback((event: MessageEvent) => {
    if (event.data === "REFRESH") {
      console.log("[UserPage] Received REFRESH signal via WebSocket");
      refreshDashboard(token || "");
    }
  }, [refreshDashboard, token]);

  const { isConnected } = useWebSocket(wsUrl, {
    onMessage: handleWebSocketMessage,
    reconnectInterval: 3000,
    maxRetries: 20
  });

  // Debug connection status
  React.useEffect(() => {
    console.log(`[UserPage] WebSocket Status: ${isConnected ? 'Connected' : 'Disconnected'}`);
  }, [isConnected]);

  const toggleSelectItem = (type: 'file' | 'url' | 'folder', id: string) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.type === type && i.id === id);
      if (exists) {
        return prev.filter(i => !(i.type === type && i.id === id));
      } else {
        return [...prev, { type, id }];
      }
    });
  };

  const handleBatchAction = async (action: 'lock' | 'unlock' | 'delete' | 'download' | 'move', folderId?: string | null) => {
    if (selectedItems.length === 0) return;

    if (action === 'move') {
      if (folderId === undefined) return;
      setIsBatchSyncing(true);
      try {
        await Promise.all(selectedItems.map(item => handleMoveItem(item.type, item.id, folderId)));
        setSelectedItems([]);
      } finally {
        setIsBatchSyncing(false);
      }
      return;
    }

    // Batch download doesn't strictly require pre-authentication for public files
    if (action !== 'download' && !isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    if (action === 'delete' && !confirm(`確定要批次刪除選中的 ${selectedItems.length} 個項目嗎？此操作不可恢復！`)) {
      return;
    }

    setIsBatchSyncing(true);
    try {
      const files = selectedItems.filter(i => i.type === 'file').map(i => i.id);
      const urls = selectedItems.filter(i => i.type === 'url').map(i => i.id);

      if (action === 'download') {
        if (files.length === 0) {
          alert("請選擇要下載的檔案（連結不支援打包下載）");
          setIsBatchSyncing(false);
          return;
        }

        const formData = new FormData();
        // Send password only if authenticated to allow downloading locked files, 
        // otherwise skip it as per user requirement.
        if (isAuthenticated && password) {
          formData.append('password', password);
        }
        // Ensure filenames is sent correctly as a list
        files.forEach(f => formData.append('filenames', f));

        setIsPacking(true);
        const res = await fetch(`/api/user/${dashboardData.user?.username}/batch-download`, {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          a.download = `${dashboardData.user?.username}_files_${timestamp}.zip`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          setSelectedItems([]);
        } else {
          const err = await res.json();
          alert(err.detail || "打包下載失敗");
        }
        setIsPacking(false);
        setIsBatchSyncing(false);
        return;
      }

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

      const performFolders = async (ids: string[]) => {
        if (ids.length === 0) return;
        // Folders must be deleted one by one for now as batch-action doesn't support folder type
        // Or we could update backend. For now, concurrent requests.
        await Promise.all(ids.map(id => 
          fetch(`/api/user/${dashboardData.user?.username}/folders/${id}/delete`, {
            method: 'POST',
            body: new URLSearchParams({ password })
          })
        ));
      };

      // Optimistic UI Update for delete
      if (action === 'delete') {
        const folders = selectedItems.filter(i => i.type === 'folder').map(i => i.id);
        const folderSet = new Set(folders);

        setDashboardData(prev => ({
          ...prev,
          files: prev.files?.filter(f => !files.includes(f.name)),
          urls: prev.urls?.filter(u => !urls.includes(u.url)),
          folders: prev.folders?.filter(f => !folderSet.has(f.id))
        }));
      }
      setSelectedItems([]);

      await Promise.all([
        perform('file', files), 
        perform('url', urls),
        action === 'delete' ? performFolders(selectedItems.filter(i => i.type === 'folder').map(i => i.id)) : Promise.resolve()
      ]);
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

  const toggleItemLock = async (type: 'file' | 'url' | 'folder', itemId: string, currentStatus: boolean) => {
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
    } else if (type === 'url') {
      setDashboardData(prev => ({
        ...prev,
        urls: prev.urls?.map(u => u.url === itemId ? { ...u, is_locked: newLockStatus } : u)
      }));
    } else if (type === 'folder') {
      setDashboardData(prev => ({
        ...prev,
        folders: prev.folders?.map(f => f.id === itemId ? { ...f, is_locked: newLockStatus } : f)
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

  const handleCreateFolder = async (name: string, type: 'file' | 'url', parentId?: string | null) => {
    if (!isAuthenticated) return;
    try {
      const body = new FormData();
      body.append('name', name);
      body.append('folder_type', type);
      body.append('password', password);
      if (parentId) body.append('parent_id', parentId);

      const res = await fetch(`/api/user/${data.user?.username}/folders`, {
        method: 'POST',
        body
      });
      if (res.ok) {
        await refreshDashboard(token || "");
      } else {
        alert("建立資料夾失敗");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateFolder = async (id: string, name: string) => {
    if (!isAuthenticated) return;
    try {
      const body = new FormData();
      body.append('name', name);
      body.append('password', password);

      const res = await fetch(`/api/user/${data.user?.username}/folders/${id}/update`, {
        method: 'POST',
        body
      });
      if (res.ok) {
        await refreshDashboard(token || "");
      } else {
        alert("更新資料夾失敗");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!isAuthenticated) return;
    try {
      const body = new FormData();
      body.append('password', password);

      const res = await fetch(`/api/user/${data.user?.username}/folders/${id}/delete`, {
        method: 'POST',
        body
      });
      if (res.ok) {
        if (activeFileFolderId === id) setActiveFileFolderId(null);
        if (activeUrlFolderId === id) setActiveUrlFolderId(null);
        await refreshDashboard(token || "");
      } else {
        alert("刪除資料夾失敗");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveItem = async (type: 'file' | 'url' | 'folder', id: string, folderId: string | null) => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    try {
      const body = new FormData();
      body.append('item_type', type);
      body.append('item_id', id);
      if (folderId) body.append('folder_id', folderId);
      body.append('password', password);

      const res = await fetch(`/api/user/${data.user?.username}/move-item`, {
        method: 'POST',
        body
      });
      if (res.ok) {
        // Optimistic update
        if (type === 'file') {
          setDashboardData(prev => ({
            ...prev,
            files: prev.files?.map(f => f.name === id ? { ...f, folder_id: folderId } : f)
          }));
        } else if (type === 'url') {
          setDashboardData(prev => ({
            ...prev,
            urls: prev.urls?.map(u => u.url === id ? { ...u, folder_id: folderId } : u)
          }));
        } else if (type === 'folder') {
          setDashboardData(prev => ({
            ...prev,
            folders: prev.folders?.map(f => f.id === id ? { ...f, parent_id: folderId } : f)
          }));
        }
      } else {
        alert("移動失敗");
        await refreshDashboard(token || "");
      }
    } catch (err) {
      console.error(err);
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

      const supportsClipboardItem = typeof ClipboardItem !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.write === 'function';

      let copySuccess = false;
      let shareUrlResult: string | null = null;

      if (supportsClipboardItem) {
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
          await navigator.clipboard.write([
            new ClipboardItem({ 'text/plain': textPromise })
          ]);
          copySuccess = true;
        } catch (clipboardErr) {
          console.log('ClipboardItem write failed:', clipboardErr);
          if (shareUrlResult) {
            copySuccess = false;
          } else {
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

        if (navigator.clipboard && navigator.clipboard.writeText) {
          try {
            await navigator.clipboard.writeText(shareUrlResult);
            copySuccess = true;
          } catch {
            console.log('Async clipboard failed, trying fallback');
          }
        }
      }

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
        setShareUrl(shareUrlResult);
      } else {
        alert('分享功能發生錯誤，請稍後再試。');
      }
    } catch (err) {
      console.error(err);
      alert('分享功能發生錯誤，請稍後再試。');
    }
  };

  const handleSelectAll = (type: 'file' | 'url', selectAll: boolean) => {
    if (selectAll) {
      if (type === 'file') {
        const selectableFiles = dashboardData.files
          ?.filter(f => !f.is_locked || isAuthenticated)
          .map(f => ({ type: 'file' as const, id: f.name })) || [];
        
        const currentFolders = dashboardData.folders
          ?.filter(f => f.parent_id === activeFileFolderId && f.type === 'file')
          .map(f => ({ type: 'folder' as const, id: f.id })) || [];

        setSelectedItems(prev => {
          const others = prev.filter(i => i.type !== 'file' && i.type !== 'folder');
          return [...others, ...selectableFiles, ...currentFolders];
        });
      } else {
        const selectableUrls = dashboardData.urls
          ?.filter(u => !u.is_locked || isAuthenticated)
          .map(u => ({ type: 'url' as const, id: u.url })) || [];

        const currentFolders = dashboardData.folders
            ?.filter(f => f.parent_id === activeUrlFolderId && f.type === 'url')
            .map(f => ({ type: 'folder' as const, id: f.id })) || [];

        setSelectedItems(prev => {
          const others = prev.filter(i => i.type !== 'url' && i.type !== 'folder');
          return [...others, ...selectableUrls, ...currentFolders];
        });
      }
    } else {
      setSelectedItems(prev => prev.filter(i => i.type !== type && i.type !== 'folder'));
    }
  };

  const handleBatchSelect = (items: { type: 'file' | 'url' | 'folder'; id: string }[], action: 'add' | 'remove' | 'set') => {
    setSelectedItems(prev => {
      if (action === 'set') return items;
      if (action === 'add') {
        const newItems = items.filter(item => !prev.some(p => p.type === item.type && p.id === item.id));
        return [...prev, ...newItems];
      }
      if (action === 'remove') {
        return prev.filter(p => !items.some(item => item.type === p.type && item.id === p.id));
      }
      return prev;
    });
  };

  return (
    <div className="h-full flex flex-col relative text-gray-900 dark:text-gray-100 font-sans selection:bg-cyan-500/30">

      {/* Background Ambient Elements - Contained to avoid overflow issues */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-[20%] -right-[10%] w-[70vw] h-[70vw] bg-radial-gradient from-quantum-cyan/10 to-transparent blur-[5rem] opacity-60 dark:opacity-40 animate-pulse-slow" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[60vw] h-[60vw] bg-radial-gradient from-neural-violet/10 to-transparent blur-[5rem] opacity-60 dark:opacity-40 animate-pulse-slow delay-1000" />
        <div className="absolute inset-0 bg-linear-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none" />
      </div>

      {/* Header - Optimized Horizontal Layout for Mobile */}
      <header className="flex flex-col gap-2 sm:gap-3 px-3 pt-3 sm:px-4 sm:pt-4 lg:px-6 lg:pt-6 relative z-10 lg:pl-6 bg-white/40 dark:bg-black/20 backdrop-blur-xl border-b border-white/10 lg:bg-transparent lg:backdrop-blur-none lg:border-none">
        
        {/* Row 1: Logo & Global Actions */}
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          
          <div className="flex items-center gap-2 sm:gap-4">

            <div className="flex items-center gap-2 sm:gap-3 group cursor-default">
              <div className="p-1.5 bg-white/80 dark:bg-white/5 backdrop-blur-xl rounded-lg border border-white/20 shadow-sm">
                <div className="text-cyan-600 dark:text-quantum-cyan font-black text-xs">FN</div>
              </div>
              <h1 className="text-base sm:text-xl font-black tracking-tighter text-gray-900 dark:text-white truncate max-w-30 sm:max-w-none">
                {dashboardData.user?.username}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Usage Pill - Compact on mobile */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/60 dark:bg-black/40 backdrop-blur-md rounded-lg border border-gray-200 dark:border-white/10 shadow-sm">
              <Activity className="w-3 h-3 text-cyan-500" />
              <span className="text-[10px] font-black text-gray-600 dark:text-gray-300 tracking-tighter">
                {dashboardData.usage}MB
              </span>
            </div>

            {/* Auth/Lock Button - Touch-friendly on mobile */}
            <button
              onClick={() => isAuthenticated ? setIsAuthenticated(false) : setShowAuthModal(true)}
              className={cn(
                "p-2.5 sm:p-2 sm:px-4 sm:py-2 rounded-xl flex items-center gap-2 transition-all duration-300 font-bold text-xs shadow-lg backdrop-blur-md border min-w-10 min-h-10",
                isAuthenticated
                  ? "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border-cyan-500/20"
                  : "bg-white/80 dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10"
              )}
            >
              {isAuthenticated ? <Unlock className="w-4 h-4 text-cyan-500" /> : <Lock className="w-4 h-4" />}
              <span className="hidden sm:inline">{isAuthenticated ? "UNLOCKED" : "LOCKED"}</span>
            </button>

            {/* Settings - Touch-friendly */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2.5 sm:p-2 rounded-xl bg-white/60 dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors border border-white/20 min-w-10 min-h-10 flex items-center justify-center"
            >
              <Settings className="w-4 h-4" />
            </button>

          </div>
        </div>

        {/* Row 2: Navigation Tabs - More compact on mobile */}
        <div className="flex items-center gap-1 sm:gap-2 pb-1 lg:pb-0">
          <button
            onClick={() => setActiveTab('files')}
            className={cn(
              "flex-1 sm:flex-none px-4 py-2 sm:px-6 sm:py-2.5 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-xs transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden",
              activeTab === 'files'
                ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                : "text-gray-500 dark:text-gray-400 hover:bg-white/40 dark:hover:bg-white/5"
            )}
          >
            <Cpu className="h-4 w-4" />
            檔案列表
          </button>
          <button
            onClick={() => setActiveTab('urls')}
            className={cn(
              "flex-1 sm:flex-none px-4 py-2 sm:px-6 sm:py-2.5 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-xs transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden",
              activeTab === 'urls'
                ? "bg-violet-500 text-white shadow-lg shadow-violet-500/20"
                : "text-gray-500 dark:text-gray-400 hover:bg-white/40 dark:hover:bg-white/5"
            )}
          >
            <Zap className="h-4 w-4" />
            筆記 / 連結
          </button>
        </div>
      </header>

      {/* Main Content Area - Reduced gap on mobile */}
      <main className="flex-1 min-h-0 px-2 pb-2 lg:px-6 lg:pb-6 relative z-10 overflow-hidden flex gap-2 lg:gap-4">
        <div className="relative flex">
          <AnimatePresence mode="wait">
            {isSidebarOpen && (
              <>
                {/* Mobile Backdrop */}
                {!isDesktop && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsSidebarOpen(false)}
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                  />
                )}
                <motion.div
                  initial={{ width: 0, opacity: 0, x: -20 }}
                  animate={{ width: "auto", opacity: 1, x: 0 }}
                  exit={{ width: 0, opacity: 0, x: -20 }}
                  className={cn(
                    "overflow-hidden bg-white/80 dark:bg-space-deep/90 backdrop-blur-xl border-r border-white/10 h-full",
                    // Desktop: Relative flow
                    "lg:relative",
                    // Mobile: Absolute drawer
                    "absolute top-0 left-0 z-40 h-full shadow-2xl"
                  )}
                >
                  <FolderSidebar
                    folders={dashboardData.folders || []}
                    activeFolderId={activeTab === 'files' ? activeFileFolderId : activeUrlFolderId}
                    activeType={activeTab === 'files' ? 'file' : 'url'}
                    isAuthenticated={isAuthenticated}
                    onSelectFolder={(id) => {
                       if (activeTab === 'files') setActiveFileFolderId(id);
                       else setActiveUrlFolderId(id);
                       // Close on selection if mobile
                       if (!isDesktop) setIsSidebarOpen(false);
                    }}
                    onCreateFolder={handleCreateFolder}
                    onUpdateFolder={handleUpdateFolder}
                    onDeleteFolder={handleDeleteFolder}
                    onMoveItem={handleMoveItem}
                    onClose={() => setIsSidebarOpen(false)}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>
          
        </div>
        <AnimatePresence mode="wait">
          {activeTab === 'files' ? (
            <motion.div
              key="files"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 min-w-0 h-full flex flex-col gap-4"
            >
              {/* Breadcrumbs for Files */}
              <div className="grid grid-cols-[1fr_auto] items-center w-full h-9 overflow-hidden pr-1">
                <div className="flex items-center gap-2 overflow-x-auto overflow-y-hidden no-scrollbar py-1 min-w-0 transition-all duration-300">
                  <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2 rounded-lg bg-white/40 dark:bg-white/5 text-gray-600 dark:text-cyan-500 hover:bg-cyan-500/10 transition-colors border border-white/20 shrink-0"
                    aria-label="資料夾"
                  >
                    <FolderIcon className="w-4 h-4" />
                  </button>
                  <div className="w-px h-4 bg-gray-300 dark:bg-white/10 mx-1 lg:hidden shrink-0" />
                  <button
                    onClick={() => setActiveFileFolderId(null)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0",
                      activeFileFolderId === null
                        ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                        : "bg-white/40 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-white/10"
                    )}
                  >
                    所有檔案
                  </button>
                  {getBreadcrumbs(activeFileFolderId).map((crumb, idx, arr) => (
                    <React.Fragment key={crumb.id}>
                      <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
                      <button
                        onClick={() => setActiveFileFolderId(crumb.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0",
                          idx === arr.length - 1
                            ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                            : "bg-white/40 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-white/10"
                        )}
                      >
                        <FolderIcon className="w-3.5 h-3.5 inline mr-1" />
                        {crumb.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
                
                <AnimatePresence>
                  {isSelectionMode && (
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="flex items-center gap-1.5 flex-nowrap shrink-0 bg-white/60 dark:bg-white/10 backdrop-blur-md px-2 py-1 rounded-xl border border-white/20 shadow-sm ml-2"
                    >
                      <button
                        onClick={() => handleSelectAll('file', selectedItems.filter(i => i.type === 'file').length < filteredFiles.length)}
                        className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/10 flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-sm"
                      >
                        {selectedItems.filter(i => i.type === 'file').length === filteredFiles.length && filteredFiles.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        <span className="text-[10px] font-bold">全選</span>
                      </button>
                      <button
                        onClick={() => { setIsSelectionMode(false); setSelectedItems([]); }}
                        className="p-1.5 rounded-lg bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/10 shrink-0 shadow-sm"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <FileView
                files={filteredFiles}
                isAuthenticated={isAuthenticated}
                selectedItems={selectedItems.filter(i => i.type === 'file' || i.type === 'folder')}
                onToggleSelect={(type, id) => toggleSelectItem(type, id)}
                onSelectAll={(selected) => handleSelectAll('file', selected)}
                onBatchSelect={(items, action) => handleBatchSelect(items, action)}
                onToggleLock={(type, id, status) => toggleItemLock(type, id, !!status)}
                onRename={handleRename}
                onDelete={handleDelete}
                onShare={handleShare}
                onQrCode={(filename) => {
                  const url = `${window.location.origin}/user/${data.user?.username}/file/${encodeURIComponent(filename)}`;
                  setQrUrl(url);
                }}
                onPreview={(file) => setPreviewFile(file)}
                username={data.user?.username || ""}
                token={token}
                folders={dashboardData.folders?.filter(f => f.type === 'file') || []}
                activeFolderId={activeFileFolderId}
                onMoveItem={handleMoveItem}
                onFolderClick={setActiveFileFolderId}
                onUpdateFolder={handleUpdateFolder}
                onDeleteFolder={handleDeleteFolder}
                onBatchAction={handleBatchAction}
                isBatchSyncing={isBatchSyncing}
                viewMode={viewMode}
                key={viewMode} // Force re-mount on view mode change to ensure Virtuoso updates correctly
                onViewModeChange={setViewMode}
                isSelectionMode={isSelectionMode}
                onSelectionModeChange={setIsSelectionMode}
                onShareFolder={(folderId) => {
                  const url = `${window.location.origin}/user/${data.user?.username}?tab=file&folder=${folderId}`;
                  navigator.clipboard?.writeText(url).then(() => alert('資料夾連結已複製！'));
                }}
                onQrCodeFolder={(folderId) => {
                  const url = `${window.location.origin}/user/${data.user?.username}?tab=file&folder=${folderId}`;
                  setQrUrl(url);
                }}
                onDownloadFolder={(folderId) => {
                  const hasFiles = (fId: string): boolean => {
                     const directFiles = dashboardData.files?.some(f => f.folder_id === fId);
                     if (directFiles) return true;
                     const subfolders = dashboardData.folders?.filter(f => f.parent_id === fId) || [];
                     return subfolders.some(sub => hasFiles(sub.id));
                  };

                  if (!hasFiles(folderId)) {
                    alert('資料夾內無檔案可下載');
                    return;
                  }
                  
                  const downloadUrl = `/api/user/${data.user?.username}/folders/${folderId}/download?token=${token || ''}`;
                  window.open(downloadUrl, '_blank');
                }}
                onToggleFolderLock={(type, id, status) => toggleItemLock(type, id, !!status)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="urls"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 min-w-0 h-full flex flex-col gap-4"
            >
               {/* Breadcrumbs for Urls */}
               <div className="grid grid-cols-[1fr_auto] items-center w-full h-9 overflow-hidden pr-1">
                <div className="flex items-center gap-2 overflow-x-auto overflow-y-hidden no-scrollbar py-1 min-w-0 transition-all duration-300">
                  <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2 rounded-lg bg-white/40 dark:bg-white/5 text-gray-600 dark:text-violet-500 hover:bg-violet-500/10 transition-colors border border-white/20 shrink-0"
                    aria-label="資料夾"
                  >
                    <FolderIcon className="w-4 h-4" />
                  </button>
                  <div className="w-px h-4 bg-gray-300 dark:bg-white/10 mx-1 lg:hidden shrink-0" />
                  <button
                    onClick={() => setActiveUrlFolderId(null)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0",
                      activeUrlFolderId === null
                        ? "bg-violet-500 text-white shadow-lg shadow-violet-500/20"
                        : "bg-white/40 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-white/10"
                    )}
                  >
                    所有連結
                  </button>
                  {getBreadcrumbs(activeUrlFolderId).map((crumb, idx, arr) => (
                    <React.Fragment key={crumb.id}>
                      <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
                      <button
                        onClick={() => setActiveUrlFolderId(crumb.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0",
                          idx === arr.length - 1
                            ? "bg-violet-500 text-white shadow-lg shadow-violet-500/20"
                            : "bg-white/40 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-white/10"
                        )}
                      >
                        <FolderIcon className="w-3.5 h-3.5 inline mr-1" />
                        {crumb.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
                
                <AnimatePresence>
                  {isSelectionMode && (
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="flex items-center gap-1.5 flex-nowrap shrink-0 bg-white/60 dark:bg-white/10 backdrop-blur-md px-2 py-1 rounded-xl border border-white/20 shadow-sm ml-2"
                    >
                      <button
                        onClick={() => handleSelectAll('url', selectedItems.filter(i => i.type === 'url').length < filteredUrls.length)}
                        className="p-1.5 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/10 flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-sm"
                      >
                        {selectedItems.filter(i => i.type === 'url').length === filteredUrls.length && filteredUrls.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        <span className="text-[10px] font-bold">全選</span>
                      </button>
                      <button
                        onClick={() => { setIsSelectionMode(false); setSelectedItems([]); }}
                        className="p-1.5 rounded-lg bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/10 shrink-0 shadow-sm"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <UrlView
                urls={filteredUrls}
                isAuthenticated={isAuthenticated}
                selectedItems={selectedItems.filter(i => i.type === 'url' || i.type === 'folder')}
                onToggleSelect={(type, id) => toggleSelectItem(type, id)}
                onSelectAll={(selected) => handleSelectAll('url', selected)}
                onBatchSelect={(items, action) => handleBatchSelect(items, action)}
                onToggleLock={(type, id, status) => toggleItemLock(type, id, !!status)}
                onQrCode={setQrUrl}
                onDelete={handleUrlDelete}
                onCopy={(url) => { navigator.clipboard?.writeText(url).then(() => alert("已複製！")); }}
                folders={dashboardData.folders?.filter(f => f.type === 'url') || []}
                activeFolderId={activeUrlFolderId}
                onMoveItem={handleMoveItem}
                onFolderClick={setActiveUrlFolderId}
                onUpdateFolder={handleUpdateFolder}
                onDeleteFolder={handleDeleteFolder}
                onBatchAction={handleBatchAction}
                isBatchSyncing={isBatchSyncing}
                viewMode={viewMode}
                key={viewMode} // Force re-mount on view mode change
                onViewModeChange={setViewMode}
                isSelectionMode={isSelectionMode}
                onSelectionModeChange={setIsSelectionMode}
                onShareFolder={(folderId) => {
                  const url = `${window.location.origin}/user/${data.user?.username}?tab=url&folder=${folderId}`;
                  navigator.clipboard?.writeText(url).then(() => alert('資料夾連結已複製！'));
                }}
                onQrCodeFolder={(folderId) => {
                  const url = `${window.location.origin}/user/${data.user?.username}?tab=url&folder=${folderId}`;
                  setQrUrl(url);
                }}

              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>


      {/* Packing Overlay */}
      <AnimatePresence>
        {isPacking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-md"
          >
            <div className="bg-white dark:bg-space-black p-8 rounded-3xl shadow-2xl border border-white/10 flex flex-col items-center gap-6">
              <div className="relative">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 border-4 border-violet-500/20 border-t-violet-500 rounded-full"
                />
                <motion.div
                  initial={{ scale: 0.8, opacity: 0.5 }}
                  animate={{ scale: 1.2, opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute inset-0 bg-violet-500 rounded-full"
                />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold dark:text-white mb-2">壓縮檔案中...</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">請稍候，我們正在為您打包選中的資源</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
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

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-xl">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">顯示模式</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      切換列表的呈現方式。
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { console.log('[Settings] Switching to grid, current:', viewMode); setViewMode('grid'); }}
                      className={cn(
                        "p-2 rounded-lg transition-all",
                        viewMode === 'grid'
                          ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                          : "bg-gray-100 dark:bg-white/5 text-gray-500"
                      )}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { console.log('[Settings] Switching to list, current:', viewMode); setViewMode('list'); }}
                      className={cn(
                        "p-2 rounded-lg transition-all",
                        viewMode === 'list'
                          ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                          : "bg-gray-100 dark:bg-white/5 text-gray-500"
                      )}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-xl">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">操作</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      批量處理當前頁面內容。
                    </p>
                  </div>
                  <button
                    onClick={() => {
                        setIsSelectionMode(true);
                        setShowSettingsModal(false);
                    }}
                    className="px-4 py-2 bg-cyan-600 text-white font-bold rounded-xl hover:bg-cyan-500 transition-colors text-xs"
                  >
                    選擇檔案
                  </button>
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
      {/* Selection Action Bar - Unified at root to ensure fixed positioning on mobile */}
      {selectedItems.length > 0 && (
        <BatchActionBar
          selectedCount={selectedItems.length}
          isBatchSyncing={isBatchSyncing}
          onAction={handleBatchAction}
          folders={(dashboardData.folders || []).filter(f => f.type === (activeTab === 'files' ? 'file' : 'url'))}
          allowedActions={activeTab === 'files' ? ['lock', 'unlock', 'download', 'delete', 'move'] : ['lock', 'unlock', 'delete', 'move']}
          mode="mobile"
        />
      )}
    </div>
  );
};
