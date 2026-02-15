import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2, ExternalLink, QrCode, Lock, Unlock, CheckSquare, Square, Copy, MoreVertical,
  Folder as FolderIcon, LayoutGrid, List, Edit3, Check, X, FileText, Link as LinkIcon
} from 'lucide-react';
import { DropdownMenu } from '../ui/DropdownMenu';
import { CascadingMenu } from '../ui/CascadingMenu';
import { cn } from '../../lib/utils';
import { useSelectionBox } from '../../hooks/useSelectionBox';
import { useLongPress } from '../../hooks/useLongPress';
import { setDragPreview, type DragItem } from '../../utils/dragUtils';
import { BatchActionBar } from './BatchActionBar';
import type { Folder } from './FolderSidebar';

export interface UrlItem {
  url: string;
  created: string;
  is_locked?: boolean;
  folder_id?: string | null;
}

const isValidUrl = (text: string): boolean => {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.includes(' ')) return false;

  // Protocol check
  if (/^https?:\/\//i.test(trimmed)) return true;
  
  // Starts with www.
  if (/^www\./i.test(trimmed)) return true;

  // Must have a dot that is not at the start or end
  const dotIndex = trimmed.indexOf('.');
  return dotIndex > 0 && dotIndex < trimmed.length - 1;
};

interface UrlViewProps {
  urls: UrlItem[];
  selectedItems: { type: 'file' | 'url' | 'folder'; id: string }[];
  isAuthenticated: boolean;
  onToggleSelect: (type: 'file' | 'url' | 'folder', id: string) => void;
  onSelectAll: (selected: boolean) => void;
  onBatchSelect: (items: { type: 'file' | 'url' | 'folder'; id: string }[], action: 'add' | 'remove' | 'set') => void;
  onToggleLock: (type: 'file' | 'url', id: string, currentStatus: boolean) => void;
  onQrCode: (url: string) => void;
  onDelete: (url: string) => void;
  onCopy: (url: string) => void;
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

export const UrlView: React.FC<UrlViewProps> = ({
  urls,
  selectedItems,
  isAuthenticated,
  onToggleSelect,
  onSelectAll,
  onBatchSelect,
  onToggleLock,
  onQrCode,
  onDelete,
  onCopy,
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
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Filter folders for current view
  const currentSubfolders = folders.filter(f => f.parent_id === activeFolderId && f.type === 'url');

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

  const filteredUrls = useMemo(() => {
    return urls;
  }, [urls]);

  const { selectionBox, handlePointerDown, handlePointerMove, handlePointerUp, handleTouchStart, handleTouchMove } = useSelectionBox(
    containerRef,
    ".url-item, .folder-card",
    React.useCallback((indices: number[]) => {
      const selectedItemsList: { type: 'file' | 'url' | 'folder'; id: string }[] = [];
      const folderCount = currentSubfolders.length;

      indices.forEach(idx => {
        if (idx < folderCount) {
          selectedItemsList.push({ type: 'folder', id: currentSubfolders[idx].id });
        } else {
          const urlIdx = idx - folderCount;
          if (filteredUrls && filteredUrls[urlIdx]) {
            selectedItemsList.push({ type: 'url', id: filteredUrls[urlIdx].url });
          }
        }
      });
      
      onBatchSelect(selectedItemsList, 'set');
    }, [filteredUrls, currentSubfolders, onBatchSelect])
  );


  const selectableUrls = filteredUrls.filter(u => !u.is_locked || isAuthenticated);
  const isAllSelected = selectableUrls.length > 0 && selectableUrls.every(u => selectedItems.some(i => i.type === 'url' && i.id === u.url));

  return (
    <section className="flex-1 min-h-0 flex flex-col bg-white/60 dark:bg-space-black/40 backdrop-blur-xl rounded-4xl border border-white/40 dark:border-white/5 shadow-2xl overflow-hidden relative">
      <div className="absolute inset-0 bg-linear-to-b from-white/20 to-transparent dark:from-white/5 dark:to-transparent pointer-events-none" />

      {/* Header - Hidden on mobile */}
      <div className="hidden lg:flex shrink-0 px-4 py-3 lg:px-6 lg:py-4 border-b border-gray-100/50 dark:border-white/5 items-center justify-between bg-white/20 dark:bg-white/2 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectAll(!isAllSelected)}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            {isAllSelected ? <CheckSquare className="w-5 h-5 text-violet-600 dark:text-violet-400" /> : <Square className="w-5 h-5 text-gray-400" />}
          </button>
          <h2 className="text-base lg:text-lg font-bold text-gray-800 dark:text-white/90 tracking-tight">筆記 / 連結</h2>
          <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-xs font-bold text-gray-500 dark:text-white/40">
            {urls?.length || 0}
          </span>
          {activeFolderId && (
            <span className="text-sm text-violet-600 dark:text-violet-400 font-medium ml-2">
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
                viewMode === 'grid' ? "bg-white dark:bg-white/10 text-violet-500 shadow-sm" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'list' ? "bg-white dark:bg-white/10 text-violet-500 shadow-sm" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
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
            className="absolute bg-violet-500/20 border border-violet-500/50 z-50 pointer-events-none rounded"
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
                      folder.id === dragOverFolderId && "ring-2 ring-violet-500 bg-violet-100 dark:bg-violet-900/30 scale-105 z-10",
                      isSelected 
                        ? "bg-violet-50 dark:bg-violet-900/10 border-violet-500 ring-2 ring-violet-500" 
                        : "bg-white dark:bg-white/5 border-gray-100 dark:border-white/10 hover:border-violet-500/50 hover:bg-violet-500/5"
                    )}
                    draggable={!isSelectionMode}
                    onDragStart={(event) => {
                      const e = event as unknown as React.DragEvent<HTMLDivElement>;
                      const itemsToDrag: { type: 'file' | 'url' | 'folder', id: string }[] = [{ type: 'folder', id: folder.id }];

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
                         {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-violet-600" /> : <Square className="w-3.5 h-3.5 text-gray-400" />}
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 rounded-lg">
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
                              className="w-full text-xs p-1 rounded border border-violet-500/50 bg-white dark:bg-black/20 outline-none"
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
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate group-hover:text-violet-600 transition-colors">
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
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-violet-600"
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

        {(!urls || urls.length === 0) && currentSubfolders.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400 dark:text-white/20">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
              <ExternalLink className="w-8 h-8 opacity-50" />
            </div>
            <p className="text-sm font-medium">尚無連結</p>
          </div>
        ) : (!urls || urls.length === 0) ? null : (
          <div className={cn(
            "grid gap-4 pb-20",
            viewMode === 'grid' 
              ? "grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
              : "grid-cols-1"
          )}>
            <AnimatePresence>
              {filteredUrls.map((url, idx) => {
                const isSelected = !!selectedItems.find(i => i.type === 'url' && i.id === url.url);
                const isLocked = url.is_locked && !isAuthenticated;
                const isActuallyUrl = isValidUrl(url.url);

                return (
                  <ItemWrapper
                    key={url.url}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    isSelectionMode={isSelectionMode}
                    className={cn(
                      "relative group flex flex-col bg-white/40 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-transparent hover:border-violet-500/30 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-md url-item cursor-pointer overflow-hidden pb-4",
                      viewMode === 'list' ? "flex-row items-center p-3" : "p-4 space-y-2",
                      isSelected && "ring-2 ring-violet-500 bg-violet-50 dark:bg-violet-900/10",
                      url.is_locked && "opacity-60 grayscale-[0.8] contrast-75 brightness-95"
                    )}
                    draggable={!isSelectionMode}
                    onDragStart={(event) => {
                      const e = event as unknown as React.DragEvent<HTMLDivElement>;
                      const isUrlSelected = selectedItems.some((i: { type: string; id: string }) => i.type === 'url' && i.id === url.url);
                      const itemsToDrag: DragItem[] = isUrlSelected
                        ? (selectedItems.filter(i => (i.type === 'url' || i.type === 'folder' || i.type === 'file')) as DragItem[])
                        : [{ type: 'url', id: url.url }];

                      e.dataTransfer.setData('application/json', JSON.stringify({ 
                        items: itemsToDrag,
                        type: 'url',
                        id: url.url
                      }));
                      e.dataTransfer.effectAllowed = 'move';
                      setDragPreview(e, itemsToDrag);
                    }}
                    onClick={() => {
                      if (isSelectionMode) {
                        onToggleSelect('url', url.url);
                        return;
                      }
                      if (!isLocked) {
                        window.open(url.url, '_blank');
                      }
                    }}
                    onLongPress={() => onSelectionModeChange(true)}
                  >
                     <div className="shrink-0 pt-1 pointer-events-none">
                      {/* Icon Indicator for Grid View */}
                      {viewMode === 'grid' && (
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-colors mb-3",
                          isActuallyUrl 
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" 
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        )}>
                          {isActuallyUrl ? <LinkIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                        </div>
                      )}

                      {/* Selection Checkbox - Visible on hover or selection mode */}
                      {!isLocked && (
                        <div className={cn(
                          "transition-opacity z-20 pointer-events-auto",
                          viewMode === 'grid' && "absolute top-2 left-2",
                          (isSelected || isSelectionMode) 
                            ? "opacity-100" 
                            : "opacity-0 lg:group-hover:opacity-100"
                        )}>
                          <button
                            onClick={(e) => { e.stopPropagation(); onToggleSelect('url', url.url); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors bg-white/50 dark:bg-white/10 backdrop-blur-sm"
                          >
                            {isSelected ? <CheckSquare className="w-5 h-5 text-violet-600" /> : <Square className="w-5 h-5 text-gray-400" />}
                          </button>
                        </div>
                      )}

                      {/* Desktop Grid Hover Overlay */}
                      {!isLocked && viewMode === 'grid' && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 lg:group-hover:opacity-100 transition-opacity z-20 hidden lg:flex flex-wrap items-center justify-center gap-2 px-4 pointer-events-none">
                          <button
                            onClick={(e) => { e.stopPropagation(); window.open(url.url, '_blank'); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                            className="p-2 bg-white rounded-full text-gray-700 hover:text-blue-600 shadow-lg transition-transform hover:scale-110 pointer-events-auto"
                            title="開啟連結"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onQrCode(url.url); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                            className="p-2 bg-white rounded-full text-gray-700 hover:text-violet-600 shadow-lg transition-transform hover:scale-110 pointer-events-auto"
                            title="QR Code"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onCopy(url.url); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                            className="p-2 bg-white rounded-full text-gray-700 hover:text-cyan-600 shadow-lg transition-transform hover:scale-110 pointer-events-auto"
                            title="複製網址"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          {isAuthenticated && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); onToggleLock('url', url.url, !!url.is_locked); }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onMouseUp={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => e.stopPropagation()}
                                className={cn(
                                  "p-2 bg-white rounded-full shadow-lg transition-transform hover:scale-110 pointer-events-auto",
                                  url.is_locked ? "text-violet-600" : "text-gray-700 hover:text-violet-600"
                                )}
                                title={url.is_locked ? "解除鎖定" : "鎖定項目"}
                              >
                                {url.is_locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                              </button>
                              <CascadingMenu
                                folders={folders}
                                onSelect={(folderId) => onMoveItem('url', url.url, folderId)}
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
                              <button
                                onClick={(e) => { e.stopPropagation(); onDelete(url.url); }}
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
                      )}
                    </div>

                     <div className={cn("flex-1 min-w-0 flex flex-col justify-center", viewMode === 'grid' && "mt-1")}>
                      <div className="flex items-start gap-3 mb-1">
                        {viewMode === 'list' && (
                          <div className={cn(
                            "p-2 rounded-lg shrink-0",
                            isActuallyUrl 
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" 
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          )}>
                            {isActuallyUrl ? <LinkIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                          </div>
                        )}
                        <p className={cn(
                          "text-sm font-medium transition-all break-all overflow-hidden",
                          viewMode === 'list' ? "truncate pt-1.5" : "line-clamp-2",
                          isLocked ? "blur-[5px] select-none text-gray-300" : "text-gray-900 dark:text-white"
                        )}>
                          {url.url}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 dark:text-white/30 tracking-widest uppercase mt-auto">
                        <span>{new Date(url.created).toLocaleDateString()}</span>
                        {viewMode === 'grid' && url.is_locked && (
                           <Lock className="w-3 h-3 text-violet-500 ml-auto" />
                        )}
                      </div>

                      {/* Mobile Top Actions - Grid View Only */}
                      {viewMode === 'grid' && !isLocked && (
                         <div className="absolute top-3 right-3 z-30 lg:hidden" onClick={(e) => e.stopPropagation()}>
                             <DropdownMenu
                               trigger={
                                 <button
                                   className="p-1.5 rounded-lg backdrop-blur-sm transition-all shadow-sm bg-white/80 dark:bg-black/50 text-gray-500 hover:text-cyan-500"
                                   onMouseDown={(e) => e.stopPropagation()}
                                   onMouseUp={(e) => e.stopPropagation()}
                                   onTouchStart={(e) => e.stopPropagation()}
                                   onTouchEnd={(e) => e.stopPropagation()}
                                 >
                                   <MoreVertical className="w-4 h-4" />
                                 </button>
                               }
                               items={[
                                 { label: '開啟連結', icon: <ExternalLink className="w-4 h-4 text-blue-500" />, onClick: () => window.open(url.url, '_blank') },
                                 { label: 'QR Code', icon: <QrCode className="w-4 h-4 text-violet-500" />, onClick: () => onQrCode(url.url) },
                                 { label: '複製網址', icon: <Copy className="w-4 h-4 text-cyan-500" />, onClick: () => onCopy(url.url) },
                                 { 
                                   label: url.is_locked ? '解除鎖定' : '鎖定項目', 
                                   icon: url.is_locked ? <Lock className="w-4 h-4 text-violet-600" /> : <Unlock className="w-4 h-4 text-cyan-600" />, 
                                   onClick: () => onToggleLock('url', url.url, !!url.is_locked),
                                   hidden: !isAuthenticated
                                 },
                                 { label: 'separator', icon: null, onClick: () => {}, hidden: !isAuthenticated },
                                 { label: '刪除項目', icon: <Trash2 className="w-4 h-4" />, onClick: () => onDelete(url.url), variant: 'danger', hidden: !isAuthenticated }
                               ]}
                             />
                         </div>
                      )}

                      {/* List View Actions (Desktop & Mobile) */}
                      {viewMode === 'list' && !isLocked && (
                        <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                          {/* Desktop List Actions */}
                          <div className="hidden lg:flex items-center gap-1">
                            <button
                               onClick={(e) => { e.stopPropagation(); window.open(url.url, '_blank'); }}
                               onMouseDown={(e) => e.stopPropagation()}
                               onMouseUp={(e) => e.stopPropagation()}
                               onTouchStart={(e) => e.stopPropagation()}
                               onTouchEnd={(e) => e.stopPropagation()}
                               className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-500/5 rounded-lg transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onQrCode(url.url); }}
                              onMouseDown={(e) => e.stopPropagation()}
                              onMouseUp={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                              onTouchEnd={(e) => e.stopPropagation()}
                              className="p-2 text-gray-400 hover:text-violet-500 hover:bg-violet-500/5 rounded-lg transition-colors"
                              title="QR Code"
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onCopy(url.url); }}
                              onMouseDown={(e) => e.stopPropagation()}
                              onMouseUp={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                              onTouchEnd={(e) => e.stopPropagation()}
                              className="p-2 text-gray-400 hover:text-cyan-600 hover:bg-cyan-500/5 rounded-lg transition-colors"
                              title="複製網址"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            {isAuthenticated && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onToggleLock('url', url.url, !!url.is_locked); }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onMouseUp={(e) => e.stopPropagation()}
                                  onTouchStart={(e) => e.stopPropagation()}
                                  onTouchEnd={(e) => e.stopPropagation()}
                                   className={cn(
                                     "p-2 rounded-lg transition-all duration-300",
                                     url.is_locked 
                                       ? "text-violet-600 bg-violet-600/10 hover:bg-violet-600/20 shadow-md" 
                                       : "text-cyan-600 bg-cyan-600/10 hover:bg-cyan-600/20 shadow-sm"
                                   )}
                                 >
                                   {url.is_locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onDelete(url.url); }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onMouseUp={(e) => e.stopPropagation()}
                                  onTouchStart={(e) => e.stopPropagation()}
                                  onTouchEnd={(e) => e.stopPropagation()}
                                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/5 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>

                          {/* Mobile List Dropdown */}
                          <div className="lg:hidden">
                             <DropdownMenu
                              trigger={
                                <button 
                                  className="p-2 text-gray-400 hover:text-violet-500 rounded-lg transition-colors"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onMouseUp={(e) => e.stopPropagation()}
                                  onTouchStart={(e) => e.stopPropagation()}
                                  onTouchEnd={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="w-5 h-5" />
                                </button>
                              }
                              items={[
                                { label: '開啟連結', icon: <ExternalLink className="w-4 h-4 text-blue-500" />, onClick: () => window.open(url.url, '_blank') },
                                { label: 'QR Code', icon: <QrCode className="w-4 h-4 text-violet-500" />, onClick: () => onQrCode(url.url) },
                                { label: '複製網址', icon: <Copy className="w-4 h-4 text-cyan-500" />, onClick: () => onCopy(url.url) },
                                { 
                                  label: url.is_locked ? '解除鎖定' : '鎖定項目', 
                                  icon: url.is_locked ? <Unlock className="w-4 h-4 text-violet-500" /> : <Lock className="w-4 h-4 text-gray-400" />, 
                                  onClick: () => onToggleLock('url', url.url, !!url.is_locked),
                                  hidden: !isAuthenticated
                                },
                                { label: 'separator', icon: null, onClick: () => {}, hidden: !isAuthenticated },
                                { label: '刪除項目', icon: <Trash2 className="w-4 h-4" />, onClick: () => onDelete(url.url), variant: 'danger', hidden: !isAuthenticated }
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
