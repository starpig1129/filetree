import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUp, Cpu, Orbit, Zap, Activity, ShieldCheck, Rocket } from 'lucide-react';
import { SecurityInitializationModal } from '../components/SecurityInitializationModal';
import { cn } from '../lib/utils';
import Uppy from '@uppy/core';
import UppyDashboard from '../components/UppyDashboard';
import Tus from '@uppy/tus';
import AwsS3 from '@uppy/aws-s3';

// Uppy styles
import '@uppy/core/css/style.min.css';
import '@uppy/dashboard/css/style.min.css';

interface LandingPageProps {
  data: {
    users?: Array<{ username: string; folder: string }>;
    error?: string;
    config?: { 
      allowed_extensions?: string[];
      r2_enabled?: boolean;
    };
  };
}

export const LandingPage: React.FC<LandingPageProps> = ({ data }) => {
  const navigate = useNavigate();
  const [uploadType, setUploadType] = useState<'url' | 'file'>('url');
  const [formData, setFormData] = useState({ content: '', password: '' });
  const [isSyncing, setIsSyncing] = useState(false);
  const [firstLoginUserInfo, setFirstLoginUserInfo] = useState<{ username: string, oldPwd: string } | null>(null);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  
  // Turbo Mode (R2) state
  const [turboMode, setTurboMode] = useState(false);

  // Sync turboMode with config default
  useEffect(() => {
    if (data.config?.r2_enabled) {
      setTurboMode(true);
    }
  }, [data.config]);

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

    if (turboMode) {
      // R2 / S3 Multipart Strategy
      u.use(AwsS3, {
        shouldUseMultipart: true,
        limit: 5,
        createMultipartUpload: async (file: any) => {
          const res = await fetch('/api/upload/r2/multipart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              type: file.type,
              metadata: file.meta
            }),
          });
          if (!res.ok) throw new Error('Failed to init upload');
          return await res.json();
        },
        signPart: async (_file: any, { uploadId, key, partNumber }: any) => {
          const res = await fetch(`/api/upload/r2/multipart/${uploadId}?key=${encodeURIComponent(key)}&partNumber=${partNumber}`);
          if (!res.ok) throw new Error('Failed to sign part');
          return await res.json();
        },
        completeMultipartUpload: async (_file: any, { uploadId, key, parts }: any) => {
          const res = await fetch(`/api/upload/r2/multipart/${uploadId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, parts }),
          });
          if (!res.ok) throw new Error('Failed to complete upload');
          return await res.json();
        },
        listParts: async (_file: any, { uploadId: _uId, key: _k }: any) => {
          console.log('listParts not implemented, returning empty', _uId, _k);
          return []; // Return empty list as we don't support resuming existing uploads for now
        },
        abortMultipartUpload: async (_file: any, { uploadId: _uId, key: _k }: any) => {
           // Optional: Implement abort endpoint if needed
           console.log('Abort not implemented on backend for now', _uId, _k);
        }
      });
    } else {
      // Fallback: Tus
      u.use(Tus, {
        endpoint: '/api/upload/tus',
        chunkSize: 50 * 1024 * 1024,
        retryDelays: [0, 1000, 3000, 5000],
        removeFingerprintOnSuccess: true,
        limit: 5,
      });
    }

    setUppy(u);

    return () => {
      u.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turboMode, data.config]); // Re-create when turboMode changes

  // Update logic on existing uppy (meta, etc)
  useEffect(() => {
    if (!uppy) return;
    
    // Sync password
    uppy.setMeta({ password: formData.password });
    
    // Event listeners
    const handleComplete = async (result: any) => {
      if (result.successful && result.successful.length > 0) {
        try {
          const body = new FormData();
          body.append('password', formData.password);
          const res = await fetch('/api/login', { method: 'POST', body });
          if (res.ok) {
            const user = await res.json();
             // Just navigate, let server handle file movement if needed?
             // For S3: Backend already moved file in complete_multipart.
             // For Tus: Backend moved file in hook.
            if (user.first_login) {
              setFirstLoginUserInfo({ username: user.username, oldPwd: formData.password });
              setRedirectPath(`/${user.username}`);
              return;
            }
            navigate(`/${user.username}`);
          }
        } catch (err) {
          console.error(err);
          alert('上傳成功！');
          window.location.reload();
        }
      }
    };
    
    uppy.on('complete', handleComplete);
    
    return () => {
      uppy.off('complete', handleComplete);
    };
  }, [uppy, formData.password, navigate]);


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
            const username = result.redirect.split('/').pop() || "";
            setFirstLoginUserInfo({ username, oldPwd: formData.password });
            setRedirectPath(result.redirect);
          } else {
            navigate(result.redirect);
          }
        } else {
          alert(result.detail || '初始化失敗');
        }
      } else if (uploadType === 'file') {
        if (!uppy || uppy.getFiles().length === 0) {
          alert('請先選擇檔案');
          setIsSyncing(false);
          return;
        }
        if (!formData.password) {
          alert('請輸入密碼');
          setIsSyncing(false);
          return;
        }

        try {
          await uppy.upload();
        } catch (err: any) {
          console.error("Upload failed:", err);
          // Auto-fallback: If Turbo Mode is on and it failed, try switching to TUS
          if (turboMode) {
            console.warn("Turbo Mode (R2) failed. Falling back to Standard Mode (TUS)...");
            // Disable Turbo Mode
            setTurboMode(false);
            // Wait for useEffect to recreate Uppy instance with TUS
            // This is tricky because React state updates are async.
            // We need to trigger a retry after state update.
            // Actually, simply setting turboMode(false) will reset Uppy. 
            // The user will have to click upload again? Or we can hack it?
            // Better UX: Show specific alert asking user to retry.
            alert('高速上傳通道暫時無法使用，系統將自動切換至標準模式。請再次點擊「開始同步」按鈕。');
            setTurboMode(false); // This triggers useEffect -> new Uppy (Tus)
            setIsSyncing(false);
            return;
          }
          throw err; // Re-throw if not turbo mode or other error
        }
      }
    } catch (err) {
      console.error(err);
      // alert('上傳失敗，請檢查網路或密碼。'); // Don't show generic alert if we handled fallback
      if (!turboMode) {
          alert('上傳失敗，請檢查網路或密碼。');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center">

      {/* Background glow - only in dark mode */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] h-[90vh] max-w-300 max-h-200 bg-quantum-cyan/5 blur-[clamp(3rem,8vw,6rem)] rounded-full -z-10 animate-pulse hidden dark:block" />

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
            Modern File Management Hub 📁
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
                
                {data.config?.r2_enabled && uploadType === 'file' && (
                  <div className="flex justify-center mt-2">
                     <button 
                       onClick={() => setTurboMode(!turboMode)}
                       className={cn(
                         "flex items-center gap-2 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider border transition-all",
                         turboMode 
                           ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-quantum-cyan" 
                           : "bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500"
                       )}
                     >
                       <Rocket className={cn("w-3 h-3", turboMode && "text-cyan-500")} />
                       Turbo Mode: {turboMode ? "ON" : "OFF"}
                     </button>
                  </div>
                )}
                
                <p className="text-gray-500 dark:text-white/30 text-[clamp(0.45rem,0.8vw,0.56rem)] uppercase tracking-[0.25em] font-bold mt-2">File Synchronization Gateway</p>
              </div>

              {/* Selector & Form */}
              <div className="space-y-5 sm:space-y-6">
                <div className="flex p-0.5 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5">
                  <button
                    onClick={() => setUploadType('url')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-3 sm:py-4 rounded-lg transition-all duration-300 cursor-pointer font-black uppercase tracking-[0.15em] text-[0.5625rem] sm:text-xs",
                      uploadType === 'url' ? "bg-white dark:bg-white/10 text-cyan-700 dark:text-quantum-cyan shadow-lg border border-gray-200 dark:border-white/10" : "text-gray-400 dark:text-white/20 hover:text-gray-600 dark:hover:text-white/40"
                    )}
                  >
                    <Zap className="w-3.5 h-3.5" /> 加密筆記
                  </button>
                  <button
                    onClick={() => setUploadType('file')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-3 sm:py-4 rounded-lg transition-all duration-300 cursor-pointer font-black uppercase tracking-[0.15em] text-[0.5625rem] sm:text-xs",
                      uploadType === 'file' ? "bg-white dark:bg-white/10 text-cyan-700 dark:text-quantum-cyan shadow-lg border border-gray-200 dark:border-white/10" : "text-gray-400 dark:text-white/20 hover:text-gray-600 dark:hover:text-white/40"
                    )}
                  >
                    <FileUp className="w-3.5 h-3.5" /> 實體資料
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="min-h-[clamp(7rem,12vh,9rem)] flex flex-col justify-center">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={uploadType}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="space-y-2"
                      >
                        <label className="text-[0.5625rem] font-black text-gray-500 dark:text-stellar-label uppercase tracking-[0.3em] ml-2 dark:opacity-50">資料源</label>
                        {uploadType === 'url' ? (
                          <textarea
                            required
                            value={formData.content}
                            onChange={(e) => setFormData(p => ({ ...p, content: e.target.value }))}
                            placeholder="輸入網址或任何想保存的文字資訊..."
                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-5 py-3.5 sm:py-4 outline-none focus:border-quantum-cyan focus:bg-white dark:focus:bg-white/10 transition-all text-gray-900 dark:text-white text-sm sm:text-base font-medium shadow-inner min-h-[clamp(7rem,12vh,9rem)] resize-none placeholder:text-gray-400 dark:placeholder:text-white/30"
                          />
                        ) : (
                          <div className="w-full rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/2">
                             {uppy ? (
                                <UppyDashboard
                                  uppy={uppy}
                                  className="w-full"
                                  props={{
                                    showProgressDetails: true,
                                    note: turboMode 
                                      ? 'Powered by Cloudflare R2 Acceleration (S3 Multipart)' 
                                      : 'Supports chunked & resumable uploads (powered by Tus)',
                                    theme: 'dark',
                                    hideUploadButton: true,
                                    height: 300,
                                    width: '100%'
                                  }}
                                />
                             ) : (
                               <div className="h-75 flex items-center justify-center text-gray-500">初始化中...</div>
                             )}
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[0.5625rem] font-black text-gray-500 dark:text-stellar-label uppercase tracking-[0.3em] ml-2 dark:opacity-50">密碼</label>
                    <div className="relative">
                      <input
                        type="password"
                        required
                        value={formData.password}
                        onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))}
                        placeholder="輸入解鎖密碼..."
                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-5 py-3.5 sm:py-4 outline-none focus:border-quantum-cyan focus:bg-white dark:focus:bg-white/10 transition-all text-gray-900 dark:text-white text-sm sm:text-base font-medium shadow-inner placeholder:text-gray-400 dark:placeholder:text-white/30"
                      />
                      <ShieldCheck className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 dark:text-white/10" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSyncing}
                    className="btn-stellar w-full flex items-center justify-center gap-3 py-4 sm:py-5 hover:scale-[1.01] active:scale-[0.99] shadow-lg bg-cyan-50 dark:bg-quantum-cyan/10 border-cyan-200 dark:border-quantum-cyan/30 cursor-pointer"
                  >
                    <span className="tracking-[clamp(0.3em,1vw,0.6em)] uppercase font-black text-gray-800 dark:text-white text-xs sm:text-sm pl-2">
                      {isSyncing ? '資料處理中...' : (uploadType === 'file' ? '開始高速上傳' : '提交資料')}
                    </span>
                    <Zap className={cn("w-4 h-4 sm:w-5 sm:h-5 text-cyan-600 dark:text-quantum-cyan", isSyncing && "animate-spin")} />
                  </button>
                </form>
              </div>
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
