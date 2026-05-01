import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Zap, 
  ShieldCheck, 
  AlertTriangle, 
  Info, 
  Activity, 
  Settings2,
  CheckCircle2,
  FileWarning,
  ChevronRight,
} from "lucide-react";
import type { AppLocale } from "../types";
import { getElectricalAuditDrawerText } from "../i18n/electricalAuditDrawerText";

interface ElectricalAuditDrawerProps {
  locale: AppLocale;
  isOpen: boolean;
  onClose: () => void;
  selectedElement: {
    type: "pole" | "edge" | "transformer";
    id: string;
    data: any;
  } | null;
  onAuditAction: (action: "approve" | "reject", notes: string) => void;
}

export function ElectricalAuditDrawer({
  locale,
  isOpen,
  onClose,
  selectedElement,
  onAuditAction
}: ElectricalAuditDrawerProps) {
  const t = getElectricalAuditDrawerText(locale);
  const [isDetailedMode, setIsDetailedMode] = React.useState(false);
  const [auditNotes, setAuditNotes] = React.useState("");
  const [simulationParams, setSimulationParams] = React.useState({
    conductorBitola: "3x70+70",
    loadMultiplier: 1.0
  });

  if (!selectedElement) return null;

  // Mocked calculation data (Smart Backend Simulation)
  const auditData = {
    tensionDrop: 4.2, // %
    maxTensionDrop: 5.0, // %
    loadingLevel: 78, // %
    normativeStatus: "compliant", // or "violation"
    normReference: "NBR 5410 / NBR 15688",
    bimMetadata: [
      { label: "Tipo", value: selectedElement.type === "pole" ? "Poste DT 11/400" : "Cabo Multiplexado" },
      { label: "Material", value: "Concreto Armado" },
      { label: "Esforço Nom.", value: "400 daN" },
      { label: "Instalação", value: "Existente" }
    ]
  };

  const getStatusColor = (value: number, limit: number) => {
    if (value > limit) return "text-rose-500 bg-rose-500";
    if (value > limit * 0.8) return "text-amber-500 bg-amber-500";
    return "text-emerald-500 bg-emerald-500";
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Glassmorphism Overlay for Detailed Mode */}
          {isDetailedMode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[490] bg-slate-900/20 backdrop-blur-[2px]"
              onClick={() => setIsDetailedMode(false)}
            />
          )}

          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={`fixed top-0 right-0 z-[500] h-full bg-slate-900 text-white shadow-2xl flex flex-col transition-all duration-300 ${
              isDetailedMode ? "w-full md:w-[60%] lg:w-[45%]" : "w-full md:w-[380px]"
            }`}
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600/20 rounded-xl text-blue-400">
                  <Zap size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-[0.15em] text-blue-400">
                    {t.title}
                  </h2>
                  <p className="text-xs text-slate-400 font-bold">
                    {selectedElement.type.toUpperCase()}: {selectedElement.data?.title || selectedElement.id}
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
              {/* Quick Health Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 text-center">
                    Queda Tensão
                  </span>
                  <div className="relative w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(auditData.tensionDrop / auditData.maxTensionDrop) * 100}%` }}
                      className={`h-full ${getStatusColor(auditData.tensionDrop, auditData.maxTensionDrop)}`}
                    />
                  </div>
                  <span className={`text-sm font-black ${auditData.tensionDrop > auditData.maxTensionDrop ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {auditData.tensionDrop}%
                  </span>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 text-center">
                    Carregamento
                  </span>
                  {/* Simple Gauge Mimic */}
                  <div className="flex items-center justify-center">
                    <Activity size={16} className={auditData.loadingLevel > 90 ? 'text-rose-400' : 'text-emerald-400'} />
                  </div>
                  <span className={`text-sm font-black ${auditData.loadingLevel > 90 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {auditData.loadingLevel}%
                  </span>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 text-center">
                    Status
                  </span>
                  {auditData.normativeStatus === "compliant" ? (
                    <ShieldCheck size={16} className="text-emerald-400" />
                  ) : (
                    <AlertTriangle size={16} className="text-rose-400" />
                  )}
                  <span className={`text-[9px] font-black uppercase text-center ${auditData.normativeStatus === "compliant" ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {auditData.normativeStatus === "compliant" ? "Conforme" : "Violação"}
                  </span>
                </div>
              </div>

              {/* BIM Metadata Card */}
              <div className="glass-card bg-white/5 border-white/10 p-4 rounded-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <Info size={14} className="text-blue-400" />
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Metadados BIM
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                  {auditData.bimMetadata.map((meta, i) => (
                    <div key={i}>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">{meta.label}</p>
                      <p className="text-xs font-black text-slate-200">{meta.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action: Detalhar Cálculos */}
              {!isDetailedMode && (
                <button
                  onClick={() => setIsDetailedMode(true)}
                  className="w-full py-4 rounded-2xl border-2 border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest text-blue-400"
                >
                  <Settings2 size={16} />
                  {t.btnDetailCalculations}
                </button>
              )}

              {/* Simulation Mode (Only in detailed mode) */}
              <AnimatePresence>
                {isDetailedMode && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="h-px bg-white/10 w-full" />
                    
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-amber-400 mb-4 flex items-center gap-2">
                        <Activity size={14} />
                        Modo Simulação (What-if)
                      </h3>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Bitola do Condutor
                          </label>
                          <select 
                            value={simulationParams.conductorBitola}
                            onChange={(e) => setSimulationParams({...simulationParams, conductorBitola: e.target.value})}
                            className="w-full bg-slate-800 border-2 border-white/5 rounded-xl p-3 text-xs font-bold outline-none focus:border-blue-500/50"
                          >
                            <option value="3x35+35">3x35+35 mm²</option>
                            <option value="3x50+50">3x50+50 mm²</option>
                            <option value="3x70+70">3x70+70 mm²</option>
                            <option value="3x95+95">3x95+95 mm²</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex justify-between">
                            <span>Multiplicador de Carga</span>
                            <span className="text-blue-400 font-black">{simulationParams.loadMultiplier.toFixed(1)}x</span>
                          </label>
                          <input 
                            type="range" 
                            min="0.5" 
                            max="2.0" 
                            step="0.1" 
                            value={simulationParams.loadMultiplier}
                            onChange={(e) => setSimulationParams({...simulationParams, loadMultiplier: parseFloat(e.target.value)})}
                            className="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-2xl">
                      <p className="text-[10px] font-black text-blue-400 uppercase mb-2">Previsão em Tempo Real</p>
                      <div className="flex items-end gap-2">
                        <span className="text-2xl font-black text-white">{(auditData.tensionDrop * simulationParams.loadMultiplier / (simulationParams.conductorBitola === "3x35+35" ? 0.7 : 1)).toFixed(2)}%</span>
                        <span className="text-xs font-bold text-slate-400 mb-1">Nova Queda Tensão</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Audit Registration */}
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Notas da Auditoria / Justificativa
                  </label>
                  <textarea 
                    value={auditNotes}
                    onChange={(e) => setAuditNotes(e.target.value)}
                    placeholder="Insira as observações técnicas aqui..."
                    className="w-full bg-slate-800/50 border-2 border-white/5 rounded-2xl p-4 text-xs font-bold min-h-[100px] outline-none focus:border-blue-500/50 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onAuditAction("approve", auditNotes)}
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20"
                  >
                    <CheckCircle2 size={16} />
                    {t.btnApprove}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onAuditAction("reject", auditNotes)}
                    className="flex items-center justify-center gap-2 border-2 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 py-4 rounded-2xl text-xs font-black uppercase tracking-widest"
                  >
                    <FileWarning size={16} />
                    {t.btnReject}
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Footer / Audit Trail */}
            <div className="p-4 bg-slate-950/80 border-t border-white/10">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  Audit Trail: {auditData.normReference}
                </div>
                <div className="flex items-center gap-1">
                  Revisor <ChevronRight size={10} /> Engenharia IM3
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
