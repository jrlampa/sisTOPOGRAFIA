import React from "react";
import { InfoCard } from "../AdminPagePrimitives";

export function renderRetencao(d: unknown): React.ReactNode {
  const rd = d as { policies: any[] } | undefined;
  if (!rd) return null;
  return (
    <div className="space-y-2">
      {rd.policies.map((p, i) => (
        <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-slate-100/40 dark:bg-slate-800/30">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{p.resource}</span>
          <span className="text-[10px] font-black bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">{p.retentionDays} dias</span>
        </div>
      ))}
    </div>
  );
}

export function renderCapacidade(d: unknown): React.ReactNode {
  const cd = d as { history: any[] } | undefined;
  if (!cd) return null;
  return (
    <div className="p-2 text-center italic text-xs text-slate-500">
      Dados de capacity planning em processamento...
    </div>
  );
}

export function renderVulns(d: unknown): React.ReactNode {
  const vd = d as { vulnerabilities: any[] } | undefined;
  if (!vd) return null;
  return (
    <div className="space-y-2">
      {vd.vulnerabilities.length === 0 ? (
        <p className="text-xs text-emerald-500 font-bold">● Nenhuma vulnerabilidade crítica aberta.</p>
      ) : (
        vd.vulnerabilities.map((v, i) => (
          <div key={i} className="p-2 rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-900/30 dark:bg-rose-950/10">
            <p className="text-xs font-black text-rose-700 dark:text-rose-400">{v.code}</p>
            <p className="text-[10px] text-rose-600/70 dark:text-rose-300/50 mt-0.5">Prazo: {v.slaDeadline}</p>
          </div>
        ))
      )}
    </div>
  );
}

export function renderFinOps(d: unknown): React.ReactNode {
  const fd = d as { budget: any; usage: any } | undefined;
  if (!fd) return null;
  return (
    <div className="grid grid-cols-2 gap-3">
      <InfoCard label="Consumo Mensal" valor={`R$ ${fd.usage.totalMonthly}`} />
      <InfoCard label="Orçamento" valor={`R$ ${fd.budget.limit}`} ok={fd.usage.totalMonthly < fd.budget.limit} />
    </div>
  );
}

export function renderHoldings(_d: unknown): React.ReactNode { return <p className="text-xs text-slate-500">Módulo Multi-empresa ativo.</p>; }
export function renderClassificacao(_d: unknown): React.ReactNode { return <p className="text-xs text-slate-500">Políticas de DLP ativas.</p>; }
export function renderKpis(_d: unknown): React.ReactNode { return <p className="text-xs text-slate-500">KPIs de produtividade ativos.</p>; }
