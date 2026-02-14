import React from 'react';
import { motion } from 'framer-motion';
import {
  Zap, FileText, Link as LinkIcon,
  CheckSquare, Square, Lock, Unlock,
  Copy, QrCode, Trash2, Download,
  LayoutGrid, List
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface UrlItem {
  url: string;
  created: string;
  is_locked?: boolean;
}

interface UrlViewProps {
  urls: UrlItem[];
  selectedItems: { type: 'file' | 'url'; id: string }[];
  isAuthenticated: boolean;
  isBatchSyncing: boolean;
  onToggleSelect: (type: 'file' | 'url', id: string) => void;
  onToggleLock: (type: 'file' | 'url', id: string, currentStatus: boolean) => void;
  onBatchAction: (action: 'delete' | 'lock' | 'unlock' | 'download') => void;
  onQrCode: (url: string) => void;
  onDelete: (url: string) => void;
  onCopy: (text: string) => void;
  onSelectAll: (selectAll: boolean) => void;
}

export const UrlView: React.FC<UrlViewProps> = ({
  urls,
  selectedItems,
  isAuthenticated,
  isBatchSyncing,
  onToggleSelect,
  onToggleLock,
  onBatchAction,
  onQrCode,
  onDelete,
  onCopy,
  onSelectAll
}) => {
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('list');
  const selectableUrls = urls?.filter(u => !u.is_locked || isAuthenticated) || [];
  const isAllSelected = selectableUrls.length > 0 && selectableUrls.every(u => selectedItems.some(i => i.type === 'url' && i.id === u.url));

  return (
    <section className="flex flex-col h-full bg-white/60 dark:bg-space-black/40 backdrop-blur-xl rounded-4xl border border-white/40 dark:border-white/5 shadow-2xl overflow-hidden relative">
      <div className="absolute inset-0 bg-linear-to-b from-white/20 to-transparent dark:from-white/5 dark:to-transparent pointer-events-none" />

      {/* Panel Header */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-100/50 dark:border-white/5 flex items-center justify-between bg-white/20 dark:bg-white/2 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectAll(!isAllSelected)}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            title={isAllSelected ? "取消全選" : "全選"}
          >
            {isAllSelected ? (
              <CheckSquare className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            ) : (
              <Square className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            )}
          </button>
          <div className="p-2 bg-violet-500/10 rounded-lg text-violet-600 dark:text-violet-400">
            <Zap className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-white/90 tracking-tight">筆記 / 連結</h2>
          <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-xs font-bold text-gray-500 dark:text-white/40">
            {urls?.length || 0}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-xl mr-2">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                viewMode === 'grid' ? "bg-white dark:bg-white/10 text-violet-500 shadow-sm" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              )}
              title="格狀顯示"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                viewMode === 'list' ? "bg-white dark:bg-white/10 text-violet-500 shadow-sm" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              )}
              title="清單顯示"
            >
              <List className="w-4 h-4" />
            </button>
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
              onClick={() => onBatchAction('download')}
              disabled={isBatchSyncing}
              className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors text-green-500"
              title="Download Selected"
            >
              <Download className="w-4 h-4" />
            </button>
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
    </div>

      {/* Scrollable URL Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {(!urls || urls.length === 0) ? (
          <div className="h-40 flex flex-col items-center justify-center text-gray-400 dark:text-white/20">
            <p className="text-sm font-medium">尚無筆記</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-3 pb-20">
            {urls?.map((url, idx) => {
              const isLocked = url.is_locked && !isAuthenticated;
              const isSelected = !!selectedItems.find(i => i.type === 'url' && i.id === url.url);
              const isLink = url.url.match(/^(http|https|www)/);

              return (
                <motion.div
                  key={`${url.url}-${idx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "group relative p-4 rounded-xl border transition-all duration-300 hover:shadow-md cursor-pointer",
                    isSelected ? "bg-violet-50 dark:bg-violet-900/10 border-violet-200 dark:border-violet-500/30" : "bg-white/40 dark:bg-white/5 border-transparent hover:bg-white/80 dark:hover:bg-white/10"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="shrink-0 mt-0.5">
                      {isLink ? (
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-500">
                          <LinkIcon className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-500">
                          <FileText className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {isLink && !isLocked ? (
                        <a
                          href={url.url.startsWith('www') ? `https://${url.url}` : url.url}
                          target="_blank"
                          rel="noreferrer"
                          className={cn("block text-sm font-medium truncate mb-1 hover:underline text-blue-600 dark:text-blue-400")}
                        >
                          {url.url}
                        </a>
                      ) : (
                        <div className={cn("text-sm font-medium break-all line-clamp-2 mb-1 text-gray-700 dark:text-gray-200", isLocked && "blur-sm opacity-50")}>
                          {url.url}
                        </div>
                      )}
                      <p className="text-[10px] text-gray-400 font-mono">{url.created}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="absolute right-2 top-2 flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-black/60 backdrop-blur-sm rounded-lg p-1 shadow-sm">
                    {isAuthenticated && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); onToggleSelect('url', url.url); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md text-gray-500">
                          {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-cyan-500" /> : <Square className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onToggleLock('url', url.url, !!url.is_locked); }} className={cn("p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md", url.is_locked ? "text-violet-500" : "text-gray-500")}>
                          {url.is_locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        </button>
                      </>
                    )}
                    {!isLocked && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); onCopy(url.url); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md text-gray-500" title="Copy">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onQrCode(url.url); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md text-gray-500" title="QR Code">
                          <QrCode className="w-3.5 h-3.5" />
                        </button>
                        {isAuthenticated && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(url.url); }}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                    {isLocked && !isAuthenticated && (
                      <Lock className="w-3.5 h-3.5 text-gray-400 m-1.5" />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-20">
            {urls?.map((url, idx) => {
              const isLocked = url.is_locked && !isAuthenticated;
              const isSelected = !!selectedItems.find(i => i.type === 'url' && i.id === url.url);
              const isLink = url.url.match(/^(http|https|www)/);

              return (
                <motion.div
                  key={`${url.url}-${idx}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "group relative p-4 rounded-2xl border transition-all duration-300 hover:shadow-xl cursor-pointer min-h-35 flex flex-col justify-between",
                    isSelected ? "bg-violet-50 dark:bg-violet-900/10 border-violet-200 dark:border-violet-500/30 ring-2 ring-violet-500" : "bg-white/40 dark:bg-white/5 border-transparent hover:bg-white/80 dark:hover:bg-white/10 shadow-sm"
                  )}
                  onClick={() => {
                    if (isLink && !isLocked) {
                      window.open(url.url.startsWith('www') ? `https://${url.url}` : url.url, '_blank');
                    } else if (!isLocked) {
                      onCopy(url.url);
                    }
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn(
                      "p-3 rounded-xl",
                      isLink ? "bg-blue-500/10 text-blue-500" : "bg-amber-500/10 text-amber-500"
                    )}>
                      {isLink ? <LinkIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!isLocked && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); onCopy(url.url); }}
                            className="p-2 bg-white/90 dark:bg-black/50 rounded-lg hover:text-violet-500 transition-colors shadow-sm"
                            title="Copy"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onQrCode(url.url); }}
                            className="p-2 bg-white/90 dark:bg-black/50 rounded-lg hover:text-violet-500 transition-colors shadow-sm"
                            title="QR Code"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className={cn(
                      "text-base font-bold line-clamp-2 leading-relaxed tracking-tight break-all",
                      isLink ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-200",
                      isLocked && "blur-md opacity-30"
                    )}>
                      {url.url}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-[10px] font-mono text-gray-400 font-bold uppercase tracking-widest">{url.created}</p>
                    {isLocked && (
                      <div className="p-1.5 bg-black/40 backdrop-blur-md rounded-lg text-white/70">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>

                  {/* Absolute Select Checkbox for Grid mode */}
                  {isAuthenticated && !isLocked && (
                    <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleSelect('url', url.url); }}
                        className="p-1.5 bg-white/90 dark:bg-black/80 rounded-lg shadow-md"
                      >
                        {isSelected ? <CheckSquare className="w-4 h-4 text-violet-600" /> : <Square className="w-4 h-4 text-gray-400" />}
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
