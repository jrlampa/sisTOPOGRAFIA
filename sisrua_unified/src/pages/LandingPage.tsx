/**
 * LandingPage.tsx — Página de marketing/produto enterprise do sisTOPOGRAFIA.
 *
 * Seções: Hero · Proposta de Valor · Features · Planos · FAQ · Footer
 * Sem dados mockados — CTAs conectam ao fluxo de autenticação/contato real.
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  FileDown,
  Globe,
  Lock,
  Mail,
  Map,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { allowedCorporateDomain } from "../lib/supabaseClient";

// ─── Dados estáticos ──────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Map,
    title: "Mapa 2.5D de Alta Fidelidade",
    desc: "Extração vetorial precisa do OpenStreetMap com elevação e topografia real. Pronto para projeto, medição e BDGD/ANEEL.",
    color: "indigo",
  },
  {
    icon: FileDown,
    title: "Exportação DXF Profissional",
    desc: "Arquivos AutoCAD com camadas semânticas, BIM light, metadados de proveniência e versionamento por artefato.",
    color: "emerald",
  },
  {
    icon: Building2,
    title: "Multi-tenant Enterprise",
    desc: "Isolamento total por organização, RBAC granular, quotas configuráveis e trilha de auditoria exportável.",
    color: "violet",
  },
  {
    icon: ShieldCheck,
    title: "Compliance LGPD + ANEEL",
    desc: "Residência de dados no Brasil, dossiê regulatório nativo, RIPD automatizado e cadeia de custódia verificável.",
    color: "rose",
  },
  {
    icon: Zap,
    title: "SLO Contratual por Tenant",
    desc: "Catálogo SoA com SLA/SLO por tier de serviço. Monitoramento em tempo real com alertas acionáveis e runbooks.",
    color: "amber",
  },
  {
    icon: BarChart3,
    title: "Observabilidade de Negócio",
    desc: "KPIs operacionais, taxa de sucesso por projeto, gargalos por região e FinOps com alertas de consumo.",
    color: "sky",
  },
];

const PLANS = [
  {
    name: "Freemium",
    price: "R$ 0",
    subtitle: "Para validar a operação",
    cta: "Começar grátis",
    ctaLink: "/app",
    highlight: false,
    features: [
      "1 projeto ativo simultâneo",
      "Mapa 2.5D com edição essencial",
      "Exportação DXF limitada (50 objetos)",
      "1 usuário por organização",
      "Base de conhecimento e FAQ",
    ],
  },
  {
    name: "Pro Operacional",
    price: "R$ 249",
    period: "/mês",
    subtitle: "Para equipes técnicas em campo",
    cta: "Testar 14 dias grátis",
    ctaLink: "/app",
    highlight: true,
    features: [
      "Projetos ilimitados",
      "DXF completo com histórico de versões",
      "Dashboard com métricas de risco e SLO",
      "Até 10 usuários por organização",
      "Suporte prioritário em horário comercial",
      "Exportação BDGD (ANEEL)",
    ],
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    subtitle: "Para concessionárias e integradores",
    cta: "Falar com especialista",
    ctaLink: "#contato",
    highlight: false,
    features: [
      "SSO, SCIM e governança avançada",
      "SLA contratual com penalidades",
      "Ambiente isolado (VPC dedicada)",
      "Onboarding técnico e treinamento",
      "Roadmap compartilhado e CAB",
      "Compliance LGPD + ANEEL + ICP-Brasil",
    ],
  },
];

const FAQ = [
  {
    q: "O plano Freemium tem prazo de expiração?",
    a: "Não. O plano Freemium é permanente e ideal para validar o fluxo, treinamento interno e projetos pequenos.",
  },
  {
    q: "Como funciona a migração do Freemium para o Pro?",
    a: "A mudança de plano preserva todos os projetos e histórico. A diferença é o desbloqueio dos recursos avançados — sem perda de dados.",
  },
  {
    q: "Os dados ficam armazenados no Brasil?",
    a: "Sim. Todos os dados são processados e armazenados exclusivamente em infraestrutura localizada no Brasil, em conformidade com a LGPD.",
  },
  {
    q: "O sisTOPOGRAFIA exporta no formato BDGD da ANEEL?",
    a: "Sim, no plano Pro e Enterprise. O módulo de exportação nativo valida e gera o formato BDGD com dossiê de proveniência técnica.",
  },
  {
    q: "Existe suporte a implantação on-premise?",
    a: "Sim, no plano Enterprise. Oferecemos suporte a implantação on-premise ou híbrida para clientes com restrições de nuvem.",
  },
];

// ─── Componentes auxiliares ───────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md transition-colors hover:border-white/15">
      <button
        className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-slate-200 transition-colors hover:text-slate-50"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{q}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-cyan-400" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
        )}
      </button>
      {open && (
        <div className="border-t border-white/10 px-5 pb-5 pt-3 text-sm leading-relaxed text-slate-400">
          {a}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────

export default function LandingPage() {
  const {
    configured,
    loading,
    mode,
    user,
    access,
    error,
    message,
    awaitingEmailConfirmation,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithMicrosoft,
  } = useAuth();
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    try {
      if (authMode === "signup") {
        await signUpWithEmail({ email, password, fullName });
      } else {
        await signInWithEmail({ email, password });
      }
    } catch (submitError) {
      setFormError(
        submitError instanceof Error
          ? submitError.message
          : "Falha ao autenticar.",
      );
    }
  }

  async function handleSocialLogin(provider: "google" | "microsoft") {
    setFormError(null);
    try {
      if (provider === "google") {
        await signInWithGoogle();
      } else {
        await signInWithMicrosoft();
      }
    } catch (socialError) {
      setFormError(
        socialError instanceof Error
          ? socialError.message
          : "Falha no login social.",
      );
    }
  }

  return (
    <div
      data-theme="dark"
      className="min-h-screen bg-[#071524] font-sans text-slate-100"
    >
      {/* ── Atmosfera ── */}
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <span
          className="absolute -left-48 -top-48 h-[640px] w-[640px] rounded-full blur-[100px] opacity-20"
          style={{
            background: "radial-gradient(circle, #0ea5c6 0%, transparent 70%)",
          }}
        />
        <span
          className="absolute -bottom-48 right-0 h-[540px] w-[540px] rounded-full blur-[100px] opacity-[0.14]"
          style={{
            background: "radial-gradient(circle, #6366f1 0%, transparent 70%)",
          }}
        />
        <span
          className="absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 rounded-full blur-[80px] opacity-[0.09]"
          style={{
            background: "radial-gradient(circle, #38bdf8 0%, transparent 70%)",
          }}
        />
        <span
          className="absolute bottom-1/4 left-1/4 h-[300px] w-[300px] rounded-full blur-[60px] opacity-[0.06]"
          style={{
            background: "radial-gradient(circle, #f58220 0%, transparent 70%)",
          }}
        />
      </div>

      {/* ── Header ── */}
      <header className="glass-premium relative z-40 border-b border-white/10 bg-[#071524]/60 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-6">
          <Link
            to="/"
            className="flex items-center gap-2.5"
            aria-label="Página inicial"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-slate-900 p-1 shadow-md shadow-cyan-500/20">
              <img
                src="/branding/logo_sisrua_optimized.png"
                className="h-6 w-6 object-contain"
                alt="sisTOPOGRAFIA"
              />
            </span>
            <span className="font-display text-sm font-bold tracking-tight">
              sis<span className="text-cyan-400">TOPOGRAFIA</span>
            </span>
            <span className="hidden rounded-md border border-cyan-400/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-black tracking-[0.15em] text-cyan-300 sm:inline">
              SaaS
            </span>
          </Link>
          <nav
            className="hidden items-center gap-6 md:flex"
            aria-label="Links do header"
          >
            <a
              href="#features"
              className="text-sm text-slate-400 transition-colors hover:text-slate-100"
            >
              Funcionalidades
            </a>
            <a
              href="#planos"
              className="text-sm text-slate-400 transition-colors hover:text-slate-100"
            >
              Planos
            </a>
            <a
              href="#faq"
              className="text-sm text-slate-400 transition-colors hover:text-slate-100"
            >
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <a
              href="#acesso"
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-white/5 hover:text-slate-100"
            >
              Entrar
            </a>
            <a
              href="#acesso"
              className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-md shadow-cyan-500/30 transition-all hover:bg-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              Começar grátis
            </a>
          </div>
        </div>
      </header>

      <div className="relative z-10">
        {/* ── Hero ── */}
        <section className="mx-auto max-w-screen-xl px-6 pb-24 pt-20 text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-cyan-300">
            <Sparkles className="h-3.5 w-3.5" />
            Plataforma enterprise de geoprocessamento
          </span>
          <h1 className="font-display mx-auto max-w-3xl text-4xl font-black leading-tight tracking-tight text-slate-50 sm:text-5xl lg:text-6xl">
            Projetos de rede elétrica{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-sky-400 bg-clip-text text-transparent">
              com precisão topográfica
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
            sisTOPOGRAFIA extrai dados OSM, gera DXF 2.5D com BIM light e
            exporta para BDGD/ANEEL — tudo em um SaaS enterprise multi-tenant
            com SLA contratual e compliance LGPD nativo.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              to={
                mode === "authenticated" && !awaitingEmailConfirmation
                  ? "/app"
                  : "/"
              }
              onClick={(event) => {
                if (mode !== "authenticated" || awaitingEmailConfirmation) {
                  event.preventDefault();
                  document
                    .getElementById("acesso")
                    ?.scrollIntoView({ behavior: "smooth" });
                }
              }}
              className="flex items-center gap-2 rounded-xl bg-cyan-500 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/25 transition-all hover:bg-cyan-400 hover:shadow-cyan-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              {mode === "authenticated" && !awaitingEmailConfirmation
                ? "Abrir plataforma"
                : "Cadastrar email corporativo"}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#contato"
              className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-300 backdrop-blur transition-all hover:border-white/25 hover:bg-white/10 hover:text-slate-100"
            >
              Falar com especialista
            </a>
          </div>
          {/* Social proof */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-slate-400">
            {[
              "Compliance LGPD nativo",
              "Dados armazenados no Brasil",
              "Exportação BDGD/ANEEL",
              "SLA contratual disponível",
            ].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-emerald-400" />
                {item}
              </span>
            ))}
          </div>
        </section>

        <section id="acesso" className="border-t border-white/5 px-6 py-20">
          <div className="mx-auto grid max-w-screen-xl gap-8 lg:grid-cols-[1fr_420px] lg:items-start">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                <Mail className="h-3.5 w-3.5" />
                Autoatendimento IM3 liberado
              </span>
              <h2 className="font-display mt-4 text-3xl font-black tracking-tight text-slate-50">
                Usuários {`@${allowedCorporateDomain}`} entram só com cadastro e
                confirmação de email.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
                O fluxo aceita alias como{" "}
                <span className="font-semibold text-slate-200">
                  nome+obra@{allowedCorporateDomain}
                </span>
                . O acesso é liberado após a confirmação do email enviada pelo
                Supabase, garantindo que o domínio corporativo é real e
                controlado.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-400">
                    Regra aplicada
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    Cadastro livre para aliases do domínio IM3 com onboarding
                    automático no backend.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-400">
                    Garantia operacional
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    Enquanto o email não for confirmado, o backend mantém o
                    acesso pendente.
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#071524]/80 p-6 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl">
              <div className="mb-5 flex rounded-2xl border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setAuthMode("signup")}
                  className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    authMode === "signup"
                      ? "bg-cyan-500 text-slate-950"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Cadastro IM3
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("login")}
                  className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    authMode === "login"
                      ? "bg-cyan-500 text-slate-950"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Entrar
                </button>
              </div>

              <form className="space-y-4" onSubmit={handleAuthSubmit}>
                {/* Social login buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={loading || !configured}
                    onClick={() => {
                      void handleSocialLogin("google");
                    }}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Entrar com Google"
                  >
                    {/* Google "G" icon via SVG */}
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 shrink-0"
                      aria-hidden="true"
                    >
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Google
                  </button>
                  <button
                    type="button"
                    disabled={loading || !configured}
                    onClick={() => {
                      void handleSocialLogin("microsoft");
                    }}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Entrar com Microsoft"
                  >
                    {/* Microsoft logo via SVG */}
                    <svg
                      viewBox="0 0 23 23"
                      className="h-4 w-4 shrink-0"
                      aria-hidden="true"
                    >
                      <rect x="1" y="1" width="10" height="10" fill="#F35325" />
                      <rect
                        x="12"
                        y="1"
                        width="10"
                        height="10"
                        fill="#81BC06"
                      />
                      <rect
                        x="1"
                        y="12"
                        width="10"
                        height="10"
                        fill="#05A6F0"
                      />
                      <rect
                        x="12"
                        y="12"
                        width="10"
                        height="10"
                        fill="#FFBA08"
                      />
                    </svg>
                    Microsoft
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-white/10" />
                  <span className="text-xs text-slate-500">ou com email</span>
                  <span className="h-px flex-1 bg-white/10" />
                </div>
                {authMode === "signup" && (
                  <label className="block">
                    <span className="mb-1 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Nome
                    </span>
                    <input
                      name="fullName"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Nome completo"
                      autoComplete="name"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-indigo-400"
                    />
                  </label>
                )}

                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Email corporativo
                  </span>
                  <input
                    name="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={`voce+alias@${allowedCorporateDomain}`}
                    autoComplete="email"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-indigo-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Senha
                  </span>
                  {authMode === "signup" ? (
                    <input
                      name="password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Mínimo recomendado: 10 caracteres"
                      autoComplete="new-password"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-indigo-400"
                    />
                  ) : (
                    <input
                      name="password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Sua senha"
                      autoComplete="current-password"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-indigo-400"
                    />
                  )}
                </label>

                <button
                  type="submit"
                  disabled={loading || !configured}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Lock className="h-4 w-4" />
                  {loading
                    ? "Processando..."
                    : authMode === "signup"
                      ? "Cadastrar e confirmar email"
                      : "Entrar com email"}
                </button>
              </form>

              <div className="mt-4 space-y-3 text-sm">
                {message && (
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-emerald-200">
                    {message}
                  </div>
                )}
                {(formError || error) && (
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-rose-200">
                    {formError || error}
                  </div>
                )}
                {!configured && (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-amber-100">
                    Defina{" "}
                    <span className="font-semibold">VITE_SUPABASE_URL</span> e{" "}
                    <span className="font-semibold">
                      VITE_SUPABASE_ANON_KEY
                    </span>{" "}
                    para habilitar o cadastro real.
                  </div>
                )}
                {mode === "authenticated" &&
                  user &&
                  !awaitingEmailConfirmation && (
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-cyan-100">
                      Sessão ativa para{" "}
                      <span className="font-semibold">{user.email}</span>
                      {access ? ` com papel ${access.role}.` : "."}
                      <div className="mt-2">
                        <Link
                          to="/app"
                          className="font-semibold text-white underline underline-offset-4"
                        >
                          Abrir plataforma
                        </Link>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="border-t border-white/5 px-6 py-20">
          <div className="mx-auto max-w-screen-xl">
            <div className="mb-12 text-center">
              <span className="mb-3 inline-block text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
                Plataforma
              </span>
              <h2 className="font-display text-3xl font-black tracking-tight text-slate-50">
                Funcionalidades enterprise
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-slate-400">
                Construído para concessionárias, construtoras e integradores de
                infraestrutura elétrica.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-cyan-500/20 hover:bg-white/10"
                >
                  <span
                    className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-${f.color}-500/15`}
                  >
                    <f.icon className={`h-5 w-5 text-${f.color}-400`} />
                  </span>
                  <h3 className="mb-2 text-sm font-bold text-slate-100">
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-400">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Planos ── */}
        <section id="planos" className="border-t border-white/5 px-6 py-20">
          <div className="mx-auto max-w-screen-xl">
            <div className="mb-12 text-center">
              <span className="mb-3 inline-block text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
                Preços
              </span>
              <h2 className="font-display text-3xl font-black tracking-tight text-slate-50">
                Planos e preços
              </h2>
              <p className="mt-3 text-slate-400">
                Escolha o plano ideal para seu volume de projetos.
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-2xl border p-8 backdrop-blur-md ${
                    plan.highlight
                      ? "border-cyan-400/30 bg-cyan-950/20 shadow-xl shadow-cyan-500/10"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-cyan-500 px-4 py-1 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-500/30">
                      Mais popular
                    </span>
                  )}
                  <div className="mb-6">
                    <h3 className="font-display text-lg font-bold text-slate-100">
                      {plan.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">
                      {plan.subtitle}
                    </p>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-3xl font-black text-slate-50">
                        {plan.price}
                      </span>
                      {plan.period && (
                        <span className="text-sm text-slate-400">
                          {plan.period}
                        </span>
                      )}
                    </div>
                  </div>
                  <ul className="mb-8 flex flex-col gap-3">
                    {plan.features.map((feat) => (
                      <li
                        key={feat}
                        className="flex items-start gap-2 text-sm text-slate-300"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto">
                    <Link
                      to={plan.ctaLink}
                      className={`block w-full rounded-xl px-4 py-3 text-center text-sm font-bold transition-all ${
                        plan.highlight
                          ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30 hover:bg-cyan-400"
                          : "border border-white/15 text-slate-300 hover:border-white/30 hover:text-slate-100"
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="border-t border-white/5 px-6 py-20">
          <div className="mx-auto max-w-2xl">
            <div className="mb-10 text-center">
              <span className="mb-3 inline-block text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
                FAQ
              </span>
              <h2 className="font-display text-3xl font-black tracking-tight text-slate-50">
                Perguntas frequentes
              </h2>
            </div>
            <div className="flex flex-col gap-3">
              {FAQ.map((item) => (
                <FaqItem key={item.q} {...item} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Contato ── */}
        <section id="contato" className="border-t border-white/5 px-6 py-20">
          <div className="mx-auto max-w-xl text-center">
            <span className="mb-3 inline-block text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
              Contato
            </span>
            <h2 className="font-display text-3xl font-black tracking-tight text-slate-50">
              Fale com nossa equipe
            </h2>
            <p className="mt-3 text-slate-400">
              Para planos Enterprise, demonstrações técnicas ou perguntas sobre
              compliance.
            </p>
            <a
              href="mailto:contato@sistopografia.com.br"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-6 py-3 text-sm font-bold text-slate-950 shadow-md shadow-cyan-500/30 transition-all hover:bg-cyan-400"
            >
              <Globe className="h-4 w-4" />
              contato@sistopografia.com.br
            </a>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-white/5 bg-[#071524]/80 px-6 py-10">
          <div className="mx-auto flex max-w-screen-xl flex-col items-center gap-6 md:flex-row md:justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-slate-900 p-1">
                <img
                  src="/branding/logo_sisrua_optimized.png"
                  className="h-5 w-5 object-contain"
                  alt=""
                />
              </span>
              <span className="font-display text-sm font-bold tracking-tight text-slate-300">
                sis<span className="text-cyan-400">TOPOGRAFIA</span>
              </span>
            </div>
            <div className="flex items-center gap-5">
              <img
                src="/branding/logo_im3.png"
                className="h-4 w-auto opacity-40 grayscale transition hover:opacity-70 hover:grayscale-0"
                alt="IM3"
              />
              <span className="text-[8px] font-black text-slate-700">×</span>
              <img
                src="/branding/logo_light_sa.gif"
                className="h-4 w-auto opacity-40 grayscale transition hover:opacity-70 hover:grayscale-0"
                alt="Light S.A."
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <Link
                to="/ajuda"
                className="transition-colors hover:text-slate-400"
              >
                Central de Ajuda
              </Link>
              <Link
                to="/status"
                className="transition-colors hover:text-slate-400"
              >
                Status
              </Link>
              <span>
                © {new Date().getFullYear()} IM3 Brasil · Todos os direitos
                reservados
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
