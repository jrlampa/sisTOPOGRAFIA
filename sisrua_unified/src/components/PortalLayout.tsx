import React from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { 
  LayoutDashboard, 
  Map as MapIcon, 
  Users, 
  Settings, 
  HelpCircle, 
  Menu, 
  Box, 
  LogOut,
  Calculator
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { useFeatureFlags } from "../contexts/FeatureFlagContext";

export const PortalLayout: React.FC = () => {
  const { user, signOut } = useAuth();
  const { flags } = useFeatureFlags();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  const navItems = [
    { label: "Overview", icon: LayoutDashboard, path: "/portal" },
    { label: "Projetos", icon: MapIcon, path: "/portal/projects" },
    { label: "Equipe", icon: Users, path: "/portal/team" },
    { label: "FinOps", icon: Calculator, path: "/portal/finance", enabled: flags.enableFinOpsDashboard },
    { label: "Engine", icon: Box, path: "/portal/modularity" },
  ];

  const bottomItems = [
    { label: "Ajuda", icon: HelpCircle, path: "/ajuda" },
    { label: "Ajustes", icon: Settings, path: "/portal/settings" },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen w-full bg-slate-950 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside 
        className={`${isSidebarOpen ? "w-64" : "w-20"} transition-all duration-300 bg-slate-900 border-r border-white/5 flex flex-col z-50 shadow-2xl`}
      >
        {/* Logo */}
        <div className="p-6 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-white font-black text-xs uppercase italic">RUA</span>
          </div>
          {isSidebarOpen && (
            <span className="text-white font-black tracking-tighter text-lg uppercase italic">sisRUA <span className="text-indigo-500">v3</span></span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.filter(i => i.enabled !== false).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all group ${
                isActive(item.path) 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <item.icon size={20} strokeWidth={isActive(item.path) ? 2.5 : 2} />
              {isSidebarOpen && <span className="text-sm font-bold tracking-tight">{item.label}</span>}
              {!isSidebarOpen && (
                <div className="absolute left-16 hidden group-hover:block z-50 bg-slate-800 text-white text-[10px] font-black px-2 py-1 rounded shadow-xl uppercase border border-white/5">
                   {item.label}
                </div>
              )}
            </Link>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-white/5 space-y-1">
          {bottomItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all group ${
                isActive(item.path) ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5"
              }`}
            >
              <item.icon size={20} />
              {isSidebarOpen && <span className="text-sm font-bold">{item.label}</span>}
            </Link>
          ))}
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all group"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="text-sm font-bold uppercase tracking-widest text-[10px]">Encerrar</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[url('/grid-subtle.png')] bg-repeat">
        {/* Header */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-slate-900/50 backdrop-blur-xl z-40">
          <div className="flex items-center gap-4">
             <button 
               onClick={() => setIsSidebarOpen(!isSidebarOpen)}
               className="p-2 hover:bg-white/5 rounded-lg text-slate-400"
             >
               {isSidebarOpen ? <Menu size={20} /> : <Box size={20} />}
             </button>
             <h2 className="text-sm font-black text-white/50 uppercase tracking-[0.3em]">IM3 Brasil / <span className="text-white">Portal do Engenheiro</span></h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-black text-white">{user?.email?.split('@')[0]}</div>
              <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Tech Lead</div>
            </div>
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 border-2 border-white/10 shadow-lg flex items-center justify-center font-black text-white uppercase italic">
              {user?.email?.[0]}
            </div>
          </div>
        </header>

        {/* Dynamic Page */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
