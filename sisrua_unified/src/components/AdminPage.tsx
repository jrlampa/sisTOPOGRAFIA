/**
 * AdminPage.tsx — Painel de Autoatendimento Administrativo.
 *
 * Roadmap Item 35 [T1]: Painel de Autoatendimento Administrativo.
 * Acessível via: /admin
 *
 * Orquestra estado, autenticação e roteamento de seções.
 * A lógica de UI está em AdminPagePrimitives e AdminPageSectionRenderers.
 */
import React, { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "../config/api";
import {
  Users,
  ShieldCheck,
  Building2,
  BarChart3,
  Sliders,
  Activity,
  Lock,
  RefreshCw,
  Network,
} from "lucide-react";
import { PainelCard } from "./AdminPagePrimitives";
import {
  renderSaude,
  renderDashboardMvs,
  renderUsuarios,
  renderPapeis,
  renderTenants,
  renderQuotas,
  renderFlags,
  renderKpis,
  renderServicos,
  renderRetencao,
  renderCapacidade,
  renderVulns,
  renderClassificacao,
  renderHoldings,
  renderFinOps,
} from "./AdminPageSectionRenderers";
import { getAdminText } from "../i18n/adminText";
import { AppLocale } from "../types";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Secao =
  | "saude"
  | "dashboard"
  | "usuarios"
  | "papeis"
  | "tenants"
  | "quotas"
  | "flags"
  | "kpis"
  | "servicos"
  | "retencao"
  | "capacidade"
  | "vulns"
  | "classificacao"
  | "holdings"
  | "finops";

interface SecaoConfig {
  id: Secao;
  titulo: string;
  descricao: string;
  icone: React.ElementType;
  cor: string;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminPage() {
  const [token, setToken] = useState<string>("");
  const [tokenInput, setTokenInput] = useState<string>("");
  const [autenticado, setAutenticado] = useState<boolean>(false);
  const [erroAuth, setErroAuth] = useState<string>("");

  // TODO: Em uma integração real, buscar do contexto global de settings
  const locale: AppLocale = "pt-BR";
  const t = getAdminText(locale);

  const SECOES: SecaoConfig[] = [
    {
      id: "saude",
      titulo: t.sections.saude,
      descricao: "Status do painel e conectividade com banco",
      icone: Activity,
      cor: "emerald",
    },
    {
      id: "dashboard",
      titulo: t.sections.dashboard,
      descricao: "Performance de rede, auditoria e catálogo (via MVs)",
      icone: BarChart3,
      cor: "fuchsia",
    },
    {
      id: "usuarios",
      titulo: t.sections.usuarios,
      descricao: "Gestão de usuários e atribuição de papéis (RBAC)",
      icone: Users,
      cor: "blue",
    },
    {
      id: "papeis",
      titulo: t.sections.papeis,
      descricao: "Estatísticas de distribuição de papéis no sistema",
      icone: ShieldCheck,
      cor: "indigo",
    },
    {
      id: "tenants",
      titulo: t.sections.tenants,
      descricao: "Clientes corporativos ativos na plataforma",
      icone: Building2,
      cor: "violet",
    },
    {
      id: "quotas",
      titulo: t.sections.quotas,
      descricao: "Limites de uso configurados por tenant",
      icone: Sliders,
      cor: "amber",
    },
    {
      id: "flags",
      titulo: t.sections.flags,
      descricao: "Configurações de funcionalidades por tenant",
      icone: BarChart3,
      cor: "orange",
    },
    {
      id: "kpis",
      titulo: t.sections.kpis,
      descricao: "Observabilidade de negócio: taxa de sucesso e gargalos",
      icone: Activity,
      cor: "rose",
    },
    {
      id: "servicos",
      titulo: t.sections.servicos,
      descricao: "Perfis de serviço (SLA/SLO)",
      icone: Network,
      cor: "sky",
    },
    {
      id: "retencao",
      titulo: t.sections.retencao,
      descricao: "Políticas de ciclo de vida e arquivamento por recurso",
      icone: Sliders,
      cor: "teal",
    },
    {
      id: "capacidade",
      titulo: t.sections.capacidade,
      descricao: "Histórico de capacidade e metas de jobs simultâneos",
      icone: BarChart3,
      cor: "cyan",
    },
    {
      id: "vulns",
      titulo: t.sections.vulns,
      descricao: "Gestão de vulnerabilidades com prazos por severidade",
      icone: ShieldCheck,
      cor: "red",
    },
    {
      id: "classificacao",
      titulo: t.sections.classificacao,
      descricao: "Níveis de sensibilidade e políticas de segregação",
      icone: Lock,
      cor: "purple",
    },
    {
      id: "holdings",
      titulo: t.sections.holdings,
      descricao: "Grupos empresariais e auditoria cruzada",
      icone: Building2,
      cor: "stone",
    },
    {
      id: "finops",
      titulo: t.sections.finops,
      descricao: "Consumo de APIs e processamento",
      icone: Activity,
      cor: "lime",
    },
  ];

  const [secoesAbertas, setSecoesAbertas] = useState<
    Partial<Record<Secao, boolean>>
  >({ saude: true });
  const [carregando, setCarregando] = useState<Partial<Record<Secao, boolean>>>(
    {},
  );
  const [erros, setErros] = useState<Partial<Record<Secao, string>>>({});
  const [dados, setDados] = useState<Partial<Record<Secao, unknown>>>({});

  const [tenantIdInput, setTenantIdInput] = useState<string>("");
  const [tenantIdAtivo, setTenantIdAtivo] = useState<string>("");
  const [servicoForm, setServicoForm] = useState({
    serviceCode: "core-geoprocessing",
    serviceName: "Core Geoprocessing",
    tier: "gold",
    slaAvailabilityPct: "99.9",
    sloLatencyP95Ms: "1500",
    supportChannel: "24x7-chat",
    supportHours: "24x7",
  });
  const [servicosMensagem, setServicosMensagem] = useState<string>("");

  const apiBase = `${API_BASE_URL}/admin`;

  const fetchComToken = useCallback(
    async (url: string, init?: RequestInit) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(init?.headers as Record<string, string> | undefined),
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      const resp = await fetch(url, { ...init, headers });
      if (resp.status === 401) throw new Error(t.auth.error);
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(
          (body as { erro?: string })?.erro ?? `Erro HTTP ${resp.status}`,
        );
      }
      return resp.json();
    },
    [token, t.auth.error],
  );

  const carregarSecao = useCallback(
    async (secao: Secao, url: string) => {
      setCarregando((c) => ({ ...c, [secao]: true }));
      setErros((e) => ({ ...e, [secao]: undefined }));
      try {
        const json = await fetchComToken(url);
        setDados((d) => ({ ...d, [secao]: json }));
      } catch (err) {
        setErros((e) => ({
          ...e,
          [secao]: err instanceof Error ? err.message : String(err),
        }));
      } finally {
        setCarregando((c) => ({ ...c, [secao]: false }));
      }
    },
    [fetchComToken],
  );

  function urlParaSecao(secao: Secao): string {
    switch (secao) {
      case "saude":
        return `${apiBase}/saude`;
      case "dashboard":
        return `${apiBase}/dashboard-mvs`;
      case "usuarios":
        return `${apiBase}/usuarios`;
      case "papeis":
        return `${apiBase}/papeis/estatisticas`;
      case "tenants":
        return `${apiBase}/tenants`;
      case "quotas":
        return `${apiBase}/quotas`;
      case "flags":
        return tenantIdAtivo
          ? `${apiBase}/feature-flags?tenantId=${tenantIdAtivo}`
          : "";
      case "kpis":
        return tenantIdAtivo ? `${apiBase}/kpis?tenantId=${tenantIdAtivo}` : "";
      case "servicos":
        return tenantIdAtivo
          ? `${apiBase}/servicos?tenantId=${tenantIdAtivo}`
          : `${apiBase}/servicos`;
      case "retencao":
        return `${API_BASE_URL}/retencao/politicas`;
      case "capacidade":
        return `${API_BASE_URL}/capacidade/status`;
      case "vulns":
        return `${API_BASE_URL}/vulns/resumo`;
      case "classificacao":
        return `${API_BASE_URL}/classificacao/resumo`;
      case "holdings":
        return `${API_BASE_URL}/holdings`;
      case "finops":
        return `${API_BASE_URL}/finops/resumo`;
    }
  }

  function toggleSecao(secao: Secao) {
    setSecoesAbertas((prev) => {
      const abrir = !prev[secao];
      if (abrir && !dados[secao]) {
        const url = urlParaSecao(secao);
        if (url) void carregarSecao(secao, url);
      }
      return { ...prev, [secao]: abrir };
    });
  }

  useEffect(() => {
    void carregarSecao("saude", urlParaSecao("saude"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, carregarSecao]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setErroAuth("Informe o token de acesso.");
      return;
    }
    setToken(tokenInput.trim());
    setAutenticado(true);
    setErroAuth("");
    setDados({});
    void carregarSecao("saude", urlParaSecao("saude"));
  }

  function handleDefinirTenant(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantIdInput.trim()) return;
    setTenantIdAtivo(tenantIdInput.trim());
    setDados((d) => ({
      ...d,
      flags: undefined,
      kpis: undefined,
      servicos: undefined,
    }));
  }

  async function salvarServico() {
    if (!tenantIdAtivo) {
      setServicosMensagem(
        "Defina o tenant ativo antes de salvar um perfil de serviço.",
      );
      return;
    }

    try {
      await fetchComToken(
        `${apiBase}/servicos/${tenantIdAtivo}/${servicoForm.serviceCode}`,
        {
          method: "PUT",
          body: JSON.stringify({
            serviceName: servicoForm.serviceName,
            tier: servicoForm.tier,
            slaAvailabilityPct: Number(servicoForm.slaAvailabilityPct),
            sloLatencyP95Ms: Number(servicoForm.sloLatencyP95Ms),
            supportChannel: servicoForm.supportChannel,
            supportHours: servicoForm.supportHours,
            escalationPolicy: {
              model: "standard",
              response: "15m",
              escalateTo: "manager-on-call",
            },
            metadata: { origem: "painel_admin", ambiente: "enterprise" },
            isActive: true,
          }),
        },
      );
      setServicosMensagem("Perfil de serviço salvo com sucesso.");
      await carregarSecao("servicos", urlParaSecao("servicos"));
    } catch (err) {
      setServicosMensagem(err instanceof Error ? err.message : String(err));
    }
  }

  async function removerServico() {
    if (!tenantIdAtivo) {
      setServicosMensagem(
        "Defina o tenant ativo antes de remover um perfil de serviço.",
      );
      return;
    }

    try {
      await fetchComToken(
        `${apiBase}/servicos/${tenantIdAtivo}/${servicoForm.serviceCode}`,
        {
          method: "DELETE",
        },
      );
      setServicosMensagem("Perfil de serviço removido com sucesso.");
      await carregarSecao("servicos", urlParaSecao("servicos"));
    } catch (err) {
      setServicosMensagem(err instanceof Error ? err.message : String(err));
    }
  }

  // Mapa de render por seção
  const renderSecao = (secao: Secao) => {
    const d = dados[secao];
    switch (secao) {
      case "saude":
        return renderSaude(d);
      case "dashboard":
        return renderDashboardMvs(d);
      case "usuarios":
        return renderUsuarios(d);
      case "papeis":
        return renderPapeis(d);
      case "tenants":
        return renderTenants(d);
      case "quotas":
        return renderQuotas(d);
      case "flags":
        return renderFlags(d);
      case "kpis":
        return renderKpis(d);
      case "servicos":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={servicoForm.serviceCode}
                onChange={(e) =>
                  setServicoForm((s) => ({
                    ...s,
                    serviceCode: e.target.value.trim().toLowerCase(),
                  }))
                }
                placeholder="service_code"
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={servicoForm.serviceName}
                onChange={(e) =>
                  setServicoForm((s) => ({ ...s, serviceName: e.target.value }))
                }
                placeholder="Nome do serviço"
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <select
                value={servicoForm.tier}
                onChange={(e) =>
                  setServicoForm((s) => ({ ...s, tier: e.target.value }))
                }
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="bronze">bronze</option>
                <option value="silver">silver</option>
                <option value="gold">gold</option>
                <option value="platinum">platinum</option>
              </select>
              <input
                type="text"
                value={servicoForm.supportHours}
                onChange={(e) =>
                  setServicoForm((s) => ({
                    ...s,
                    supportHours: e.target.value,
                  }))
                }
                placeholder="Ex: 24x7"
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <input
                type="number"
                step="0.001"
                value={servicoForm.slaAvailabilityPct}
                onChange={(e) =>
                  setServicoForm((s) => ({
                    ...s,
                    slaAvailabilityPct: e.target.value,
                  }))
                }
                placeholder="SLA %"
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={servicoForm.sloLatencyP95Ms}
                onChange={(e) =>
                  setServicoForm((s) => ({
                    ...s,
                    sloLatencyP95Ms: e.target.value,
                  }))
                }
                placeholder="SLO p95 (ms)"
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={servicoForm.supportChannel}
                onChange={(e) =>
                  setServicoForm((s) => ({
                    ...s,
                    supportChannel: e.target.value,
                  }))
                }
                placeholder="Canal de suporte"
                className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  void salvarServico();
                }}
                className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3 py-2 text-sm font-semibold transition-colors"
              >
                Salvar Perfil
              </button>
              <button
                onClick={() => {
                  void removerServico();
                }}
                className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 text-sm font-semibold transition-colors"
              >
                Remover Perfil
              </button>
              <button
                onClick={() => {
                  void carregarSecao("servicos", urlParaSecao("servicos"));
                }}
                className="rounded-lg bg-slate-600 hover:bg-slate-700 text-white px-3 py-2 text-sm font-semibold transition-colors"
              >
                Recarregar Lista
              </button>
            </div>
            {servicosMensagem && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {servicosMensagem}
              </p>
            )}
            {renderServicos(d)}
          </div>
        );
      case "retencao":
        return renderRetencao(d);
      case "capacidade":
        return renderCapacidade(d);
      case "vulns":
        return renderVulns(d);
      case "classificacao":
        return renderClassificacao(d);
      case "holdings":
        return renderHoldings(d);
      case "finops":
        return renderFinOps(d);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-zinc-950 p-4 md:p-8 font-sans">
      {/* Cabeçalho */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {t.title}
            </h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 opacity-70">
              sisRUA Unified — Autoatendimento Corporativo
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-4">
        {/* Login */}
        {!autenticado && (
          <div className="glass-panel rounded-2xl border-2 border-indigo-700/30 dark:border-indigo-500/40 p-6 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                <Lock size={16} />
              </div>
              <h2 className="font-black text-sm text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">
                Autenticação Requerida
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
              Informe o token de administração para acessar os recursos
              protegidos do painel central.
            </p>
            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  id="admin-token-input"
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder={t.auth.placeholder}
                  aria-label="Token de administração"
                  className="flex-1 rounded-xl border-2 border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/40 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:border-indigo-500 outline-none transition-all"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 text-sm font-black uppercase tracking-widest shadow-lg shadow-indigo-600/25 transition-all active:scale-[0.98]"
                >
                  {t.auth.button}
                </button>
              </div>
            </form>
            {erroAuth && (
              <p
                className="mt-3 text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2"
                role="alert"
              >
                <AlertCircle size={14} /> {erroAuth}
              </p>
            )}
          </div>
        )}

        {/* Tenant seletor */}
        {autenticado && (
          <div className="glass-panel rounded-2xl border-2 border-amber-700/30 dark:border-amber-500/40 p-4 shadow-lg backdrop-blur-md">
            <label
              htmlFor="tenant-id-input"
              className="block text-[10px] font-black uppercase tracking-[0.2em] text-amber-900 dark:text-amber-200 mb-2 opacity-80"
            >
              Tenant Ativo (Filtro Global)
            </label>
            <form onSubmit={handleDefinirTenant} className="flex gap-2">
              <input
                id="tenant-id-input"
                type="text"
                value={tenantIdInput}
                onChange={(e) => setTenantIdInput(e.target.value)}
                placeholder="Ex: empresa-abc"
                className="flex-1 rounded-xl border-2 border-amber-100 dark:border-amber-900/20 bg-amber-50/30 dark:bg-amber-950/10 px-4 py-2.5 text-sm text-amber-900 dark:text-amber-100 placeholder:text-amber-700/30 focus:border-amber-400 outline-none transition-all"
              />
              <button
                type="submit"
                className="rounded-xl bg-amber-600 hover:bg-amber-500 text-white px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all"
              >
                Definir
              </button>
            </form>
            {tenantIdAtivo && (
              <p
                className="mt-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5"
                aria-live="polite"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Filtro ativo:{" "}
                <span className="font-black text-amber-700 dark:text-amber-300">
                  {tenantIdAtivo}
                </span>
              </p>
            )}
          </div>
        )}

        {/* Recarregar todos */}
        {autenticado && (
          <div className="flex justify-end">
            <button
              onClick={() => {
                setDados({});
                void carregarSecao("saude", urlParaSecao("saude"));
              }}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
            >
              <RefreshCw size={12} className="shrink-0" />
              Atualizar Painel
            </button>
          </div>
        )}

        {/* Seções */}
        <div className="space-y-3">
          {SECOES.map((sec) => (
            <PainelCard
              key={sec.id}
              titulo={sec.titulo}
              descricao={sec.descricao}
              icone={sec.icone}
              cor={sec.cor}
              aberto={secoesAbertas[sec.id] ?? false}
              onToggle={() => toggleSecao(sec.id)}
              carregando={carregando[sec.id] ?? false}
              erro={erros[sec.id]}
            >
              {renderSecao(sec.id)}
            </PainelCard>
          ))}
        </div>
      </div>
    </div>
  );
}

// Sub-componente de feedback visual (adicionado para suportar icones de erro na renderizacao)
function AlertCircle({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
