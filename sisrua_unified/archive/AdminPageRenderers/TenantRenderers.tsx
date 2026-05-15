import React from "react";
import { Shield, Database } from "lucide-react";

interface TenantAdmin { 
  id: string; 
  name: string; 
  slug: string; 
  isActive: boolean; 
  plan: string; 
}

interface QuotaAdmin { 
  tenantId: string; 
  resource: string; 
  limitValue: number; 
  usageValue: number; 
}

interface FlagAdmin { 
  tenantId: string; 
  flagCode: string; 
  isEnabled: boolean; 
}

export function renderTenants(d: unknown): React.ReactNode {
  const td = d as { tenants: TenantAdmin[] } | undefined;
  if (!td) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {td.tenants.map((t) => (
        <div key={t.id} className="p-3 rounded-xl border border-slate-200/50 dark:border-white/5 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{t.name}</p>
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${t.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {t.isActive ? "Ativo" : "Inativo"}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono mt-1">{t.slug}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Plano:</span>
            <span className="text-xs font-black text-indigo-500">{t.plan}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function renderQuotas(d: unknown): React.ReactNode {
  const qd = d as { quotas: QuotaAdmin[] } | undefined;
  if (!qd) return null;
  return (
    <div className="space-y-3">
      {qd.quotas.map((q, i) => (
        <div key={i} className="p-3 rounded-xl border border-slate-200/50 dark:border-white/5 bg-white/40 dark:bg-zinc-900/40">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5">
              <Database size={10} /> {q.resource}
            </span>
            <span className="text-[10px] font-bold text-slate-400 italic">{Math.round((q.usageValue / q.limitValue) * 100)}% usado</span>
          </div>
          <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${q.usageValue >= q.limitValue ? "bg-rose-500" : "bg-blue-500"}`} 
              style={{ width: `${Math.min(100, (q.usageValue / q.limitValue) * 100)}%` }} 
            />
          </div>
          <div className="flex justify-between mt-1 text-[10px] font-mono text-slate-500">
            <span>{q.usageValue}</span>
            <span>{q.limitValue}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function renderFlags(d: unknown): React.ReactNode {
  const fd = d as { flags: FlagAdmin[] } | undefined;
  if (!fd) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {fd.flags.map((f, i) => (
        <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${f.isEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300" : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900/40"}`}>
          <Shield size={12} className={f.isEnabled ? "text-emerald-500" : "text-slate-400"} />
          <span className="text-xs font-bold">{f.flagCode}</span>
        </div>
      ))}
    </div>
  );
}
