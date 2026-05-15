import React from "react";

interface ServiceProfileAdmin {
  tenantName: string | null;
  tenantSlug: string | null;
  serviceCode: string;
  serviceName: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  slaAvailabilityPct: number;
  sloLatencyP95Ms: number;
  supportChannel: string;
  supportHours: string;
  isActive: boolean;
}

export function renderServicos(d: unknown): React.ReactNode {
  const sd = d as { profiles: ServiceProfileAdmin[] } | undefined;
  if (!sd) return null;
  return (
    <div className="space-y-4">
      {sd.profiles.map((p, i) => (
        <div key={i} className="p-4 rounded-2xl border border-slate-200/60 dark:border-white/5 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md relative overflow-hidden group">
          <div className={`absolute top-0 left-0 w-1 h-full ${p.tier === "platinum" ? "bg-indigo-500" : p.tier === "gold" ? "bg-amber-400" : "bg-slate-400"}`} />
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-black text-sm text-slate-800 dark:text-slate-100">{p.serviceName}</h4>
              <p className="text-[10px] font-mono text-slate-500 mt-0.5">{p.serviceCode}</p>
            </div>
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${p.tier === "platinum" ? "bg-indigo-100 text-indigo-700" : p.tier === "gold" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
              {p.tier}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-slate-400">SLA Disponibilidade</p>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{p.slaAvailabilityPct}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-slate-400">SLO Latência (P95)</p>
              <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{p.sloLatencyP95Ms}ms</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex justify-between items-center text-[10px] text-slate-500">
            <span>Suporte: {p.supportHours} ({p.supportChannel})</span>
            <span className={p.isActive ? "text-emerald-500" : "text-rose-500"}>● {p.isActive ? "Ativo" : "Inativo"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
