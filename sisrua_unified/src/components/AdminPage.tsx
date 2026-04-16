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
  Users, ShieldCheck, Building2, BarChart3, Sliders, Activity, Lock, RefreshCw, Network,
} from "lucide-react";
import { PainelCard } from "./AdminPagePrimitives";
import {
  renderSaude, renderUsuarios, renderPapeis, renderTenants, renderQuotas,
  renderFlags, renderKpis, renderServicos, renderRetencao, renderCapacidade, renderVulns,
  renderClassificacao, renderHoldings, renderFinOps,
} from "./AdminPageSectionRenderers";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Secao =
  | "saude" | "usuarios" | "papeis" | "tenants" | "quotas" | "flags" | "kpis"
  | "servicos" | "retencao" | "capacidade" | "vulns" | "classificacao" | "holdings" | "finops";

interface SecaoConfig {
  id: Secao;
  titulo: string;
  descricao: string;
  icone: React.ElementType;
  cor: string;
}

const SECOES: SecaoConfig[] = [
  { id: "saude",        titulo: "Saúde do Sistema",              descricao: "Status do painel e conectividade com banco",               icone: Activity,   cor: "emerald" },
  { id: "usuarios",     titulo: "Usuários e Papéis",             descricao: "Gestão de usuários e atribuição de papéis (RBAC)",         icone: Users,      cor: "blue"    },
  { id: "papeis",       titulo: "Distribuição de Papéis",        descricao: "Estatísticas de distribuição de papéis no sistema",        icone: ShieldCheck, cor: "indigo" },
  { id: "tenants",      titulo: "Tenants",                       descricao: "Clientes corporativos ativos na plataforma",               icone: Building2,  cor: "violet"  },
  { id: "quotas",       titulo: "Quotas",                        descricao: "Limites de uso configurados por tenant",                   icone: Sliders,    cor: "amber"   },
  { id: "flags",        titulo: "Feature Flags",                 descricao: "Configurações de funcionalidades por tenant",              icone: BarChart3,  cor: "orange"  },
  { id: "kpis",         titulo: "KPIs Operacionais",             descricao: "Observabilidade de negócio: taxa de sucesso e gargalos",   icone: Activity,   cor: "rose"    },
  { id: "servicos",     titulo: "Perfis de Serviço (SLA/SLO)",   descricao: "Catálogo SoA por tenant com tier, suporte e latência alvo", icone: Network,   cor: "sky"     },
  { id: "retencao",     titulo: "Retenção de Dados",             descricao: "Políticas de ciclo de vida e arquivamento por recurso",    icone: Sliders,    cor: "teal"    },
  { id: "capacidade",   titulo: "Capacity Planning",             descricao: "Histórico de capacidade e metas de jobs simultâneos",      icone: BarChart3,  cor: "cyan"    },
  { id: "vulns",        titulo: "Vulnerabilidades (CVSS SLA)",   descricao: "Gestão de vulnerabilidades com prazos por severidade",     icone: ShieldCheck, cor: "red"   },
  { id: "classificacao",titulo: "Classificação da Informação",   descricao: "Níveis de sensibilidade e políticas de segregação",        icone: Lock,       cor: "purple"  },
  { id: "holdings",     titulo: "Holdings & Multiempresa",       descricao: "Grupos empresariais, subsidiárias e auditoria cruzada",    icone: Building2,  cor: "stone"   },
  { id: "finops",       titulo: "FinOps — Controle de Custos",   descricao: "Consumo de APIs e processamento com alertas de orçamento", icone: Activity,   cor: "lime"    },
];

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminPage() {
  const [token, setToken]         = useState<string>("");
  const [tokenInput, setTokenInput] = useState<string>("");
  const [autenticado, setAutenticado] = useState<boolean>(false);
  const [erroAuth, setErroAuth]   = useState<string>("");

  const [secoesAbertas, setSecoesAbertas] = useState<Partial<Record<Secao, boolean>>>({ saude: true });
  const [carregando, setCarregando]       = useState<Partial<Record<Secao, boolean>>>({});
  const [erros, setErros]                 = useState<Partial<Record<Secao, string>>>({});
  const [dados, setDados]                 = useState<Partial<Record<Secao, unknown>>>({});

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

  const fetchComToken = useCallback(async (url: string, init?: RequestInit) => {
    const headers: Record<string, string> = { "Content-Type": "application/json", ...(init?.headers as Record<string, string> | undefined) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const resp = await fetch(url, { ...init, headers });
    if (resp.status === 401) throw new Error("Não autorizado — verifique o token.");
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error((body as { erro?: string })?.erro ?? `Erro HTTP ${resp.status}`);
    }
    return resp.json();
  }, [token]);

  const carregarSecao = useCallback(async (secao: Secao, url: string) => {
    setCarregando((c) => ({ ...c, [secao]: true }));
    setErros((e) => ({ ...e, [secao]: undefined }));
    try {
      const json = await fetchComToken(url);
      setDados((d) => ({ ...d, [secao]: json }));
    } catch (err) {
      setErros((e) => ({ ...e, [secao]: err instanceof Error ? err.message : String(err) }));
    } finally {
      setCarregando((c) => ({ ...c, [secao]: false }));
    }
  }, [fetchComToken]);

  function urlParaSecao(secao: Secao): string {
    switch (secao) {
      case "saude":        return `${apiBase}/saude`;
      case "usuarios":     return `${apiBase}/usuarios`;
      case "papeis":       return `${apiBase}/papeis/estatisticas`;
      case "tenants":      return `${apiBase}/tenants`;
      case "quotas":       return `${apiBase}/quotas`;
      case "flags":        return tenantIdAtivo ? `${apiBase}/feature-flags?tenantId=${tenantIdAtivo}` : "";
      case "kpis":         return tenantIdAtivo ? `${apiBase}/kpis?tenantId=${tenantIdAtivo}` : "";
      case "servicos":     return tenantIdAtivo ? `${apiBase}/servicos?tenantId=${tenantIdAtivo}` : `${apiBase}/servicos`;
      case "retencao":     return `${API_BASE_URL}/retencao/politicas`;
      case "capacidade":   return `${API_BASE_URL}/capacidade/status`;
      case "vulns":        return `${API_BASE_URL}/vulns/resumo`;
      case "classificacao":return `${API_BASE_URL}/classificacao/resumo`;
      case "holdings":     return `${API_BASE_URL}/holdings`;
      case "finops":       return `${API_BASE_URL}/finops/resumo`;
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
    if (!tokenInput.trim()) { setErroAuth("Informe o token de acesso."); return; }
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
    setDados((d) => ({ ...d, flags: undefined, kpis: undefined, servicos: undefined }));
  }

  async function salvarServico() {
    if (!tenantIdAtivo) {
      setServicosMensagem("Defina o tenant ativo antes de salvar um perfil de serviço.");
      return;
    }

    try {
      await fetchComToken(`${apiBase}/servicos/${tenantIdAtivo}/${servicoForm.serviceCode}`, {
        method: "PUT",
        body: JSON.stringify({
          serviceName: servicoForm.serviceName,
          tier: servicoForm.tier,
          slaAvailabilityPct: Number(servicoForm.slaAvailabilityPct),
          sloLatencyP95Ms: Number(servicoForm.sloLatencyP95Ms),
          supportChannel: servicoForm.supportChannel,
          supportHours: servicoForm.supportHours,
          escalationPolicy: { model: "standard", response: "15m", escalateTo: "manager-on-call" },
          metadata: { origem: "painel_admin", ambiente: "enterprise" },
          isActive: true,
        }),
      });
      setServicosMensagem("Perfil de serviço salvo com sucesso.");
      await carregarSecao("servicos", urlParaSecao("servicos"));
    } catch (err) {
      setServicosMensagem(err instanceof Error ? err.message : String(err));
    }
  }

  async function removerServico() {
    if (!tenantIdAtivo) {
      setServicosMensagem("Defina o tenant ativo antes de remover um perfil de serviço.");
      return;
    }

    try {
      await fetchComToken(`${apiBase}/servicos/${tenantIdAtivo}/${servicoForm.serviceCode}`, {
        method: "DELETE",
      });
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
      case "saude":        return renderSaude(d);
      case "usuarios":     return renderUsuarios(d);
      case "papeis":       return renderPapeis(d);
      case "tenants":      return renderTenants(d);
      case "quotas":       return renderQuotas(d);
      case "flags":        return renderFlags(d, tenantIdAtivo);
      case "kpis":         return renderKpis(d, tenantIdAtivo);
      case "servicos":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={servicoForm.serviceCode}
                onChange={(e) => setServicoForm((s) => ({ ...s, serviceCode: e.target.value.trim().toLowerCase() }))}
                placeholder="service_code"
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={servicoForm.serviceName}
                onChange={(e) => setServicoForm((s) => ({ ...s, serviceName: e.target.value }))}
                placeholder="Nome do serviço"
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <select
                value={servicoForm.tier}
                onChange={(e) => setServicoForm((s) => ({ ...s, tier: e.target.value }))}
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
                onChange={(e) => setServicoForm((s) => ({ ...s, supportHours: e.target.value }))}
                placeholder="Ex: 24x7"
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <input
                type="number"
                step="0.001"
                value={servicoForm.slaAvailabilityPct}
                onChange={(e) => setServicoForm((s) => ({ ...s, slaAvailabilityPct: e.target.value }))}
                placeholder="SLA %"
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={servicoForm.sloLatencyP95Ms}
                onChange={(e) => setServicoForm((s) => ({ ...s, sloLatencyP95Ms: e.target.value }))}
                placeholder="SLO p95 (ms)"
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={servicoForm.supportChannel}
                onChange={(e) => setServicoForm((s) => ({ ...s, supportChannel: e.target.value }))}
                placeholder="Canal de suporte"
                className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { void salvarServico(); }} className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3 py-2 text-sm font-semibold transition-colors">
                Salvar Perfil
              </button>
              <button onClick={() => { void removerServico(); }} className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 text-sm font-semibold transition-colors">
                Remover Perfil
              </button>
              <button onClick={() => { void carregarSecao("servicos", urlParaSecao("servicos")); }} className="rounded-lg bg-slate-600 hover:bg-slate-700 text-white px-3 py-2 text-sm font-semibold transition-colors">
                Recarregar Lista
              </button>
            </div>
            {servicosMensagem && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{servicosMensagem}</p>
            )}
            {renderServicos(d, tenantIdAtivo)}
          </div>
        );
      case "retencao":     return renderRetencao(d);
      case "capacidade":   return renderCapacidade(d);
      case "vulns":        return renderVulns(d);
      case "classificacao":return renderClassificacao(d);
      case "holdings":     return renderHoldings(d);
      case "finops":       return renderFinOps(d);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-zinc-950 p-4 md:p-8">
      {/* Cabeçalho */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">Painel Administrativo</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">sisRUA Unified — Autoatendimento Corporativo</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-4">
        {/* Login */}
        {!autenticado && (
          <div className="glass-panel rounded-2xl border-2 border-indigo-700/30 dark:border-indigo-500/40 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lock size={16} className="text-indigo-600 dark:text-indigo-400" />
              <h2 className="font-bold text-sm text-indigo-900 dark:text-indigo-200">Autenticação Requerida</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Informe o token de administração para acessar os recursos protegidos.
            </p>
            <form onSubmit={handleLogin} className="flex gap-2">
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Token de acesso..."
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
              />
              <button type="submit" className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-semibold transition-colors">
                Entrar
              </button>
            </form>
            {erroAuth && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{erroAuth}</p>}
          </div>
        )}

        {/* Tenant seletor */}
        {autenticado && (
          <div className="glass-panel rounded-2xl border-2 border-amber-700/30 dark:border-amber-500/40 p-4">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-2">
              Tenant Ativo (para Feature Flags e KPIs)
            </p>
            <form onSubmit={handleDefinirTenant} className="flex gap-2">
              <input
                type="text"
                value={tenantIdInput}
                onChange={(e) => setTenantIdInput(e.target.value)}
                placeholder="Ex: empresa-abc"
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
              />
              <button type="submit" className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 text-sm font-semibold transition-colors">
                Definir
              </button>
            </form>
            {tenantIdAtivo && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Tenant ativo: <strong className="text-amber-700 dark:text-amber-300">{tenantIdAtivo}</strong>
              </p>
            )}
          </div>
        )}

        {/* Recarregar todos */}
        {autenticado && (
          <button
            onClick={() => { setDados({}); void carregarSecao("saude", urlParaSecao("saude")); }}
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition-colors"
          >
            <RefreshCw size={12} />
            Recarregar dados
          </button>
        )}

        {/* Seções */}
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
  );
}
