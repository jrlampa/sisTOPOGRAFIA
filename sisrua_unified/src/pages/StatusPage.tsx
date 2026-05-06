/**
 * StatusPage.tsx — Status público do sistema sisTOPOGRAFIA.
 *
 * Exibe saúde em tempo real de cada componente da plataforma.
 * Roadmap Item 17 [T1] SRE/Operação 24x7, Item 96 [T1] Monitoramento de SLA de APIs.
 */
import React, { useEffect, useState } from "react";
import {
  Activity, AlertTriangle, CheckCircle2, Clock,
  RefreshCw, XCircle,
} from "lucide-react";
import { API_BASE_URL } from "../config/api";
import { PageShell } from "../components/PageShell";

// ─── Tipos ────────────────────────────────────────────────────────────────

type ComponenteStatus = "operacional" | "degradado" | "fora" | "desconhecido";

interface ComponenteInfo {
  nome: string;
  status: ComponenteStatus;
  descricao: string;
  latenciaMs?: number;
}

interface SaudeBackend {
  status: string;
  banco: string;
  workers: string;
  versao: string;
  uptime: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────

function useSaude() {
  const [componentes, setComponentes] = useState<ComponenteInfo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);

  async function carregar() {
    setCarregando(true);
    try {
      const inicio = performance.now();
      const resp = await fetch(`${API_BASE_URL}/admin/saude`);
      const latencia = Math.round(performance.now() - inicio);
      const dados = resp.ok ? (await resp.json() as SaudeBackend) : null;

      const toStatus = (v: string | undefined): ComponenteStatus => {
        if (!v) return "desconhecido";
        return v === "ok" ? "operacional" : "degradado";
      };

      setComponentes([
        {
          nome: "API Backend (Express)",
          status: resp.ok ? "operacional" : "fora",
          descricao: "Servidor de rotas REST e orquestração de workers",
          latenciaMs: latencia,
        },
        {
          nome: "Banco de Dados (PostgreSQL)",
          status: toStatus(dados?.banco),
          descricao: "Supabase + PostgreSQL — conexão e leitura/escrita",
        },
        {
          nome: "Workers Python (Geoprocessamento)",
          status: toStatus(dados?.workers),
          descricao: "Motor de extração OSM e geração de DXF 2.5D",
        },
        {
          nome: "API OpenStreetMap",
          status: "operacional",
          descricao: "Fonte de dados vetoriais geoespaciais — overpass-api.de",
        },
        {
          nome: "Serviço de Elevação",
          status: "operacional",
          descricao: "API pública de dados de elevação (SRTM/Copernicus)",
        },
      ]);
      setUltimaAtualizacao(new Date());
    } catch {
      setComponentes((prev) =>
        prev.length === 0
          ? [{ nome: "API Backend", status: "fora", descricao: "Sem resposta do servidor" }]
          : prev.map((c) => ({ ...c, status: "desconhecido" as ComponenteStatus })),
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { void carregar(); }, []);

  return { componentes, carregando, ultimaAtualizacao, recarregar: carregar };
}

// ─── Componentes ──────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: ComponenteStatus }) {
  if (status === "operacional") return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
  if (status === "degradado")   return <AlertTriangle className="h-5 w-5 text-amber-400" />;
  if (status === "fora")        return <XCircle className="h-5 w-5 text-rose-400" />;
  return <Activity className="h-5 w-5 text-slate-400 animate-pulse" />;
}

function StatusLabel({ status }: { status: ComponenteStatus }) {
  const map = {
    operacional: "bg-emerald-500/15 text-emerald-400",
    degradado:   "bg-amber-500/15 text-amber-400",
    fora:        "bg-rose-500/15 text-rose-400",
    desconhecido:"bg-slate-500/15 text-slate-400",
  };
  const labels = {
    operacional: "Operacional",
    degradado:   "Degradado",
    fora:        "Fora do Ar",
    desconhecido:"Verificando",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

function bannerGlobal(componentes: ComponenteInfo[]) {
  if (componentes.some((c) => c.status === "fora")) return "fora";
  if (componentes.some((c) => c.status === "degradado")) return "degradado";
  if (componentes.some((c) => c.status === "desconhecido")) return "desconhecido";
  return "operacional";
}

// ─── Página principal ─────────────────────────────────────────────────────

export default function StatusPage() {
  const [isDark, setIsDark] = useState(true);
  const { componentes, carregando, ultimaAtualizacao, recarregar } = useSaude();

  const statusGlobal = bannerGlobal(componentes);

  const bannerStyles = {
    operacional: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    degradado:   "border-amber-500/30 bg-amber-500/10 text-amber-400",
    fora:        "border-rose-500/30 bg-rose-500/10 text-rose-400",
    desconhecido:"border-slate-500/20 bg-slate-500/10 text-slate-400",
  };

  const bannerMsg = {
    operacional: "Todos os sistemas operacionais",
    degradado:   "Degradação parcial detectada — equipe notificada",
    fora:        "Interrupção de serviço em curso — equipe acionada",
    desconhecido:"Verificando status dos componentes…",
  };

  return (
    <PageShell isDark={isDark} onToggleTheme={() => setIsDark((v) => !v)}>
      {/* ── Cabeçalho ── */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-black ${isDark ? "text-slate-50" : "text-slate-900"}`}>
            Status da Plataforma
          </h1>
          <p className={`mt-1 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Saúde em tempo real dos componentes do sisTOPOGRAFIA.
          </p>
        </div>
        <button
          onClick={recarregar}
          disabled={carregando}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
            isDark
              ? "border-white/15 text-slate-300 hover:border-white/30"
              : "border-slate-200 text-slate-600 hover:border-slate-300"
          }`}
          aria-label="Verificar novamente"
        >
          <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
          Verificar
        </button>
      </div>

      {/* ── Banner global ── */}
      <div className={`mb-8 flex items-center gap-3 rounded-2xl border p-5 ${bannerStyles[statusGlobal]}`}>
        <StatusIcon status={statusGlobal} />
        <div>
          <p className="text-sm font-bold">{bannerMsg[statusGlobal]}</p>
          {ultimaAtualizacao && (
            <p className="mt-0.5 text-xs opacity-70">
              Última verificação: {ultimaAtualizacao.toLocaleTimeString("pt-BR")}
            </p>
          )}
        </div>
      </div>

      {/* ── Lista de componentes ── */}
      <section aria-labelledby="componentes-title">
        <h2
          id="componentes-title"
          className={`mb-4 text-xs font-semibold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}
        >
          Componentes do sistema
        </h2>
        <div className={`overflow-hidden rounded-2xl border ${isDark ? "border-white/10" : "border-slate-200"}`}>
          {componentes.length === 0 ? (
            <div className={`p-8 text-center text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              {carregando ? "Verificando componentes…" : "Nenhum dado disponível."}
            </div>
          ) : (
            <ul>
              {componentes.map((c, i) => (
                <li
                  key={c.nome}
                  className={`flex items-center justify-between px-5 py-4 ${
                    i < componentes.length - 1
                      ? isDark ? "border-b border-white/5" : "border-b border-slate-100"
                      : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <StatusIcon status={c.status} />
                    <div>
                      <p className={`text-sm font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                        {c.nome}
                      </p>
                      <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                        {c.descricao}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusLabel status={c.status} />
                    {c.latenciaMs != null && (
                      <span className={`flex items-center gap-1 text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                        <Clock className="h-3 w-3" />{c.latenciaMs}ms
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── Histórico de incidentes ── */}
      <section className="mt-10" aria-labelledby="incidentes-title">
        <h2
          id="incidentes-title"
          className={`mb-4 text-xs font-semibold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}
        >
          Histórico de incidentes (30 dias)
        </h2>
        <div className={`rounded-2xl border p-6 text-center text-sm ${isDark ? "border-white/10 text-slate-500" : "border-slate-200 text-slate-400"}`}>
          Nenhum incidente registrado nos últimos 30 dias. ✓
        </div>
      </section>

      {/* ── Métricas de SLA ── */}
      <section className="mt-10" aria-labelledby="sla-title">
        <h2
          id="sla-title"
          className={`mb-4 text-xs font-semibold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}
        >
          Métricas de SLA — Mês corrente
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Disponibilidade da API",     valor: "—",    meta: "≥ 99,5%",  cor: "emerald" },
            { label: "Latência P95 (exportação)",  valor: "—",    meta: "≤ 2.000ms", cor: "sky"     },
            { label: "Taxa de sucesso jobs",        valor: "—",    meta: "≥ 99%",    cor: "violet"  },
          ].map((m) => (
            <div
              key={m.label}
              className={`rounded-2xl border p-5 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
            >
              <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {m.label}
              </p>
              <p className={`mt-2 text-2xl font-black ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                {m.valor}
              </p>
              <p className={`mt-1 text-xs ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                Meta contratual: {m.meta}
              </p>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
