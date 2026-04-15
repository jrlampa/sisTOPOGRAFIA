/**
 * AdminPageSectionRenderers.tsx — Funções de renderização por seção do Painel Admin.
 *
 * Cada função recebe `dados` (o estado atual da seção) e `tenantIdAtivo` quando necessário,
 * e retorna o conteúdo a exibir no accordion correspondente.
 */
import React from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { InfoCard, PapelBadge } from "./AdminPagePrimitives";

// ─── Tipos de resposta da API ─────────────────────────────────────────────────

interface SaudeAdmin { painel: string; versao: string; status: string; banco: string; timestamp: string }
interface UsuarioAdmin { userId: string; papel: string }
interface EstatisticasPapel { distribuicao: Record<string, number> }

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
