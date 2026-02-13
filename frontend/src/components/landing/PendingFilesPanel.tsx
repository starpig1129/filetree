import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, FileText, X } from 'lucide-react';
import type { UppyFile } from '@uppy/core';

interface PendingFilesPanelProps {
  pendingFiles: UppyFile<any, any>[];
  onRemoveFile: (fileId: string) => void;
}

export const PendingFilesPanel: React.FC<PendingFilesPanelProps> = ({
  pendingFiles,
  onRemoveFile,
}) => {
  return (
    <div className="glass-card h-full w-full p-4 lg:p-[1.5vw] rounded-3xl bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/20 dark:border-white/5 flex flex-col shadow-lg relative overflow-hidden">
      <div className="flex items-center justify-between mb-3 lg:mb-[2vh]">
        <h3 className="text-xs lg:text-[clamp(0.65rem,0.7vw,0.8rem)] font-black text-gray-500 dark:text-stellar-label uppercase tracking-[0.2em] flex items-center gap-2">
          <Database className="w-4 h-4 text-purple-500" />
          待傳檔案 ({pendingFiles.length})
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pl-1 relative z-10 min-h-[100px]">
        <AnimatePresence mode="popLayout">
          {pendingFiles.length === 0 ? (
            <motion.div
              key="empty-files"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-white/10 space-y-3 lg:space-y-4 min-h-[100px]"
            >
              <div className="w-10 h-10 lg:w-[8vh] lg:h-[8vh] max-w-[4rem] max-h-[4rem] rounded-full border-2 border-dashed border-current flex items-center justify-center opacity-50">
                <FileText className="w-1/2 h-1/2" />
              </div>
              <p className="text-[0.6rem] lg:text-[0.65rem] uppercase tracking-widest text-center font-bold">
                拖放檔案
                <br />
                至任意處
              </p>
            </motion.div>
          ) : (
            pendingFiles.map((file) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                layout
                className="group/item relative p-3 bg-white/60 dark:bg-white/10 rounded-xl border border-white/20 dark:border-white/5 hover:border-purple-500/30 transition-all shadow-sm backdrop-blur-sm flex items-center gap-3 cursor-default"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-gray-500 dark:text-gray-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-800 dark:text-gray-200 font-bold truncate">
                    {file.name}
                  </p>
                  <p className="text-[0.6rem] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-mono">
                    {((file.size ?? 0) / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={() => onRemoveFile(file.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors opacity-100 lg:opacity-0 lg:group-hover/item:opacity-100 p-1"
                >
                  <X className="w-4 h-4 lg:w-4 lg:h-4" />
                </button>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Decorative BG element */}
      <div className="absolute -top-10 -right-10 w-24 h-24 lg:w-32 lg:h-32 bg-purple-500/10 blur-3xl rounded-full pointer-events-none" />
    </div>
  );
};
