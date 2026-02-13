import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, FileText, X, Clock, TrendingUp } from 'lucide-react';
import type { UppyFile } from '@uppy/core';

interface ExtendedFileProgress {
  percentage?: number;
  bytesUploaded?: number | boolean;
  uploadSpeed?: number;
  eta?: number;
}

interface PendingFilesPanelProps {
  pendingFiles: (UppyFile<Record<string, unknown>, Record<string, unknown>> & { progress?: ExtendedFileProgress })[];
  onRemoveFile: (fileId: string) => void;
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDuration = (seconds: number) => {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '--';
  if (seconds === Infinity) return 'Calculating...';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

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
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-800 dark:text-gray-200 font-bold truncate">
                      {file.name}
                    </p>
                    <button
                      onClick={() => onRemoveFile(file.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors opacity-100 p-1 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Progress Info */}
                  {file.progress && file.progress.percentage !== undefined && file.progress.percentage > 0 && (
                    <div className="space-y-1.5">
                      {/* Bar */}
                      <div className="h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${file.progress.percentage}%` }}
                          className="h-full bg-linear-to-r from-purple-500 to-cyan-500"
                        />
                      </div>
                      
                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-y-1 text-[0.6rem] font-mono uppercase tracking-tight">
                        <div className="text-purple-600 dark:text-purple-400 font-bold">
                          {file.progress.percentage.toFixed(1)}%
                        </div>
                        <div className="text-right text-gray-500 dark:text-gray-400">
                          {formatBytes(typeof file.progress.bytesUploaded === 'number' ? file.progress.bytesUploaded : 0)} / {formatBytes(file.size || 0)}
                        </div>
                        
                        {file.progress.percentage < 100 && (
                          <>
                            <div className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400">
                              <TrendingUp className="w-2.5 h-2.5" />
                              {formatBytes(Number(file.meta.uploadSpeed) || 0)}/s
                            </div>
                            <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 justify-self-end">
                              <Clock className="w-2.5 h-2.5" />
                              {formatDuration(Number(file.meta.eta) || 0)}
                            </div>
                          </>
                        )}
                        {file.progress.percentage === 100 && (
                          <div className="col-span-2 text-green-500 font-bold tracking-widest">
                            UPLOAD COMPLETED
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!file.progress || file.progress.percentage === 0 ? (
                    <p className="text-[0.6rem] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-mono">
                      {formatBytes(file.size ?? 0)}
                    </p>
                  ) : null}
                </div>
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
