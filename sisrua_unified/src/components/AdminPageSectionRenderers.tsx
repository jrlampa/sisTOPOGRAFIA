/**
 * AdminPageSectionRenderers.tsx — Funções de renderização por seção do Painel Admin.
 *
 * Cada função recebe `dados` (o estado atual da seção) e `tenantIdAtivo` quando necessário,
 * e retorna o conteúdo a exibir no accordion correspondente.
 */
import React from "react";
import { CheckCircle2, AlertCircle, BarChart3, Shield, Database } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from "recharts";
import { InfoCard, PapelBadge } from "./AdminPagePrimitives";

// ─── Tipos de resposta da API ─────────────────────────────────────────────────

interface SaudeAdmin { painel: string; versao: string; status: string; banco: string; timestamp: string }
interface UsuarioAdmin { userId: string; papel: string }
interface EstatisticasPapel { distribuicao: Record<string, number> }
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

// ─── Saúde ────────────────────────────────────────────────────────────────────

export function renderSaude(d: unknown): React.ReactNode {
  const sd = d as SaudeAdmin | undefined;
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

// ─── Usuários ─────────────────────────────────────────────────────────────────

export function renderUsuarios(d: unknown): React.ReactNode {
  const ud = d as { total: number; usuarios: UsuarioAdmin[] } | undefined;
  if (!ud) return null;
  if (ud.total === 0) return <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum usuário cadastrado.</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{ud.total} usuário(s)</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-xs text-slate-500 dark:text-slate-400 uppercase">
              <th className="pb-2 pr-4">Usuário</th>
              <th className="pb-2">Papel</th>
            </tr>
          </thead>
          <tbody>
            {ud.usuarios.map((u) => (
              <tr key={u.userId} className="border-t border-slate-200/50 dark:border-slate-700/50">
                <td className="py-1.5 pr-4 font-mono text-xs text-slate-700 dark:text-slate-300">{u.userId}</td>
                <td className="py-1.5"><PapelBadge papel={u.papel} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Papéis ───────────────────────────────────────────────────────────────────

export function renderPapeis(d: unknown): React.ReactNode {
  const pd = d as EstatisticasPapel | undefined;
  if (!pd) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Object.entries(pd.distribuicao).map(([papel, contagem]) => (
        <div key={papel} className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 p-3 text-center">
          <PapelBadge papel={papel} />
          <p className="mt-1 text-xl font-black text-slate-800 dark:text-slate-200">{String(contagem)}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export function renderTenants(d: unknown): React.ReactNode {
  const td = d as { total: number; tenants: Array<{ slug: string; name: string; plan: string }>; aviso?: string } | undefined;
  if (!td) return null;
  if (td.aviso && td.total === 0) return <p className="text-sm text-amber-600 dark:text-amber-400">{td.aviso}</p>;
  return (
    <div className="space-y-1.5">
      {td.tenants.map((t) => (
        <div key={t.slug} className="flex items-center justify-between rounded-lg border border-slate-200/70 dark:border-slate-700/50 px-3 py-2">
          <div>
            <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{t.name}</p>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{t.slug}</p>
          </div>
          <span className="text-xs font-medium text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 rounded-full">{t.plan}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Quotas ───────────────────────────────────────────────────────────────────

export function renderQuotas(d: unknown): React.ReactNode {
  const qd = d as { tipos?: string[]; aviso?: string; tenantId?: string; quotas?: Record<string, unknown> } | undefined;
  if (!qd) return null;
  if (qd.aviso) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">{qd.aviso}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500">Tipos disponíveis: {qd.tipos?.join(", ")}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 dark:text-slate-400">Tenant: <strong>{qd.tenantId}</strong></p>
      <pre className="text-xs bg-slate-50 dark:bg-slate-900 rounded-lg p-3 overflow-x-auto">{JSON.stringify(qd.quotas, null, 2)}</pre>
    </div>
  );
}

// ─── Feature Flags ────────────────────────────────────────────────────────────

export function renderFlags(d: unknown, tenantIdAtivo: string): React.ReactNode {
  const fd = d as { tenantId?: string; total?: number; flags?: Record<string, boolean> } | undefined;
  if (!fd) {
    return tenantIdAtivo
      ? null
      : <p className="text-sm text-amber-600 dark:text-amber-400">Defina um Tenant ID para ver os feature flags.</p>;
  }
  if (!fd.flags || Object.keys(fd.flags).length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum override configurado para este tenant.</p>;
  }
  return (
    <div className="space-y-1.5">
      {Object.entries(fd.flags).map(([flag, ativo]) => (
        <div key={flag} className="flex items-center justify-between rounded-lg border border-slate-200/70 dark:border-slate-700/50 px-3 py-2">
          <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{flag}</span>
          <span className={`flex items-center gap-1 text-xs font-medium ${ativo ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {ativo ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            {ativo ? "ativo" : "inativo"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export function renderKpis(d: unknown, tenantIdAtivo: string): React.ReactNode {
  const kd = d as { global?: { total: number; taxaSucesso: number; retrabalhos?: number }; gargalosRegionais?: Array<{ regiao: string; taxaFalha: number; ehGargalo: boolean }> } | undefined;
  if (!kd) {
    return tenantIdAtivo
      ? null
      : <p className="text-sm text-amber-600 dark:text-amber-400">Defina um Tenant ID para ver os KPIs.</p>;
  }
  if (!kd.global) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <InfoCard label="Total de Jobs" valor={String(kd.global.total)} />
        <InfoCard label="Taxa de Sucesso" valor={`${(kd.global.taxaSucesso * 100).toFixed(1)}%`} ok={kd.global.taxaSucesso >= 0.9} />
        <InfoCard label="Retrabalhos" valor={String(kd.global.retrabalhos ?? 0)} />
      </div>
      {kd.gargalosRegionais && kd.gargalosRegionais.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Regiões com Gargalos</p>
          <div className="space-y-1.5">
            {kd.gargalosRegionais.filter((g) => g.ehGargalo).map((g) => (
              <div key={g.regiao} className="flex items-center justify-between rounded-lg border border-rose-200/70 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/20 px-3 py-2">
                <span className="text-sm font-medium text-rose-800 dark:text-rose-300 capitalize">{g.regiao}</span>
                <span className="text-xs text-rose-600 dark:text-rose-400">{(g.taxaFalha * 100).toFixed(1)}% falha</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Perfis de Serviço ───────────────────────────────────────────────────────

export function renderServicos(d: unknown, tenantIdAtivo: string): React.ReactNode {
  const sd = d as { total?: number; profiles?: ServiceProfileAdmin[] } | undefined;
  if (!sd) {
    return tenantIdAtivo
      ? null
      : <p className="text-sm text-amber-600 dark:text-amber-400">Defina um Tenant ID para filtrar e gerir perfis de serviço.</p>;
  }

  const profiles = sd.profiles ?? [];
  if (profiles.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum perfil de serviço cadastrado para o filtro atual.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {sd.total ?? profiles.length} perfil(is) encontrado(s)
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-xs text-slate-500 dark:text-slate-400 uppercase">
              <th className="pb-2 pr-3">Serviço</th>
              <th className="pb-2 pr-3">Tier</th>
              <th className="pb-2 pr-3">SLA</th>
              <th className="pb-2 pr-3">SLO p95</th>
              <th className="pb-2 pr-3">Suporte</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={`${p.tenantSlug ?? "tenant"}:${p.serviceCode}`} className="border-t border-slate-200/50 dark:border-slate-700/50">
                <td className="py-1.5 pr-3">
                  <p className="font-semibold text-slate-800 dark:text-slate-200">{p.serviceName}</p>
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{p.serviceCode} · {p.tenantSlug ?? p.tenantName ?? "tenant"}</p>
                </td>
                <td className="py-1.5 pr-3 capitalize">{p.tier}</td>
                <td className="py-1.5 pr-3">{Number(p.slaAvailabilityPct).toFixed(3)}%</td>
                <td className="py-1.5 pr-3">{p.sloLatencyP95Ms}ms</td>
                <td className="py-1.5 pr-3">{p.supportChannel} · {p.supportHours}</td>
                <td className="py-1.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {p.isActive ? "ativo" : "inativo"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Retenção de Dados ────────────────────────────────────────────────────────

type PoliticaRetencao = { resourceType: string; maxAgeDays: number; enabled: boolean };

export function renderRetencao(d: unknown): React.ReactNode {
  const lista: PoliticaRetencao[] = Array.isArray(d)
    ? (d as PoliticaRetencao[])
    : ((d as { politicas?: PoliticaRetencao[] })?.politicas ?? []);
  if (lista.length === 0) return <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma política cadastrada.</p>;
  return (
    <div className="space-y-1.5">
      {lista.map((p) => (
        <div key={p.resourceType} className="flex items-center justify-between rounded-lg border border-slate-200/70 dark:border-slate-700/50 px-3 py-2">
          <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{p.resourceType}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{p.maxAgeDays} dias · {p.enabled ? "ativa" : "inativa"}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Capacity Planning ────────────────────────────────────────────────────────

export function renderCapacidade(d: unknown): React.ReactNode {
  const cd = d as { snapshots?: number; ultima?: { jobsConcurrentes: number; latenciaMediaMs: number }; meta?: { maxJobsConcurrentes: number; alertaAtivo: boolean } } | undefined;
  if (!cd) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <InfoCard label="Snapshots" valor={String(cd.snapshots ?? 0)} />
      <InfoCard label="Jobs Concorrentes" valor={String(cd.ultima?.jobsConcurrentes ?? "—")} />
      <InfoCard label="Latência Média" valor={cd.ultima ? `${cd.ultima.latenciaMediaMs}ms` : "—"} />
      {cd.meta && <InfoCard label="Meta Jobs" valor={String(cd.meta.maxJobsConcurrentes)} />}
      {cd.meta && <InfoCard label="Alerta" valor={cd.meta.alertaAtivo ? "ATIVO" : "ok"} ok={!cd.meta.alertaAtivo} />}
    </div>
  );
}

// ─── Vulnerabilidades ─────────────────────────────────────────────────────────

export function renderVulns(d: unknown): React.ReactNode {
  const vd = d as { total?: number; porSeveridade?: Record<string, number>; vencidas?: number; emPrazo?: number } | undefined;
  if (!vd) return null;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <InfoCard label="Total" valor={String(vd.total ?? 0)} />
        <InfoCard label="Vencidas" valor={String(vd.vencidas ?? 0)} ok={(vd.vencidas ?? 0) === 0} />
        <InfoCard label="Em Prazo" valor={String(vd.emPrazo ?? 0)} />
      </div>
      {vd.porSeveridade && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(vd.porSeveridade).map(([sev, qtd]) => (
            <div key={sev} className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 p-2 text-center">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 capitalize">{sev}</p>
              <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{String(qtd)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Classificação da Informação ──────────────────────────────────────────────

export function renderClassificacao(d: unknown): React.ReactNode {
  const cd = d as { distribuicao?: Record<string, number> } | undefined;
  if (!cd?.distribuicao) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Object.entries(cd.distribuicao).map(([nivel, qtd]) => (
        <div key={nivel} className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 p-3 text-center">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 capitalize">{nivel}</p>
          <p className="font-bold text-xl text-slate-800 dark:text-slate-200">{String(qtd)}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Holdings & Multiempresa ──────────────────────────────────────────────────

export function renderHoldings(d: unknown): React.ReactNode {
  const hd = d as { total?: number; holdings?: Array<{ nome: string; slug: string; ativa: boolean }> } | undefined;
  if (!hd) return null;
  if (!hd.holdings?.length) return <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma holding cadastrada.</p>;
  return (
    <div className="space-y-1.5">
      {hd.holdings.map((h) => (
        <div key={h.slug} className="flex items-center justify-between rounded-lg border border-slate-200/70 dark:border-slate-700/50 px-3 py-2">
          <div>
            <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{h.nome}</p>
            <p className="text-xs font-mono text-slate-500">{h.slug}</p>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${h.ativa ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
            {h.ativa ? "ativa" : "inativa"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── FinOps ───────────────────────────────────────────────────────────────────

export function renderFinOps(d: unknown): React.ReactNode {
  const fd = d as { totalRegistros?: number; totalUsd?: number; porAmbiente?: Record<string, number> } | undefined;
  if (!fd) return null;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <InfoCard label="Total Registros" valor={String(fd.totalRegistros ?? 0)} />
        <InfoCard label="Total USD" valor={`$${(fd.totalUsd ?? 0).toFixed(2)}`} />
      </div>
      {fd.porAmbiente && (
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Por Ambiente</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(fd.porAmbiente).map(([amb, usd]) => (
              <InfoCard key={amb} label={amb} valor={`$${(usd as number).toFixed(2)}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard MVs ────────────────────────────────────────────────────────────

export function renderDashboardMvs(d: unknown): React.ReactNode {
  const rd = d as SystemHealthMvsReport | undefined;
  if (!rd) return null;

  const btData = rd.btHistory.map(h => ({
    name: new Date(h.day_local).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    sucesso: h.parity_pass_count,
    falha: h.parity_fail_count,
    total: h.export_count
  })).reverse();

  const auditData = rd.auditStats.slice(0, 10).map(a => ({
    name: `${a.table_name}:${a.action}`,
    valor: a.event_count
  }));

  return (
    <div className="space-y-6">
      {/* Resumo Rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InfoCard label="Última Atualização" valor={new Date(rd.timestamp).toLocaleTimeString("pt-BR")} />
        <InfoCard label="Eventos Auditoria" valor={String(rd.auditStats.reduce((s, a) => s + a.event_count, 0))} />
        <InfoCard label="Séries BT" valor={String(rd.btHistory.length)} />
        <InfoCard label="Namespaces Catálogo" valor={String(rd.catalogSummary.length)} />
      </div>

      {/* Gráfico de Histórico BT */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900/50">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={16} className="text-fuchsia-600" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-tight">Histórico de Exportação BT (30 dias)</h3>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={btData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
              <XAxis dataKey="name" fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip 
                contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                itemStyle={{ fontSize: "12px", fontWeight: "bold" }}
              />
              <Legend fontSize={10} />
              <Bar dataKey="sucesso" fill="#10B981" radius={[4, 4, 0, 0]} name="Sucesso" />
              <Bar dataKey="falha" fill="#EF4444" radius={[4, 4, 0, 0]} name="Falha" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Auditoria Top 10 */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900/50">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-tight">Top 10 Eventos Auditoria</h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={auditData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#88888822" />
                <XAxis type="number" fontSize={10} hide />
                <YAxis dataKey="name" type="category" fontSize={9} width={120} />
                <Tooltip />
                <Bar dataKey="valor" fill="#6366F1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Catálogo Summary */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900/50">
          <div className="flex items-center gap-2 mb-4">
            <Database size={16} className="text-amber-600" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-tight">Status do Catálogo</h3>
          </div>
          <div className="space-y-2 overflow-y-auto max-h-64">
            {rd.catalogSummary.map(c => (
              <div key={c.namespace} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{c.namespace}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 uppercase font-black">{c.active_entries}/{c.total_entries} ativos</span>
                  <div className="h-1.5 w-24 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500" 
                      style={{ width: `${(c.active_entries / c.total_entries) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

