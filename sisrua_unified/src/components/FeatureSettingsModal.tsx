import React from "react";
import { Settings, X, Power, Info, Zap, ShieldCheck, Brain, Users, Layout, Lock, Gauge, Trash2, Plus, Wifi, WifiOff } from "lucide-react";
import { useFeatureFlags } from "../contexts/FeatureFlagContext";
import { FEATURE_LABELS, FeatureFlags, PRESETS, FeaturePreset } from "../types/featureFlags";
import { useAuth } from "../auth/AuthProvider";

interface FeatureSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeatureSettingsModal: React.FC<FeatureSettingsModalProps> = ({ isOpen, onClose }) => {
  const { 
    flags, 
    customPresets, 
    featureHealth, 
    toggleFlag, 
    applyPreset, 
    saveCustomPreset, 
    deleteCustomPreset 
  } = useFeatureFlags();
  const { user } = useAuth();
  const [newPresetLabel, setNewPresetLabel] = React.useState("");

  if (!isOpen) return null;

  const userRole = (user?.email?.includes("admin") || user?.email?.includes("techlead")) ? "tech_lead" : "editor";
  const categories = Array.from(new Set(Object.values(FEATURE_LABELS).map(l => l.category)));

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Engenharia": return <Zap className="w-3 h-3" />;
      case "Compliance": return <ShieldCheck className="w-3 h-3" />;
      case "IA & Dados": return <Brain className="w-3 h-3" />;
      case "Colaboração": return <Users className="w-3 h-3" />;
      default: return <Layout className="w-3 h-3" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high": return "text-rose-500 bg-rose-500/10";
      case "medium": return "text-amber-500 bg-amber-500/10";
      default: return "text-emerald-500 bg-emerald-500/10";
    }
  };

  const isRestricted = (minRole?: string) => {
    if (!minRole) return false;
    const roles = ["editor", "tech_lead", "admin"];
    return roles.indexOf(userRole) < roles.indexOf(minRole);
  };

  const getRobustnessScore = () => {
    const total = Object.keys(FEATURE_LABELS).length;
    const active = Object.entries(flags).filter(([key, val]) => val && FEATURE_LABELS[key as keyof FeatureFlags]).length;
    return Math.round((active / total) * 100);
  };

  const getSavings = () => {
    const highActive = Object.entries(FEATURE_LABELS).filter(([key, info]) => info.performanceImpact === "high" && flags[key as keyof FeatureFlags]).length;
    const highTotal = Object.values(FEATURE_LABELS).filter(i => i.performanceImpact === "high").length;
    const savedPct = Math.round(((highTotal - highActive) / highTotal) * 100);
    return savedPct;
  };

  const handleSavePreset = () => {
    if (newPresetLabel.trim()) {
      saveCustomPreset(newPresetLabel.trim());
      setNewPresetLabel("");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-fuchsia-500/20 rounded-2xl shadow-inner border border-fuchsia-500/20">
              <Settings className="w-6 h-6 text-fuchsia-400 animate-[spin_4s_linear_infinite]" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">Engine Modularity</h2>
              <p className="text-[10px] text-fuchsia-400/80 font-black uppercase tracking-[0.3em]">Painel de Controle de Robustez</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-full transition-all hover:rotate-90 duration-300"
          >
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar bg-[url('/grid-subtle.png')] bg-repeat">
          
          {/* Modularity Dashboard */}
          <div className="grid grid-cols-3 gap-4 animate-in zoom-in-95 duration-500">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center text-center shadow-lg">
               <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">Robustez</div>
               <div className="text-2xl font-black text-white">{getRobustnessScore()}%</div>
               <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                 <div className="h-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 transition-all duration-1000" style={{ width: `${getRobustnessScore()}%` }} />
               </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center text-center shadow-lg">
               <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">Memória Livre</div>
               <div className="text-2xl font-black text-emerald-400">+{100 - getRobustnessScore()}%</div>
               <div className="text-[8px] font-bold text-emerald-500/60 uppercase mt-1">Otimizado</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center text-center shadow-lg">
               <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">Status Rede</div>
               <div className="text-2xl font-black text-sky-400">{getSavings() > 30 ? 'Lite' : 'Robust'}</div>
               <div className="text-[8px] font-bold text-sky-500/60 uppercase mt-1">Footprint</div>
            </div>
          </div>

          <div className="h-px bg-white/5 mx-2" />

          {/* Presets Quick Select */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[11px] font-black text-white/40 uppercase tracking-[0.4em]">Configurações Rápidas (Presets)</h3>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                <Users className="w-2.5 h-2.5 text-indigo-400" />
                <span className="text-[8px] font-black text-indigo-300 uppercase">Perfil: {userRole}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(PRESETS) as [FeaturePreset, any][]).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className="flex flex-col items-start p-4 rounded-2xl border border-white/5 bg-white/5 hover:bg-fuchsia-500/10 hover:border-fuchsia-500/30 transition-all text-left group"
                >
                  <span className="text-xs font-black text-slate-100 group-hover:text-fuchsia-400 transition-colors">{preset.label}</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase mt-1 tracking-tighter">Padrão do Sistema</span>
                </button>
              ))}

              {customPresets.map((preset) => (
                <div key={preset.id} className="relative group">
                  <button
                    onClick={() => applyPreset(preset.id)}
                    className="w-full flex flex-col items-start p-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-all text-left"
                  >
                    <span className="text-xs font-black text-indigo-100">{preset.label}</span>
                    <span className="text-[9px] font-bold text-indigo-500/60 uppercase mt-1 tracking-tighter">Preset do Usuário</span>
                  </button>
                  <button 
                    onClick={() => deleteCustomPreset(preset.id)}
                    className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 rounded-lg text-rose-400 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}

              {/* Save New Preset */}
              <div className="p-4 rounded-2xl border border-dashed border-white/10 bg-transparent flex items-center gap-2">
                <input 
                  type="text" 
                  value={newPresetLabel}
                  onChange={(e) => setNewPresetLabel(e.target.value)}
                  placeholder="Nome do Preset..."
                  className="flex-1 bg-transparent text-[10px] font-bold text-white outline-none placeholder:text-slate-700"
                />
                <button 
                  onClick={handleSavePreset}
                  disabled={!newPresetLabel.trim()}
                  className="p-1.5 bg-fuchsia-600 rounded-lg text-white disabled:opacity-30 transition-all"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="h-px bg-white/5 mx-2" />

          {categories.map(category => (
            <div key={category} className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <div className="p-1 bg-slate-800 rounded text-slate-400">
                  {getCategoryIcon(category)}
                </div>
                <h3 className="text-[11px] font-black text-white/40 uppercase tracking-[0.4em]">{category}</h3>
                <div className="flex-1 h-px bg-white/5" />
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {Object.entries(FEATURE_LABELS)
                  .filter(([_, info]) => info.category === category)
                  .map(([key, info]) => {
                    const isEnabled = flags[key as keyof FeatureFlags];
                    const restricted = isRestricted(info.minRole);
                    const health = featureHealth[key];
                    
                    return (
                      <div 
                        key={key} 
                        className={`group relative flex items-center justify-between p-5 rounded-2xl border transition-all duration-300 ${isEnabled ? 'bg-white/5 border-white/10 shadow-lg' : 'bg-slate-950/40 border-white/5 opacity-50 grayscale'} ${restricted ? 'opacity-30' : ''}`}
                      >
                        {isEnabled && <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/5 to-transparent rounded-2xl pointer-events-none" />}
                        
                        <div className="flex gap-5 items-start relative z-10">
                          <div className={`mt-1.5 p-2.5 rounded-xl border transition-colors ${isEnabled ? 'bg-fuchsia-500/10 border-fuchsia-500/20' : 'bg-slate-800 border-transparent'}`}>
                            <Power className={`w-4 h-4 ${isEnabled ? 'text-fuchsia-400' : 'text-slate-600'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                               <div className="text-base font-black text-slate-100 tracking-tight">{info.label}</div>
                               <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${getImpactColor(info.performanceImpact)}`}>
                                 <Gauge className="w-2.5 h-2.5" />
                                 {info.performanceImpact}
                               </div>
                               {isEnabled && health && (
                                 <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 border border-white/5 text-[8px] font-black uppercase tracking-tighter ${health.status === "online" ? "text-emerald-400" : health.status === "degraded" ? "text-amber-400" : "text-rose-500"}`}>
                                   {health.status === "online" ? <Wifi size={10} /> : <WifiOff size={10} />}
                                   {health.latencyMs}ms
                                 </div>
                               )}
                               {restricted && (
                                 <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 text-[8px] font-black uppercase tracking-tighter border border-white/5">
                                   <Lock className="w-2.5 h-2.5" />
                                   {info.minRole}
                                 </div>
                               )}
                            </div>
                            <div className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">{info.description}</div>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => !restricted && toggleFlag(key as keyof FeatureFlags)}
                          disabled={restricted}
                          className={`relative z-10 inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 ease-in-out focus:outline-none ${isEnabled ? 'bg-fuchsia-600 shadow-[0_0_15px_rgba(217,70,239,0.4)]' : 'bg-slate-800'} ${restricted ? 'cursor-not-allowed opacity-20' : ''}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-xl ring-0 transition duration-300 ease-in-out ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                          />
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-950/80 border-t border-white/5 backdrop-blur-md">
          <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">
            <Info className="w-3 h-3 text-fuchsia-500" />
            Mudanças aplicadas em tempo real na interface
          </div>
        </div>
      </div>
    </div>
  );
};
