import React from "react";
import { motion } from "framer-motion";
import { 
  ShieldCheck, 
  Activity, 
  Users, 
  Building2, 
  BarChart3, 
  Globe, 
  Zap, 
  Terminal,
  Database,
  Server,
  Lock,
  RefreshCw,
  Search,
  ChevronRight,
  TrendingUp,
  AlertTriangle
} from "lucide-react";

/**
 * SuperAdminDashboard.tsx — Dashboard de Governança Global da Plataforma.
 */
export default function SuperAdminDashboard() {
  const [loading, setLoading] = React.useState(false);

  const globalMetrics = [
    { label: "Tenants Ativos", value: "142", trend: "+12%", icon: Building2, color: "text-cyan-400" },
    { label: "Usuários Totais", value: "3,842", trend: "+8%", icon: Users, color: "text-indigo-400" },
    { label: "Jobs / Mês", value: "85.2k", trend: "+24%", icon: Activity, color: "text-emerald-400" },
    { label: "Custo Infra (Estimated)", value: "R$ 4.2k", trend: "-5%", icon: BarChart3, color: "text-amber-400" },
  ];

  const systemStatus = [
    { name: "API Gateway", status: "online", latency: "42ms", icon: Globe },
    { name: "Auth Service", status: "online", latency: "18ms", icon: Lock },
    { name: "PostGIS Engine", status: "online", latency: "156ms", icon: Database },
    { name: "Python Workers", status: "online", latency: "890ms", icon: Terminal },
    { name: "Ollama IA Node", status: "degraded", latency: "4.2s", icon: Zap },
    { name: "Redis Cache", status: "online", latency: "2ms", icon: Server },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-10"
    >
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <ShieldCheck className="w-4 h-4 text-indigo-500" />
             <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Governance & Ops</span>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic drop-shadow-lg">SuperAdmin Center</h1>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="relative group">
              <input 
                type="text" 
                placeholder="Buscar tenant ou log..." 
                className="h-11 bg-slate-900/60 border border-white/5 rounded-xl pl-10 pr-4 text-xs font-bold text-white focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all w-64"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
           </div>
           <button 
             onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1000); }}
             className="h-11 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all flex items-center justify-center gap-2"
           >
              <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? "animate-spin text-indigo-400" : ""}`} />
           </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {globalMetrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-6 rounded-[2rem] bg-slate-900/40 border border-white/5 backdrop-blur-2xl relative overflow-hidden group hover:border-white/10 transition-all"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <m.icon className={`w-16 h-16 ${m.color}`} />
            </div>
            <div className="flex items-center justify-between mb-4">
               <div className={`p-2 rounded-xl bg-slate-950/50 border border-white/5 ${m.color}`}>
                  <m.icon size={18} />
               </div>
               <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${m.trend.startsWith('+') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                 {m.trend}
               </span>
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{m.label}</div>
            <div className="text-3xl font-black text-white mt-1 italic tracking-tighter">{m.value}</div>
          </motion.div>
        ))}
      </div>

      {/* System Health & Incident Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Health Column */}
        <div className="lg:col-span-1 space-y-6">
           <h3 className="text-xs font-black text-white/40 uppercase tracking-[0.4em] px-2">Core Infrastructure</h3>
           <div className="bg-slate-900/40 border border-white/5 rounded-[2rem] p-6 backdrop-blur-xl space-y-4">
              {systemStatus.map(s => (
                <div key={s.name} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors border border-transparent hover:border-white/5">
                   <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-black/20 ${s.status === 'online' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        <s.icon size={14} />
                      </div>
                      <span className="text-[11px] font-bold text-slate-300 uppercase tracking-tight">{s.name}</span>
                   </div>
                   <div className="text-right">
                      <div className={`text-[9px] font-black uppercase ${s.status === 'online' ? 'text-emerald-500' : 'text-amber-500'}`}>{s.status}</div>
                      <div className="text-[10px] font-mono text-slate-500">{s.latency}</div>
                   </div>
                </div>
              ))}
           </div>

           <div className="p-6 rounded-[2rem] bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-between group cursor-pointer hover:bg-indigo-600/20 transition-all">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 ring-1 ring-indigo-500/30">
                    <TrendingUp size={20} />
                 </div>
                 <div>
                    <div className="text-xs font-black text-white uppercase tracking-tight italic">Performance Reports</div>
                    <div className="text-[10px] font-bold text-indigo-400/80 uppercase">Gerar auditoria técnica</div>
                 </div>
              </div>
              <ChevronRight className="text-indigo-500 group-hover:translate-x-1 transition-transform" />
           </div>
        </div>

        {/* Recent Events Column */}
        <div className="lg:col-span-2 space-y-6">
           <div className="flex items-center justify-between px-2">
              <h3 className="text-xs font-black text-white/40 uppercase tracking-[0.4em]">Audit Trail & Security</h3>
              <button className="text-[9px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors">Export Logs</button>
           </div>
           
           <div className="space-y-3">
              {[
                { type: 'incident', msg: 'Latência anormal detectada no Ollama IA Node.', time: '2 min ago', severity: 'warning' },
                { type: 'security', msg: 'Tentativa de força bruta bloqueada: IP 187.42.x.x', time: '14 min ago', severity: 'critical' },
                { type: 'tenant', msg: 'Novo Tenant registrado: Light S.A. (Enterprise)', time: '1h ago', severity: 'info' },
                { type: 'deploy', msg: 'Build v0.9.0-rc4 promovido para produção.', time: '3h ago', severity: 'info' },
                { type: 'billing', msg: 'Alerta de quota: Tenant IM3 atingiu 80% do limite DXF.', time: '5h ago', severity: 'warning' },
              ].map((ev, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-3xl bg-slate-900/30 border border-white/5 group hover:border-indigo-500/20 transition-all">
                   <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${ev.severity === 'critical' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse' : ev.severity === 'warning' ? 'bg-amber-500' : 'bg-indigo-500'}`} />
                      <div>
                         <div className="text-[11px] font-bold text-white uppercase tracking-tight">{ev.msg}</div>
                         <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{ev.type} • {ev.time}</div>
                      </div>
                   </div>
                   <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 hover:bg-white/5 rounded-lg text-slate-400">
                         <Search size={14} />
                      </button>
                   </div>
                </div>
              ))}
           </div>

           <div className="p-8 rounded-[2.5rem] bg-slate-900/60 border border-dashed border-white/10 flex flex-col items-center justify-center text-center opacity-40">
              <AlertTriangle className="w-8 h-8 mb-3 text-slate-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Fim do Log de Auditoria</p>
           </div>
        </div>

      </div>
    </motion.div>
  );
}
