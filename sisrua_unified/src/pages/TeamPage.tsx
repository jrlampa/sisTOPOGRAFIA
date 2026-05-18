import React from "react";
import { 
  Users as UsersIcon, 
  ShieldCheck, 
  Shield, 
  MoreHorizontal, 
  Mail, 
  UserPlus,
  Zap,
  Activity
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "tech_lead" | "editor" | "observer";
  status: "online" | "away" | "offline";
  lastActive: string;
}

export const TeamPage: React.FC = () => {
  const { user } = useAuth();
  
  const [members] = React.useState<TeamMember[]>([
    { id: "M001", name: "Jonathan Tech Lead", email: "jonathan@im3brasil.com.br", role: "tech_lead", status: "online", lastActive: "Agora" },
    { id: "M002", name: "Ricardo Sênior", email: "ricardo@im3brasil.com.br", role: "editor", status: "online", lastActive: "Agora" },
    { id: "M003", name: "Amanda Designer", email: "amanda@im3brasil.com.br", role: "editor", status: "away", lastActive: "há 15 min" },
    { id: "M004", name: "Carlos Estagiário", email: "carlos@im3brasil.com.br", role: "observer", status: "offline", lastActive: "há 2 horas" },
  ]);

  const getRoleIcon = (role: TeamMember["role"]) => {
    switch (role) {
      case "admin": return <ShieldCheck className="w-4 h-4 text-rose-500" />;
      case "tech_lead": return <Zap className="w-4 h-4 text-indigo-400" />;
      default: return <Shield className="w-4 h-4 text-slate-500" />;
    }
  };

  const getStatusColor = (status: TeamMember["status"]) => {
    switch (status) {
      case "online": return "bg-emerald-500";
      case "away": return "bg-amber-500";
      default: return "bg-slate-700";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Equipe IM3</h1>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-[0.2em] mt-1">Gerencie membros e permissões da sua jurisdição</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-indigo-500/20 active:scale-95">
          <UserPlus size={18} strokeWidth={3} />
          Convidar Engenheiro
        </button>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="p-6 bg-white/5 border border-white/5 rounded-3xl flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-2xl">
               <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
               <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ativos Agora</div>
               <div className="text-2xl font-black text-white italic">02 Membros</div>
            </div>
         </div>
         <div className="p-6 bg-white/5 border border-white/5 rounded-3xl flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-2xl">
               <ShieldCheck className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
               <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">SLA de Resposta</div>
               <div className="text-2xl font-black text-white italic">99.9%</div>
            </div>
         </div>
         <div className="p-6 bg-white/5 border border-white/5 rounded-3xl flex items-center gap-4">
            <div className="p-3 bg-fuchsia-500/10 rounded-2xl">
               <UsersIcon className="w-5 h-5 text-fuchsia-400" />
            </div>
            <div>
               <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Equipe</div>
               <div className="text-2xl font-black text-white italic">14 Engenheiros</div>
            </div>
         </div>
      </div>

      {/* Members List */}
      <div className="bg-slate-900/40 border border-white/10 rounded-[2.5rem] overflow-hidden backdrop-blur-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 bg-white/5">
              <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Membro</th>
              <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Cargo / Role</th>
              <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Status</th>
              <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Último Acesso</th>
              <th className="p-6"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                <td className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center font-black text-white uppercase italic text-sm shadow-lg">
                      {member.name[0]}
                    </div>
                    <div>
                      <div className="text-sm font-black text-white group-hover:text-indigo-400 transition-colors">{member.name}</div>
                      <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mt-1 uppercase italic tracking-widest">
                         <Mail size={10} />
                         {member.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-6">
                   <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5 w-max">
                      {getRoleIcon(member.role)}
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{member.role.replace('_', ' ')}</span>
                   </div>
                </td>
                <td className="p-6">
                   <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(member.status)} shadow-lg shadow-current/20 animate-pulse`} />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{member.status}</span>
                   </div>
                </td>
                <td className="p-6 text-[11px] font-black text-slate-500 uppercase">{member.lastActive}</td>
                <td className="p-6 text-right">
                   <button className="p-2 hover:bg-white/10 rounded-xl text-slate-500 transition-all opacity-0 group-hover:opacity-100">
                      <MoreHorizontal size={18} />
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
