import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Folder as FolderIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Folder } from '../dashboard/FolderSidebar';

interface CascadingMenuProps {
  folders: Folder[];
  onSelect: (folderId: string | null) => void;
  trigger?: React.ReactNode;
  disabled?: boolean;
}

interface FolderNode extends Folder {
  children: FolderNode[];
}

const buildFolderTree = (folders: Folder[]): FolderNode[] => {
  const folderMap = new Map<string, FolderNode>();
  const rootNodes: FolderNode[] = [];

  // Initialize nodes
  folders.forEach(f => {
    folderMap.set(f.id, { ...f, children: [] });
  });

  // Build tree
  folders.forEach(f => {
    const node = folderMap.get(f.id)!;
    if (f.parent_id && folderMap.has(f.parent_id)) {
      folderMap.get(f.parent_id)!.children.push(node);
    } else {
      rootNodes.push(node);
    }
  });

  return rootNodes;
};

const MenuItem: React.FC<{
  node: FolderNode;
  onSelect: (id: string) => void;
  depth?: number;
}> = ({ node, onSelect, depth = 0 }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const itemRef = useRef<HTMLButtonElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hasChildren = node.children && node.children.length > 0;

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    if (itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      const submenuWidth = 192; // 48 * 4 (w-48)
      const windowWidth = window.innerWidth;
      
      // Check if there's enough space on the right
      const flushRight = rect.right + submenuWidth + 10 > windowWidth;

      setPosition({
        top: rect.top,
        left: flushRight ? rect.left - submenuWidth - 4 : rect.right + 4,
      });
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 150); // Grace period
  };

  return (
    <div
      className="relative px-1"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={itemRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node.id);
        }}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors text-left",
          isHovered ? "bg-cyan-500 text-white" : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10"
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <FolderIcon className={cn("w-4 h-4", isHovered ? "text-white" : "text-cyan-500")} />
          <span className="truncate">{node.name}</span>
        </div>
        {hasChildren && <ChevronRight className={cn("w-3 h-3", isHovered ? "text-white" : "text-gray-400")} />}
      </button>

      {/* Submenu Portal */}
      {hasChildren && isHovered && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, x: -5, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed w-48 bg-white/90 dark:bg-space-black/90 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-xl shadow-xl py-1 z-[9999] max-h-64 overflow-y-auto custom-scrollbar"
            style={{
              top: position.top,
              left: position.left,
            }}
            onMouseEnter={() => {
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }}
            onMouseLeave={handleMouseLeave}
          >
            {node.children.map(child => (
              <MenuItem key={child.id} node={child} onSelect={onSelect} depth={depth + 1} />
            ))}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export const CascadingMenu: React.FC<CascadingMenuProps> = ({ folders, onSelect, trigger, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const rootNodes = buildFolderTree(folders.filter(f => f.type === 'file')); // Ensure we only show relevant folders if needed, but usually passed folders are pre-filtered.

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (id: string | null) => {
    onSelect(id);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <div onClick={() => !disabled && setIsOpen(!isOpen)}>
        {trigger || (
          <button
            disabled={disabled}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-white/80 dark:hover:bg-white/10 transition-colors"
          >
            <span>移動至...</span>
            <ChevronRight className={cn("w-3 h-3 transition-transform", isOpen ? "rotate-90" : "")} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-56 bg-white/80 dark:bg-space-black/80 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-xl shadow-2xl py-2 z-50 origin-top-right ring-1 ring-black/5"
          >
             <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-1">
                <button
                  onClick={() => handleSelect(null)} // Root
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-cyan-500 hover:text-white rounded-lg transition-colors text-left"
                >
                  <FolderIcon className="w-4 h-4" />
                  <span>根目錄</span>
                </button>
                
                <div className="my-1 h-px bg-gray-200 dark:bg-white/10 mx-2" />

                {rootNodes.length > 0 ? (
                  rootNodes.map(node => (
                    <MenuItem key={node.id} node={node} onSelect={handleSelect} />
                  ))
                ) : (
                  <div className="px-4 py-2 text-xs text-gray-400 text-center">
                    沒有其他資料夾
                  </div>
                )}
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
