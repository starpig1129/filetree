import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Terminal, Activity, UserPlus, ChevronLeft, ShieldCheck } from 'lucide-react';
import { Starfield } from '../components/Starfield';
import { cn } from '../lib/utils';

export const AdminPage: React.FC = () => {
  const [masterKey, setMasterKey] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '', folder: '' });
  const [status, setStatus] = useState<{ type: 'info' | 'error' | 'success', msg: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/admin/verify?master_key=${masterKey}`);
      if (res.ok) {
        setIsAuthorized(true);
        setStatus({ type: 'success', msg: '矩陣權限已確認。指揮系統上線。' });
      } else {
        const err = await res.json();
        setStatus({ type: 'error', msg: err.detail || '權限驗證失敗：無效的主金鑰。' });
      }
    } catch (err) {
      console.error('Matrix Auth Error:', err);
      setStatus({ type: 'error', msg: '連結中斷：無法存取核心驗證伺服器。' });
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    setStatus(null);

    try {
      const body = new FormData();
      body.append('master_key', masterKey);
      body.append('username', formData.username);
      body.append('password', formData.password);
      if (formData.folder) body.append('folder', formData.folder);

      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        body
      });
      const result = await res.json();

      if (res.ok) {
        setStatus({ type: 'success', msg: `節點建立成功：${formData.username} 已加入網格。` });
        setFormData({ username: '', password: '', folder: '' });
      } else {
        setStatus({ type: 'error', msg: result.detail || '建立失敗：核心邏輯衝突。' });
      }
    } catch (err) {
      console.error('Deployment Error:', err);
      setStatus({ type: 'error', msg: '系統錯誤：數據流寫入中斷。' });
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <Starfield />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-12 w-full max-w-md space-y-8 relative z-10"
        >
          <div className="text-center space-y-4">
            <ShieldAlert className="w-16 h-16 text-neural-violet mx-auto animate-pulse" />
            <h1 className="text-3xl font-bold tracking-tighter text-white">CORE AUTHORITY</h1>
            <p className="text-white/40 text-xs uppercase tracking-widest font-bold">請輸入授權主金鑰以進入矩陣</p>
          </div>

          <form onSubmit={handleVerify} className="space-y-6">
            <input 
              type="password"
              placeholder="MASTER KEY"
              value={masterKey}
              onChange={(e) => setMasterKey(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-neural-violet transition-all text-center tracking-widest font-mono text-white"
            />
            <button className="btn-stellar w-full py-4 bg-neural-violet/10 border-neural-violet/30 text-neural-violet uppercase font-black tracking-widest">
              啟動授權
            </button>
          </form>

          {status && (
            <p className={cn("text-center text-xs font-bold uppercase tracking-widest", status.type === 'error' ? "text-red-400" : "text-green-400")}>
              {status.msg}
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen p-[clamp(1rem,3vw,2rem)] sm:p-[clamp(1.5rem,4vw,3rem)] space-y-[clamp(1.5rem,4vh,3rem)] overflow-hidden">
      <Starfield />
      
      {/* Background Ambient Elements - More compact for 1080p */}
      <div className="absolute top-1/4 -left-20 w-[60vw] h-[50vh] max-w-240 max-h-150 bg-quantum-cyan/5 blur-[clamp(3rem,8vw,8rem)] rounded-full -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-[80vw] h-[60vh] max-w-300 max-h-180 bg-neural-violet/5 blur-[clamp(4rem,10vw,10rem)] rounded-full -z-10 animate-pulse" style={{ animationDelay: '2s' }} />

      {/* Admin Header - Tightened for 1080p */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10 max-w-10xl mx-auto">
        <a href="/" className="flex items-center gap-2 text-white/40 hover:text-quantum-cyan transition-all uppercase text-[clamp(0.6rem,0.9vw,0.8rem)] tracking-[0.3em] font-bold group">
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-2 transition-transform" /> 
          <span>回歸核心樞紐</span>
        </a>
        <div className="flex items-center gap-3 sm:gap-6 px-4 sm:px-6 py-2 sm:py-2.5 glass-card text-[clamp(0.45rem,0.75vw,0.7rem)] tracking-[0.2em] sm:tracking-[0.3em] uppercase font-black text-green-400 border-green-500/20 shadow-lg">
          <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse shrink-0" /> 矩陣維護者憑證：ACTIVE
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[clamp(1rem,3vw,3rem)] relative z-10 max-w-10xl mx-auto">
        {/* Control Panel - Compacted height */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-[clamp(1rem,2.5vh,2.5rem)]">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-[clamp(1.25rem,3.5vw,3rem)] space-y-[clamp(1.25rem,3.5vh,2.5rem)] relative overflow-hidden group"
          >
            {/* Inner Glowing Border */}
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-quantum-cyan to-transparent opacity-30" />
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-[clamp(1rem,2.5vw,2rem)]">
              <div className="p-[clamp(0.75rem,2vw,1.25rem)] bg-quantum-cyan/5 rounded-2xl border border-quantum-cyan/20 shadow-xl shrink-0">
                <UserPlus className="w-[clamp(1.5rem,3vw,2.5rem)] h-[clamp(1.5rem,3vw,2.5rem)] text-quantum-cyan" />
              </div>
              <div>
                <h2 className="text-[clamp(1.5rem,3vw,2.5rem)] font-bold text-white tracking-tighter leading-tight">部署新數據節點</h2>
                <p className="text-quantum-cyan/40 text-[clamp(0.45rem,0.75vw,0.7rem)] uppercase tracking-[0.3em] sm:tracking-[0.4em] mt-0.5 font-bold">DEPLOYMENT CONTROL UNIT</p>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 gap-[clamp(1rem,2.5vw,2rem)]">
              <div className="space-y-2">
                <label className="text-[9px] sm:text-[10px] font-black text-stellar-label uppercase tracking-[0.3em] ml-2 opacity-60">Username / Node ID</label>
                <input 
                  required
                  placeholder="輸入節點代碼 (例如: pilot_01)"
                  value={formData.username}
                  onChange={(e) => setFormData(p => ({ ...p, username: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 sm:py-4 outline-none focus:border-quantum-cyan focus:bg-white/10 transition-all text-white text-sm sm:text-base font-medium shadow-inner"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] sm:text-[10px] font-black text-stellar-label uppercase tracking-[0.3em] ml-2 opacity-60">Access Key / Auth</label>
                <input 
                  required
                  type="password"
                  placeholder="設定存取密鑰"
                  value={formData.password}
                  onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 sm:py-4 outline-none focus:border-quantum-cyan focus:bg-white/10 transition-all text-white text-sm sm:text-base font-medium shadow-inner"
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <label className="text-[9px] sm:text-[10px] font-black text-stellar-label uppercase tracking-[0.3em] ml-2 opacity-60">Storage Sector (Optional)</label>
                <input 
                  placeholder="預設將根據名稱分配扇區路徑..."
                  value={formData.folder}
                  onChange={(e) => setFormData(p => ({ ...p, folder: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 sm:py-4 outline-none focus:border-quantum-cyan focus:bg-white/10 transition-all text-white text-sm sm:text-base font-medium shadow-inner font-mono"
                />
              </div>
              <button 
                disabled={isSyncing}
                className="sm:col-span-2 btn-stellar py-4 sm:py-5 bg-quantum-cyan/10 border-quantum-cyan/30 text-white font-black uppercase tracking-[clamp(0.2em,1vw,0.5em)] text-sm sm:text-base hover:bg-quantum-cyan/20 shadow-xl active:scale-[0.99] transition-all"
              >
                {isSyncing ? '正在同步數據流...' : '啟動節點初始化流程'}
              </button>
            </form>

            <AnimatePresence>
              {status && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className={cn("p-4 rounded-2xl border text-center text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3", 
                    status.type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-100" : "bg-green-500/10 border-green-500/20 text-green-100 shadow-lg")}
                >
                  <Activity className={cn("w-4 h-4 sm:w-5 sm:h-5", status.type === 'error' ? "text-red-400" : "text-green-400 animate-pulse")} />
                  {status.msg}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Sidebar Status - Compacted list */}
        <div className="lg:col-span-4 xl:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-[clamp(1rem,2.5vw,2.5rem)]">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-5 sm:p-6 space-y-4 bg-space-deep/80"
          >
            <h3 className="text-[clamp(0.6rem,0.9vw,0.75rem)] font-black text-white/40 uppercase tracking-[0.3em] sm:tracking-[0.4em] flex items-center gap-2 border-b border-white/5 pb-3">
              <Activity className="w-4 h-4 text-neural-violet animate-pulse shrink-0" /> 矩陣脈動
            </h3>
            <div className="space-y-3">
              {[
                { label: '核心模式', val: 'RELAXED_DEV', color: 'text-quantum-cyan' },
                { label: '認證協定', val: 'SHA256_SALT', color: 'text-neural-violet' },
                { label: '存取限制', val: 'LOCAL_ONLY', color: 'text-green-400' },
                { label: '指令延遲', val: '0.02ms', color: 'text-white/60' }
              ].map((item, i) => (
                <div key={i} className="flex flex-col gap-0.5 group">
                  <span className="text-[clamp(0.4rem,0.55vw,0.5rem)] tracking-[0.2em] uppercase text-white/50 font-bold group-hover:text-white transition-colors">{item.label}</span>
                  <span className={cn("text-[clamp(0.8rem,1vw,1rem)] font-black tracking-tight drop-shadow-lg", item.color)}>{item.val}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-5 sm:p-6 space-y-4 bg-space-deep/80"
          >
            <h3 className="text-[clamp(0.6rem,0.9vw,0.75rem)] font-black text-white/40 uppercase tracking-[0.3em] sm:tracking-[0.4em] flex items-center gap-2 border-b border-white/5 pb-3">
              <Terminal className="w-4 h-4 text-quantum-cyan shrink-0" /> 事件日誌
            </h3>
            <div className="text-[clamp(0.5rem,0.7vw,0.6rem)] font-mono text-white/80 space-y-2.5 max-h-[clamp(8rem,15vh,12rem)] lg:max-h-[clamp(12rem,25vh,20rem)] overflow-y-auto custom-scrollbar pr-2 overflow-x-hidden">
              <div className="flex gap-2 shrink-0"><span className="text-quantum-cyan/80 font-bold shrink-0">[1:04:12]</span> <span className="text-white/60 truncate">管理控制單元就緒...</span></div>
              <div className="flex gap-2 shrink-0"><span className="text-green-400 font-bold shrink-0">[1:04:15]</span> <span className="text-white/60 truncate">權限確認</span></div>
              {status?.type === 'success' && (
                <div className="flex gap-2 animate-in fade-in slide-in-from-left-2 transition-all p-2 bg-quantum-cyan/5 rounded-lg border border-quantum-cyan/20 shrink-0">
                  <span className="text-quantum-cyan font-bold shrink-0">[OK]</span> 
                  <span className="text-quantum-cyan/90 font-bold truncate">已部署: {formData.username}</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
