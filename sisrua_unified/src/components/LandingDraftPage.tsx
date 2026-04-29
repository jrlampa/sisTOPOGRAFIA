import React from "react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  Cloud,
  Compass,
  Database,
  MessageCircle,
  Gauge,
  Globe,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

type AuthMode = "login" | "cadastro";

const SOCIAL_OPTIONS = [
  { id: "google", label: "Continuar com Google", icon: Mail },
  { id: "github", label: "Continuar com GitHub", icon: Globe },
  { id: "facebook", label: "Continuar com Facebook", icon: MessageCircle },
];

const PLAN_ITEMS = [
  {
    name: "Freemium",
    price: "R$ 0",
    subtitle: "Para validar a operação",
    cta: "Começar grátis",
    highlight: false,
    features: [
      "1 projeto ativo",
      "Mapa 2.5D com edição essencial",
      "Exportação DXF limitada",
      "Colaboração com 1 usuário",
      "Suporte via base de conhecimento",
    ],
  },
  {
    name: "Pro Operacional",
    price: "R$ 249/mês",
    subtitle: "Para equipes em campo",
    cta: "Testar 14 dias",
    highlight: true,
    features: [
      "Projetos ilimitados",
      "DXF completo e histórico de versões",
      "Painel técnico com métricas de risco",
      "Colaboração com até 10 usuários",
      "Suporte prioritário em horário comercial",
    ],
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    subtitle: "Para concessionárias e integradores",
    cta: "Falar com vendas",
    highlight: false,
    features: [
      "SSO e governança avançada",
      "SLA e suporte dedicado",
      "Ambiente isolado por organização",
      "Treinamento técnico e onboarding",
      "Roadmap compartilhado",
    ],
  },
];

const FAQ_ITEMS = [
  {
    q: "O plano freemium tem prazo?",
    a: "Nao. O plano freemium e permanente e ideal para validar fluxo, treinamento e pequenos projetos.",
  },
  {
    q: "Consigo migrar do freemium para o Pro sem perder dados?",
    a: "Sim. A mudanca de plano preserva projetos e historico; a diferenca e o desbloqueio de recursos avancados.",
  },
  {
    q: "Este frontpage ja esta conectado ao backend?",
    a: "Nao. Esta e uma versao draft de marketing, sem integracao com autenticacao, banco ou servicos externos.",
  },
];

export default function LandingDraftPage() {
  const [authMode, setAuthMode] = React.useState<AuthMode>("login");

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f6efe3] text-slate-900">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-[#f97316]/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
      </div>

      <header className="sticky top-0 z-30 border-b border-amber-900/15 bg-[#f6efe3]/90 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border-2 border-slate-900/20 bg-gradient-to-br from-orange-500 via-amber-500 to-cyan-400 p-2 text-white shadow-[4px_4px_0_rgba(15,23,42,0.3)]">
              <Compass size={20} />
            </div>
            <div>
              <p className="font-display text-lg font-black leading-none tracking-tight">
                sisTOPOGRAFIA Cloud
              </p>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-900/75">
                SaaS para engenharia de rede BT
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="#auth"
              className="rounded-xl border border-slate-900/20 bg-white px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-slate-50"
            >
              Login
            </a>
            <a
              href="#planos"
              className="rounded-xl border border-cyan-800/20 bg-cyan-600 px-4 py-2 text-sm font-black text-white transition hover:bg-cyan-700"
            >
              Ver planos
            </a>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid w-full max-w-7xl gap-8 px-4 pb-12 pt-10 md:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:py-16">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-700/25 bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-900">
              <Sparkles size={14} />
              Draft comercial - sem integracao com backend
            </p>
            <h1 className="font-display text-4xl font-black leading-[1.02] text-slate-950 md:text-5xl xl:text-6xl">
              Projete, valide e entregue redes BT com velocidade de SaaS.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-700 md:text-lg">
              Uma plataforma pensada para equipes tecnicas que precisam sair do
              improviso e operar com previsibilidade: mapa 2.5D, historico,
              produtividade de campo e exportacoes tecnicas em um unico fluxo.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#auth"
                className="inline-flex items-center gap-2 rounded-xl border border-amber-950/15 bg-slate-950 px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:translate-y-[-1px] hover:bg-slate-800"
              >
                Criar conta agora
                <ArrowRight size={16} />
              </a>
              <a
                href="#freemium"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-900/15 bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-slate-900 transition hover:bg-slate-50"
              >
                Entender freemium
              </a>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <MetricCard label="Reducao de retrabalho" value="-37%" />
              <MetricCard label="Tempo de modelagem" value="2.4x" />
              <MetricCard label="Aderencia operacional" value="99.2%" />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-900/15 bg-white/90 p-5 shadow-[10px_10px_0_rgba(15,23,42,0.12)]">
            <div className="rounded-2xl border border-slate-900/10 bg-slate-950 p-4 text-slate-100">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-cyan-200">
                Painel Executivo
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <DashboardTile icon={Gauge} title="Produtividade" value="89" />
                <DashboardTile
                  icon={ShieldCheck}
                  title="Conformidade"
                  value="98"
                />
                <DashboardTile icon={Cloud} title="Jobs DXF" value="142" />
                <DashboardTile icon={Database} title="Projetos" value="318" />
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-amber-900/15 bg-[#fff7ea] p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-900">
                Valor para o cliente
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li className="flex items-center gap-2">
                  <BadgeCheck size={16} className="text-emerald-600" />
                  Menos ruído entre campo, engenharia e gestão.
                </li>
                <li className="flex items-center gap-2">
                  <BadgeCheck size={16} className="text-emerald-600" />
                  Mais rastreabilidade para auditoria e crescimento.
                </li>
                <li className="flex items-center gap-2">
                  <BadgeCheck size={16} className="text-emerald-600" />
                  Operação padronizada desde o plano gratuito.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section
          className="mx-auto w-full max-w-7xl px-4 pb-4 md:px-8"
          id="freemium"
        >
          <div className="rounded-3xl border border-cyan-900/15 bg-gradient-to-r from-cyan-500 to-blue-600 p-6 text-white shadow-[10px_10px_0_rgba(15,23,42,0.2)] md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100">
              Estrategia Freemium clara
            </p>
            <h2 className="mt-2 font-display text-3xl font-black leading-tight md:text-4xl">
              O cliente testa com risco zero e evolui por valor real.
            </h2>
            <p className="mt-3 max-w-3xl text-sm text-cyan-50/95 md:text-base">
              O plano Freemium entrega o necessario para validar uso em campo.
              Quando a equipe precisa de escala, controle e governanca, os
              planos pagos destravam capacidade sem trocar de plataforma.
            </p>
          </div>
        </section>

        <section
          className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8"
          id="planos"
        >
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-900/70">
                Planos e monetizacao
              </p>
              <h2 className="font-display text-3xl font-black text-slate-950 md:text-4xl">
                Estrutura pronta para conversao
              </h2>
            </div>
            <span className="rounded-full border border-slate-900/20 bg-white px-3 py-1 text-xs font-bold text-slate-700">
              Precos ilustrativos no draft
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {PLAN_ITEMS.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-3xl border p-5 shadow-[8px_8px_0_rgba(15,23,42,0.12)] transition hover:translate-y-[-2px] ${
                  plan.highlight
                    ? "border-cyan-600 bg-cyan-50"
                    : "border-slate-900/15 bg-white"
                }`}
              >
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">
                  {plan.name}
                </p>
                <p className="mt-2 font-display text-4xl font-black text-slate-950">
                  {plan.price}
                </p>
                <p className="mt-1 text-sm text-slate-700">{plan.subtitle}</p>
                <button
                  type="button"
                  className={`mt-5 w-full rounded-xl border px-3 py-2 text-sm font-black uppercase tracking-wide ${
                    plan.highlight
                      ? "border-cyan-700 bg-cyan-600 text-white hover:bg-cyan-700"
                      : "border-slate-900/20 bg-slate-100 text-slate-900 hover:bg-slate-200"
                  }`}
                >
                  {plan.cta}
                </button>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-slate-700"
                    >
                      <Check size={15} className="mt-0.5 text-emerald-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section
          className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 md:px-8 lg:grid-cols-[1.1fr_0.9fr]"
          id="auth"
        >
          <div className="rounded-3xl border border-slate-900/15 bg-white p-6 shadow-[8px_8px_0_rgba(15,23,42,0.1)]">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-900/70">
              Onboarding e autenticacao
            </p>
            <h2 className="mt-2 font-display text-3xl font-black text-slate-950">
              Login social + cadastro prontos para integrar
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              Esta area ja antecipa o fluxo comercial real: entrada com redes
              sociais, cadastro por email e mensagens de seguranca para elevar
              confianca desde a primeira visita.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <InfoBadge icon={Lock} text="Protecao de conta e sessao" />
              <InfoBadge icon={Building2} text="Pronto para times e empresas" />
              <InfoBadge icon={Zap} text="Inicio rapido em menos de 2 min" />
              <InfoBadge icon={ShieldCheck} text="Base para compliance LGPD" />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-900/15 bg-slate-950 p-5 text-slate-100 shadow-[10px_10px_0_rgba(15,23,42,0.2)]">
            <div className="mb-4 inline-flex rounded-xl bg-slate-800 p-1 text-xs font-black uppercase tracking-[0.14em]">
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={`rounded-lg px-3 py-2 ${
                  authMode === "login"
                    ? "bg-cyan-500 text-white"
                    : "text-slate-300"
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("cadastro")}
                className={`rounded-lg px-3 py-2 ${
                  authMode === "cadastro"
                    ? "bg-cyan-500 text-white"
                    : "text-slate-300"
                }`}
              >
                Cadastro
              </button>
            </div>

            <p className="mb-3 text-sm font-semibold text-cyan-100">
              {authMode === "login"
                ? "Entre para continuar seus projetos"
                : "Crie sua conta e teste o plano freemium"}
            </p>

            <div className="space-y-2">
              {SOCIAL_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
                  >
                    <Icon size={16} />
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="my-4 h-px bg-slate-700" />

            <form
              className="space-y-3"
              onSubmit={(event) => event.preventDefault()}
            >
              {authMode === "cadastro" && (
                <input
                  type="text"
                  placeholder="Nome completo"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400"
                />
              )}
              <input
                type="email"
                placeholder="E-mail corporativo"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400"
              />
              <input
                type="password"
                placeholder="Senha"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400"
              />
              <button
                type="submit"
                className="w-full rounded-xl border border-cyan-500 bg-cyan-600 px-3 py-2 text-sm font-black uppercase tracking-wide text-white transition hover:bg-cyan-700"
              >
                {authMode === "login" ? "Entrar" : "Criar conta"}
              </button>
            </form>

            <p className="mt-3 text-center text-sm text-slate-400">
              Draft visual sem conexao com API de autenticacao.
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 pb-14 md:px-8">
          <div className="rounded-3xl border border-slate-900/15 bg-white p-6 shadow-[8px_8px_0_rgba(15,23,42,0.1)]">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-900/70">
              FAQ comercial
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {FAQ_ITEMS.map((item) => (
                <article
                  key={item.q}
                  className="rounded-2xl border border-slate-900/10 bg-slate-50 p-4"
                >
                  <h3 className="text-sm font-black text-slate-900">
                    {item.q}
                  </h3>
                  <p className="mt-2 text-sm text-slate-700">{item.a}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-900/10 bg-white/80">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-600 md:flex-row md:items-center md:justify-between md:px-8">
          <span>sisTOPOGRAFIA Cloud - Draft de Landing Page SaaS</span>
          <span>Sem integracao com backend, banco ou autenticacao real</span>
        </div>
      </footer>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-900/10 bg-white p-3 shadow-[4px_4px_0_rgba(15,23,42,0.1)]">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl font-black text-slate-950">
        {value}
      </p>
    </div>
  );
}

function DashboardTile({
  icon: Icon,
  title,
  value,
}: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-slate-400">
          {title}
        </p>
        <Icon size={14} />
      </div>
      <p className="mt-2 font-display text-2xl font-black text-white">
        {value}
      </p>
    </div>
  );
}

function InfoBadge({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-900/10 bg-slate-50 px-3 py-2 text-sm text-slate-700">
      <Icon size={16} className="text-cyan-700" />
      <span>{text}</span>
    </div>
  );
}
