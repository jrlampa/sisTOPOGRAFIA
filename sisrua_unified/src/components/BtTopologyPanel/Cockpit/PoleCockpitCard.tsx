import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    ChevronDown, 
    ChevronUp, 
    MapPin,
    AlertTriangle,
    Zap,
    Box,
    Users,
    Activity,
    Truck
} from "lucide-react";
import type { BtPoleNode, AppLocale } from "../../../types";
import { getFlagColor } from "../../MapSelectorStyles";

interface PoleCockpitCardProps {
    pole: BtPoleNode;
    mtStructures?: string[];
    locale: AppLocale;
    onRename: (id: string, title: string) => void;
    onSetFlag: (id: string, flag: any) => void;
    onUpdateSpec: (id: string, spec: any) => void;
    onUpdateAcessibilidade: (id: string, hasAccess: boolean, dist?: number) => void;
    mechanicalResult?: {
        resultantForceDaN: number;
        overloaded: boolean;
        resultantAngleDegrees: number;
    };
    accessibilityCost?: number;
}

const PoleCockpitCard: React.FC<PoleCockpitCardProps> = ({
    pole,
    mtStructures = [],
    onRename,
    onSetFlag,
    onUpdateSpec,
    onUpdateAcessibilidade,
    mechanicalResult,
    accessibilityCost
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const currentFlag = pole.nodeChangeFlag ?? "existing";

    const btStructures = Object.values(pole.btStructures || {}).filter(Boolean);
    const ramais = pole.ramais || [];

    return (
        <motion.div 
            layout
            className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl overflow-hidden mb-4"
        >
            {/* Header: Identificação do Ponto */}
            <div className="p-4 bg-slate-50/50 border-bottom border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div 
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0"
                        style={{ backgroundColor: getFlagColor(currentFlag, "#3b82f6") }}
                    >
                        <MapPin size={24} />
                    </div>
                    <div>
                        <input
                            type="text"
                            value={pole.title}
                            onChange={(e) => onRename(pole.id, e.target.value)}
                            className="bg-transparent border-none p-0 text-lg font-black text-slate-900 focus:ring-0 w-full"
                        />
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-slate-400">ID: {pole.id}</span>
                            {mechanicalResult?.overloaded && (
                                <span className="bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase flex items-center gap-0.5">
                                    <AlertTriangle size={8} /> Sobrecarga
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 text-slate-400">
                    {isExpanded ? <ChevronUp /> : <ChevronDown />}
                </button>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div 
                        initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                        className="p-5"
                    >
                        {/* Narrativa Vertical (Croqui) */}
                        <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                            
                            {/* 1. O POSTE */}
                            <div className="relative">
                                <div className="absolute -left-[23px] top-1 w-4 h-4 rounded-full bg-slate-900 border-4 border-white shadow-sm z-10" />
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xs font-black text-slate-400">1.</span>
                                    <div className="flex gap-1 items-center bg-slate-900 text-white px-2.5 py-1 rounded-lg shadow-sm">
                                        <input 
                                            type="number" 
                                            value={pole.poleSpec?.heightM ?? ""} 
                                            onChange={(e) => onUpdateSpec(pole.id, { ...pole.poleSpec, heightM: Number(e.target.value) })}
                                            className="bg-transparent border-none p-0 w-6 text-center text-xs font-black focus:ring-0"
                                            placeholder="H"
                                        />
                                        <span className="opacity-30">/</span>
                                        <input 
                                            type="number" 
                                            value={pole.poleSpec?.nominalEffortDan ?? ""} 
                                            onChange={(e) => onUpdateSpec(pole.id, { ...pole.poleSpec, nominalEffortDan: Number(e.target.value) })}
                                            className="bg-transparent border-none p-0 w-8 text-center text-xs font-black focus:ring-0"
                                            placeholder="daN"
                                        />
                                    </div>
                                    <select
                                        value={pole.poleSpec?.material ?? "CC"}
                                        onChange={(e) => onUpdateSpec(pole.id, { ...pole.poleSpec, material: e.target.value })}
                                        className="bg-slate-100 border border-slate-200 rounded-md px-1.5 py-0.5 text-[10px] font-black text-slate-700 focus:ring-0 appearance-none"
                                    >
                                        <option value="CC">CC</option>
                                        <option value="DT">DT</option>
                                        <option value="MAD">MAD</option>
                                        <option value="FIB">FIB</option>
                                        <option value="FER">FER</option>
                                    </select>
                                    <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest hidden sm:inline">
                                        {pole.poleSpec?.material === "CC" ? "(Concreto Circular)" : 
                                         pole.poleSpec?.material === "DT" ? "(Duplo T)" :
                                         pole.poleSpec?.material === "MAD" ? "(Madeira)" :
                                         pole.poleSpec?.material === "FIB" ? "(Fibra)" :
                                         pole.poleSpec?.material === "FER" ? "(Ferro/Aço)" : ""}
                                    </span>
                                </div>
                            </div>

                            {/* 2 & 3. MÉDIA TENSÃO (MT) */}
                            {mtStructures.length > 0 ? mtStructures.map((struct, idx) => (
                                <div key={idx} className="relative">
                                    <div className="absolute -left-[23px] top-1 w-4 h-4 rounded-full bg-amber-500 border-4 border-white shadow-sm z-10" />
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-xs font-black text-slate-400">{idx + 2}.</span>
                                        <span className="text-xs font-black text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md uppercase">
                                            {struct}
                                        </span>
                                    </div>
                                </div>
                            )) : (
                                <div className="relative opacity-30">
                                    <div className="absolute -left-[23px] top-1 w-4 h-4 rounded-full bg-slate-200 border-4 border-white z-10" />
                                    <span className="text-[10px] font-bold italic ml-5">Sem estruturas MT</span>
                                </div>
                            )}

                            {/* 4. BAIXA TENSÃO (BT) */}
                            <div className="relative">
                                <div className="absolute -left-[23px] top-1 w-4 h-4 rounded-full bg-blue-500 border-4 border-white shadow-sm z-10" />
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xs font-black text-slate-400">{mtStructures.length + 2}.</span>
                                    <div className="flex flex-wrap gap-1">
                                        {btStructures.length > 0 ? btStructures.map((s, i) => (
                                            <span key={i} className="text-xs font-black text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md uppercase">
                                                {s}
                                            </span>
                                        )) : <span className="text-[10px] font-bold italic opacity-40 uppercase">Sem BT (Passante)</span>}
                                    </div>
                                </div>
                            </div>

                            {/* 5. RAMAIS (Clientes) */}
                            <div className="relative">
                                <div className="absolute -left-[23px] top-1 w-4 h-4 rounded-full bg-emerald-500 border-4 border-white shadow-sm z-10" />
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-black text-slate-400">{mtStructures.length + 3}. RAMAIS</span>
                                    <div className="space-y-1 ml-4">
                                        {ramais.length > 0 ? ramais.map((r, i) => (
                                            <div key={i} className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                                                <span className="text-slate-300">5.{i+1}</span>
                                                <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100">
                                                    {r.quantity}x {r.ramalType || "MONO"}
                                                </span>
                                            </div>
                                        )) : <span className="text-[10px] italic opacity-40">Nenhum cliente</span>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Rodapé: Resultados de Engenharia */}
                        <div className="mt-8 grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                    <Activity size={10} /> Stress Mecânico
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-sm font-black ${mechanicalResult?.overloaded ? "text-rose-600" : "text-slate-800"}`}>
                                        {mechanicalResult?.resultantForceDaN ?? 0}
                                    </span>
                                    <span className="text-[9px] font-bold opacity-40">daN</span>
                                </div>
                            </div>
                            <div className="bg-slate-900 rounded-2xl p-3 text-white">
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                    <Truck size={10} className="text-blue-400" /> Acessibilidade
                                </div>
                                <div className="text-[11px] font-bold truncate">
                                    {pole.hasVehicleAccess === false ? `Arraste: ${pole.manualDragDistanceMeters}m` : "Acesso Ok"}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default PoleCockpitCard;
