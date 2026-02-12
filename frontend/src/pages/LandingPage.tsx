import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUp, Cpu, Orbit, Zap, Activity, ShieldCheck, UploadCloud, X, Terminal, FileText, Database, ArrowRight } from 'lucide-react';
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
  // State for the central input
  const [inputText, setInputText] = useState('');
  const [password, setPassword] = useState('');
  
  // Pending lists
  const [pendingNotes, setPendingNotes] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<any[]>([]); 
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [firstLoginUserInfo, setFirstLoginUserInfo] = useState<{ username: string, oldPwd: string } | null>(null);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  
  // Drag drop
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  // Dynamic Uppy Instance
  const [uppy, setUppy] = useState<Uppy | null>(null);

  useEffect(() => {
    if (uppy) uppy.destroy();

    // Safety check for config
    const allowed = data?.config?.allowed_extensions || null;

    const u = new Uppy({
      id: 'filenexus-uploader',
      autoProceed: false,
      debug: true,
      restrictions: {
        maxFileSize: 10 * 1024 * 1024 * 1024, // 10GB
        allowedFileTypes: allowed
      }
    });

    try {
        u.use(Tus, {
        endpoint: '/api/upload/tus',
        chunkSize: 5 * 1024 * 1024,
        retryDelays: [0, 1000, 3000, 5000],
        removeFingerprintOnSuccess: true,
        limit: 5,
        });

        u.on('file-added', () => {
        setPendingFiles(u.getFiles());
        });
        u.on('file-removed', () => {
        setPendingFiles(u.getFiles());
        });
        u.on('complete', () => {
        setPendingFiles([]); 
        });

        setUppy(u);
    } catch (e) {
        console.error("Uppy initialization failed", e);
    }

    return () => u.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.config]);

  // Sync password with Uppy meta
  useEffect(() => {
    if (uppy) uppy.setMeta({ password });
  }, [uppy, password]);

  // Memoize uppy props
  const uppyProps = React.useMemo(() => ({
    showProgressDetails: true,
    note: '拖放檔案至此 或 瀏覽選擇',
    theme: 'dark' as const,
    hideUploadButton: true,
    width: '100%',
    height: '100%'
  }), []);

  // --- Handlers ---

  const handleAddNote = () => {
    const trimmed = inputText.trim();
    if (trimmed) {
      setPendingNotes(prev => [...prev, trimmed]);
      setInputText('');
    }
  };

  const handleRemoveNote = (index: number) => {
    setPendingNotes(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleRemoveFile = (fileId: string) => {
      if (uppy) {
          uppy.removeFile(fileId);
      }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddNote();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      alert('請輸入密碼以驗證身分');
      return;
    }

    // Add current input if not empty
    let finalNotes = [...pendingNotes];
    if (inputText.trim()) {
      finalNotes.push(inputText.trim());
    }

    const hasFiles = uppy && uppy.getFiles().length > 0;

    if (finalNotes.length === 0 && !hasFiles) {
      alert('請輸入文字或加入檔案');
      return;
    }

    setIsSyncing(true);

    try {
      // 1. Upload Files
      if (hasFiles && uppy) {
        const result = await uppy.upload();
        if (result && result.failed && result.failed.length > 0) {
           throw new Error(`上傳失敗: ${result.failed.length} 個檔案未完成`);
        } else if (!result) {
           throw new Error('上傳未回傳結果');
        }
      }

      // 2. Upload Notes
      if (finalNotes.length > 0) {
        await Promise.all(finalNotes.map(async (note) => {
           const body = new FormData();
           body.append('url', note);
           body.append('password', password);
           const res = await fetch('/api/upload_url', { method: 'POST', body });
           if (!res.ok) {
             const err = await res.json();
             throw new Error(`筆記上傳失敗: ${note} - ${err.detail}`);
           }
        }));
      }

      // 3. Login & Redirect
      const body = new FormData();
      body.append('password', password);
      const res = await fetch('/api/login', { method: 'POST', body });
      
      if (res.ok) {
        const user = await res.json();
        if (user.first_login) {
          setFirstLoginUserInfo({ username: user.username, oldPwd: password });
          setRedirectPath(`/${user.username}`);
        } else {
          navigate(`/${user.username}`);
        }
      } else {
        alert('資料已提交，但自動登入失敗 (密碼可能錯誤？)');
        setIsSyncing(false);
      }

    } catch (err: any) {
      console.error(err);
      alert(err.message || '作業失敗，請檢查網路或密碼。');
      setIsSyncing(false);
    }
  };

  // --- Drag & Drop ---
  const handleDragEnter = useCallback((e: React.DragEvent | DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer) setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent | DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent | DragEvent) => {
    e.preventDefault(); e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent | DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragOver(false);
    dragCounter.current = 0;
    if (uppy && e.dataTransfer && e.dataTransfer.files?.length > 0) {
      Array.from(e.dataTransfer.files).forEach((file) => {
        try {
          uppy.addFile({ source: 'drag-drop-overlay', name: file.name, type: file.type, data: file });
        } catch (err) { console.warn('File add skipped:', err); }
      });
    }
  }, [uppy]);

  useEffect(() => {
    const handleWindowDragEnter = (e: DragEvent) => handleDragEnter(e);
    const handleWindowDragLeave = (e: DragEvent) => handleDragLeave(e);
    const handleWindowDragOver = (e: DragEvent) => handleDragOver(e);
    const handleWindowDrop = (e: DragEvent) => handleDrop(e);

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);
    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);


  return (
    // Outer container: Fix width to 100vw but use overflow-hidden to clip scrollbars
    // Note: w-full is better than w-screen to respect parent constraints
    <div className="relative h-[100dvh] w-full max-w-[100vw] overflow-hidden flex items-center justify-center bg-gray-50 dark:bg-black">
      {/* Background glow - only in dark mode */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] h-[90vh] bg-quantum-cyan/5 blur-[clamp(3rem,8vw,6rem)] rounded-full -z-10 animate-pulse hidden dark:block pointer-events-none" />

       {/* Drag Overlay */}
       <AnimatePresence>
        {isDragOver && (
          <motion.div
            key="drag-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99] bg-cyan-500/20 backdrop-blur-md flex flex-col items-center justify-center border-4 border-dashed border-cyan-400 p-8"
          >
            <div className="bg-white/90 dark:bg-black/80 p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
              <UploadCloud className="w-16 h-16 text-cyan-600 animate-bounce" />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">釋放滑鼠以上傳檔案</h2>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TRIPTYCH LAYOUT - FLEXBOX for Tight Coupling 
          Use max-w-full to prevent overflow
      */}
      <div className="w-full h-full flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-6 px-4 md:px-6 relative z-10 box-border">
        
        {/* --- [LEFT WING] Pending Notes --- */}
        <div className="order-2 lg:order-1 w-full lg:w-[260px] xl:w-[320px] flex flex-col h-[30vh] lg:h-[600px] transition-opacity duration-300 lg:opacity-60 lg:hover:opacity-100 min-w-0 shrink-0">
           
           <div className="glass-card h-full p-4 lg:p-6 rounded-3xl bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/20 dark:border-white/5 flex flex-col shadow-lg relative group overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                 <h3 className="text-xs font-black text-gray-500 dark:text-stellar-label uppercase tracking-[0.2em] flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-orange-500" />
                    待定筆記 ({pendingNotes.length})
                 </h3>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 relative z-10">
                <AnimatePresence mode="popLayout">
                  {pendingNotes.length === 0 ? (
                    <motion.div 
                       key="empty-notes"
                       initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                       exit={{ opacity: 0 }}
                       className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-white/10 space-y-4"
                    >
                       <div className="w-16 h-16 rounded-full border-2 border-dashed border-current flex items-center justify-center opacity-50">
                          <Zap className="w-6 h-6" />
                       </div>
                       <p className="text-[0.65rem] uppercase tracking-widest text-center font-bold">
                          請在中欄輸入<br/>並按 Enter
                       </p>
                    </motion.div>
                  ) : (
                    pendingNotes.map((note, idx) => (
                      <motion.div
                        key={`${idx}-${note.substring(0, 10)}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        layout
                        className="group/item relative p-4 bg-white/60 dark:bg-white/10 rounded-xl border border-white/20 dark:border-white/5 hover:border-orange-500/30 transition-all cursor-default shadow-sm backdrop-blur-sm"
                      >
                         <div className="flex items-start justify-between gap-3">
                            <p className="text-sm text-gray-700 dark:text-gray-200 break-all font-mono leading-relaxed">
                              {note}
                            </p>
                            <button
                              onClick={() => handleRemoveNote(idx)}
                              className="text-gray-400 hover:text-red-500 transition-colors opacity-100 lg:opacity-0 lg:group-hover/item:opacity-100"
                            >
                              <X className="w-4 h-4" />
                            </button>
                         </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
              
              {/* Decorative BG element */}
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-orange-500/10 blur-3xl rounded-full pointer-events-none" />
           </div>
        </div>

        {/* --- [CENTER CORE] Unified Input (Restored) --- */}
        <div className="order-1 lg:order-2 w-full max-w-2xl relative z-20 min-w-0 shrink-1">
           
           {/* Floating Title */}
           <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-6 lg:mb-8 space-y-2"
            >
              <div className="flex items-center justify-center gap-4">
                <h1 className="text-5xl lg:text-[3.5rem] font-bold tracking-tighter leading-none animate-stellar-text bg-clip-text text-transparent bg-gradient-to-br from-gray-900 via-gray-700 to-gray-500 dark:from-white dark:via-gray-200 dark:to-gray-500">FileNexus</h1>
                <Orbit className="w-8 h-8 text-cyan-500 animate-spin-slow opacity-80" />
              </div>
              <p className="text-[0.65rem] uppercase tracking-[0.6em] font-bold text-cyan-600/80 dark:text-quantum-cyan/60 pl-4">
                 Pro Max 整合網關
              </p>
            </motion.div>

           <div className="glass-card p-0.5 relative group mx-auto w-full shadow-2xl hover:shadow-cyan-500/10 transition-shadow duration-500">
              <div className="neural-border rounded-[2.5rem] p-6 lg:p-8 space-y-6 lg:space-y-8 bg-white/90 dark:bg-[#0a0a0a]/95 backdrop-blur-[40px] relative overflow-hidden">
                 
                 {/* Internal Glow */}
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-50" />

                 <div className="relative z-10 flex flex-col gap-5 lg:gap-6">
                    
                    {/* Core Header */}
                    <div className="text-center mb-2 flex items-center justify-center gap-2 opacity-80">
                      <Cpu className="w-5 h-5 text-cyan-500" />
                      <span className="text-sm font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400">資料傳輸核心</span>
                      <Activity className="w-4 h-4 text-purple-500 animate-pulse" />
                    </div>

                    {/* 1. Note Input */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <Zap className="w-3.5 h-3.5 text-orange-500" />
                        <label className="text-[0.6rem] font-black text-gray-500 dark:text-stellar-label uppercase tracking-[0.2em]">
                          快速筆記 / 網址
                        </label>
                      </div>
                      <div className="relative group/input">
                        <textarea
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="輸入內容..."
                          className="w-full h-24 lg:h-32 bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-cyan-500/50 focus:bg-white dark:focus:bg-white/[0.08] transition-all text-gray-900 dark:text-white/90 text-lg font-medium shadow-inner resize-none placeholder:text-gray-400 dark:placeholder:text-white/20 custom-scrollbar"
                        />
                        <div className="absolute bottom-4 right-4 flex items-center gap-2 text-[0.6rem] text-gray-400 uppercase tracking-widest font-bold bg-white dark:bg-white/10 border border-gray-100 dark:border-white/5 px-3 py-1.5 rounded-full pointer-events-none opacity-40 group-focus-within/input:opacity-100 transition-all transform group-focus-within/input:scale-105 shadow-sm">
                           <span>按 Enter</span>
                           <ArrowRight className="w-3 h-3" />
                        </div>
                      </div>
                    </div>

                    {/* 2. File Upload Box */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <FileUp className="w-3.5 h-3.5 text-cyan-500" />
                        <label className="text-[0.6rem] font-black text-gray-500 dark:text-stellar-label uppercase tracking-[0.2em]">
                          檔案上傳
                        </label>
                      </div>
                      <div className="w-full h-40 lg:h-52 rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] relative group/uppy hover:border-cyan-500/30 transition-all hover:bg-white/[0.05]">
                        {uppy ? (
                          <UppyDashboard
                            uppy={uppy}
                            className="w-full h-full absolute inset-0 [&_.uppy-Dashboard-inner]:!bg-transparent [&_.uppy-Dashboard-inner]:!border-none"
                            props={uppyProps}
                          />
                        ) : (
                          <div className="h-full flex items-center justify-center text-gray-400 text-sm">初始化中...</div>
                        )}
                      </div>
                    </div>

                    {/* 3. Auth & Submit */}
                    <div className="pt-6 border-t border-gray-100 dark:border-white/5 space-y-5">
                       <div className="space-y-2">
                          <label className="text-[0.6rem] font-black text-gray-500 dark:text-stellar-label uppercase tracking-[0.2em] ml-2 opacity-60">身分驗證</label>
                          <div className="relative group/auth">
                            <input
                              type="password"
                              required
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                              placeholder="輸入通行碼"
                              className="w-full bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl px-6 py-4 outline-none focus:border-quantum-cyan focus:bg-white dark:focus:bg-white/[0.08] transition-all text-gray-900 dark:text-white text-xl font-bold text-center tracking-[0.3em] placeholder:text-gray-400 placeholder:tracking-widest placeholder:text-xs placeholder:font-bold group-hover/auth:border-white/20"
                            />
                            <ShieldCheck className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 dark:text-white/10 group-focus-within/auth:text-cyan-500 transition-colors" />
                          </div>
                       </div>

                       <button
                          onClick={handleSubmit}
                          disabled={isSyncing}
                          className="btn-stellar w-full flex items-center justify-center gap-3 py-5 hover:scale-[1.01] active:scale-[0.99] shadow-xl hover:shadow-cyan-500/20 bg-gradient-to-r from-gray-800 to-black dark:from-cyan-600 dark:to-blue-600 text-white rounded-2xl transition-all cursor-pointer disabled:opacity-70 disabled:grayscale group/btn relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 pointer-events-none" />
                          <span className="tracking-[0.25em] uppercase font-black text-sm relative z-10">
                            {isSyncing ? '同步資料庫中...' : '確認並提交'}
                          </span>
                          <Zap className={cn("w-5 h-5 mb-0.5 relative z-10", isSyncing && "animate-spin")} />
                        </button>
                    </div>

                 </div>
              </div>
           </div>
        </div>


        {/* --- [RIGHT WING] Pending Files --- */}
        <div className="order-3 lg:order-3 w-full lg:w-[260px] xl:w-[320px] flex flex-col h-[30vh] lg:h-[600px] transition-opacity duration-300 lg:opacity-60 lg:hover:opacity-100 min-w-0 shrink-0">
           
           <div className="glass-card h-full p-4 lg:p-6 rounded-3xl bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/20 dark:border-white/5 flex flex-col shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                 <h3 className="text-xs font-black text-gray-500 dark:text-stellar-label uppercase tracking-[0.2em] flex items-center gap-2">
                    <Database className="w-4 h-4 text-purple-500" />
                    待傳檔案 ({pendingFiles.length})
                 </h3>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pl-1 relative z-10">
                <AnimatePresence mode="popLayout">
                   {pendingFiles.length === 0 ? (
                      <motion.div 
                         key="empty-files"
                         initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                         exit={{ opacity: 0 }}
                         className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-white/10 space-y-4"
                      >
                         <div className="w-16 h-16 rounded-full border-2 border-dashed border-current flex items-center justify-center opacity-50">
                            <FileText className="w-6 h-6" />
                         </div>
                         <p className="text-[0.65rem] uppercase tracking-widest text-center font-bold">
                            拖放檔案<br/>至任意處
                         </p>
                      </motion.div>
                   ) : (
                      pendingFiles.map((file) => (
                        <motion.div
                          key={file.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          layout
                          className="group/item relative p-3 bg-white/60 dark:bg-white/10 rounded-xl border border-white/20 dark:border-white/5 hover:border-purple-500/30 transition-all shadow-sm backdrop-blur-sm flex items-center gap-3 cursor-default"
                        >
                           <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                              <FileText className="w-5 h-5 text-gray-500 dark:text-gray-300" />
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-800 dark:text-gray-200 font-bold truncate">{file.name}</p>
                              <p className="text-[0.6rem] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-mono">
                                 {(file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                           </div>
                           <button
                             onClick={() => handleRemoveFile(file.id)}
                             className="text-gray-400 hover:text-red-500 transition-colors opacity-100 lg:opacity-0 lg:group-hover/item:opacity-100"
                           >
                             <X className="w-4 h-4" />
                           </button>
                        </motion.div>
                      ))
                   )}
                </AnimatePresence>
              </div>

              {/* Decorative BG element */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full pointer-events-none" />
           </div>
        </div>

      </div>

      <SecurityInitializationModal
        isOpen={!!firstLoginUserInfo}
        username={firstLoginUserInfo?.username || ""}
        oldPassword={firstLoginUserInfo?.oldPwd || ""}
        onSuccess={() => {
            alert("安全性初始化完成，正在跳轉至專屬區域。");
            navigate(redirectPath || '/');
        }}
      />
    </div>
  );
};
