import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2, ExternalLink, QrCode, Lock, Unlock, CheckSquare, Square, Search, Copy,
  Folder as FolderIcon, LayoutGrid, List, Edit3, Check, X
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSelectionBox } from '../../hooks/useSelectionBox';
import { setDragPreview } from '../../utils/dragUtils';
import { BatchActionBar } from './BatchActionBar';
import type { Folder } from './FolderSidebar';

export interface UrlItem {
  url: string;
  created: string;
  is_locked?: boolean;
  folder_id?: string | null;
}

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
  onBatchAction?: (action: any, folderId?: string | null) => void;
  isBatchSyncing?: boolean;
}

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
  isBatchSyncing = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
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
    return urls.filter(u => u.url.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [urls, searchQuery]);

  const { selectionBox, handlePointerDown, handlePointerMove, handleTouchStart, handleTouchMove } = useSelectionBox(
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



  const renderFolderButtons = (urlId: string, parentId: string | null = null, depth = 0) => {
    return folders
      .filter(f => f.type === 'url' && (f.parent_id === parentId || (!parentId && !f.parent_id)))
      .map(f => (
        <React.Fragment key={f.id}>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveItem('url', urlId, f.id); }}
            className="w-full text-left px-3 py-1.5 text-xs font-bold hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
            style={{ paddingLeft: `${12 + depth * 12}px` }}
          >
            <FolderIcon className="w-3 h-3 text-gray-400" />
            <span className="truncate">{f.name}</span>
          </button>
          {renderFolderButtons(urlId, f.id, depth + 1)}
        </React.Fragment>
      ));
  };

  const selectableUrls = filteredUrls.filter(u => !u.is_locked || isAuthenticated);
  const isAllSelected = selectableUrls.length > 0 && selectableUrls.every(u => selectedItems.some(i => i.type === 'url' && i.id === u.url));

  return (
    <section className="flex flex-col h-full bg-white/60 dark:bg-space-black/40 backdrop-blur-xl rounded-4xl border border-white/40 dark:border-white/5 shadow-2xl overflow-hidden relative group">
      <div className="absolute inset-0 bg-linear-to-b from-white/20 to-transparent dark:from-white/5 dark:to-transparent pointer-events-none" />

      {/* Header */}
      {/* Header - Reduced padding on mobile */}
      <div className="shrink-0 px-4 py-3 lg:px-6 lg:py-4 border-b border-gray-100/50 dark:border-white/5 flex items-center justify-between bg-white/20 dark:bg-white/2 backdrop-blur-sm sticky top-0 z-20">
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


        

          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'grid' ? "bg-white dark:bg-white/10 text-violet-500 shadow-sm" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
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

        <div className="flex items-center gap-4">
          <div className="relative group/search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within/search:text-violet-500 transition-colors" />
            <input
              type="text"
              placeholder="搜尋..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-100/50 dark:bg-white/5 border border-transparent focus:border-violet-500/50 rounded-xl outline-none text-sm transition-all w-32 sm:w-48"
            />
          </div>

        </div>
      </div>

      <div 
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        className="flex-1 overflow-y-auto p-3 sm:p-6 custom-scrollbar select-none touch-none relative"
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
                  <motion.div
                    key={folder.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      "group relative p-3 rounded-xl border transition-all cursor-pointer folder-card",
                      folder.id === dragOverFolderId && "ring-2 ring-violet-500 bg-violet-100 dark:bg-violet-900/30 scale-105 z-10",
                      isSelected 
                        ? "bg-violet-50 dark:bg-violet-900/10 border-violet-500 ring-2 ring-violet-500" 
                        : "bg-white dark:bg-white/5 border-gray-100 dark:border-white/10 hover:border-violet-500/50 hover:bg-violet-500/5"
                    )}
                    draggable
                    onDragStart={(event) => {
                      const e = event as unknown as React.DragEvent<HTMLDivElement>;
                      const itemsToDrag = [{ type: 'folder', id: folder.id }];

                      e.dataTransfer.setData('application/json', JSON.stringify({ type: 'folder', id: folder.id }));
                      e.dataTransfer.effectAllowed = 'move';
                      setDragPreview(e, itemsToDrag as any);
                    }}
                    onClick={() => onFolderClick(folder.id)} 
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => handleDragEnterFolder(e, folder.id)}
                    onDragLeave={handleDragLeaveFolder}
                    onDrop={(e) => handleDrop(e, folder.id)}
                  >
                    {/* Selection Checkbox */}
                    <div className={cn(
                      "absolute top-1.5 left-1.5 z-30 transition-opacity",
                      isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
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
                  </motion.div>
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
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
              : "grid-cols-1"
          )}>
            <AnimatePresence>
              {filteredUrls.map((url, idx) => {
                const isSelected = !!selectedItems.find(i => i.type === 'url' && i.id === url.url);
                const isLocked = url.is_locked && !isAuthenticated;

                return (
                  <motion.div
                    key={url.url}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className={cn(
                      "relative group flex items-start gap-4 p-4 bg-white/40 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-transparent hover:border-violet-500/30 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-md url-item cursor-pointer",
                      isSelected && "ring-2 ring-violet-500 bg-violet-50 dark:bg-violet-900/10"
                    )}
                    draggable
                    onDragStart={(event) => {
                      const e = event as unknown as React.DragEvent<HTMLDivElement>;
                      const isUrlSelected = selectedItems.some(i => i.type === 'url' && i.id === url.url);
                      const itemsToDrag = isUrlSelected
                        ? selectedItems.filter(i => i.type === 'url' || i.type === 'folder')
                        : [{ type: 'url', id: url.url }];

                      e.dataTransfer.setData('application/json', JSON.stringify({ 
                        items: itemsToDrag,
                        type: 'url',
                        id: url.url
                      }));
                      e.dataTransfer.effectAllowed = 'move';
                      setDragPreview(e, itemsToDrag as any);
                    }}
                  >
                    <div className="shrink-0 pt-1">
                      {!isLocked && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleSelect('url', url.url); }}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                        >
                          {isSelected ? <CheckSquare className="w-5 h-5 text-violet-600" /> : <Square className="w-5 h-5 text-gray-400" />}
                        </button>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={cn(
                          "text-sm font-medium transition-all",
                          isLocked ? "blur-[5px] select-none text-gray-300" : "text-gray-900 dark:text-white"
                        )}>
                          {url.url}
                        </p>
                        <div className="flex items-center gap-1">
                          {isAuthenticated && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onToggleLock('url', url.url, !!url.is_locked); }}
                              className={cn(
                                "p-1 rounded-md transition-all",
                                url.is_locked ? "text-violet-500 bg-violet-500/10" : "text-gray-400 hover:text-gray-600"
                              )}
                            >
                              {url.is_locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                            </button>
                          )}
                          {!isAuthenticated && url.is_locked && (
                            <div className="p-1 bg-black/5 dark:bg-white/5 rounded-md text-gray-400">
                              <Lock className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 dark:text-white/30 tracking-widest uppercase">
                        <span>{new Date(url.created).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {!isLocked && (
                      <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        <a
                          href={url.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl text-gray-500 hover:text-violet-500 transition-colors"
                          title="Open Link"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          onClick={(e) => { e.stopPropagation(); onQrCode(url.url); }}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl text-gray-500 hover:text-violet-500 transition-colors"
                          title="QR Code"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onCopy(url.url); }}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl text-gray-500 hover:text-violet-500 transition-colors"
                          title="Copy"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        
                        <div className="relative group/move pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                          <button className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl text-gray-500 hover:text-violet-500 transition-colors">
                            <FolderIcon className="w-4 h-4" />
                          </button>
                          <div className="absolute top-full right-0 mt-2 bg-white dark:bg-space-black border border-gray-100 dark:border-white/10 rounded-xl shadow-2xl p-2 hidden group-hover/move:block z-50 min-w-32">
                            <button 
                              onClick={(e) => { e.stopPropagation(); onMoveItem('url', url.url, null); }}
                              className="w-full text-left px-3 py-1.5 text-xs font-bold hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg"
                            >
                              根目錄
                            </button>
                                {renderFolderButtons(url.url)}
                          </div>
                        </div>

                        {isAuthenticated && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(url.url); }}
                            className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl text-red-400 hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
};
