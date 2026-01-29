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
    <div className="relative min-h-screen p-6 md:p-12 lg:p-20 space-y-16 overflow-hidden">
      <Starfield />
      
      {/* Background Ambient Elements - Adding more weight to fill space */}
      <div className="absolute top-1/4 -left-20 w-120 h-120 bg-quantum-cyan/5 blur-[150px] rounded-full -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-150 h-150 bg-neural-violet/5 blur-[180px] rounded-full -z-10 animate-pulse" style={{ animationDelay: '2s' }} />

      {/* Admin Header */}
      <div className="flex items-center justify-between relative z-10 max-w-10xl mx-auto">
        <a href="/" className="flex items-center gap-3 text-white/40 hover:text-quantum-cyan transition-all uppercase text-sm tracking-[0.3em] font-bold group">
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-2 transition-transform" /> 
          <span className="opacity-0 group-hover:opacity-100 transition-opacity">回歸核心樞紐</span>
        </a>
        <div className="flex items-center gap-6 px-8 py-4 glass-card text-sm tracking-[0.4em] uppercase font-black text-green-400 border-green-500/20 shadow-[0_0_30px_rgba(74,222,128,0.1)]">
          <ShieldCheck className="w-5 h-5 animate-pulse" /> 矩陣維護者憑證：ACTIVE
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-12 lg:gap-20 relative z-10 max-w-10xl mx-auto">
        {/* Control Panel - Taking more space on wide screens */}
        <div className="xl:col-span-3 space-y-12">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-10 md:p-16 lg:p-24 space-y-12 relative overflow-hidden group"
          >
            {/* Inner Glowing Border */}
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-quantum-cyan to-transparent opacity-30" />
            
            <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
              <div className="p-6 bg-quantum-cyan/5 rounded-3xl border border-quantum-cyan/20 shadow-[0_0_40px_rgba(34,211,238,0.1)]">
                <UserPlus className="w-12 h-12 text-quantum-cyan" />
              </div>
              <div>
                <h2 className="text-4xl lg:text-5xl font-bold text-white tracking-tighter">部署新數據節點</h2>
                <p className="text-quantum-cyan/40 text-sm uppercase tracking-[0.5em] mt-2 font-bold">DEPLOYMENT CONTROL UNIT</p>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-4">
                <label className="text-xs font-black text-stellar-label uppercase tracking-[0.3em] ml-2 drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">Username / Node ID</label>
                <input 
                  required
                  placeholder="輸入節點代碼 (例如: pilot_01)"
                  value={formData.username}
                  onChange={(e) => setFormData(p => ({ ...p, username: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 outline-none focus:border-quantum-cyan focus:bg-white/10 transition-all text-white text-lg font-medium shadow-inner"
                />
              </div>
              <div className="space-y-4">
                <label className="text-xs font-black text-stellar-label uppercase tracking-[0.3em] ml-2 drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">Access Key / Auth</label>
                <input 
                  required
                  type="password"
                  placeholder="設定存取密鑰"
                  value={formData.password}
                  onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 outline-none focus:border-quantum-cyan focus:bg-white/10 transition-all text-white text-lg font-medium shadow-inner"
                />
              </div>
              <div className="md:col-span-2 space-y-4">
                <label className="text-xs font-black text-stellar-label uppercase tracking-[0.3em] ml-2 drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">Storage Sector (Optional)</label>
                <input 
                  placeholder="預設將根據名稱分配扇區路徑..."
                  value={formData.folder}
                  onChange={(e) => setFormData(p => ({ ...p, folder: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 outline-none focus:border-quantum-cyan focus:bg-white/10 transition-all text-white text-lg font-medium shadow-inner font-mono"
                />
              </div>
              <button 
                disabled={isSyncing}
                className="md:col-span-2 btn-stellar py-8 bg-quantum-cyan/10 border-quantum-cyan/30 text-white font-black uppercase tracking-[0.6em] text-lg hover:bg-quantum-cyan/20 shadow-[0_0_50px_rgba(34,211,238,0.15)] active:scale-[0.99] transition-all"
              >
                {isSyncing ? '正在同步數據流...' : '啟動節點初始化流程'}
              </button>
            </form>

            <AnimatePresence>
              {status && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className={cn("p-8 rounded-3xl border text-center text-sm font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4", 
                    status.type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-100" : "bg-green-500/10 border-green-500/20 text-green-100 shadow-[0_0_30px_rgba(34,197,94,0.1)]")}
                >
                  <Activity className={cn("w-6 h-6", status.type === 'error' ? "text-red-400" : "text-green-400 animate-pulse")} />
                  {status.msg}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Sidebar Status - More prominent vertically */}
        <div className="space-y-10">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-10 space-y-8 h-fit bg-space-deep/80"
          >
            <h3 className="text-sm font-black text-white/40 uppercase tracking-[0.5em] flex items-center gap-3 border-b border-white/5 pb-6">
              <Activity className="w-5 h-5 text-neural-violet animate-pulse" /> 矩陣脈動
            </h3>
            <div className="space-y-6">
              {[
                { label: '核心運行模式', val: 'RELAXED_DEV', color: 'text-quantum-cyan' },
                { label: '認證加密協定', val: 'SHA256_SALT', color: 'text-neural-violet' },
                { label: '矩陣存取限制', val: 'LOCAL_ONLY', color: 'text-green-400' },
                { label: '當前指令延遲', val: '0.02ms', color: 'text-white/60' }
              ].map((item, i) => (
                <div key={i} className="flex flex-col gap-2 group">
                  <span className="text-[10px] tracking-[0.3em] uppercase text-white/50 font-bold group-hover:text-white transition-colors">{item.label}</span>
                  <span className={cn("text-xl font-black tracking-tight drop-shadow-[0_0_10px_rgba(34,211,238,0.2)]", item.color)}>{item.val}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-10 space-y-8 bg-space-deep/80"
          >
            <h3 className="text-sm font-black text-white/40 uppercase tracking-[0.5em] flex items-center gap-3 border-b border-white/5 pb-6">
              <Terminal className="w-5 h-5 text-quantum-cyan" /> 事件日誌
            </h3>
            <div className="text-[11px] font-mono text-white/80 space-y-4 max-h-[40vh] overflow-y-auto custom-scrollbar pr-4">
              <div className="flex gap-3"><span className="text-quantum-cyan/80 font-bold">[1:04:12]</span> <span className="text-white/60">指揮系統初始化完成...</span></div>
              <div className="flex gap-3"><span className="text-green-400 font-bold">[1:04:15]</span> <span className="text-white/60">權限已確認 (Session: Admin)</span></div>
              <div className="flex gap-3"><span className="text-neural-violet/80 font-bold">[1:04:22]</span> <span className="text-white/60">IP 來源驗證通過: 127.0.0.1</span></div>
              {status?.type === 'success' && (
                <div className="flex gap-3 animate-in fade-in slide-in-from-left-2 transition-all p-3 bg-quantum-cyan/5 rounded-xl border border-quantum-cyan/20">
                  <span className="text-quantum-cyan font-bold">[ACTION]</span> 
                  <span className="text-quantum-cyan/90 font-bold">已完成節點建立: {formData.username}</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
