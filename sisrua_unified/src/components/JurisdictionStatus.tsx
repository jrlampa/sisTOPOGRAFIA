import React from "react";
import { ShieldCheck, AlertCircle, Maximize } from "lucide-react";
import { BtTopology } from "../types";

interface JurisdictionStatusProps {
  topology: BtTopology;
  selectionMode: string;
  hasPolygon: boolean;
  hasCollision?: boolean;
}

export const JurisdictionStatus: React.FC<JurisdictionStatusProps> = ({ 
  topology, 
  selectionMode, 
  hasPolygon,
  hasCollision = false
}) => {
  const poleCount = topology.poles.length;
  const transformerCount = topology.transformers.length;
  
  return (
    <div className={`flex items-center gap-3 px-4 py-2 glass-premium rounded-2xl border backdrop-blur-xl shadow-xl animate-in slide-in-from-right-4 duration-500 pointer-events-auto transition-colors ${hasCollision ? 'border-rose-500/50 bg-rose-900/20' : 'border-white/10 bg-slate-900/60'}`}>
      <div className={`p-1.5 rounded-lg ${hasCollision ? 'bg-rose-500/20 text-rose-400' : hasPolygon ? 'bg-indigo-500/20 text-indigo-400' : 'bg-amber-500/20 text-amber-400'}`}>
         {hasCollision ? <AlertCircle className="w-4 h-4 animate-pulse" /> : hasPolygon ? <ShieldCheck className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      </div>
      
      <div className="flex flex-col">
        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none flex items-center gap-2">
           Jurisdição Ativa
           {hasCollision && <span className="text-rose-500 italic font-black underline decoration-rose-500/50 underline-offset-2 tracking-tighter">COLISÃO</span>}
        </div>
        <div className="flex items-center gap-3 mt-1">
           <div className="flex items-center gap-1">
              <span className="text-xs font-black text-white italic">{poleCount}</span>
              <span className="text-[8px] font-bold text-slate-500 uppercase">Postes</span>
           </div>
           <div className="h-2 w-px bg-white/10" />
           <div className="flex items-center gap-1">
              <span className="text-xs font-black text-white italic">{transformerCount}</span>
              <span className="text-[8px] font-bold text-slate-500 uppercase">Trafos</span>
           </div>
           {selectionMode === "polygon" && (
             <>
               <div className="h-2 w-px bg-white/10" />
               <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border border-indigo-500/20 ${hasCollision ? 'bg-rose-500/10' : 'bg-indigo-500/10'}`}>
                  <Maximize className="w-2.5 h-2.5 text-indigo-400" />
                  <span className="text-[8px] font-black text-indigo-300 uppercase tracking-tighter">Polígono ON</span>
               </div>
             </>
           )}
        </div>
      </div>
    </div>
  );
};
