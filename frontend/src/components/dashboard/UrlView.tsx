import React from 'react';
import { motion } from 'framer-motion';
import {
  Zap, FileText, Link as LinkIcon,
  CheckSquare, Square, Lock, Unlock,
  Copy, QrCode, Trash2
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
  onToggleSelect: (type: 'file' | 'url', id: string) => void;
  onToggleLock: (type: 'file' | 'url', id: string, currentStatus: boolean) => void;
  onQrCode: (url: string) => void;
  onDelete: (url: string) => void;
  onCopy: (text: string) => void;
  onSelectAll: (selectAll: boolean) => void;
}

export const UrlView: React.FC<UrlViewProps> = ({
  urls,
  selectedItems,
  isAuthenticated,
  onToggleSelect,
  onToggleLock,
  onQrCode,
  onDelete,
  onCopy,
  onSelectAll
}) => {
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
      </div>

      {/* Scrollable URL List */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
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
                  "group relative p-4 rounded-xl border transition-all duration-300 hover:shadow-md",
                  isSelected ? "bg-violet-50 dark:bg-violet-900/10 border-violet-200 dark:border-violet-500/30" : "bg-white/40 dark:bg-white/5 border-transparent hover:bg-white/80 dark:hover:bg-white/10"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* URL Icon */}
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

                  {/* Content */}
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

                {/* Actions - Slide in on hover (Desktop) / Always visible (Mobile) */}
                <div className="absolute right-2 top-2 flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-black/60 backdrop-blur-sm rounded-lg p-1 shadow-sm">
                  {isAuthenticated && (
                    <>
                      <button onClick={() => onToggleSelect('url', url.url)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md text-gray-500">
                        {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-cyan-500" /> : <Square className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => onToggleLock('url', url.url, !!url.is_locked)} className={cn("p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md", url.is_locked ? "text-violet-500" : "text-gray-500")}>
                        {url.is_locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                    </>
                  )}
                  {!isLocked && (
                    <>
                      <button onClick={() => onCopy(url.url)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md text-gray-500" title="Copy">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onQrCode(url.url)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md text-gray-500" title="QR Code">
                        <QrCode className="w-3.5 h-3.5" />
                      </button>
                      {isAuthenticated && (
                        <button
                          onClick={() => onDelete(url.url)}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                  {/* Always show lock icon if locked and not authenticated */}
                  {isLocked && !isAuthenticated && (
                    <Lock className="w-3.5 h-3.5 text-gray-400 m-1.5" />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
        {(!urls || urls.length === 0) && (
          <div className="h-40 flex flex-col items-center justify-center text-gray-400 dark:text-white/20">
            <p className="text-sm font-medium">尚無筆記</p>
          </div>
        )}
      </div>
    </section>
  );
};
