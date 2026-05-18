import React, { useState, useEffect } from "react";
import { Camera, X, CheckCircle2, History, ChevronRight, Loader2 } from "lucide-react";
import { ProjectService, ProjectSnapshot } from "../services/projectService";
import { GlobalState } from "../types";

interface SnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  projetoId: string;
  currentState: GlobalState;
  onRestore: (state: GlobalState) => void;
}

export const SnapshotModal: React.FC<SnapshotModalProps> = ({ 
  isOpen, 
  onClose, 
  projetoId, 
  currentState,
  onRestore 
}) => {
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([]);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (isOpen && projetoId) {
      loadSnapshots();
    }
  }, [isOpen, projetoId]);

  const loadSnapshots = async () => {
    setFetching(true);
    const data = await ProjectService.listSnapshots(projetoId);
    setSnapshots(data);
    setFetching(false);
  };

  const handleCreate = async () => {
    if (!label.trim()) return;
    setLoading(true);
    try {
      await ProjectService.createSnapshot(projetoId, label.trim(), currentState);
      setLabel("");
      await loadSnapshots();
    } catch (err) {
      alert("Erro ao criar snapshot.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300 p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-fuchsia-600/20 rounded-2xl">
              <Camera className="w-6 h-6 text-fuchsia-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">Snapshots do Projeto</h2>
              <p className="text-[10px] text-fuchsia-400/80 font-black uppercase tracking-[0.3em]">Congelar versões e marcos técnicos</p>
            </div>
          </div>
          <button onClick={onClose} title="Fechar modal" aria-label="Fechar modal" className="p-2 hover:bg-white/10 rounded-full transition-all hover:rotate-90">
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* New Snapshot Form */}
          <div className="w-full md:w-72 p-8 border-b md:border-b-0 md:border-r border-white/5 space-y-6">
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Novo Marco</label>
                <textarea
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ex: Antes da Auditoria ESG..."
                  className="w-full h-32 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white text-xs font-bold outline-none focus:border-fuchsia-500 transition-all placeholder:text-slate-800 resize-none"
                />
             </div>
             <button
               onClick={handleCreate}
               disabled={loading || !label.trim()}
               className="w-full py-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-fuchsia-600/20 disabled:opacity-30"
             >
               {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Capturar Snapshot"}
             </button>
          </div>

          {/* Snapshot History */}
          <div className="flex-1 p-8 space-y-6 overflow-y-auto custom-scrollbar bg-slate-950/20">
             <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-black text-white/40 uppercase tracking-[0.4em]">Linha do Tempo</h3>
                <History className="w-4 h-4 text-slate-700" />
             </div>

             {fetching ? (
               <div className="py-20 text-center opacity-20">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
               </div>
             ) : snapshots.length === 0 ? (
               <div className="py-20 text-center border border-dashed border-white/5 rounded-3xl opacity-20">
                  <p className="text-[10px] font-black uppercase italic">Nenhum snapshot capturado.</p>
               </div>
             ) : (
               <div className="space-y-3">
                  {snapshots.map((s) => (
                    <div key={s.id} className="group p-4 bg-white/5 border border-white/5 hover:border-fuchsia-500/30 rounded-2xl flex items-center justify-between transition-all">
                       <div className="space-y-1">
                          <div className="text-xs font-black text-white group-hover:text-fuchsia-400 transition-colors">{s.label}</div>
                          <div className="text-[9px] font-bold text-slate-500 uppercase">{new Date(s.createdAt).toLocaleString()}</div>
                       </div>
                       <button 
                         onClick={() => { if(confirm("Deseja restaurar esta versão? O estado atual será substituído.")) onRestore(s.state); }}
                         className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white rounded-lg border border-white/5 transition-all flex items-center gap-2"
                       >
                          Restaurar
                          <ChevronRight size={12} />
                       </button>
                    </div>
                  ))}
               </div>
             )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/50 border-t border-white/5 text-center">
           <div className="flex items-center justify-center gap-2 text-[9px] text-slate-600 font-black uppercase tracking-widest">
              <CheckCircle2 size={12} className="text-emerald-500" />
              Snapshots são persistidos na Nuvem IM3 de forma imutável.
           </div>
        </div>
      </div>
    </div>
  );
};
