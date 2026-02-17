import React from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, FileUp, Zap, Lock, Shield, Clock, Globe, Cpu } from 'lucide-react';

export const HelpPage: React.FC = () => {
  return (
    <div className="relative min-h-[calc(100vh-8rem)] overflow-x-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 -right-20 w-[50vw] h-[40vh] bg-quantum-cyan/5 blur-[6rem] rounded-full -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 -left-20 w-[40vw] h-[30vh] bg-neural-violet/5 blur-[6rem] rounded-full -z-10 animate-pulse" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="flex items-center justify-center gap-4 mb-4">
          <HelpCircle className="w-10 h-10 text-cyan-600 dark:text-quantum-cyan" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white/90">使用說明</h1>
        </div>
        <p className="filenexus-brand text-sm! uppercase tracking-widest">FileNexus User Guide</p>
      </motion.div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        
        {/* Feature Card: Upload */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-50 dark:bg-quantum-cyan/10 rounded-xl border border-cyan-200 dark:border-quantum-cyan/20">
              <FileUp className="w-5 h-5 text-cyan-600 dark:text-quantum-cyan" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white/90">檔案上傳</h2>
          </div>
          <ul className="space-y-2 text-gray-600 dark:text-white/60 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-cyan-500 dark:text-quantum-cyan">•</span>
              支援任意檔案格式，單檔最大 10GB
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-500 dark:text-quantum-cyan">•</span>
              使用 TUS 協議，支援斷點續傳
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-500 dark:text-quantum-cyan">•</span>
              輸入密碼建立或存取您的個人目錄
            </li>
          </ul>
        </motion.div>

        {/* Feature Card: Notes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card p-6 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-50 dark:bg-neural-violet/10 rounded-xl border border-violet-200 dark:border-neural-violet/20">
              <Zap className="w-5 h-5 text-violet-600 dark:text-neural-violet" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white/90">加密筆記</h2>
          </div>
          <ul className="space-y-2 text-gray-600 dark:text-white/60 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-violet-500 dark:text-neural-violet">•</span>
              可保存網址、文字、備忘錄等資訊
            </li>
            <li className="flex items-start gap-2">
              <span className="text-violet-500 dark:text-neural-violet">•</span>
              筆記與連結永久保留，不會自動刪除
            </li>
            <li className="flex items-start gap-2">
              <span className="text-violet-500 dark:text-neural-violet">•</span>
              支援 QR Code 快速分享
            </li>
          </ul>
        </motion.div>

        {/* Feature Card: Security */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-green-500/10 rounded-xl border border-emerald-200 dark:border-green-500/20">
              <Lock className="w-5 h-5 text-emerald-600 dark:text-green-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white/90">隱私保護</h2>
          </div>
          <ul className="space-y-2 text-gray-600 dark:text-white/60 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 dark:text-green-400">•</span>
              每個目錄都有獨立密碼保護
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 dark:text-green-400">•</span>
              可對個別檔案或筆記進行加鎖
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 dark:text-green-400">•</span>
              首次登入後建議更改初始密碼
            </li>
          </ul>
        </motion.div>

        {/* Feature Card: Lifecycle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card p-6 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white/90">檔案生命週期</h2>
          </div>
          <ul className="space-y-2 text-gray-600 dark:text-white/60 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-amber-500 dark:text-amber-400">•</span>
              實體檔案將於上傳後 30 天自動刪除
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 dark:text-amber-400">•</span>
              檔案卡片會顯示剩餘時間
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 dark:text-amber-400">•</span>
              請及時下載重要檔案進行備份
            </li>
          </ul>
        </motion.div>

        {/* Feature Card: Share */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/20">
              <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white/90">檔案分享</h2>
          </div>
          <ul className="space-y-2 text-gray-600 dark:text-white/60 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 dark:text-blue-400">•</span>
              點擊分享按鈕產生一次性下載連結
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 dark:text-blue-400">•</span>
              分享連結可直接傳送給他人
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 dark:text-blue-400">•</span>
              公開目錄可讓他人瀏覽您的檔案列表
            </li>
          </ul>
        </motion.div>

        {/* Feature Card: Access */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass-card p-6 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-50 dark:bg-rose-500/10 rounded-xl border border-rose-200 dark:border-rose-500/20">
              <Shield className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white/90">存取目錄</h2>
          </div>
          <ul className="space-y-2 text-gray-600 dark:text-white/60 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-rose-500 dark:text-rose-400">•</span>
              點擊右側「公開目錄」進入其他使用者頁面
            </li>
            <li className="flex items-start gap-2">
              <span className="text-rose-500 dark:text-rose-400">•</span>
              輸入密碼可解鎖查看加鎖項目
            </li>
            <li className="flex items-start gap-2">
              <span className="text-rose-500 dark:text-rose-400">•</span>
              解鎖後可進行刪除、鎖定等管理操作
            </li>
          </ul>
        </motion.div>

      </div>

      {/* Footer Note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center mt-12 text-gray-400 dark:text-white/20 text-xs uppercase tracking-widest"
      >
        <Cpu className="w-4 h-4 inline-block mr-2 opacity-50" />
        <span className="filenexus-brand text-xs! tracking-widest uppercase inline-block">FileNexus</span> - Modern File Management Hub
      </motion.div>
    </div>
  );
};
