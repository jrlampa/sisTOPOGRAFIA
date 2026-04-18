/**
 * DashboardPage.tsx — Dashboard operacional do cliente (tenant).
 *
 * Exibe KPIs, histórico de jobs, status de SLO e quotas consumidas.
 * Todos os dados vêm das APIs reais do backend (sem mock).
 * Roadmap: Item 125 [T1] Observabilidade de Negócio, Item 27 [T1] Dashboards de alta densidade.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileDown,
  Map,
  RefreshCw,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { API_BASE_URL } from "../config/api";
import { PageShell } from "../components/PageShell";

// ─── Tipos ────────────────────────────────────────────────────────────────

interface KpiMetrica {
  total: number;
  sucesso: number;
  falha: number;
  taxaSucessoPct: number;
  tempoMedioMs: number;
  jobsUltimas24h: number;
}

interface SloStatus {
  serviceCode: string;
  serviceName: string;
  slaAvailabilityPct: number;
  sloLatencyP95Ms: number;
  medidoAtualPct: number | null;
  medidoLatenciaMs: number | null;
  tier: string;
  status: "ok" | "degradado" | "violado";
}

interface QuotaStatus {
  recurso: string;
  limite: number;
  consumido: number;
  unidade: string;
}

// ─── Hooks de dados ───────────────────────────────────────────────────────

function useKpis(tenantId: string) {
  const [dados, setDados] = useState<KpiMetrica | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!tenantId) return;
    setCarregando(true);
    setErro(null);
    try {
      const url = `${API_BASE_URL}/admin/kpis?tenantId=${encodeURIComponent(tenantId)}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = (await resp.json()) as KpiMetrica;
      setDados(json);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);
  return { dados, carregando, erro, recarregar: carregar };
}

function useQuotas(tenantId: string) {
  const [dados, setDados] = useState<QuotaStatus[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    setCarregando(true);
    fetch(`${API_BASE_URL}/admin/quotas`)
      .then((r) =>
        r.ok
          ? (r.json() as Promise<QuotaStatus[]>)
          : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then(setDados)
      .catch(() => setDados([]))
      .finally(() => setCarregando(false));
  }, [tenantId]);

  return { dados, carregando };
}

function useSlos(tenantId: string) {
  const [dados, setDados] = useState<SloStatus[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    setCarregando(true);
    fetch(
      `${API_BASE_URL}/admin/servicos?tenantId=${encodeURIComponent(tenantId)}`,
    )
      .then((r) =>
        r.ok
          ? (r.json() as Promise<SloStatus[]>)
          : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then(setDados)
      .catch(() => setDados([]))
      .finally(() => setCarregando(false));
  }, [tenantId]);

  return { dados, carregando };
}

// ─── Componentes de suporte ───────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  cor,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  cor: string;
}) {
  const corMap: Record<string, string> = {
    emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    sky: "bg-sky-500/15 text-sky-400 border-sky-500/25",
    violet: "bg-violet-500/15 text-violet-400 border-violet-500/25",
    amber: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    rose: "bg-rose-500/15 text-rose-400 border-rose-500/25",
    indigo: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
  };
  return (
    <div className={`rounded-2xl border p-5 ${corMap[cor] ?? corMap.indigo}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider opacity-75">
          {label}
        </span>
        <Icon className="h-4 w-4 opacity-75" />
      </div>
      <p className="text-2xl font-black">{value}</p>
      {sub && <p className="mt-1 text-xs opacity-60">{sub}</p>}
    </div>
  );
}

function SloChip({ status }: { status: SloStatus["status"] }) {
  if (status === "ok")
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        OK
      </span>
    );
  if (status === "degradado")
    return (
      <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400">
        <AlertTriangle className="h-3 w-3" />
        Degradado
      </span>
    );
  return (
    <span className="flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-400">
      <XCircle className="h-3 w-3" />
      Violado
    </span>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const [isDark, setIsDark] = useState(true);
  // Em produção, tenantId viria do contexto de autenticação real
  const tenantId = localStorage.getItem("sisrua_tenant_id") ?? "";

  const {
    dados: kpis,
    carregando: kpiLoad,
    erro: kpiErro,
    recarregar,
  } = useKpis(tenantId);
  const { dados: quotas, carregando: quotaLoad } = useQuotas(tenantId);
  const { dados: slos, carregando: sloLoad } = useSlos(tenantId);

  const semTenant = !tenantId;

  return (
    <PageShell isDark={isDark} onToggleTheme={() => setIsDark((v) => !v)}>
      {/* ── Cabeçalho da página ── */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className={`text-2xl font-black ${isDark ? "text-slate-50" : "text-slate-900"}`}
          >
            Dashboard Operacional
          </h1>
          <p
            className={`mt-1 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
          >
            Métricas de operação, status de SLO e consumo de quotas do seu
            tenant.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/app"
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all hover:bg-indigo-500"
          >
            <Map className="h-4 w-4" />
            Abrir Projeto
          </Link>
          <button
            onClick={recarregar}
            disabled={kpiLoad}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
              isDark
                ? "border-white/15 text-slate-300 hover:border-white/30"
                : "border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
            aria-label="Recarregar dados"
          >
            <RefreshCw className={`h-4 w-4 ${kpiLoad ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* ── Aviso sem tenant ── */}
      {semTenant && (
        <div className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-400">
          <strong>Tenant não configurado.</strong> Configure seu{" "}
          <code className="font-mono">sisrua_tenant_id</code> no{" "}
          <Link to="/admin" className="underline">
            painel administrativo
          </Link>{" "}
          para visualizar as métricas.
        </div>
      )}

      {/* ── KPIs ── */}
      <section className="mb-8" aria-labelledby="kpi-title">
        <h2
          id="kpi-title"
          className={`mb-4 text-xs font-semibold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}
        >
          KPIs — Últimas 24 horas
        </h2>
        {kpiErro && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-400">
            Erro ao carregar KPIs: {kpiErro}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Jobs realizados"
            cor="sky"
            value={kpiLoad ? "—" : (kpis?.jobsUltimas24h ?? 0)}
            sub="últimas 24h"
            icon={Activity}
          />
          <KpiCard
            label="Taxa de sucesso"
            cor="emerald"
            value={kpiLoad ? "—" : `${(kpis?.taxaSucessoPct ?? 0).toFixed(1)}%`}
            sub={`${kpis?.sucesso ?? 0} sucesso · ${kpis?.falha ?? 0} falha`}
            icon={TrendingUp}
          />
          <KpiCard
            label="Tempo médio"
            cor="violet"
            value={
              kpiLoad
                ? "—"
                : `${((kpis?.tempoMedioMs ?? 0) / 1000).toFixed(1)}s`
            }
            sub="por job de exportação"
            icon={Clock}
          />
          <KpiCard
            label="Total processado"
            cor="amber"
            value={kpiLoad ? "—" : (kpis?.total ?? 0)}
            sub="desde o início do mês"
            icon={FileDown}
          />
        </div>
      </section>

      {/* ── SLOs ── */}
      <section className="mb-8" aria-labelledby="slo-title">
        <h2
          id="slo-title"
          className={`mb-4 text-xs font-semibold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}
        >
          Status de SLO por Serviço
        </h2>
        {sloLoad ? (
          <div
            className={`rounded-xl border p-6 text-center text-sm ${isDark ? "border-white/10 text-slate-500" : "border-slate-200 text-slate-400"}`}
          >
            Carregando dados de SLO…
          </div>
        ) : slos.length === 0 ? (
          <div
            className={`rounded-xl border p-6 text-center text-sm ${isDark ? "border-white/10 text-slate-500" : "border-slate-200 text-slate-400"}`}
          >
            Nenhum perfil de serviço configurado.{" "}
            <Link to="/admin" className="text-indigo-400 underline">
              Configurar no Admin
            </Link>
          </div>
        ) : (
          <div
            className={`overflow-hidden rounded-2xl border ${isDark ? "border-white/10" : "border-slate-200"}`}
          >
            <table className="w-full text-sm">
              <thead>
                <tr
                  className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "border-b border-white/10 bg-white/5 text-slate-400" : "border-b border-slate-100 bg-slate-50 text-slate-500"}`}
                >
                  <th className="px-4 py-3 text-left">Serviço</th>
                  <th className="px-4 py-3 text-left">Tier</th>
                  <th className="px-4 py-3 text-right">SLA Alvo</th>
                  <th className="px-4 py-3 text-right">Latência P95</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {slos.map((s, i) => (
                  <tr
                    key={s.serviceCode}
                    className={`border-b ${isDark ? "border-white/5 hover:bg-white/5" : "border-slate-100 hover:bg-slate-50"} ${i === slos.length - 1 ? "border-b-0" : ""}`}
                  >
                    <td
                      className={`px-4 py-3 font-medium ${isDark ? "text-slate-200" : "text-slate-800"}`}
                    >
                      {s.serviceName}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-semibold uppercase text-indigo-400">
                        {s.tier}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    >
                      {s.slaAvailabilityPct}%
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    >
                      {s.sloLatencyP95Ms}ms
                    </td>
                    <td className="px-4 py-3 text-center">
                      <SloChip status={s.status ?? "ok"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Quotas ── */}
      <section className="mb-8" aria-labelledby="quota-title">
        <h2
          id="quota-title"
          className={`mb-4 text-xs font-semibold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}
        >
          Consumo de Quotas
        </h2>
        {quotaLoad ? (
          <div
            className={`rounded-xl border p-6 text-center text-sm ${isDark ? "border-white/10 text-slate-500" : "border-slate-200 text-slate-400"}`}
          >
            Carregando quotas…
          </div>
        ) : quotas.length === 0 ? (
          <div
            className={`rounded-xl border p-6 text-center text-sm ${isDark ? "border-white/10 text-slate-500" : "border-slate-200 text-slate-400"}`}
          >
            Nenhuma quota configurada para este tenant.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quotas.map((q) => {
              const pct =
                q.limite > 0
                  ? Math.min(100, (q.consumido / q.limite) * 100)
                  : 0;
              const barCor =
                pct >= 90
                  ? "bg-rose-500"
                  : pct >= 70
                    ? "bg-amber-500"
                    : "bg-emerald-500";
              return (
                <div
                  key={q.recurso}
                  className={`rounded-2xl border p-5 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
                >
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span
                      className={`font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}
                    >
                      {q.recurso}
                    </span>
                    <span
                      className={`font-mono text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    >
                      {q.consumido}/{q.limite} {q.unidade}
                    </span>
                  </div>
                  <div
                    className={`h-2 w-full overflow-hidden rounded-full ${isDark ? "bg-white/10" : "bg-slate-100"}`}
                  >
                    <div
                      className={`h-full rounded-full transition-all ${barCor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p
                    className={`mt-1 text-right text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
                  >
                    {pct.toFixed(0)}% utilizado
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Acesso rápido ── */}
      <section aria-labelledby="quick-title">
        <h2
          id="quick-title"
          className={`mb-4 text-xs font-semibold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}
        >
          Acesso rápido
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Novo Projeto",
              to: "/app",
              icon: Map,
              desc: "Extrair área, gerar DXF 2.5D",
            },
            {
              label: "Painel Admin",
              to: "/admin",
              icon: Zap,
              desc: "Usuários, quotas, flags, SLA",
            },
            {
              label: "Central de Ajuda",
              to: "/ajuda",
              icon: BarChart3,
              desc: "Documentação, FAQ e suporte",
            },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center justify-between rounded-2xl border p-4 transition-all hover:border-indigo-500/30 ${
                isDark
                  ? "border-white/10 bg-white/5 hover:bg-white/10"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15">
                  <item.icon className="h-5 w-5 text-indigo-400" />
                </span>
                <div>
                  <p
                    className={`text-sm font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}
                  >
                    {item.label}
                  </p>
                  <p
                    className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
                  >
                    {item.desc}
                  </p>
                </div>
              </div>
              <ChevronRight
                className={`h-4 w-4 shrink-0 ${isDark ? "text-slate-500" : "text-slate-300"}`}
              />
            </Link>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
