import React from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { InfoCard } from "../AdminPagePrimitives";

interface BtDailySummary {
  day_local: string;
  project_type: string;
  export_count: number;
  parity_pass_count: number;
  parity_fail_count: number;
}

interface AuditStat {
  table_name: string;
  action: string;
  event_count: number;
}

interface ConstantsNamespaceSummary {
  namespace: string;
  total_entries: number;
  active_entries: number;
  last_updated_at: string;
}

interface SystemHealthMvsReport {
  btHistory: BtDailySummary[];
  auditStats: AuditStat[];
  catalogSummary: ConstantsNamespaceSummary[];
  timestamp: string;
}

export function renderSaude(d: unknown): React.ReactNode {
  const sd = d as { status: string; versao: string; banco: string; timestamp: string } | undefined;
  if (!sd) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <InfoCard label="Status" valor={sd.status} ok={sd.status === "operacional"} />
      <InfoCard label="Versão" valor={sd.versao} />
      <InfoCard label="Banco" valor={sd.banco} ok={sd.banco === "disponível"} />
      <InfoCard label="Timestamp" valor={new Date(sd.timestamp).toLocaleString("pt-BR")} />
    </div>
  );
}

export function renderDashboardMvs(d: unknown): React.ReactNode {
  const report = d as SystemHealthMvsReport | undefined;
  if (!report) return null;

  return (
    <div className="space-y-6">
      {/* Resumo de Exportação BT */}
      <div>
        <h4 className="text-xs font-black uppercase text-slate-500 mb-3 flex items-center gap-2">
          <CheckCircle2 size={12} className="text-emerald-500" />
          Exportações BT (Últimos 7 dias)
        </h4>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={report.btHistory}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
              <XAxis dataKey="day_local" fontSize={10} tick={{ fill: "#64748b" }} />
              <YAxis fontSize={10} tick={{ fill: "#64748b" }} />
              <Tooltip 
                contentStyle={{ backgroundColor: "#0f172a", border: "none", borderRadius: "8px", fontSize: "12px", color: "#fff" }}
                itemStyle={{ color: "#cbd5e1" }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: "10px" }} />
              <Bar dataKey="export_count" name="Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="parity_pass_count" name="Paridade OK" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Auditoria Recente */}
      <div>
        <h4 className="text-xs font-black uppercase text-slate-500 mb-3 flex items-center gap-2">
          <AlertCircle size={12} className="text-amber-500" />
          Volume de Eventos de Auditoria
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {report.auditStats.slice(0, 6).map((stat, i) => (
            <div key={i} className="p-2 rounded-lg bg-slate-100/50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{stat.table_name}</p>
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">{stat.action}</span>
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">{stat.event_count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
