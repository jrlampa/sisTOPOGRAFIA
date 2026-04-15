/**
 * AdminPage.tsx — Painel de Autoatendimento Administrativo.
 *
 * Roadmap Item 35 [T1]: Painel de Autoatendimento Administrativo.
 * Permite aos gestores gerenciar usuários, papéis, quotas e feature flags
 * sem intervenção da equipe técnica.
 *
 * Acessível via: /admin
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
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Lock,
} from "lucide-react";

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface SaudeAdmin {
  painel: string;
  versao: string;
  status: string;
  banco: string;
  timestamp: string;
}

interface UsuarioAdmin {
  userId: string;
  papel: string;
}

interface EstatisticasPapel {
  distribuicao: Record<string, number>;
}

type Secao = "saude" | "usuarios" | "papeis" | "tenants" | "quotas" | "flags" | "kpis";

interface SecaoConfig {
  id: Secao;
  titulo: string;
  descricao: string;
  icone: React.ElementType;
  cor: string;
}

const SECOES: SecaoConfig[] = [
  {
    id: "saude",
    titulo: "Saúde do Sistema",
    descricao: "Status do painel e conectividade com banco de dados",
    icone: Activity,
    cor: "emerald",
  },
  {
    id: "usuarios",
    titulo: "Usuários e Papéis",
    descricao: "Gestão de usuários e atribuição de papéis (RBAC)",
    icone: Users,
    cor: "blue",
  },
  {
    id: "papeis",
    titulo: "Distribuição de Papéis",
    descricao: "Estatísticas de distribuição de papéis no sistema",
    icone: ShieldCheck,
    cor: "indigo",
  },
  {
    id: "tenants",
    titulo: "Tenants",
    descricao: "Clientes corporativos ativos na plataforma",
    icone: Building2,
    cor: "violet",
  },
  {
    id: "quotas",
    titulo: "Quotas",
    descricao: "Limites de uso configurados por tenant",
    icone: Sliders,
    cor: "amber",
  },
  {
    id: "flags",
    titulo: "Feature Flags",
    descricao: "Configurações de funcionalidades por tenant",
    icone: BarChart3,
    cor: "orange",
  },
  {
    id: "kpis",
    titulo: "KPIs Operacionais",
    descricao: "Observabilidade de negócio: taxa de sucesso e gargalos",
    icone: Activity,
    cor: "rose",
  },
];

// ─── Componentes auxiliares ────────────────────────────────────────────────────

// Mapa estático de classes Tailwind por cor (necessário para JIT funcionar corretamente).
const COR_CLASSES: Record<
  string,
  { border: string; darkBorder: string; bg: string; darkBg: string; hoverBg: string; darkHoverBg: string; iconBg: string; darkIconBg: string; iconBorder: string; darkIconBorder: string; iconText: string; darkIconText: string; titleText: string; darkTitleText: string }
> = {
  emerald: {
    border: "border-emerald-700/30",
    darkBorder: "dark:border-emerald-500/40",
    bg: "bg-emerald-50",
    darkBg: "dark:bg-emerald-950/20",
    hoverBg: "hover:bg-emerald-100",
    darkHoverBg: "dark:hover:bg-emerald-950/30",
    iconBg: "bg-emerald-100",
    darkIconBg: "dark:bg-emerald-900/40",
    iconBorder: "border-emerald-300/50",
    darkIconBorder: "dark:border-emerald-700/50",
    iconText: "text-emerald-700",
    darkIconText: "dark:text-emerald-300",
    titleText: "text-emerald-900",
    darkTitleText: "dark:text-emerald-100",
  },
  blue: {
    border: "border-blue-700/30",
    darkBorder: "dark:border-blue-500/40",
    bg: "bg-blue-50",
    darkBg: "dark:bg-blue-950/20",
    hoverBg: "hover:bg-blue-100",
    darkHoverBg: "dark:hover:bg-blue-950/30",
    iconBg: "bg-blue-100",
    darkIconBg: "dark:bg-blue-900/40",
    iconBorder: "border-blue-300/50",
    darkIconBorder: "dark:border-blue-700/50",
    iconText: "text-blue-700",
    darkIconText: "dark:text-blue-300",
    titleText: "text-blue-900",
    darkTitleText: "dark:text-blue-100",
  },
  indigo: {
    border: "border-indigo-700/30",
    darkBorder: "dark:border-indigo-500/40",
    bg: "bg-indigo-50",
    darkBg: "dark:bg-indigo-950/20",
    hoverBg: "hover:bg-indigo-100",
    darkHoverBg: "dark:hover:bg-indigo-950/30",
    iconBg: "bg-indigo-100",
    darkIconBg: "dark:bg-indigo-900/40",
    iconBorder: "border-indigo-300/50",
    darkIconBorder: "dark:border-indigo-700/50",
    iconText: "text-indigo-700",
    darkIconText: "dark:text-indigo-300",
    titleText: "text-indigo-900",
    darkTitleText: "dark:text-indigo-100",
  },
  violet: {
    border: "border-violet-700/30",
    darkBorder: "dark:border-violet-500/40",
    bg: "bg-violet-50",
    darkBg: "dark:bg-violet-950/20",
    hoverBg: "hover:bg-violet-100",
    darkHoverBg: "dark:hover:bg-violet-950/30",
    iconBg: "bg-violet-100",
    darkIconBg: "dark:bg-violet-900/40",
    iconBorder: "border-violet-300/50",
    darkIconBorder: "dark:border-violet-700/50",
    iconText: "text-violet-700",
    darkIconText: "dark:text-violet-300",
    titleText: "text-violet-900",
    darkTitleText: "dark:text-violet-100",
  },
  amber: {
    border: "border-amber-700/30",
    darkBorder: "dark:border-amber-500/40",
    bg: "bg-amber-50",
    darkBg: "dark:bg-amber-950/20",
    hoverBg: "hover:bg-amber-100",
    darkHoverBg: "dark:hover:bg-amber-950/30",
    iconBg: "bg-amber-100",
    darkIconBg: "dark:bg-amber-900/40",
    iconBorder: "border-amber-300/50",
    darkIconBorder: "dark:border-amber-700/50",
    iconText: "text-amber-700",
    darkIconText: "dark:text-amber-300",
    titleText: "text-amber-900",
    darkTitleText: "dark:text-amber-100",
  },
  orange: {
    border: "border-orange-700/30",
    darkBorder: "dark:border-orange-500/40",
    bg: "bg-orange-50",
    darkBg: "dark:bg-orange-950/20",
    hoverBg: "hover:bg-orange-100",
    darkHoverBg: "dark:hover:bg-orange-950/30",
    iconBg: "bg-orange-100",
    darkIconBg: "dark:bg-orange-900/40",
    iconBorder: "border-orange-300/50",
    darkIconBorder: "dark:border-orange-700/50",
    iconText: "text-orange-700",
    darkIconText: "dark:text-orange-300",
    titleText: "text-orange-900",
    darkTitleText: "dark:text-orange-100",
  },
  rose: {
    border: "border-rose-700/30",
    darkBorder: "dark:border-rose-500/40",
    bg: "bg-rose-50",
    darkBg: "dark:bg-rose-950/20",
    hoverBg: "hover:bg-rose-100",
    darkHoverBg: "dark:hover:bg-rose-950/30",
    iconBg: "bg-rose-100",
    darkIconBg: "dark:bg-rose-900/40",
    iconBorder: "border-rose-300/50",
    darkIconBorder: "dark:border-rose-700/50",
    iconText: "text-rose-700",
    darkIconText: "dark:text-rose-300",
    titleText: "text-rose-900",
    darkTitleText: "dark:text-rose-100",
  },
};

interface PainelCardProps {
  titulo: string;
  descricao: string;
  icone: React.ElementType;
  cor: string;
  aberto: boolean;
  onToggle: () => void;
  carregando: boolean;
  erro?: string;
  children: React.ReactNode;
}

function PainelCard({
  titulo,
  descricao,
  icone: Icone,
  cor,
  aberto,
  onToggle,
  carregando,
  erro,
  children,
}: PainelCardProps) {
  const cc = COR_CLASSES[cor] ?? COR_CLASSES.emerald;
  return (
    <div className={`glass-panel rounded-2xl border-2 ${cc.border} ${cc.darkBorder} overflow-hidden`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-4 ${cc.bg} ${cc.darkBg} ${cc.hoverBg} ${cc.darkHoverBg} transition-colors`}
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${cc.iconBg} ${cc.darkIconBg} border ${cc.iconBorder} ${cc.darkIconBorder}`}>
            <Icone size={18} className={`${cc.iconText} ${cc.darkIconText}`} />
          </div>
          <div className="text-left">
            <p className={`font-bold ${cc.titleText} ${cc.darkTitleText} text-sm`}>{titulo}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{descricao}</p>
          </div>
        </div>
        {aberto ? (
          <ChevronUp size={16} className="text-slate-400 shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-slate-400 shrink-0" />
        )}
      </button>

      {aberto && (
        <div className="p-4 border-t border-slate-200/70 dark:border-slate-700/50">
          {carregando && (
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm py-2">
              <RefreshCw size={14} className="animate-spin" />
              <span>Carregando...</span>
            </div>
          )}
          {erro && !carregando && (
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-sm py-2">
              <AlertCircle size={14} />
              <span>{erro}</span>
            </div>
          )}
          {!carregando && !erro && children}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminPage() {
  const [token, setToken] = useState<string>("");
  const [tokenInput, setTokenInput] = useState<string>("");
  const [autenticado, setAutenticado] = useState<boolean>(false);
  const [erroAuth, setErroAuth] = useState<string>("");

  const [secoesAbertas, setSecoesAbertas] = useState<Partial<Record<Secao, boolean>>>({
    saude: true,
  });
  const [carregando, setCarregando] = useState<Partial<Record<Secao, boolean>>>({});
  const [erros, setErros] = useState<Partial<Record<Secao, string>>>({});
  const [dados, setDados] = useState<Partial<Record<Secao, unknown>>>({});

  const [tenantIdInput, setTenantIdInput] = useState<string>("");
  const [tenantIdAtivo, setTenantIdAtivo] = useState<string>("");

  const apiBase = `${API_BASE_URL}/admin`;

  const fetchComToken = useCallback(
    async (url: string) => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const resp = await fetch(url, { headers });
      if (resp.status === 401) throw new Error("Não autorizado — verifique o token.");
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.erro ?? `Erro HTTP ${resp.status}`);
      }
      return resp.json();
    },
    [token],
  );

  const carregarSecao = useCallback(
    async (secao: Secao, url: string) => {
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
    },
    [fetchComToken],
  );

  function toggleSecao(secao: Secao) {
    setSecoesAbertas((prev) => {
      const novoEstado = !prev[secao];
      if (novoEstado && !dados[secao]) {
        let url = "";
        if (secao === "saude") url = `${apiBase}/saude`;
        else if (secao === "usuarios") url = `${apiBase}/usuarios`;
        else if (secao === "papeis") url = `${apiBase}/papeis/estatisticas`;
        else if (secao === "tenants") url = `${apiBase}/tenants`;
        else if (secao === "quotas") url = `${apiBase}/quotas`;
        else if (secao === "flags" && tenantIdAtivo) url = `${apiBase}/feature-flags?tenantId=${tenantIdAtivo}`;
        else if (secao === "kpis" && tenantIdAtivo) url = `${apiBase}/kpis?tenantId=${tenantIdAtivo}`;
        if (url) void carregarSecao(secao, url);
      }
      return { ...prev, [secao]: novoEstado };
    });
  }

  // Carrega a seção de saúde automaticamente
  useEffect(() => {
    void carregarSecao("saude", `${apiBase}/saude`);
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
    // Recarrega saúde com token
    void carregarSecao("saude", `${apiBase}/saude`);
  }

  function handleDefinirTenant(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantIdInput.trim()) return;
    setTenantIdAtivo(tenantIdInput.trim());
    setDados((d) => ({ ...d, flags: undefined, kpis: undefined }));
  }

  // ── Renderização de dados por seção ──────────────────────────────────────

  function renderSaude() {
    const d = dados.saude as SaudeAdmin | undefined;
    if (!d) return null;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InfoCard label="Status" valor={d.status} ok={d.status === "operacional"} />
        <InfoCard label="Versão" valor={d.versao} />
        <InfoCard label="Banco" valor={d.banco} ok={d.banco === "disponível"} />
        <InfoCard label="Timestamp" valor={new Date(d.timestamp).toLocaleString("pt-BR")} />
      </div>
    );
  }

  function renderUsuarios() {
    const d = dados.usuarios as { total: number; usuarios: UsuarioAdmin[] } | undefined;
    if (!d) return null;
    if (d.total === 0) {
      return <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum usuário cadastrado.</p>;
    }
    return (
      <div className="space-y-2">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{d.total} usuário(s)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-slate-500 dark:text-slate-400 uppercase">
                <th className="pb-2 pr-4">Usuário</th>
                <th className="pb-2">Papel</th>
              </tr>
            </thead>
            <tbody>
              {d.usuarios.map((u) => (
                <tr key={u.userId} className="border-t border-slate-200/50 dark:border-slate-700/50">
                  <td className="py-1.5 pr-4 font-mono text-xs text-slate-700 dark:text-slate-300">{u.userId}</td>
                  <td className="py-1.5">
                    <PapelBadge papel={u.papel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderPapeis() {
    const d = dados.papeis as EstatisticasPapel | undefined;
    if (!d) return null;
    const dist = d.distribuicao;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(dist).map(([papel, contagem]) => (
          <div key={papel} className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 p-3 text-center">
            <PapelBadge papel={papel} />
            <p className="mt-1 text-xl font-black text-slate-800 dark:text-slate-200">{String(contagem)}</p>
          </div>
        ))}
      </div>
    );
  }

  function renderTenants() {
    const d = dados.tenants as { total: number; tenants: Array<{ slug: string; name: string; plan: string }>; aviso?: string } | undefined;
    if (!d) return null;
    if (d.aviso && d.total === 0) {
      return <p className="text-sm text-amber-600 dark:text-amber-400">{d.aviso}</p>;
    }
    return (
      <div className="space-y-1.5">
        {d.tenants.map((t) => (
          <div key={t.slug} className="flex items-center justify-between rounded-lg border border-slate-200/70 dark:border-slate-700/50 px-3 py-2">
            <div>
              <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{t.name}</p>
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{t.slug}</p>
            </div>
            <span className="text-xs font-medium text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 rounded-full">
              {t.plan}
            </span>
          </div>
        ))}
      </div>
    );
  }

  function renderQuotas() {
    const d = dados.quotas as { tipos?: string[]; aviso?: string; tenantId?: string; quotas?: Record<string, unknown> } | undefined;
    if (!d) return null;
    if (d.aviso) {
      return (
        <div className="space-y-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">{d.aviso}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Tipos disponíveis: {d.tipos?.join(", ")}
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">Tenant: <strong>{d.tenantId}</strong></p>
        <pre className="text-xs bg-slate-50 dark:bg-slate-900 rounded-lg p-3 overflow-x-auto">
          {JSON.stringify(d.quotas, null, 2)}
        </pre>
      </div>
    );
  }

  function renderFlags() {
    const d = dados.flags as { tenantId?: string; total?: number; flags?: Record<string, boolean> } | undefined;
    if (!d) {
      return tenantIdAtivo
        ? null
        : <p className="text-sm text-amber-600 dark:text-amber-400">Defina um Tenant ID acima para ver os feature flags.</p>;
    }
    if (!d.flags || Object.keys(d.flags).length === 0) {
      return <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum override configurado para este tenant.</p>;
    }
    return (
      <div className="space-y-1.5">
        {Object.entries(d.flags).map(([flag, ativo]) => (
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

  function renderKpis() {
    const d = dados.kpis as { global?: { total: number; taxaSucesso: number; retrabalhos?: number }; gargalosRegionais?: Array<{ regiao: string; taxaFalha: number; ehGargalo: boolean }> } | undefined;
    if (!d) {
      return tenantIdAtivo
        ? null
        : <p className="text-sm text-amber-600 dark:text-amber-400">Defina um Tenant ID acima para ver os KPIs.</p>;
    }
    if (!d.global) return null;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <InfoCard label="Total de Jobs" valor={String(d.global.total)} />
          <InfoCard label="Taxa de Sucesso" valor={`${(d.global.taxaSucesso * 100).toFixed(1)}%`} ok={d.global.taxaSucesso >= 0.9} />
          <InfoCard label="Retrabalhos" valor={String(d.global.retrabalhos ?? 0)} />
        </div>
        {d.gargalosRegionais && d.gargalosRegionais.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Regiões com Gargalos</p>
            <div className="space-y-1.5">
              {d.gargalosRegionais.filter((g) => g.ehGargalo).map((g) => (
                <div key={g.regiao} className="flex items-center justify-between rounded-lg border border-rose-200/70 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/20 px-3 py-2">
                  <span className="text-sm font-medium text-rose-800 dark:text-rose-300 capitalize">{g.regiao}</span>
                  <span className="text-xs text-rose-600 dark:text-rose-400">
                    {(g.taxaFalha * 100).toFixed(1)}% falha
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Renderização principal ────────────────────────────────────────────────

  const conteudoSecao: Partial<Record<Secao, () => React.ReactNode>> = {
    saude: renderSaude,
    usuarios: renderUsuarios,
    papeis: renderPapeis,
    tenants: renderTenants,
    quotas: renderQuotas,
    flags: renderFlags,
    kpis: renderKpis,
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
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">
              Painel Administrativo
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              sisRUA Unified — Autoatendimento Corporativo
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-4">
        {/* Login / Token */}
        {!autenticado && (
          <div className="glass-panel rounded-2xl border-2 border-indigo-700/30 dark:border-indigo-500/40 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lock size={16} className="text-indigo-600 dark:text-indigo-400" />
              <h2 className="font-bold text-sm text-indigo-900 dark:text-indigo-200">
                Autenticação Requerida
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Informe o token de administração para acessar os recursos protegidos.
              Sem token, apenas a seção de Saúde é visível.
            </p>
            <form onSubmit={handleLogin} className="flex gap-2">
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Token de acesso..."
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
              />
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-semibold transition-colors"
              >
                Entrar
              </button>
            </form>
            {erroAuth && (
              <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{erroAuth}</p>
            )}
          </div>
        )}

        {/* Tenant ID seletor (para flags e KPIs) */}
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
              <button
                type="submit"
                className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 text-sm font-semibold transition-colors"
              >
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
            {conteudoSecao[sec.id]?.()}
          </PainelCard>
        ))}
      </div>
    </div>
  );
}

// ─── Sub-componentes utilitários ──────────────────────────────────────────────

function InfoCard({
  label,
  valor,
  ok,
}: {
  label: string;
  valor: string;
  ok?: boolean;
}) {
  const corValor =
    ok === undefined
      ? "text-slate-800 dark:text-slate-200"
      : ok
        ? "text-emerald-700 dark:text-emerald-300"
        : "text-rose-700 dark:text-rose-300";

  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 bg-white/50 dark:bg-slate-900/40 px-3 py-2">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{label}</p>
      <p className={`font-bold text-sm mt-0.5 ${corValor}`}>{valor}</p>
    </div>
  );
}

function PapelBadge({ papel }: { papel: string }) {
  const cores: Record<string, string> = {
    admin: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    technician: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    viewer: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    guest: "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500",
  };

  const cor = cores[papel] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${cor}`}>
      {papel}
    </span>
  );
}
