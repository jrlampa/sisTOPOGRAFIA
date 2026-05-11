import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  ChevronRight,
  Map as MapIcon,
  Briefcase,
  Users,
  ShieldCheck,
  Archive,
  Loader2
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { ProjectService, ActivityLog } from "../services/projectService";

// ─── Suporte ──────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, trend, color = "indigo", delay = 0 }: any) {
  const colors: any = {
    indigo: "text-indigo-400 bg-indigo-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
    amber: "text-amber-400 bg-amber-500/10",
    fuchsia: "text-fuchsia-400 bg-fuchsia-500/10"
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className="relative overflow-hidden p-6 rounded-3xl bg-slate-900/40 border border-white/5 backdrop-blur-2xl shadow-2xl flex flex-col gap-4 group hover:border-white/20 transition-all hover:-translate-y-1 hover:shadow-indigo-500/10"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative z-10 flex items-center justify-between">
        <div className={`p-2 rounded-xl ${colors[color]} ring-1 ring-white/5`}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase ring-1 ring-emerald-500/20">
            +{trend}%
          </span>
        )}
      </div>
      <div className="relative z-10">
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</div>
        <div className="text-3xl font-black text-white mt-1 italic tracking-tighter drop-shadow-md">{value}</div>
        {sub && <div className="text-[10px] font-bold text-slate-600 mt-1 uppercase">{sub}</div>}
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [projectCount, setProjectCount] = useState<number | null>(null);
  const [archivedCount, setArchivedCount] = useState<number>(0);
  const [totalArea, setTotalArea] = useState<number>(0);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      const allProjects = await ProjectService.listProjects(true);
      const activity = await ProjectService.getRecentActivity();
      
      const active = allProjects.filter(p => !p.isArchived);
      const archived = allProjects.filter(p => p.isArchived);
      
      setProjectCount(active.length);
      setArchivedCount(archived.length);
      setTotalArea(active.reduce((acc, p) => acc + (p.areaM2 || 0), 0));
      setRecentActivity(activity);
      setLoading(false);
    };

    loadDashboardData();
  }, []);
  
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-10"
    >
      {/* Welcome Section */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-wrap items-end justify-between gap-6"
      >
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic drop-shadow-lg">Visão Geral</h1>
          <p className="text-slate-400 text-sm font-bold uppercase tracking-[0.2em] mt-1">Bem-vindo ao centro de comando, <span className="text-indigo-400">{user?.email?.split('@')[0]}</span></p>
        </div>
        <div className="flex items-center gap-3 bg-slate-900/60 p-2 rounded-2xl border border-white/10 backdrop-blur-xl shadow-xl">
           <div className="px-4 py-2 text-right border-r border-white/10">
             <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none italic">Jurisdição IM3</div>
             <div className="text-xs font-black text-white uppercase mt-1">Brasil / Sudeste</div>
           </div>
           <div className="px-4 py-2 text-right">
             <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Status do Tenant</div>
             <div className="text-xs font-black text-emerald-400 uppercase mt-1 flex items-center justify-end gap-1.5">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
               Enterprise Ativo
             </div>
           </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard 
          label="Projetos Ativos" 
          value={projectCount !== null ? projectCount.toString() : "..."} 
          sub={`${archivedCount} arquivados`} 
          icon={Briefcase} 
          trend={projectCount ? "10" : undefined}
          color="indigo"
          delay={0.1}
        />
        <StatCard 
          label="Área Mapeada" 
          value={`${(totalArea / 1000).toFixed(1)}k m²`} 
          sub="Cortes geográficos" 
          icon={MapIcon} 
          color="emerald"
          delay={0.2}
        />
        <StatCard 
          label="Membros Online" 
          value="04" 
          sub="Sincronização Live" 
          icon={Users} 
          color="amber"
          delay={0.3}
        />
        <StatCard 
          label="Compliance ESG" 
          value="98.2%" 
          sub="Média do portfólio" 
          icon={ShieldCheck} 
          color="fuchsia"
          delay={0.4}
        />
      </div>

      {/* Bottom Layout: Recent Activity + Project Lifecycle */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="lg:col-span-2 space-y-6"
        >
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black text-white/40 uppercase tracking-[0.4em]">Linha do Tempo de Atividade</h3>
            <div className="flex items-center gap-4">
               {loading && <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />}
               <Link to="/portal/projects" className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest transition-all">Ver Histórico</Link>
            </div>
          </div>
          
          <div className="space-y-3">
             {!loading && recentActivity.length === 0 && (
               <div className="p-10 text-center border border-dashed border-white/10 rounded-3xl opacity-20">
                  <Activity className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-[10px] font-black uppercase">Nenhuma atividade registrada na jurisdição.</p>
               </div>
             )}
             {recentActivity.map(log => (
               <Link 
                 key={log.id} 
                 to={log.projectId ? `/editor/${log.projectId}` : "#"}
                 className="group p-5 bg-white/5 border border-white/5 hover:border-indigo-500/20 rounded-3xl flex items-center justify-between transition-all"
               >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-lg">
                       <MapIcon size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-black text-white group-hover:text-indigo-400 transition-colors">{log.projectName}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase italic mt-1">
                        {log.action} por <span className="text-indigo-400">{log.userName}</span> • {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-700 group-hover:text-indigo-400 transition-all translate-x-0 group-hover:translate-x-1" />
               </Link>
             ))}
          </div>
        </motion.div>

        <div className="space-y-6">
          <h3 className="text-xs font-black text-white/40 uppercase tracking-[0.4em] px-2">Integridade de Projetos</h3>
          <div className="p-8 rounded-[2.5rem] bg-indigo-600/5 border border-indigo-500/10 space-y-6 shadow-2xl shadow-indigo-500/5">
             <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <Archive className="w-4 h-4 text-slate-500" />
                      <span className="text-[10px] font-black text-slate-400 uppercase">Arquivamento</span>
                   </div>
                   <span className="text-xs font-black text-white">{archivedCount}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                   <div className="h-full bg-slate-500 transition-all duration-1000" style={{ width: `${(archivedCount / (((projectCount || 0) + archivedCount) || 1)) * 100}%` }} />
                </div>
             </div>

             <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      <span className="text-[10px] font-black text-slate-400 uppercase">Auditados (ESG)</span>
                   </div>
                   <span className="text-xs font-black text-white">85%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                   <div className="h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.4)]" style={{ width: `85%` }} />
                </div>
             </div>

             <div className="pt-6 border-t border-white/5">
                <button className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-indigo-600/20 active:scale-95">
                   Relatório de Governança
                </button>
             </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
