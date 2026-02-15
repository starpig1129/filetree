import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  File, FileText, Image as ImageIcon, Music, Video,
  Download, Share2, Trash2, Edit3,
  Lock, Unlock, CheckSquare, Square,
  Clock, Cpu, X, Check, Loader2, MoreVertical, QrCode,
  LayoutGrid, List, Folder as FolderIcon, AlertCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSelectionBox } from '../../hooks/useSelectionBox';
import { useLongPress } from '../../hooks/useLongPress';
import { setDragPreview, type DragItem } from '../../utils/dragUtils';
import { BatchActionBar } from './BatchActionBar';
import { CascadingMenu } from '../ui/CascadingMenu';
import { DropdownMenu } from '../ui/DropdownMenu';
import type { Folder } from './FolderSidebar';

export interface FileItem {
  name: string;
  size: number;
  size_bytes: number;
  expired: boolean;
  remaining_days: number;
  remaining_hours: number;
  is_locked?: boolean;
  folder_id?: string | null;
}

interface FileViewProps {
  files: FileItem[];
  username: string;
  token: string | null;
  selectedItems: { type: 'file' | 'url' | 'folder'; id: string }[];
  isAuthenticated: boolean;
  onToggleSelect: (type: 'file' | 'url' | 'folder', id: string) => void;
  onSelectAll: (selected: boolean) => void;
  onBatchSelect: (items: { type: 'file' | 'url' | 'folder'; id: string }[], action: 'add' | 'remove' | 'set') => void;
  onToggleLock: (type: 'file' | 'url', id: string, currentStatus: boolean) => void;
  onPreview: (file: { name: string; size: string; url: string }) => void;
  onShare: (filename: string) => void;
  onQrCode: (url: string) => void;
  onDelete: (filename: string) => void;
  onRename?: (oldName: string, newName: string) => Promise<boolean>;
  folders: Folder[];
  activeFolderId: string | null;
  onMoveItem: (type: 'file' | 'url' | 'folder', id: string, folderId: string | null) => void;
  onFolderClick: (folderId: string) => void;
  onUpdateFolder?: (id: string, name: string) => Promise<void>;
  onDeleteFolder?: (id: string) => Promise<void>;
  onBatchAction?: (action: 'lock' | 'unlock' | 'download' | 'delete' | 'move', folderId?: string | null) => void;
  isBatchSyncing?: boolean;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  isSelectionMode: boolean;
  onSelectionModeChange: (active: boolean) => void;
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext!)) return ImageIcon;
  if (['mp4', 'webm', 'mov'].includes(ext!)) return Video;
  if (['mp3', 'wav', 'ogg'].includes(ext!)) return Music;
  if (['pdf', 'doc', 'docx', 'txt'].includes(ext!)) return FileText;
  return File;
};

import type { HTMLMotionProps } from 'framer-motion';

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
  
  // In selection mode, bypass useLongPress to ensure immediate click response on mobile
  const motionProps = props as HTMLMotionProps<"div">;
  
  // On desktop, if draggable is true, we should let the browser handle mousedown/mouseup for dragging
  // useLongPress mouse handlers can sometimes interfere with native drag start
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filteredHandlers: Record<string, any> = { ...handlers };
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024; // lg breakpoint
  
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
  onToggleSelect,
  onSelectAll,
  onBatchSelect,
  onToggleLock,
  onPreview,
  onShare,
  onQrCode,
  onDelete,
  onRename,
  folders,
  activeFolderId,
  onMoveItem,
  onFolderClick,
  onUpdateFolder,
  onDeleteFolder,
  onBatchAction,
  isBatchSyncing = false,
  viewMode,
  onViewModeChange,
  isSelectionMode,
  onSelectionModeChange
}) => {
  const [renamingFile, setRenamingFile] = React.useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = React.useState<string | null>(null);
  const [newName, setNewName] = React.useState('');
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [dragOverFolderId, setDragOverFolderId] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Filter folders for current view
  const currentSubfolders = folders.filter(f => f.parent_id === activeFolderId && f.type === 'file');

  const { selectionBox, handlePointerDown, handlePointerMove, handlePointerUp, handleTouchStart, handleTouchMove } = useSelectionBox(
    containerRef,
    ".folder-card, .file-item",
    React.useCallback((indices: number[]) => {
      const selectedItemsList: { type: 'file' | 'url' | 'folder'; id: string }[] = [];
      const folderCount = currentSubfolders.length;

      indices.forEach(idx => {
        if (idx < folderCount) {
          selectedItemsList.push({ type: 'folder', id: currentSubfolders[idx].id });
        } else {
          const fileIdx = idx - folderCount;
          if (files && files[fileIdx]) {
            selectedItemsList.push({ type: 'file', id: files[fileIdx].name });
          }
        }
      });
      
      onBatchSelect(selectedItemsList, 'set');
    }, [files, currentSubfolders, onBatchSelect])
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnterFolder = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverFolderId(folderId);
  };

  const handleDragLeaveFolder = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolderId(null);
  };

  const handleDrop = (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    
    try {
      const parsed = JSON.parse(data);
      
      // Handle batch items
      if (parsed.items && Array.isArray(parsed.items)) {
        parsed.items.forEach((item: { type: 'file' | 'url' | 'folder', id: string }) => {
          if (item.type === 'folder' && item.id === targetFolderId) return; // Prevent self-drop
          onMoveItem(item.type, item.id, targetFolderId);
        });
        return;
      }

      // Handle single item (backward compatibility)
      const { type, id } = parsed;
      if (type && id) {
        if (type === 'folder' && id === targetFolderId) return;
        onMoveItem(type, id, targetFolderId);
      }
    } catch (err) {
      console.error("Drop error:", err);
    }
  };

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

  const handleRenameFolder = async (id: string) => {
    if (!newName || !onUpdateFolder) {
      setRenamingFolderId(null);
      return;
    }

    setIsRenaming(true);
    try {
      await onUpdateFolder(id, newName);
      setRenamingFolderId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRenaming(false);
    }
  };


  const selectableFiles = files?.filter(f => !f.is_locked || isAuthenticated) || [];
  const isAllSelected = selectableFiles.length > 0 && selectableFiles.every(f => selectedItems.some(i => i.type === 'file' && i.id === f.name));

  return (
    <section className="flex-1 min-h-0 flex flex-col bg-white/60 dark:bg-space-black/40 backdrop-blur-xl rounded-4xl border border-white/40 dark:border-white/5 shadow-2xl overflow-hidden relative">
      <div className="absolute inset-0 bg-linear-to-b from-white/20 to-transparent dark:from-white/5 dark:to-transparent pointer-events-none" />

      {/* Panel Header - Hidden on mobile */}
      <div className="hidden lg:flex shrink-0 px-4 py-3 lg:px-6 lg:py-4 border-b border-gray-100/50 dark:border-white/5 items-center justify-between bg-white/20 dark:bg-white/2 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectAll(!isAllSelected)}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            {isAllSelected ? (
              <CheckSquare className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            ) : (
              <Square className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            )}
          </button>
          <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-600 dark:text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
          <h2 className="text-base lg:text-lg font-bold text-gray-800 dark:text-white/90 tracking-tight">檔案列表</h2>
          <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-xs font-bold text-gray-500 dark:text-white/40">
            {files?.length || 0}
          </span>
          {activeFolderId && (
            <span className="text-sm text-cyan-600 dark:text-cyan-400 font-medium ml-2">
              / {folders.find(f => f.id === activeFolderId)?.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
            <button
              onClick={() => onViewModeChange('grid')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'grid' ? "bg-white dark:bg-white/10 text-cyan-500 shadow-sm" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'list' ? "bg-white dark:bg-white/10 text-cyan-500 shadow-sm" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {selectedItems.length > 0 && onBatchAction && (
             <BatchActionBar
                selectedCount={selectedItems.length}
                isBatchSyncing={isBatchSyncing}
                onAction={onBatchAction}
                folders={folders}
                mode="desktop"
             />
          )}

        </div>
      </div>

      {/* Scrollable File Area */}
      <div 
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        className="flex-1 overflow-y-auto p-3 sm:p-6 custom-scrollbar touch-pan-y relative"
      >
        {selectionBox && (
          <div
            className="absolute bg-cyan-500/20 border border-cyan-500/50 z-50 pointer-events-none rounded"
            style={{
              left: selectionBox.x1,
              top: selectionBox.y1,
              width: selectionBox.x2 - selectionBox.x1,
              height: selectionBox.y2 - selectionBox.y1,
            }}
          />
        )}
        {/* Render Folders */}
        {currentSubfolders.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 px-1">
              Folders
            </h3>
            <div className={cn(
              "grid gap-4",
              viewMode === 'grid' 
                ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" 
                : "grid-cols-1"
            )}>
              {currentSubfolders.map(folder => {
                const isSelected = !!selectedItems.find(i => i.type === 'folder' && i.id === folder.id);
                
                return (
                  <ItemWrapper
                    key={folder.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    isSelectionMode={isSelectionMode}
                    className={cn(
                      "group relative p-3 rounded-xl border transition-all cursor-pointer folder-card",
                      folder.id === dragOverFolderId && "ring-2 ring-cyan-500 bg-cyan-100 dark:bg-cyan-900/30 scale-105 z-10",
                      isSelected 
                        ? "bg-cyan-50 dark:bg-cyan-900/10 border-cyan-500 ring-2 ring-cyan-500" 
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
                    onDragEnter={(e) => handleDragEnterFolder(e, folder.id)}
                    onDragLeave={handleDragLeaveFolder}
                    onDrop={(e) => handleDrop(e, folder.id)}
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

                    <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 rounded-lg">
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
                              if (e.key === 'Enter') handleRenameFolder(folder.id);
                              if (e.key === 'Escape') setRenamingFolderId(null);
                            }}
                            className="w-full text-xs p-1 rounded border border-cyan-500/50 bg-white dark:bg-black/20 outline-none"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRenameFolder(folder.id); }}
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
                    
                    {isAuthenticated && !renamingFolderId && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        {onUpdateFolder && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingFolderId(folder.id);
                              setNewName(folder.name);
                            }}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-cyan-600"
                            title="Rename"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteFolder && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`確定要刪除資料夾 "${folder.name}" 嗎？`)) {
                                onDeleteFolder(folder.id);
                              }
                            }}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-500"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </ItemWrapper>
                );
              })}
            </div>
          </div>
        )}

        {(!files || files.length === 0) && currentSubfolders.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400 dark:text-white/20">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 opacity-50" />
            </div>
            <p className="text-sm font-medium">尚無檔案</p>
          </div>
        ) : (!files || files.length === 0) ? null : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
            <AnimatePresence>
              {files?.map((file, idx) => {
                const Icon = getFileIcon(file.name);
                const isSelected = !!selectedItems.find(i => i.type === 'file' && i.id === file.name);
                const isLocked = file.is_locked && !isAuthenticated;
                const isDisplayable = !isLocked && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov'].includes(file.name.split('.').pop()?.toLowerCase() || '');

                return (
                  <ItemWrapper
                    key={file.name}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    isSelectionMode={isSelectionMode}
                    onClick={() => {
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
                    }}
                    onLongPress={() => onSelectionModeChange(true)}
                    className={cn(
                      "relative group flex flex-col bg-white/40 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-transparent hover:border-cyan-500/30 rounded-2xl transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1 file-item",
                      isSelected && "ring-2 ring-cyan-500 bg-cyan-50 dark:bg-cyan-900/10",
                      isLocked && "opacity-75"
                    )}
                    draggable={!isSelectionMode}
                    onDragStart={(event) => {
                      const e = event as unknown as React.DragEvent<HTMLDivElement>;
                      const isFileSelected = selectedItems.some(i => i.type === 'file' && i.id === file.name);
                      const itemsToDrag: DragItem[] = isFileSelected 
                        ? selectedItems.map(i => ({ type: i.type, id: i.id }))
                        : [{ type: 'file', id: file.name }];
                      
                      e.dataTransfer.setData('application/json', JSON.stringify({ 
                        items: itemsToDrag,
                        type: 'file',
                        id: file.name
                      }));
                      e.dataTransfer.effectAllowed = 'move';
                      setDragPreview(e, itemsToDrag);
                    }}
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
                          className="p-1.5 bg-white/90 dark:bg-black/80 rounded-lg shadow-sm"
                        >
                          {isSelected ? <CheckSquare className="w-4 h-4 text-cyan-600" /> : <Square className="w-4 h-4 text-gray-400" />}
                        </button>
                      </div>
                    )}

                    <div className="absolute top-3 right-3 z-30">
                      {isAuthenticated ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleLock('file', file.name, !!file.is_locked); }}
                          className={cn(
                            "p-1.5 rounded-lg backdrop-blur-sm transition-all shadow-sm opacity-100 lg:opacity-0 lg:group-hover:opacity-100",
                            file.is_locked ? "bg-violet-500/10 text-violet-500 opacity-100" : "bg-white/80 dark:bg-black/50 text-gray-400"
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
                      
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity hidden lg:flex flex-wrap items-center justify-center gap-2 p-4 z-20 pointer-events-none">
                          <button
                            onClick={(e) => { e.stopPropagation(); onShare(file.name); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
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
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                            className="p-2 bg-white rounded-full text-gray-700 hover:text-violet-600 shadow-lg transition-transform hover:scale-110 pointer-events-auto"
                            title="QR Code"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <a
                            href={`/api/download/${username}/${file.name}${token ? `?token=${token}` : ''}`}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                            className="p-2 bg-white rounded-full text-gray-700 hover:text-green-600 shadow-lg transition-transform hover:scale-110 pointer-events-auto"
                            title="下載"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <CascadingMenu
                            folders={folders}
                            onSelect={(folderId) => onMoveItem('file', file.name, folderId)}
                            trigger={
                              <button 
                                className="p-2 bg-white rounded-full text-gray-700 hover:text-cyan-600 shadow-lg transition-transform hover:scale-110 pointer-events-auto" 
                                title="移動到..."
                                onMouseDown={(e) => e.stopPropagation()}
                                onMouseUp={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => e.stopPropagation()}
                              >
                                <FolderIcon className="w-4 h-4" />
                              </button>
                            }
                          />
                          {isAuthenticated && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenamingFile(file.name);
                                  setNewName(file.name);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onMouseUp={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => e.stopPropagation()}
                                className="p-2 bg-white rounded-full text-gray-700 hover:text-cyan-600 shadow-lg transition-transform hover:scale-110 pointer-events-auto"
                                title="重命名項目"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); onToggleLock('file', file.name, !!file.is_locked); }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onMouseUp={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
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
                                onMouseDown={(e) => e.stopPropagation()}
                                onMouseUp={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => e.stopPropagation()}
                                className="p-2 bg-white rounded-full text-gray-700 hover:text-red-600 shadow-lg transition-transform hover:scale-110 pointer-events-auto"
                                title="刪除項目"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                    {/* Top Action Menu - For Grid View on all devices */}
                     {!isSelectionMode && (
                       <div className="absolute top-3 right-3 z-30 lg:hidden" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu
                          trigger={
                            <button 
                              className={cn(
                                "p-1.5 rounded-lg backdrop-blur-sm transition-all shadow-sm bg-white/80 dark:bg-black/50 text-gray-500 hover:text-cyan-500"
                              )}
                              onMouseDown={(e) => e.stopPropagation()}
                              onMouseUp={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                              onTouchEnd={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          }
                          items={[
                            { label: '分享', icon: <Share2 className="w-4 h-4 text-blue-500" />, onClick: () => onShare(file.name), hidden: isLocked },
                            {
                              label: 'QR Code',
                              icon: <QrCode className="w-4 h-4 text-violet-500" />,
                              onClick: () => {
                                const url = `${window.location.origin}/api/download/${username}/${encodeURIComponent(file.name)}${token ? `?token=${token}` : ''}`;
                                onQrCode(url);
                              },
                              hidden: isLocked
                            },
                            {
                              label: '下載',
                              icon: <Download className="w-4 h-4 text-green-500" />,
                              onClick: () => {
                                const a = document.createElement('a');
                                a.href = `/api/download/${username}/${file.name}${token ? `?token=${token}` : ''}`;
                                a.click();
                              },
                              hidden: isLocked
                             },
                            {
                              label: '重命名',
                              icon: <Edit3 className="w-4 h-4 text-cyan-500" />,
                              onClick: () => { setRenamingFile(file.name); setNewName(file.name); },
                              hidden: !onRename || isLocked || !isAuthenticated
                            },
                            {
                              label: file.is_locked ? '解除鎖定' : '鎖定檔案',
                              icon: file.is_locked ? <Unlock className="w-4 h-4 text-violet-500" /> : <Lock className="w-4 h-4 text-gray-400" />,
                              onClick: () => onToggleLock('file', file.name, !!file.is_locked),
                              hidden: !isAuthenticated
                            },
                            { label: 'separator', icon: null, onClick: () => {}, hidden: !isAuthenticated },
                            {
                              label: '刪除',
                              icon: <Trash2 className="w-4 h-4" />,
                              onClick: () => onDelete(file.name),
                              variant: 'danger',
                              hidden: !isAuthenticated
                            }
                          ]}
                        />
                      </div>
                    )}
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
                              className="w-full text-sm p-2 rounded-lg border border-cyan-500/50 bg-white dark:bg-black/20 outline-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleRename(file.name)}
                                disabled={isRenaming}
                                className="flex-1 py-1.5 px-3 text-xs font-medium bg-cyan-500 text-white rounded-lg"
                              >
                                {isRenaming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                確認
                              </button>
                              <button
                                onClick={() => setRenamingFile(null)}
                                disabled={isRenaming}
                                className="flex-1 py-1.5 px-3 text-xs font-medium bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 rounded-lg"
                              >
                                <X className="w-3 h-3" />
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <h3 className={cn("font-semibold text-sm truncate pr-1 text-gray-800 dark:text-gray-200", isLocked && "blur-[3px]")}>{file.name}</h3>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-wider">{file.size} MB</span>
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
                  </ItemWrapper>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pb-20">
            <AnimatePresence>
              {files?.map((file, idx) => {
                const Icon = getFileIcon(file.name);
                const isSelected = !!selectedItems.find(i => i.type === 'file' && i.id === file.name);
                const isLocked = file.is_locked && !isAuthenticated;

                return (
                  <ItemWrapper
                    key={file.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    isSelectionMode={isSelectionMode}
                    onClick={() => {
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
                    }}
                    onLongPress={() => onSelectionModeChange(true)}
                    className={cn(
                      "relative group flex items-center gap-4 p-3 bg-white/40 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-transparent hover:border-cyan-500/30 rounded-xl transition-all duration-300 cursor-pointer shadow-sm file-item",
                      isSelected && "ring-2 ring-cyan-500 bg-cyan-50 dark:bg-cyan-900/10",
                      isLocked && "opacity-75"
                    )}
                    draggable={!isSelectionMode}
                    onDragStart={(event) => {
                      const e = event as unknown as React.DragEvent<HTMLDivElement>;
                      const isFileSelected = selectedItems.some(i => i.type === 'file' && i.id === file.name);
                      const itemsToDrag: DragItem[] = isFileSelected
                        ? (selectedItems.filter(i => (i.type === 'file' || i.type === 'folder')) as DragItem[])
                        : [{ type: 'file', id: file.name }];

                      e.dataTransfer.setData('application/json', JSON.stringify({
                        items: itemsToDrag,
                        type: 'file',
                        id: file.name
                      }));
                      e.dataTransfer.effectAllowed = 'move';
                      setDragPreview(e, itemsToDrag);
                    }}
                  >
                    <div className="flex items-center gap-3 shrink-0">
                      {!isLocked && (
                        <div className={cn(
                            "transition-opacity",
                            (isSelected || isSelectionMode) 
                              ? "opacity-100 pointer-events-auto" 
                              : "opacity-0 pointer-events-none lg:group-hover:opacity-100 lg:group-hover:pointer-events-auto"
                        )}>
                            <button
                                onClick={(e) => { e.stopPropagation(); onToggleSelect('file', file.name); }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onMouseUp={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => e.stopPropagation()}
                                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                            >
                                {isSelected ? <CheckSquare className="w-4 h-4 text-cyan-600" /> : <Square className="w-4 h-4 text-gray-400" />}
                            </button>
                        </div>
                      )}

                      <div className={cn(
                        "p-2 rounded-xl transition-all",
                        file.expired ? "bg-red-500/10 text-red-500" : "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      {renamingFile === file.name ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            autoFocus
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRename(file.name);
                              if (e.key === 'Escape') setRenamingFile(null);
                            }}
                            className="w-full text-sm p-1.5 rounded-lg border border-cyan-500/50 bg-white dark:bg-black/20 outline-none"
                          />
                          <button
                            onClick={() => handleRename(file.name)}
                            disabled={isRenaming}
                            className="p-1.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setRenamingFile(null)}
                            disabled={isRenaming}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className={cn("font-bold text-sm text-gray-700 dark:text-gray-200 truncate", isLocked && "blur-[3px]")}>
                            {file.name}
                          </h3>
                          {file.is_locked && (
                            <div className={cn(
                              "p-1 rounded-md",
                              isLocked ? "bg-black/40 text-white/70" : "bg-violet-500/10 text-violet-500"
                            )}>
                              <Lock className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-white/20 uppercase tracking-widest leading-none">
                          {file.size} MB
                        </span>
                        <div className="w-1 h-1 rounded-full bg-gray-300 dark:bg-white/10" />
                        <span className={cn("text-[10px] font-bold uppercase tracking-widest leading-none", getLifecycleColor(file))}>
                          {file.expired ? '已過期' : file.remaining_days < 0 ? '永久保留' : `剩餘 ${file.remaining_days} 天`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity pr-2">
                       {!isLocked && (
                        <div className="flex items-center gap-1">
                          {/* Desktop Actions */}
                          <div className="hidden lg:flex items-center gap-1">
                            {isAuthenticated && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onToggleLock('file', file.name, !!file.is_locked); }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onMouseUp={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => e.stopPropagation()}
                                className={cn(
                                  "p-2 rounded-lg transition-colors",
                                  file.is_locked ? "text-violet-500 bg-violet-500/10" : "text-gray-400 hover:text-cyan-600 hover:bg-cyan-500/5"
                                )}
                              >
                                {file.is_locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); onShare(file.name); }}
                              onMouseDown={(e) => e.stopPropagation()}
                              onMouseUp={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                              onTouchEnd={(e) => e.stopPropagation()}
                              className="p-2 text-gray-400 hover:text-cyan-600 hover:bg-cyan-500/5 rounded-lg transition-colors"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                            <a
                              href={`/api/download/${username}/${file.name}${token ? `?token=${token}` : ''}`}
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              onMouseUp={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                              onTouchEnd={(e) => e.stopPropagation()}
                              className="p-2 text-gray-400 hover:text-cyan-600 hover:bg-cyan-500/5 rounded-lg transition-colors"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                            <CascadingMenu
                              folders={folders}
                              onSelect={(folderId) => onMoveItem('file', file.name, folderId)}
                              trigger={
                                <button 
                                  className="p-2 text-gray-400 hover:text-cyan-600 hover:bg-cyan-500/5 rounded-lg transition-colors"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onMouseUp={(e) => e.stopPropagation()}
                                  onTouchStart={(e) => e.stopPropagation()}
                                  onTouchEnd={(e) => e.stopPropagation()}
                                >
                                  <FolderIcon className="w-4 h-4" />
                                </button>
                              }
                            />
                            {isAuthenticated && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onDelete(file.name); }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onMouseUp={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => e.stopPropagation()}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/5 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          {/* Mobile Actions Menu */}
                          <div className="lg:hidden">
                             <DropdownMenu
                                trigger={
                                  <button 
                                    className="p-2 text-gray-400 hover:text-cyan-600 rounded-lg transition-colors"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onMouseUp={(e) => e.stopPropagation()}
                                    onTouchStart={(e) => e.stopPropagation()}
                                    onTouchEnd={(e) => e.stopPropagation()}
                                  >
                                    <MoreVertical className="w-5 h-5" />
                                  </button>
                                }
                                items={[
                                  { label: '分享', icon: <Share2 className="w-4 h-4 text-blue-500" />, onClick: () => onShare(file.name) },
                                  { label: '下載', icon: <Download className="w-4 h-4 text-green-500" />, onClick: () => {
                                      const a = document.createElement('a');
                                      a.href = `/api/download/${username}/${file.name}${token ? `?token=${token}` : ''}`;
                                      a.click();
                                    } 
                                  },
                                  { label: '重命名', icon: <Edit3 className="w-4 h-4 text-cyan-500" />, onClick: () => { setRenamingFile(file.name); setNewName(file.name); }, hidden: !onRename || !isAuthenticated },
                                  { 
                                    label: file.is_locked ? '解除鎖定' : '鎖定項', 
                                    icon: file.is_locked ? <Unlock className="w-4 h-4 text-violet-500" /> : <Lock className="w-4 h-4 text-gray-400" />, 
                                    onClick: () => onToggleLock('file', file.name, !!file.is_locked),
                                    hidden: !isAuthenticated
                                  },
                                  { label: 'separator', icon: null, onClick: () => {}, hidden: !isAuthenticated },
                                  { label: '刪除項目', icon: <Trash2 className="w-4 h-4" />, onClick: () => onDelete(file.name), variant: 'danger', hidden: !isAuthenticated }
                                ]}
                             />
                          </div>
                        </div>
                      )}
                    </div>
                  </ItemWrapper>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

    </section>
  );
};
