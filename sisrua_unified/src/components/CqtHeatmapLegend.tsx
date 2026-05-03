import React from "react";

export function CqtHeatmapLegend() {
  return (
    <div className="absolute bottom-24 right-4 z-[1000] flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-900/80 p-3 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-right-4 transition-all hover:bg-slate-900/90 hover:scale-[1.02]">
      <div className="flex items-center gap-2 mb-1 border-b border-white/5 pb-2">
        <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
        <span className="text-[10px] font-black uppercase tracking-widest text-white/90">Performance CQT</span>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-6">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Ideal (0-3%)</span>
          <div className="h-1.5 w-14 rounded-full bg-emerald-500/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]" />
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Aceitável (3-5%)</span>
          <div className="h-1.5 w-14 rounded-full bg-amber-500/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]" />
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Próx. Limite (5-7%)</span>
          <div className="h-1.5 w-14 rounded-full bg-orange-500/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]" />
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-[9px] font-bold text-rose-400/80 uppercase tracking-tighter">Violação (>7%)</span>
          <div className="h-1.5 w-14 rounded-full bg-red-600/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]" />
        </div>
      </div>
    </div>
  );
}
