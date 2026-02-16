import React, { useState } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import {
  Folder as FolderIcon, CheckSquare, Square, Edit3, Trash2, Check, X,
  MoreVertical, Share2, QrCode, Download, Lock, Unlock
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLongPress } from '../../hooks/useLongPress';
import { setDragPreview, type DragItem } from '../../utils/dragUtils';
import type { Folder } from './FolderSidebar';
import { DropdownMenu } from '../ui/DropdownMenu';
import { CascadingMenu } from '../ui/CascadingMenu';

interface ItemWrapperProps extends Omit<HTMLMotionProps<"div">, 'onClick' | 'onDragStart' | 'onDragEnd' | 'onDrag' | 'onDragOver' | 'onDragEnter' | 'onDragLeave' | 'onDrop'> {
  onClick: (e: React.MouseEvent | React.TouchEvent) => void;
  onLongPress: (e: React.MouseEvent | React.TouchEvent) => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
}

const ItemWrapper: React.FC<ItemWrapperProps & { isSelectionMode?: boolean; draggable?: boolean }> = ({ 
  onClick, onLongPress, isSelectionMode, draggable, ...props 
}) => {
  const handlers = useLongPress(onLongPress, onClick, { delay: 600 });
  const motionProps = props as HTMLMotionProps<"div">;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filteredHandlers: Record<string, any> = { ...handlers };
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
  
  if (isDesktop && draggable) {
    delete filteredHandlers.onMouseDown;
    delete filteredHandlers.onMouseUp;
  }

  return (
    <motion.div 
      {...motionProps} 
      draggable={draggable}
      {...(isSelectionMode 
        ? { onClick } 
        : (isDesktop && draggable 
            ? { ...filteredHandlers, onClick } 
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            : (filteredHandlers as any)
          )
      )}
    >
      {props.children}
    </motion.div>
  );
};

interface FolderItemProps {
  folder: Folder;
  isSelected: boolean;
  isSelectionMode: boolean;
  isAuthenticated: boolean;
  onToggleSelect: (type: 'folder', id: string) => void;
  onFolderClick: (id: string) => void;
  onSelectionModeChange: (active: boolean) => void;
  onUpdateFolder?: (id: string, name: string) => Promise<void>;
  onDeleteFolder?: (id: string) => Promise<void>;
  onMoveItem: (type: 'file' | 'url' | 'folder', id: string, folderId: string | null) => void;
  dragOverFolderId: string | null;
  setDragOverFolderId: (id: string | null) => void;
  renamingFolderId: string | null;
  setRenamingFolderId: (id: string | null) => void;
  // New props for full folder actions
  folders?: Folder[];
  onShare?: (folderId: string) => void;
  onQrCode?: (folderId: string) => void;
  onDownloadFolder?: (folderId: string) => void;
  onToggleLock?: (type: 'folder', id: string, currentStatus: boolean) => void;
}

export const FolderItem: React.FC<FolderItemProps> = React.memo(({
  folder,
  isSelected,
  isSelectionMode,
  isAuthenticated,
  onToggleSelect,
  onFolderClick,
  onSelectionModeChange,
  onUpdateFolder,
  onDeleteFolder,
  onMoveItem,
  dragOverFolderId,
  setDragOverFolderId,
  renamingFolderId,
  setRenamingFolderId,
  folders = [],
  onShare,
  onQrCode,
  onDownloadFolder,
  onToggleLock,
}) => {
  const [newName, setNewName] = useState(folder.name);
  const [isRenaming, setIsRenaming] = useState(false);

  const handleRenameFolder = async () => {
    if (!newName || !onUpdateFolder) {
      setRenamingFolderId(null);
      return;
    }

    setIsRenaming(true);
    try {
      await onUpdateFolder(folder.id, newName);
      setRenamingFolderId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnterFolder = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolderId(folder.id);
  };

  const handleDragLeaveFolder = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolderId(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    
    try {
      const parsed = JSON.parse(data);
      if (parsed.items && Array.isArray(parsed.items)) {
        parsed.items.forEach((item: { type: 'file' | 'url' | 'folder', id: string }) => {
          if (item.type === 'folder' && item.id === folder.id) return;
          onMoveItem(item.type, item.id, folder.id);
        });
        return;
      }
      const { type, id } = parsed;
      if (type && id) {
        if (type === 'folder' && id === folder.id) return;
        onMoveItem(type, id, folder.id);
      }
    } catch (err) {
      console.error("Drop error:", err);
    }
  };

  // Common dropdown items for mobile menus
  const mobileDropdownItems = [
    { 
      label: '分享', 
      icon: <Share2 className="w-4 h-4 text-blue-500" />, 
      onClick: () => onShare?.(folder.id),
      hidden: !onShare
    },
    {
      label: 'QR Code',
      icon: <QrCode className="w-4 h-4 text-violet-500" />,
      onClick: () => onQrCode?.(folder.id),
      hidden: !onQrCode
    },
    {
      label: '下載',
      icon: <Download className="w-4 h-4 text-green-500" />,
      onClick: () => onDownloadFolder?.(folder.id),
      hidden: !onDownloadFolder
    },
    {
      label: '重命名',
      icon: <Edit3 className="w-4 h-4 text-cyan-500" />,
      onClick: () => { setRenamingFolderId(folder.id); setNewName(folder.name); },
      hidden: !isAuthenticated
    },
    {
      label: folder.is_locked ? '解除鎖定' : '鎖定資料夾',
      icon: folder.is_locked ? <Unlock className="w-4 h-4 text-violet-500" /> : <Lock className="w-4 h-4 text-gray-400" />,
      onClick: () => onToggleLock?.('folder', folder.id, !!folder.is_locked),
      hidden: !onToggleLock || !isAuthenticated
    },
    {
      label: '移動',
      icon: <CheckSquare className="w-4 h-4 text-orange-500" />,
      onClick: () => {}, // Triggered via cascading menu
      isCascading: true,
      hidden: !onMoveItem || !isAuthenticated
    },
    { label: 'separator', icon: null, onClick: () => {}, hidden: !isAuthenticated },
    {
      label: '刪除',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => {
        if (window.confirm(`確定要刪除資料夾 "${folder.name}" 嗎？`)) {
          onDeleteFolder?.(folder.id);
        }
      },
      variant: 'danger' as const,
      hidden: !onDeleteFolder || !isAuthenticated
    }
  ];

  return (
    <ItemWrapper
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      isSelectionMode={isSelectionMode}
      className={cn(
        "group relative p-3 rounded-2xl border transition-all cursor-pointer folder-card h-full shadow-sm hover:shadow-xl hover:-translate-y-1",
        folder.id === dragOverFolderId && "ring-2 ring-cyan-500 bg-cyan-100 dark:bg-cyan-900/30 scale-105 z-10",
        isSelected 
          ? "ring-2 ring-cyan-500 bg-cyan-50 dark:bg-cyan-900/10 border-transparent" 
          : "bg-white dark:bg-white/5 border-gray-100 dark:border-white/10 hover:border-cyan-500/50 hover:bg-cyan-500/5"
      )}
      draggable={!isSelectionMode}
      onDragStart={(event) => {
        const e = event as unknown as React.DragEvent<HTMLDivElement>;
        const itemsToDrag: DragItem[] = [{ type: 'folder', id: folder.id }];
        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'folder', id: folder.id }));
        e.dataTransfer.effectAllowed = 'move';
        setDragPreview(e, itemsToDrag);
      }}
      onClick={() => {
        if (isSelectionMode) {
          onToggleSelect('folder', folder.id);
        } else {
          onFolderClick(folder.id);
        }
      }} 
      onLongPress={() => onSelectionModeChange(true)}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnterFolder}
      onDragLeave={handleDragLeaveFolder}
      onDrop={handleDrop}
    >
      {/* Selection Checkbox */}
      <div className={cn(
        "absolute top-1.5 left-1.5 z-30 transition-opacity",
        (isSelected || isSelectionMode) 
          ? "opacity-100 pointer-events-auto" 
          : "opacity-0 pointer-events-none lg:group-hover:opacity-100 lg:group-hover:pointer-events-auto"
      )}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect('folder', folder.id); }}
          className="p-1 rounded bg-white/90 dark:bg-black/80 shadow-sm hover:bg-white dark:hover:bg-black"
        >
           {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-cyan-600" /> : <Square className="w-3.5 h-3.5 text-gray-400" />}
        </button>
      </div>

       {/* Lock Badge (Top-Left, below checkbox if selected) */}
       {folder.is_locked && (
        <div className={cn(
          "absolute top-1.5 z-20 pointer-events-none",
          (isSelected || isSelectionMode) ? "left-8" : "left-1.5"
        )}>
          <div className="p-1 rounded bg-white/90 dark:bg-black/80 shadow-sm">
            <Lock className="w-3.5 h-3.5 text-gray-400" />
          </div>
        </div>
      )}

      {/* Mobile Action Menu (top-right) */}
      {!isSelectionMode && (
        <div className="absolute top-1.5 right-1.5 z-30 lg:hidden" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu
            trigger={
              <button
                className="p-1.5 rounded-lg backdrop-blur-sm transition-all shadow-sm bg-white/80 dark:bg-black/50 text-gray-500 hover:text-cyan-500 min-w-8 min-h-8 flex items-center justify-center"
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            }
            items={mobileDropdownItems}
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="p-2 bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 rounded-lg shrink-0">
          <FolderIcon className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          {renamingFolderId === folder.id ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameFolder();
                  if (e.key === 'Escape') setRenamingFolderId(null);
                }}
                className="w-full text-xs p-1 rounded border border-cyan-500/50 bg-white dark:bg-black/20 outline-none"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => { e.stopPropagation(); handleRenameFolder(); }}
                disabled={isRenaming}
                className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 rounded"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setRenamingFolderId(null); }}
                disabled={isRenaming}
                className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate group-hover:text-cyan-600 transition-colors">
              {folder.name}
            </h4>
          )}
        </div>
        
        {/* Desktop hover actions */}
            {/* Desktop Hover Actions (Overlay) */}
            {!renamingFolderId && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity hidden lg:flex flex-wrap items-center justify-center gap-1 z-20 pointer-events-none">
              {onShare && (
                <button
                  onClick={(e) => { e.stopPropagation(); onShare(folder.id); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                  className="p-1.5 bg-white rounded-full text-blue-500 hover:text-blue-600 shadow-md transition-transform hover:scale-110 pointer-events-auto"
                  title="分享"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              )}
              {onQrCode && (
                <button
                  onClick={(e) => { e.stopPropagation(); onQrCode(folder.id); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                  className="p-1.5 bg-white rounded-full text-violet-500 hover:text-violet-600 shadow-md transition-transform hover:scale-110 pointer-events-auto"
                  title="QR Code"
                >
                  <QrCode className="w-3.5 h-3.5" />
                </button>
              )}
              {onDownloadFolder && (
                 <button
                  onClick={(e) => { e.stopPropagation(); onDownloadFolder(folder.id); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                  className="p-1.5 bg-white rounded-full text-green-500 hover:text-green-600 shadow-md transition-transform hover:scale-110 pointer-events-auto"
                  title="下載資料夾"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              )}
              
              {isAuthenticated && (
                <>
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setRenamingFolderId(folder.id); 
                      setNewName(folder.name); 
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                    className="p-1.5 bg-white rounded-full text-cyan-500 hover:text-cyan-600 shadow-md transition-transform hover:scale-110 pointer-events-auto"
                    title="重命名"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {folders.length > 0 && (
                      <CascadingMenu
                        folders={folders}
                        onSelect={(folderId) => onMoveItem?.('folder', folder.id, folderId)}
                        trigger={
                          <button
                            className="p-1.5 bg-white rounded-full text-orange-500 hover:text-orange-600 shadow-md transition-transform hover:scale-110 pointer-events-auto"
                            title="移動到..."
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                          >
                            <FolderIcon className="w-3.5 h-3.5" />
                          </button>
                        }
                      />
                    )}
                </>
              )}

              {onToggleLock && isAuthenticated && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleLock('folder', folder.id, !!folder.is_locked); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                  className={cn(
                    "p-1.5 rounded-full shadow-md transition-transform hover:scale-110 pointer-events-auto",
                    folder.is_locked 
                      ? "bg-white text-violet-600 hover:text-violet-700" 
                      : "bg-white text-gray-400 hover:text-violet-600"
                  )}
                  title={folder.is_locked ? '解除鎖定' : '鎖定'}
                >
                  {folder.is_locked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                </button>
              )}

              {onDeleteFolder && isAuthenticated && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`確定要刪除資料夾 "${folder.name}" 嗎？`)) {
                      onDeleteFolder(folder.id);
                    }
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                  className="p-1.5 bg-white rounded-full text-gray-400 hover:text-red-500 shadow-md transition-transform hover:scale-110 pointer-events-auto"
                  title="刪除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            )}
      </div>
    </ItemWrapper>
  );
});
