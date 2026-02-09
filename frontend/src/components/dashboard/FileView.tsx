import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  File, FileText, Image as ImageIcon, Music, Video, 
  Download, Share2, Trash2, Edit3,
  Lock, Unlock, CheckSquare, Square, 
  AlertCircle, Clock, Cpu, X, Check, Loader2, MoreVertical
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface FileItem {
  name: string;
  size: number;
  size_bytes: number;
  expired: boolean;
  remaining_days: number;
  remaining_hours: number;
  is_locked?: boolean;
}

interface FileViewProps {
  files: FileItem[];
  username: string;
  token: string | null;
  selectedItems: { type: 'file' | 'url'; id: string }[];
  isAuthenticated: boolean;
  isBatchSyncing: boolean;
  onToggleSelect: (type: 'file' | 'url', id: string) => void;
  onToggleLock: (type: 'file' | 'url', id: string, currentStatus: boolean) => void;
  onBatchAction: (action: 'delete' | 'lock' | 'unlock') => void;
  onPreview: (file: { name: string; size: string; url: string }) => void;
  onShare: (filename: string) => void;
  onDelete: (filename: string) => void;
  onRename?: (oldName: string, newName: string) => Promise<boolean>;
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

const getLifecycleColor = (file: FileItem) => {
  if (file.expired) return 'text-red-400';
  if (file.remaining_days < 5) return 'text-neural-violet';
  return 'text-quantum-cyan';
};

export const FileView: React.FC<FileViewProps> = ({
  files,
  username,
  token,
  selectedItems,
  isAuthenticated,
  isBatchSyncing,
  onToggleSelect,
  onToggleLock,
  onBatchAction,
  onPreview,
  onShare,
  onDelete,
  onRename
}) => {
  const [renamingFile, setRenamingFile] = React.useState<string | null>(null);
  const [newName, setNewName] = React.useState('');
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState<string | null>(null);

  // Close mobile menu on click outside
  React.useEffect(() => {
    const handleClick = () => setMobileMenuOpen(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);


  const handleRename = async (oldName: string) => {
    if (!newName || newName === oldName || !onRename) {
      setRenamingFile(null);
      return;
    }
    
    setIsRenaming(true);
    try {
      const success = await onRename(oldName, newName);
      if (success) {
        setRenamingFile(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <section className="flex flex-col h-full bg-white/60 dark:bg-space-black/40 backdrop-blur-xl rounded-4xl border border-white/40 dark:border-white/5 shadow-2xl overflow-hidden relative group">
      <div className="absolute inset-0 bg-linear-to-b from-white/20 to-transparent dark:from-white/5 dark:to-transparent pointer-events-none" />
      
      {/* Panel Header */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-100/50 dark:border-white/5 flex items-center justify-between bg-white/20 dark:bg-white/2 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-600 dark:text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-white/90 tracking-tight">檔案列表</h2>
          <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-xs font-bold text-gray-500 dark:text-white/40">
            {files?.length || 0}
          </span>
        </div>

        {selectedItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center bg-white dark:bg-white/10 rounded-lg border border-gray-200 dark:border-white/10 p-1 shadow-sm"
          >
              <button 
                onClick={() => onBatchAction('lock')} 
                disabled={isBatchSyncing} 
                className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors text-violet-500" 
                title="Lock Selected"
              >
                <Lock className="w-4 h-4" />
              </button>
              <button 
                onClick={() => onBatchAction('unlock')} 
                disabled={isBatchSyncing} 
                className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors text-cyan-500" 
                title="Unlock Selected"
              >
                <Unlock className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-gray-200 dark:bg-white/10 mx-1" />
              <button 
                onClick={() => onBatchAction('delete')} 
                disabled={isBatchSyncing} 
                className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors text-red-500" 
                title="Delete Selected"
              >
                <Trash2 className="w-4 h-4" />
              </button>
          </motion.div>
        )}
      </div>

      {/* Scrollable File Grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
          <AnimatePresence>
            {files?.map((file, idx) => {
              const Icon = getFileIcon(file.name);
              const isSelected = !!selectedItems.find(i => i.type === 'file' && i.id === file.name);
              const isLocked = file.is_locked && !isAuthenticated;
              const isImage = !isLocked && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(file.name.split('.').pop()?.toLowerCase() || '');

              return (
                <motion.div
                  key={file.name}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => {
                    if (!isLocked) {
                      onPreview({
                        name: file.name,
                        size: formatSize(file.size_bytes),
                        url: `/api/download/${username}/${encodeURIComponent(file.name)}${token ? `?token=${token}` : ''}`
                      });
                    }
                  }}
                  className={cn(
                    "relative group flex flex-col bg-white/40 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-transparent hover:border-cyan-500/30 rounded-2xl transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1",
                    isSelected && "ring-2 ring-cyan-500 bg-cyan-50 dark:bg-cyan-900/10",
                    isLocked && "opacity-75"
                  )}
                >
                  {/* Selection Checkbox (Absolute) */}
                  {!isLocked && (
                    <div className="absolute top-3 left-3 z-30 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                       <button
                         onClick={(e) => { e.stopPropagation(); onToggleSelect('file', file.name); }}
                         className="p-1.5 bg-white/90 dark:bg-black/80 rounded-lg shadow-sm hover:scale-110 transition-transform"
                       >
                          {isSelected ? <CheckSquare className="w-4 h-4 text-cyan-600" /> : <Square className="w-4 h-4 text-gray-400" />}
                       </button>
                    </div>
                  )}

                  {/* Lock Status (Absolute) */}
                  <div className="absolute top-3 right-3 z-30">
                    {isAuthenticated ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleLock('file', file.name, !!file.is_locked); }}
                        className={cn(
                          "p-1.5 rounded-lg backdrop-blur-sm transition-all shadow-sm opacity-100 lg:opacity-0 lg:group-hover:opacity-100",
                          file.is_locked ? "bg-violet-500/10 text-violet-500 opacity-100" : "bg-white/80 dark:bg-black/50 text-gray-400 hover:text-gray-600"
                        )}
                      >
                         {file.is_locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                    ) : isLocked && (
                      <div className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white/70">
                        <Lock className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                     {/* Thumbnail / Icon */}
                  <div className="relative w-full aspect-[4/3] bg-gray-100/50 dark:bg-black/20 flex items-center justify-center overflow-hidden">
                     {(isImage || ['mp4', 'webm', 'mov'].includes(file.name.split('.').pop()?.toLowerCase() || '')) ? (
                       <img
                         src={`/api/thumbnail/${username}/${encodeURIComponent(file.name)}?v=2${token ? `&token=${token}` : ''}`}
                         alt={file.name}
                         loading="lazy"
                         className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                         onError={(e) => {
                           // Fallback to icon if thumbnail fails
                           e.currentTarget.style.display = 'none';
                           e.currentTarget.nextElementSibling?.classList.remove('hidden');
                         }}
                       />
                     ) : null}
                     
                     <div className={cn(
                       "flex items-center justify-center w-full h-full absolute inset-0 transition-all duration-300",
                       (isImage || ['mp4', 'webm', 'mov'].includes(file.name.split('.').pop()?.toLowerCase() || '')) ? "hidden" : "",
                     )}>
                        <Icon className={cn(
                          "w-12 h-12",
                          isLocked ? "text-gray-300 dark:text-gray-600 blur-sm" : "text-gray-400 dark:text-gray-500 group-hover:text-cyan-500 group-hover:scale-110"
                        )} />
                     </div>
                     {/* Desktop ONLY Hover Actions Overlay */}
                     {!isLocked && (
                       <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity hidden lg:flex items-center justify-center gap-2 z-20 pointer-events-none group-hover:pointer-events-auto">
                          <button 
                            onClick={(e) => { e.stopPropagation(); onShare(file.name); }} 
                            className="p-2 bg-white rounded-full text-gray-700 hover:text-cyan-600 hover:scale-110 transition-all shadow-lg" 
                            title="Share"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          <a 
                            href={`/api/download/${username}/${file.name}${token ? `?token=${token}` : ''}`} 
                            onClick={(e) => e.stopPropagation()} 
                            className="p-2 bg-white rounded-full text-gray-700 hover:text-cyan-600 hover:scale-110 transition-all shadow-lg" 
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(file.name); }}
                            className="p-2 bg-white rounded-full text-gray-700 hover:text-red-500 hover:scale-110 transition-all shadow-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {onRename && (
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setRenamingFile(file.name); 
                                setNewName(file.name); 
                              }}
                              className="p-2 bg-white rounded-full text-gray-700 hover:text-cyan-600 hover:scale-110 transition-all shadow-lg"
                              title="Rename"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                       </div>
                     )}
                  </div>

                  {/* Mobile Action Menu Dropdown - OUTSIDE thumbnail container */}
                  <AnimatePresence>
                    {mobileMenuOpen === file.name && (
                      <>
                        {/* Invisible backdrop to close menu */}
                        <div className="fixed inset-0 z-30 lg:hidden" onClick={(e) => { e.stopPropagation(); setMobileMenuOpen(null); }} />
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-2 top-1/2 -translate-y-1/2 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl p-2 flex flex-col gap-1 lg:hidden min-w-36 rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10"
                        >
                          <button 
                            onClick={(e) => { e.stopPropagation(); onShare(file.name); setMobileMenuOpen(null); }} 
                            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 transition-colors"
                          >
                            <Share2 className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-bold">分享</span>
                          </button>
                          <a 
                            href={`/api/download/${username}/${file.name}${token ? `?token=${token}` : ''}`}
                            onClick={() => setMobileMenuOpen(null)}
                            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 transition-colors"
                          >
                            <Download className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-bold">下載</span>
                          </a>
                          {onRename && (
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setRenamingFile(file.name); 
                                setNewName(file.name);
                                setMobileMenuOpen(null);
                              }}
                              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 transition-colors"
                            >
                              <Edit3 className="w-4 h-4 text-cyan-500" />
                              <span className="text-sm font-bold">重命名</span>
                            </button>
                          )}
                          <div className="h-px bg-gray-100 dark:bg-white/5 my-1" />
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(file.name); setMobileMenuOpen(null); }}
                            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-red-500/10 text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="text-sm font-bold">刪除</span>
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>

                  {/* Rename Overlay - OUTSIDE thumbnail container */}
                  <AnimatePresence>
                    {renamingFile === file.name && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute inset-x-0 inset-y-0 z-50 bg-white/98 dark:bg-gray-950/98 backdrop-blur-xl p-3 flex flex-col justify-center rounded-2xl border-2 border-cyan-500/20"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 bg-cyan-500/10 text-cyan-500 rounded-lg">
                            <Edit3 className="w-3.5 h-3.5" />
                          </div>
                          <label className="text-[0.625rem] font-bold text-gray-400 dark:text-white/30 uppercase tracking-[0.2em]">重新命名</label>
                        </div>
                        
                        <div className="relative mb-4">
                          <input
                            autoFocus
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRename(file.name);
                              if (e.key === 'Escape') setRenamingFile(null);
                            }}
                            className="w-full text-xs font-medium p-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 dark:text-white outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all"
                            placeholder="輸入新名稱..."
                          />
                        </div>

                        <div className="flex gap-2">
                          <button 
                            onClick={() => setRenamingFile(null)}
                            className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/40 text-[0.625rem] font-bold uppercase tracking-widest active:scale-95 transition-transform"
                          >
                            取消
                          </button>
                          <button 
                            onClick={() => handleRename(file.name)}
                            disabled={isRenaming}
                            className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white text-[0.625rem] font-bold uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-cyan-500/20"
                          >
                            {isRenaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            確認
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Info Footer */}
                  <div className="p-3 bg-white/50 dark:bg-white/5 flex-1 flex flex-col justify-between backdrop-blur-sm border-t border-white/20 dark:border-white/5">
                    <div className="mb-2">
                       {renamingFile === file.name ? (
                         <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                           <input
                             autoFocus
                             value={newName}
                             onChange={(e) => setNewName(e.target.value)}
                             onKeyDown={(e) => {
                               if (e.key === 'Enter') handleRename(file.name);
                               if (e.key === 'Escape') setRenamingFile(null);
                             }}
                             className="w-full text-sm p-2 rounded-lg border border-cyan-500/50 bg-white dark:bg-black/20 outline-none focus:ring-2 focus:ring-cyan-500/30"
                           />
                           <div className="flex gap-2">
                             <button 
                               onClick={() => handleRename(file.name)} 
                               disabled={isRenaming} 
                               className="flex-1 py-1.5 px-3 text-xs font-medium bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors flex items-center justify-center gap-1"
                             >
                               {isRenaming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                               確認
                             </button>
                             <button 
                               onClick={() => setRenamingFile(null)} 
                               disabled={isRenaming} 
                               className="flex-1 py-1.5 px-3 text-xs font-medium bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-white/20 transition-colors flex items-center justify-center gap-1"
                             >
                               <X className="w-3 h-3" />
                               取消
                             </button>
                           </div>
                         </div>
                       ) : (
                         <h3 className={cn("font-semibold text-sm truncate text-gray-800 dark:text-gray-200", isLocked && "blur-[3px]")}>{file.name}</h3>
                       )}
                       <div className="flex items-center gap-2 mt-1 justify-between">
                         <span className="text-[10px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-wider">{file.size} MB</span>
                         
                         {/* Mobile Menu Trigger */}
                         <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             setMobileMenuOpen(mobileMenuOpen === file.name ? null : file.name);
                           }}
                           className="lg:hidden p-1 -mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                         >
                           <MoreVertical className="w-4 h-4" />
                         </button>
                       </div>
                    </div>
                    <div className={cn("text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5", getLifecycleColor(file))}>
                      {file.expired ? (
                        <><AlertCircle className="w-3 h-3" /> 已過期</>
                      ) : file.remaining_days < 0 ? (
                        <><Clock className="w-3 h-3" /> 永久保留</>
                      ) : (
                        <><Clock className="w-3 h-3" /> 剩餘 {file.remaining_days} 天</>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        {(!files || files.length === 0) && (
           <div className="h-64 flex flex-col items-center justify-center text-gray-400 dark:text-white/20">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 opacity-50" />
              </div>
              <p className="text-sm font-medium">尚無檔案</p>
           </div>
        )}
      </div>
    </section>
  );
};
