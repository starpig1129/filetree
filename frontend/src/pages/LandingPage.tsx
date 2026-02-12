import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUp, Cpu, Orbit, Zap, Activity, ShieldCheck, UploadCloud } from 'lucide-react';
import { SecurityInitializationModal } from '../components/SecurityInitializationModal';
import { cn } from '../lib/utils';
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
    config?: { 
      allowed_extensions?: string[];
    };
  };
}

export const LandingPage: React.FC<LandingPageProps> = ({ data }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ content: '', password: '' });
  const [isSyncing, setIsSyncing] = useState(false);
  const [firstLoginUserInfo, setFirstLoginUserInfo] = useState<{ username: string, oldPwd: string } | null>(null);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  // Dynamic Uppy Instance
  const [uppy, setUppy] = useState<Uppy | null>(null);

  useEffect(() => {
    // Clean up previous instance
    if (uppy) {
      uppy.destroy();
    }

    const u = new Uppy({
      id: 'filenexus-uploader',
      autoProceed: false,
      debug: true,
      restrictions: {
        maxFileSize: 10 * 1024 * 1024 * 1024, // 10GB
        allowedFileTypes: data.config?.allowed_extensions || null
      }
    });

    // Use TUS protocol for resumable uploads
    u.use(Tus, {
      endpoint: '/api/upload/tus',
      chunkSize: 5 * 1024 * 1024, // 5MB chunks
      retryDelays: [0, 1000, 3000, 5000],
      removeFingerprintOnSuccess: true,
      limit: 5,
    });

    setUppy(u);

    return () => {
      u.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.config]);

  // Sync password with Uppy meta
  useEffect(() => {
    if (uppy) {
      uppy.setMeta({ password: formData.password });
    }
  }, [uppy, formData.password]);

  // Full-screen Drag & Drop Handlers
  const handleDragEnter = useCallback((e: React.DragEvent | DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent | DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent | DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent | DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounter.current = 0;

    if (uppy && e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      files.forEach((file) => {
        try {
          uppy.addFile({
            source: 'drag-drop-overlay',
            name: file.name,
            type: file.type,
            data: file,
          });
        } catch (err) {
          // Ignore duplicate file errors or restriction errors
          console.warn('File add skipped:', err);
        }
      });
    }
  }, [uppy]);

  // Bind global drag events
  useEffect(() => {
    window.addEventListener('dragenter', handleDragEnter as any);
    window.addEventListener('dragleave', handleDragLeave as any);
    window.addEventListener('dragover', handleDragOver as any);
    window.addEventListener('drop', handleDrop as any);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter as any);
      window.removeEventListener('dragleave', handleDragLeave as any);
      window.removeEventListener('dragover', handleDragOver as any);
      window.removeEventListener('drop', handleDrop as any);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.password) {
      alert('請輸入密碼以驗證身分');
      return;
    }

    const hasText = formData.content.trim().length > 0;
    const hasFiles = uppy && uppy.getFiles().length > 0;

    if (!hasText && !hasFiles) {
      alert('請輸入文字或選擇檔案');
      return;
    }

    setIsSyncing(true);

    try {
      // 1. Upload Files if present
      if (hasFiles && uppy) {
        const result = await uppy.upload();
        if (result && result.failed && result.failed.length > 0) {
          throw new Error(`上傳失敗: ${result.failed.length} 個檔案未完成`);
        } else if (!result) {
          throw new Error('上傳未回傳結果');
        }
      }

      // 2. Upload Text if present
      if (hasText) {
        const body = new FormData();
        body.append('url', formData.content);
        body.append('password', formData.password);
        const res = await fetch('/api/upload_url', { method: 'POST', body });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || '文字儲存失敗');
        }
      }

      // 3. Login & Redirect
      const body = new FormData();
      body.append('password', formData.password);
      const res = await fetch('/api/login', { method: 'POST', body });
      
      if (res.ok) {
        const user = await res.json();
        if (user.first_login) {
          setFirstLoginUserInfo({ username: user.username, oldPwd: formData.password });
          setRedirectPath(`/${user.username}`);
        } else {
          navigate(`/${user.username}`);
        }
      } else {
        // If login fails but upload succeeded, just alert
        alert('資料已提交，但自動登入失敗 (密碼可能錯誤但剛好通過了上傳驗證？)');
        setIsSyncing(false);
      }

    } catch (err: any) {
      console.error(err);
      alert(err.message || '作業失敗，請檢查網路或密碼。');
      setIsSyncing(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center">

      {/* Background glow - only in dark mode */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] h-[90vh] max-w-300 max-h-200 bg-quantum-cyan/5 blur-[clamp(3rem,8vw,6rem)] rounded-full -z-10 animate-pulse hidden dark:block" />

      {/* Drag & Drop Overlay */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-cyan-500/20 backdrop-blur-md flex flex-col items-center justify-center border-4 border-dashed border-cyan-400 p-8"
          >
            <div className="bg-white/90 dark:bg-black/80 p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
              <UploadCloud className="w-16 h-16 text-cyan-600 animate-bounce" />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">釋放滑鼠以上傳檔案</h2>
              <p className="text-gray-500">支援多檔案同時上傳</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Container */}
      <div className="w-full max-w-2xl px-4 relative z-10 py-4">

        {/* Title Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6 space-y-2"
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-6">
            <h1 className="text-[clamp(1.8rem,5vw,4rem)] font-bold tracking-tighter animate-stellar-text leading-tight">
              FileNexus
            </h1>
            <Orbit className="w-[clamp(1.8rem,4vw,3rem)] h-[clamp(1.8rem,4vw,3rem)] text-cyan-600 dark:text-quantum-cyan animate-spin-slow opacity-80 dark:opacity-60" />
          </div>
          <p className="text-gray-500 dark:text-quantum-cyan/40 tracking-[clamp(0.2em,2vw,0.6em)] font-light uppercase text-[clamp(0.55rem,1vw,0.75rem)] pl-2 sm:pl-4">
            Unified Data Gateway 📁
          </p>
        </motion.div>

        {/* Upload Center Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-0.5 relative group"
        >
          <div className="neural-border rounded-4xl p-5 sm:p-6 md:p-8 space-y-6 bg-white/95 dark:bg-space-black/80 backdrop-blur-3xl relative overflow-hidden">

            <div className="relative z-10">
              <div className="text-center space-y-1 mb-6">
                <h2 className="text-[clamp(1.1rem,2vw,1.5rem)] font-bold flex items-center justify-center gap-3 leading-tight">
                  <Cpu className="w-5 h-5 sm:w-7 sm:h-7 text-cyan-600 dark:text-quantum-cyan shrink-0" />
                  資料上傳中心
                  <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-neural-violet animate-pulse shrink-0" />
                </h2>
                <p className="text-gray-500 dark:text-white/30 text-[clamp(0.45rem,0.8vw,0.56rem)] uppercase tracking-[0.25em] font-bold mt-2">Text & File Synchronization</p>
              </div>

              {/* Unified Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* 1. Text Input */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-3.5 h-3.5 text-orange-500" />
                    <label className="text-[0.5625rem] font-black text-gray-500 dark:text-stellar-label uppercase tracking-[0.2em] dark:opacity-70">
                      加密筆記 / 網址
                    </label>
                  </div>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData(p => ({ ...p, content: e.target.value }))}
                    placeholder="在此輸入網址或文字訊息..."
                    className="w-full h-24 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-cyan-500/50 focus:bg-white dark:focus:bg-white/10 transition-all text-gray-900 dark:text-white text-sm font-medium shadow-inner resize-none placeholder:text-gray-400 dark:placeholder:text-white/20"
                  />
                </div>

                {/* 2. File Upload */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <FileUp className="w-3.5 h-3.5 text-cyan-500" />
                    <label className="text-[0.5625rem] font-black text-gray-500 dark:text-stellar-label uppercase tracking-[0.2em] dark:opacity-70">
                      實體檔案
                    </label>
                  </div>
                  <div className="w-full h-48 rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/2">
                    {uppy ? (
                      <UppyDashboard
                        uppy={uppy}
                        className="w-full h-full"
                        props={{
                          showProgressDetails: true,
                          note: '拖放檔案至畫面任意處即可上傳',
                          theme: 'dark',
                          hideUploadButton: true, // Hide internal button, use global submit
                          height: 190,
                          width: '100%'
                        }}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-400 text-sm">元件初始化中...</div>
                    )}
                  </div>
                </div>

                {/* 3. Auth & Submit */}
                <div className="pt-2 space-y-4 border-t border-gray-100 dark:border-white/5">
                  <div className="space-y-2">
                    <label className="text-[0.5625rem] font-black text-gray-500 dark:text-stellar-label uppercase tracking-[0.2em] ml-2 dark:opacity-50">驗證密碼</label>
                    <div className="relative">
                      <input
                        type="password"
                        required
                        value={formData.password}
                        onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))}
                        placeholder="輸入密碼..."
                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-5 py-3.5 outline-none focus:border-quantum-cyan focus:bg-white dark:focus:bg-white/10 transition-all text-gray-900 dark:text-white text-base font-bold text-center tracking-widest placeholder:text-gray-400 dark:placeholder:text-white/30 placeholder:tracking-normal placeholder:text-sm placeholder:font-normal"
                      />
                      <ShieldCheck className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 dark:text-white/10" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSyncing}
                    className="btn-stellar w-full flex items-center justify-center gap-3 py-4 sm:py-5 hover:scale-[1.01] active:scale-[0.99] shadow-lg bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl transition-all cursor-pointer disabled:opacity-70 disabled:grayscale"
                  >
                    <span className="tracking-[clamp(0.2em,1vw,0.4em)] uppercase font-black text-xs sm:text-sm">
                      {isSyncing ? '資料同步中...' : '提交資料'}
                    </span>
                    <Zap className={cn("w-4 h-4 sm:w-5 sm:h-5", isSyncing && "animate-spin")} />
                  </button>
                </div>

              </form>
            </div>
          </div>
        </motion.div>
      </div>

      <SecurityInitializationModal
        isOpen={!!firstLoginUserInfo}
        username={firstLoginUserInfo?.username || ""}
        oldPassword={firstLoginUserInfo?.oldPwd || ""}
        onSuccess={() => {
          alert("安全性初始化完成，正在跳轉至專屬區域。");
          if (redirectPath) {
            navigate(redirectPath);
          } else {
            navigate('/');
          }
        }}
      />
    </div>
  );
};
