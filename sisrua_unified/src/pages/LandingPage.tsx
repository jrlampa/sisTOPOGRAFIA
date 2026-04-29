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
  Map,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

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
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur">
      <button
        className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-slate-100"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{q}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-indigo-400" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        )}
      </button>
      {open && (
        <div className="border-t border-white/10 px-5 pb-4 pt-3 text-sm text-slate-400 leading-relaxed">
          {a}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100">
      {/* ── Atmosfera ── */}
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <span
          className="absolute -left-48 -top-48 h-[600px] w-[600px] rounded-full opacity-[0.15]"
          style={{
            background: "radial-gradient(circle, #6366f1 0%, transparent 70%)",
          }}
        />
        <span
          className="absolute -bottom-48 right-0 h-[500px] w-[500px] rounded-full opacity-[0.12]"
          style={{
            background: "radial-gradient(circle, #06b6d4 0%, transparent 70%)",
          }}
        />
        <span
          className="absolute left-1/2 top-1/3 h-[400px] w-[400px] -translate-x-1/2 rounded-full opacity-[0.07]"
          style={{
            background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)",
          }}
        />
      </div>

      {/* ── Header ── */}
      <header className="relative z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-6">
          <Link
            to="/"
            className="flex items-center gap-2"
            aria-label="Página inicial"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 shadow-md shadow-indigo-500/30">
              <Map className="h-4 w-4 text-white" />
            </span>
            <span className="text-sm font-bold">
              sis<span className="text-indigo-400">TOPOGRAFIA</span>
            </span>
            <span className="rounded bg-indigo-600/20 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-indigo-400">
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
            <Link
              to="/dashboard"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-slate-100"
            >
              Entrar
            </Link>
            <Link
              to="/app"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 transition-all hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
            >
              Começar grátis
            </Link>
          </div>
        </div>
      </header>

      <div className="relative z-10">
        {/* ── Hero ── */}
        <section className="mx-auto max-w-screen-xl px-6 pb-24 pt-20 text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-400">
            <Sparkles className="h-3.5 w-3.5" />
            Plataforma enterprise de geoprocessamento
          </span>
          <h1 className="mx-auto max-w-3xl text-4xl font-black leading-tight tracking-tight text-slate-50 sm:text-5xl lg:text-6xl">
            Projetos de rede elétrica{" "}
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
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
              to="/app"
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-500 hover:shadow-indigo-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
            >
              Acessar plataforma
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#contato"
              className="flex items-center gap-2 rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-slate-300 backdrop-blur transition-all hover:border-white/30 hover:text-slate-100"
            >
              Falar com especialista
            </a>
          </div>
          {/* Social proof */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4 text-emerald-500" /> Compliance
              LGPD nativo
            </span>
            <span className="flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4 text-emerald-500" /> Dados
              armazenados no Brasil
            </span>
            <span className="flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4 text-emerald-500" /> Exportação
              BDGD/ANEEL
            </span>
            <span className="flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4 text-emerald-500" /> SLA contratual
              disponível
            </span>
          </div>
        </section>

        {/* ── Features ── */}
        <section
          id="features"
          className="border-t border-white/5 bg-slate-900/40 px-6 py-20"
        >
          <div className="mx-auto max-w-screen-xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-black text-slate-50">
                Funcionalidades enterprise
              </h2>
              <p className="mt-3 text-slate-400">
                Construído para concessionárias, construtoras e integradores de
                infraestrutura elétrica.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition-all hover:border-indigo-500/30 hover:bg-white/10"
                >
                  <span
                    className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-${f.color}-500/15`}
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
        <section id="planos" className="px-6 py-20">
          <div className="mx-auto max-w-screen-xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-black text-slate-50">
                Planos e preços
              </h2>
              <p className="mt-3 text-slate-400">
                Escolha o plano ideal para seu volume de projetos.
              </p>
            </div>
            <div className="grid gap-8 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-2xl border p-8 ${
                    plan.highlight
                      ? "border-indigo-500/60 bg-indigo-950/40 shadow-xl shadow-indigo-500/10"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-4 py-1 text-xs font-bold text-white shadow-lg shadow-indigo-500/30">
                      Mais popular
                    </span>
                  )}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-slate-100">
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
                      className={`block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold transition-all ${
                        plan.highlight
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30 hover:bg-indigo-500"
                          : "border border-white/20 text-slate-300 hover:border-white/40 hover:text-slate-100"
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
        <section
          id="faq"
          className="border-t border-white/5 bg-slate-900/40 px-6 py-20"
        >
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-10 text-center text-3xl font-black text-slate-50">
              Perguntas frequentes
            </h2>
            <div className="flex flex-col gap-3">
              {FAQ.map((item) => (
                <FaqItem key={item.q} {...item} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Contato ── */}
        <section id="contato" className="px-6 py-20">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-3xl font-black text-slate-50">
              Fale com nossa equipe
            </h2>
            <p className="mt-3 text-slate-400">
              Para planos Enterprise, demonstrações técnicas ou perguntas sobre
              compliance.
            </p>
            <a
              href="mailto:contato@sistopografia.com.br"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 transition-all hover:bg-indigo-500"
            >
              <Globe className="h-4 w-4" />
              contato@sistopografia.com.br
            </a>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-white/10 bg-slate-950 px-6 py-10">
          <div className="mx-auto flex max-w-screen-xl flex-col items-center justify-between gap-4 sm:flex-row">
            <span className="text-xs text-slate-400">
              © {new Date().getFullYear()} sisTOPOGRAFIA · SaaS enterprise de
              geoprocessamento
            </span>
            <div className="flex items-center gap-4 text-xs text-slate-400">
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
              <span>CNPJ: informar</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
