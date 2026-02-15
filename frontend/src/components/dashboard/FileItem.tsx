import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Image as ImageIcon, 
  Music, 
  Video, 
  File as FileIcon, 
  MoreVertical, 
  Download, 
  Trash2, 
  Edit3, 
  Share2, 
  Lock, 
  Unlock, 
  QrCode,
  CheckSquare,
  Square,
  Folder as FolderIcon
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLongPress } from '../../hooks/useLongPress';
import type { Folder } from './FolderSidebar';
import { CascadingMenu } from '../ui/CascadingMenu';
import { DropdownMenu } from '../ui/DropdownMenu';

export interface FileItemData {
  name: string;
  size?: number;
  size_bytes: number;
  created?: string;
  expired?: boolean;
  remaining_days: number;
  remaining_hours?: number;
  is_locked?: boolean;
  folder_id?: string | null;
  uploaded_at?: number;
  timetolive?: number;
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
      return ImageIcon;
    case 'mp3':
    case 'wav':
    case 'ogg':
      return Music;
    case 'mp4':
    case 'webm':
    case 'mov':
    case 'avi':
      return Video;
    case 'pdf':
    case 'txt':
    case 'doc':
    case 'docx':
      return FileText;
    default:
      return FileIcon;
  }
};

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getLifecycleColor = (file: FileItemData) => {
  if (file.remaining_days <= 3) return "text-red-500 font-bold";
  if (file.remaining_days <= 7) return "text-amber-500 font-medium";
  return "text-green-500";
};

// ItemWrapper Component
const ItemWrapper = motion.div;

interface FileItemProps {
  file: FileItemData;
  username: string;
  token: string | null;
  isSelected: boolean;
  isSelectionMode: boolean;
  isAuthenticated: boolean;
  folders: Folder[];
  viewMode: 'grid' | 'list';
  idx: number; // for staggering animations
  
  onToggleSelect: (type: 'file', id: string) => void;
  onSelectionModeChange: (active: boolean) => void;
  onPreview: (file: { name: string; size: string; url: string }) => void;
  onBatchSelect: (items: { type: 'file' | 'url' | 'folder'; id: string }[], action: 'add' | 'remove' | 'set') => void;
  
  // Actions
  onShare: (filename: string) => void;
  onQrCode: (url: string) => void;
  onDelete: (filename: string) => void;
  onRename?: (oldName: string, newName: string) => Promise<boolean>;
  onToggleLock: (type: 'file', id: string, currentStatus: boolean) => void;
  onMoveItem: (type: 'file' | 'url' | 'folder', id: string, folderId: string | null) => void;
  
  renamingFile: string | null;
  setRenamingFile: (name: string | null) => void;
  selectedItemsCount: number; // to check if multi-drag
  // isMultiSelectDrag removed as unused
}

export const FileItem: React.FC<FileItemProps> = React.memo(({
  file,
  username,
  token,
  isSelected,
  isSelectionMode,
  isAuthenticated,
  folders,
  viewMode,
  idx,
  onToggleSelect,
  onSelectionModeChange,
  onPreview,
  onShare,
  onQrCode,
  onDelete,
  onRename,
  onToggleLock,
  onMoveItem,
  renamingFile,
  setRenamingFile,
  // selectedItemsCount removed from destructuring/usage if not needed, 
  // but it is in interface. Let's keep it in interface but unused.
}) => {
  const [newName, setNewName] = useState(file.name);
  
  const Icon = getFileIcon(file.name);
  const isLocked = file.is_locked && !isAuthenticated;
  const isDisplayable = !isLocked && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov'].includes(file.name.split('.').pop()?.toLowerCase() || '');

  const handleRename = async () => {
    if (!newName || newName === file.name || !onRename) {
      setRenamingFile(null);
      return;
    }

    try {
      const success = await onRename(file.name, newName);
      if (success) {
        setRenamingFile(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleClick = () => {
    if (isSelectionMode) {
        onToggleSelect('file', file.name);
        return;
    }
    if (!isLocked) {
        onPreview({
        name: file.name,
        size: formatSize(file.size_bytes),
        url: `/api/download/${username}/${encodeURIComponent(file.name)}${token ? `?token=${token}` : ''}`
        });
    }
  };

  // Bind long press and click logic
  const longPressBind = useLongPress(
    () => onSelectionModeChange(true),
    handleClick,
    { delay: 500 }
  );

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    // Basic drag support for single file
    event.dataTransfer.setData('application/json', JSON.stringify({ 
      type: 'file',
      id: file.name
    }));
    event.dataTransfer.effectAllowed = 'move';
  };

  const preventEventPropagation = (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
  };

  if (viewMode === 'list') {
    return (
      <ItemWrapper
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(idx * 0.02, 0.3) }}
        {...longPressBind}
        className={cn(
          "relative group flex items-center p-3 sm:p-4 gap-4 bg-white/40 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-transparent hover:border-cyan-500/30 rounded-xl transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md",
          isSelected && "ring-2 ring-cyan-500 bg-cyan-50 dark:bg-cyan-900/10",
          isLocked && "opacity-75"
        )}
        draggable={!isSelectionMode}
        onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent<HTMLDivElement>)}
      >
        {/* Selection Checkbox (Left) */}
        {isSelectionMode && (
          <div 
            className="shrink-0" 
            onClick={preventEventPropagation}
            onMouseDown={preventEventPropagation}
            onTouchStart={preventEventPropagation}
          >
            <button
               onClick={() => onToggleSelect('file', file.name)}
               className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              {isSelected ? (
                <CheckSquare className="w-5 h-5 text-cyan-500" />
              ) : (
                <Square className="w-5 h-5 text-gray-400" />
              )}
            </button>
          </div>
        )}

        {/* Icon */}
        <div className="shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
           {isLocked ? <Lock className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h3 className={cn(
              "text-sm font-medium text-gray-700 dark:text-gray-200 truncate pr-4 text-left",
               isSelected && "text-cyan-700 dark:text-cyan-300"
            )}>
              {renamingFile === file.name ? (
                 <form 
                    onSubmit={(e) => { e.preventDefault(); handleRename(); }}
                    onClick={preventEventPropagation}
                    onMouseDown={preventEventPropagation}
                    onTouchStart={preventEventPropagation}
                    className="flex-1 min-w-0"
                 >
                    <input
                      autoFocus
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onBlur={handleRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setRenamingFile(null);
                      }}
                      className="w-full bg-white dark:bg-black/20 border-2 border-cyan-500 rounded px-2 py-0.5 text-sm focus:outline-none"
                    />
                 </form>
              ) : (
                file.name
              )}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
               <span>{formatSize(file.size_bytes)}</span>
               <span>•</span>
               <span className={getLifecycleColor(file)}>
                  {file.remaining_days}天後過期
               </span>
            </div>
        </div>

        {/* Actions (Right) */}
        <div 
            className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" 
            onClick={preventEventPropagation}
            onMouseDown={preventEventPropagation}
            onTouchStart={preventEventPropagation}
        >
           {!isLocked && (
             <>
               <button
                  onClick={() => onPreview({
                    name: file.name,
                    size: formatSize(file.size_bytes),
                    url: `/api/download/${username}/${encodeURIComponent(file.name)}${token ? `?token=${token}` : ''}`
                  })}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-500 dark:text-gray-400 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors hidden sm:block"
                  title="預覽"
                >
                  <FileText className="w-4 h-4" />
                </button>
                <button
                   onClick={(e) => {
                     e.stopPropagation();
                     const link = document.createElement('a');
                     link.href = `/api/download/${username}/${encodeURIComponent(file.name)}${token ? `?token=${token}` : ''}`;
                     link.download = file.name;
                     link.click();
                   }}
                   className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-500 dark:text-gray-400 hover:text-green-500 dark:hover:text-green-400 transition-colors hidden sm:block"
                   title="下載"
                >
                  <Download className="w-4 h-4" />
                </button>
                
                {/* Independent Move Button for List View */}
                {folders.length > 0 && (
                    <CascadingMenu
                        folders={folders}
                        onSelect={(folderId) => onMoveItem('file', file.name, folderId)}
                        trigger={
                            <button className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-500 dark:text-gray-400 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors" title="移動">
                            <FolderIcon className="w-4 h-4" />
                            </button>
                        }
                    />
                )}
             </>
           )}
           
           <DropdownMenu
              trigger={
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-500 dark:text-gray-400 transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              }
              items={[
                !isLocked && {
                  label: '重新命名',
                  icon: <Edit3 className="w-4 h-4" />,
                  onClick: () => {
                     setNewName(file.name);
                     setRenamingFile(file.name);
                  }
                },
                !isLocked && {
                   label: '分享',
                   icon: <Share2 className="w-4 h-4" />,
                   onClick: () => onShare && onShare(file.name)
                },
                !isLocked && {
                    label: 'QR Code',
                    icon: <QrCode className="w-4 h-4" />,
                    onClick: () => onQrCode && onQrCode(file.name)
                },
                {
                   label: isLocked ? '解鎖' : '鎖定',
                   icon: isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />,
                   onClick: () => onToggleLock && onToggleLock('file', file.name, !file.is_locked),
                   variant: isLocked ? 'success' : undefined
                },
                !isLocked && {
                   label: '刪除',
                   icon: <Trash2 className="w-4 h-4" />,
                   onClick: () => onDelete && onDelete(file.name),
                   variant: 'danger'
                }
              ].filter(Boolean) as any[]}
           />
        </div>
      </ItemWrapper>
    );
  }

  // Grid View (Default)
  return (
    <ItemWrapper
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(idx * 0.03, 0.5) }}
      {...longPressBind}
      className={cn(
        "relative group flex flex-col bg-white/40 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-transparent hover:border-cyan-500/30 rounded-2xl transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1 file-item h-full",
        isSelected && "ring-2 ring-cyan-500 bg-cyan-50 dark:bg-cyan-900/10",
        isLocked && "opacity-75"
      )}
      draggable={!isSelectionMode}
      onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent<HTMLDivElement>)}
    >
      {!isLocked && (
        <div className={cn(
          "absolute top-3 left-3 z-30 transition-opacity",
          (isSelected || isSelectionMode) 
            ? "opacity-100 pointer-events-auto" 
            : "opacity-0 pointer-events-none lg:group-hover:opacity-100 lg:group-hover:pointer-events-auto"
        )}>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect('file', file.name); }}
            onMouseDown={preventEventPropagation}
            onTouchStart={preventEventPropagation}
            className="p-2 sm:p-1.5 bg-white/90 dark:bg-black/80 rounded-lg shadow-sm min-w-10 min-h-10 flex items-center justify-center"
          >
            {isSelected ? <CheckSquare className="w-4 h-4 text-cyan-600" /> : <Square className="w-4 h-4 text-gray-400" />}
          </button>
        </div>
      )}

      <div className="relative w-full aspect-4/3 bg-gray-100/50 dark:bg-black/20 flex items-center justify-center overflow-hidden">
        {isDisplayable ? (
          <img
            src={`/api/thumbnail/${username}/${encodeURIComponent(file.name)}?v=2${token ? `&token=${token}` : ''}`}
            alt={file.name}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}

        <div className={cn(
          "flex items-center justify-center w-full h-full absolute inset-0",
          isDisplayable ? "hidden" : "",
        )}>
          <Icon className={cn(
            "w-12 h-12",
            isLocked ? "text-gray-300 dark:text-gray-600 blur-sm" : "text-gray-400 dark:text-gray-500"
          )} />
        </div>
        
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity hidden lg:flex flex-wrap items-end content-end justify-center gap-1 p-2 z-20 pointer-events-none">
            <button
              onClick={(e) => { e.stopPropagation(); onShare(file.name); }}
              onMouseDown={preventEventPropagation}
              onMouseUp={(e) => e.stopPropagation()}
              onTouchStart={preventEventPropagation}
              onTouchEnd={(e) => e.stopPropagation()}
              className="p-2 bg-white rounded-full text-gray-700 hover:text-cyan-600 shadow-lg transition-transform hover:scale-110 pointer-events-auto"
              title="分享"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const url = `${window.location.origin}/api/download/${username}/${encodeURIComponent(file.name)}${token ? `?token=${token}` : ''}`;
                onQrCode(url);
              }}
              onMouseDown={preventEventPropagation}
              onMouseUp={(e) => e.stopPropagation()}
              onTouchStart={preventEventPropagation}
              onTouchEnd={(e) => e.stopPropagation()}
              className="p-2 bg-white rounded-full text-gray-700 hover:text-violet-600 shadow-lg transition-transform hover:scale-110 pointer-events-auto"
              title="QR Code"
            >
              <QrCode className="w-4 h-4" />
            </button>
            <a
              href={`/api/download/${username}/${file.name}${token ? `?token=${token}` : ''}`}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={preventEventPropagation}
              onMouseUp={(e) => e.stopPropagation()}
              onTouchStart={preventEventPropagation}
              onTouchEnd={(e) => e.stopPropagation()}
              className="p-2 bg-white rounded-full text-gray-700 hover:text-green-600 shadow-lg transition-transform hover:scale-110 pointer-events-auto"
              title="下載"
              download
            >
              <Download className="w-4 h-4" />
            </a>
            {folders.length > 0 && (
                <CascadingMenu
                folders={folders}
                onSelect={(folderId) => onMoveItem('file', file.name, folderId)}
                trigger={
                    <button 
                    className="p-2 bg-white rounded-full text-gray-700 hover:text-cyan-600 shadow-lg transition-transform hover:scale-110 pointer-events-auto" 
                    title="移動到..."
                    onMouseDown={preventEventPropagation}
                    onMouseUp={(e) => e.stopPropagation()}
                    onTouchStart={preventEventPropagation}
                    onTouchEnd={(e) => e.stopPropagation()}
                    >
                    <FolderIcon className="w-4 h-4" />
                    </button>
                }
                />
            )}
            {isAuthenticated && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenamingFile(file.name);
                    setNewName(file.name);
                  }}
                  onMouseDown={preventEventPropagation}
                  onMouseUp={(e) => e.stopPropagation()}
                  onTouchStart={preventEventPropagation}
                  onTouchEnd={(e) => e.stopPropagation()}
                  className="p-2 bg-white rounded-full text-gray-700 hover:text-cyan-600 shadow-lg transition-transform hover:scale-110 pointer-events-auto"
                  title="重命名項目"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleLock('file', file.name, !!file.is_locked); }}
                  onMouseDown={preventEventPropagation}
                  onMouseUp={(e) => e.stopPropagation()}
                  onTouchStart={preventEventPropagation}
                  onTouchEnd={(e) => e.stopPropagation()}
                  className={cn(
                    "p-2 bg-white rounded-full shadow-lg transition-transform hover:scale-110 pointer-events-auto",
                    file.is_locked ? "text-violet-600" : "text-gray-700 hover:text-violet-600"
                  )}
                  title={file.is_locked ? "解除鎖定" : "鎖定項目"}
                >
                  {file.is_locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(file.name); }}
                  onMouseDown={preventEventPropagation}
                  onMouseUp={(e) => e.stopPropagation()}
                  onTouchStart={preventEventPropagation}
                  onTouchEnd={(e) => e.stopPropagation()}
                  className="p-2 bg-white rounded-full text-gray-700 hover:text-red-500 shadow-lg transition-transform hover:scale-110 pointer-events-auto"
                  title="刪除項目"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
      </div>
          
      {/* File Info for Grid */}
      <div className="p-3">
        <h3 className={cn(
          "font-bold text-gray-800 dark:text-gray-100 truncate mb-1 text-sm text-left pl-1",
          isSelected ? "text-cyan-600 dark:text-cyan-400" : ""
        )}>
          {renamingFile === file.name ? (
              <form 
              onSubmit={(e) => { e.preventDefault(); handleRename(); }}
              onClick={preventEventPropagation}
              onMouseDown={preventEventPropagation}
              onTouchStart={preventEventPropagation}
              >
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onBlur={handleRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setRenamingFile(null);
                    }}
                    className="w-full bg-white dark:bg-black/20 border-2 border-cyan-500 rounded px-2 py-0.5 text-xs focus:outline-none"
                  />
              </form>
          ) : (
            file.name
          )}
        </h3>
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] text-gray-500 dark:text-gray-400">{formatSize(file.size_bytes)}</span>
           <span className={cn("text-[10px] font-medium", getLifecycleColor(file))}>
              {file.remaining_days}天
           </span>
        </div>
      </div>
    </ItemWrapper>
  );
});
