/**
 * SaaSAdminPage.tsx — Administração global da plataforma sisTOPOGRAFIA.
 *
 * Acesso exclusivo: operadores da plataforma (role = "plataforma").
 * Exibe visão consolidada de todos os tenants, saúde do sistema,
 * métricas globais e ações de governança.
 *
 * Roadmap: Item 35/37 [T1] Admin corporativo, Item 125 [T1] Observabilidade,
 *          Item 111 [T1] Release Governance, Item 129 [T1] Modelo Multiempresa.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ShieldCheck,
  Sliders,
  TrendingUp,
  Users,
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { PageShell } from '../components/PageShell';

// ─── Tipos ────────────────────────────────────────────────────────────────

interface TenantResumo {
  id: string;
  nome: string;
  ativo: boolean;
  plano: string;
  usuarios: number;
  jobsUltimos30d: number;
}

interface SaudeGlobal {
  status: string;
  banco: string;
  workers: string;
  versao: string;
  uptime: number;
}

interface MetricaGlobal {
  totalTenants: number;
  totalJobs30d: number;
  taxaSucesso30d: number;
  alertasAtivos: number;
}

// ─── Hooks ────────────────────────────────────────────────────────────────

function useDadosAdmin(token: string) {
  const [tenants, setTenants] = useState<TenantResumo[]>([]);
  const [saude, setSaude] = useState<SaudeGlobal | null>(null);
  const [metricas, setMetricas] = useState<MetricaGlobal | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const [rSaude, rTenants] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/saude`, { headers }),
        fetch(`${API_BASE_URL}/admin/tenants`, { headers }),
      ]);

      if (rSaude.ok) {
        const js = (await rSaude.json()) as SaudeGlobal;
        setSaude(js);
      }

      if (rTenants.ok) {
        const js = (await rTenants.json()) as TenantResumo[];
        const lista = Array.isArray(js) ? js : [];
        setTenants(lista);
        // Deriva métricas globais da lista de tenants
        setMetricas({
          totalTenants: lista.length,
          totalJobs30d: lista.reduce((acc, t) => acc + (t.jobsUltimos30d ?? 0), 0),
          taxaSucesso30d: 0, // virá de endpoint separado futuramente
          alertasAtivos: 0,
        });
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    void carregar();
  }, [carregar]);
  return { tenants, saude, metricas, carregando, erro, recarregar: carregar };
}

// ─── Componentes de suporte ───────────────────────────────────────────────

function MetricCard({
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
  const map: Record<string, string> = {
    sky: 'border-sky-500/25 bg-sky-500/10 text-sky-400',
    emerald: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
    violet: 'border-violet-500/25 bg-violet-500/10 text-violet-400',
    rose: 'border-rose-500/25 bg-rose-500/10 text-rose-400',
    amber: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
  };
  return (
    <div className={`rounded-2xl border p-5 ${map[cor] ?? map.sky}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider opacity-75">{label}</span>
        <Icon className="h-4 w-4 opacity-75" />
      </div>
      <p className="text-2xl font-black">{value}</p>
      {sub && <p className="mt-1 text-xs opacity-60">{sub}</p>}
    </div>
  );
}

function StatusBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">
      <CheckCircle2 className="h-3 w-3" />
      Operacional
    </span>
  ) : (
    <span className="flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-400">
      <AlertTriangle className="h-3 w-3" />
      Degradado
    </span>
  );
}

function SaudePanel({ saude, isDark }: { saude: SaudeGlobal; isDark: boolean }) {
  const items = [
    { label: 'API Backend', ok: saude.status === 'ok' },
    { label: 'Banco de Dados', ok: saude.banco === 'ok' },
    { label: 'Workers Python', ok: saude.workers === 'ok' },
  ];
  return (
    <div
      className={`rounded-2xl border p-6 ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
          Saúde da Plataforma
        </h3>
        <span className={`font-mono text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          v{saude.versao ?? '—'}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {items.map(item => (
          <div key={item.label} className="flex items-center justify-between">
            <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {item.label}
            </span>
            <StatusBadge ok={item.ok} />
          </div>
        ))}
        {saude.uptime != null && (
          <div className="flex items-center justify-between">
            <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Uptime
            </span>
            <span className={`font-mono text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {Math.floor(saude.uptime / 3600)}h
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function TenantRow({ tenant, isDark }: { tenant: TenantResumo; isDark: boolean }) {
  return (
    <tr
      className={`border-b ${isDark ? 'border-white/5 hover:bg-white/5' : 'border-slate-100 hover:bg-slate-50'}`}
    >
      <td className={`px-4 py-3 font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
        {tenant.nome || tenant.id}
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            tenant.ativo ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'
          }`}
        >
          {tenant.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-semibold uppercase text-indigo-400">
          {tenant.plano ?? '—'}
        </span>
      </td>
      <td
        className={`px-4 py-3 text-center font-mono text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
      >
        {tenant.usuarios ?? 0}
      </td>
      <td
        className={`px-4 py-3 text-right font-mono text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
      >
        {tenant.jobsUltimos30d ?? 0}
      </td>
    </tr>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────

export default function SaaSAdminPage() {
  const [isDark, setIsDark] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem('sisrua_token') ?? '');
  const [tokenInput, setTokenInput] = useState('');
  const [autenticado, setAutenticado] = useState(!!token);
  const [tenantsExpanded, setTenantsExpanded] = useState(true);

  const { tenants, saude, metricas, carregando, erro, recarregar } = useDadosAdmin(
    autenticado ? token : ''
  );

  function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    const t = tokenInput.trim();
    if (!t) return;
    setToken(t);
    localStorage.setItem('sisrua_token', t);
    setAutenticado(true);
    setTokenInput('');
  }

  return (
    <PageShell isDark={isDark} onToggleTheme={() => setIsDark(v => !v)} role="plataforma">
      {/* ── Cabeçalho ── */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-400" />
            <h1 className={`text-2xl font-black ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>
              Admin da Plataforma
            </h1>
          </div>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Visão global de tenants, saúde do sistema e métricas operacionais.
          </p>
        </div>
        {autenticado && (
          <button
            onClick={recarregar}
            disabled={carregando}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
              isDark
                ? 'border-white/15 text-slate-300 hover:border-white/30'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
            aria-label="Recarregar dados"
          >
            <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        )}
      </div>

      {/* ── Autenticação ── */}
      {!autenticado && (
        <div
          className={`mb-8 rounded-2xl border p-6 ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}
        >
          <h2 className={`mb-4 text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            Autenticação de Operador
          </h2>
          <form onSubmit={handleAuth} className="flex flex-col gap-3 sm:flex-row">
            <input
              type="password"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              placeholder="Token de acesso de operador"
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-indigo-500 ${
                isDark
                  ? 'border-white/15 bg-white/5 text-slate-100 placeholder:text-slate-600'
                  : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400'
              }`}
            />
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-500"
            >
              Autenticar
            </button>
          </form>
        </div>
      )}

      {/* ── Erro ── */}
      {erro && (
        <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-400">
          Erro ao carregar dados: {erro}
        </div>
      )}

      {autenticado && (
        <>
          {/* ── Métricas globais ── */}
          <section className="mb-8" aria-labelledby="metricas-title">
            <h2
              id="metricas-title"
              className={`mb-4 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
            >
              Métricas globais da plataforma
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Tenants ativos"
                cor="sky"
                icon={Building2}
                value={carregando ? '—' : (metricas?.totalTenants ?? 0)}
                sub="organizações cadastradas"
              />
              <MetricCard
                label="Jobs (30 dias)"
                cor="emerald"
                icon={Activity}
                value={carregando ? '—' : (metricas?.totalJobs30d ?? 0)}
                sub="exportações processadas"
              />
              <MetricCard
                label="Taxa de sucesso"
                cor="violet"
                icon={TrendingUp}
                value={carregando ? '—' : `${(metricas?.taxaSucesso30d ?? 0).toFixed(1)}%`}
                sub="últimos 30 dias"
              />
              <MetricCard
                label="Alertas ativos"
                cor="amber"
                icon={AlertTriangle}
                value={carregando ? '—' : (metricas?.alertasAtivos ?? 0)}
                sub="requerem atenção"
              />
            </div>
          </section>

          {/* ── Saúde + Ações rápidas ── */}
          <div className="mb-8 grid gap-6 lg:grid-cols-3">
            {/* Saúde */}
            <div className="lg:col-span-1">
              {saude ? (
                <SaudePanel saude={saude} isDark={isDark} />
              ) : (
                <div
                  className={`flex h-full items-center justify-center rounded-2xl border p-6 text-sm ${isDark ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-400'}`}
                >
                  {carregando ? 'Carregando saúde…' : 'Dados de saúde indisponíveis'}
                </div>
              )}
            </div>

            {/* Ações rápidas */}
            <div className="lg:col-span-2">
              <div
                className={`rounded-2xl border p-6 ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}
              >
                <h3
                  className={`mb-4 text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
                >
                  Ações da Plataforma
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      label: 'Gerenciar Tenants',
                      to: '/admin',
                      icon: Building2,
                      desc: 'Criar, ativar, desativar',
                    },
                    {
                      label: 'Feature Flags Globais',
                      to: '/admin',
                      icon: Sliders,
                      desc: 'Rollout por tenant/região',
                    },
                    {
                      label: 'Capacity Planning',
                      to: '/admin',
                      icon: BarChart3,
                      desc: 'Histórico e metas de jobs',
                    },
                    {
                      label: 'Gestão de Vulnerabilidades',
                      to: '/admin',
                      icon: ShieldCheck,
                      desc: 'CVSS SLA por severidade',
                    },
                  ].map(a => (
                    <Link
                      key={a.label}
                      to={a.to}
                      className={`flex items-center gap-3 rounded-xl border p-3 transition-all hover:border-indigo-500/30 ${
                        isDark
                          ? 'border-white/10 hover:bg-white/10'
                          : 'border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15">
                        <a.icon className="h-4 w-4 text-indigo-400" />
                      </span>
                      <div>
                        <p
                          className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
                        >
                          {a.label}
                        </p>
                        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {a.desc}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Tabela de tenants ── */}
          <section aria-labelledby="tenants-title">
            <button
              className={`mb-4 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider transition-colors ${
                isDark
                  ? 'border-white/10 text-slate-400 hover:bg-white/5'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
              onClick={() => setTenantsExpanded(v => !v)}
              id="tenants-title"
            >
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Todos os Tenants ({tenants.length})
              </span>
              {tenantsExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {tenantsExpanded &&
              (tenants.length === 0 ? (
                <div
                  className={`rounded-xl border p-6 text-center text-sm ${isDark ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-400'}`}
                >
                  {carregando ? 'Carregando tenants…' : 'Nenhum tenant encontrado.'}
                </div>
              ) : (
                <div
                  className={`overflow-hidden rounded-2xl border ${isDark ? 'border-white/10' : 'border-slate-200'}`}
                >
                  <table className="w-full text-sm">
                    <thead>
                      <tr
                        className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'border-b border-white/10 bg-white/5 text-slate-400' : 'border-b border-slate-100 bg-slate-50 text-slate-500'}`}
                      >
                        <th className="px-4 py-3 text-left">Organização</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Plano</th>
                        <th className="px-4 py-3 text-center">Usuários</th>
                        <th className="px-4 py-3 text-right">Jobs (30d)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenants.map(t => (
                        <TenantRow key={t.id} tenant={t} isDark={isDark} />
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </section>

          {/* ── Rodapé de segurança ── */}
          <p className={`mt-8 text-center text-xs ${isDark ? 'text-slate-700' : 'text-slate-300'}`}>
            Acesso restrito · Todas as ações são registradas na trilha de auditoria forense.
          </p>
        </>
      )}
    </PageShell>
  );
}
