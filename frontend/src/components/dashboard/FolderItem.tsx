import React, { useState } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { Folder as FolderIcon, CheckSquare, Square, Edit3, Trash2, Check, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLongPress } from '../../hooks/useLongPress';
import { setDragPreview, type DragItem } from '../../utils/dragUtils';
import type { Folder } from './FolderSidebar';

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
  setRenamingFolderId
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

  return (
    <ItemWrapper
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      isSelectionMode={isSelectionMode}
      className={cn(
        "group relative p-3 rounded-xl border transition-all cursor-pointer folder-card h-full",
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
        
        {isAuthenticated && !renamingFolderId && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
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
});
