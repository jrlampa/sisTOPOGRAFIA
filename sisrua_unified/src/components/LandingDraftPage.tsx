import React from "react";
import {
  ArrowRight,
  BadgeCheck,
  Compass,
  Cpu,
  Layers,
  LineChart,
  Map,
  Radar,
  Route,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

const CORE_MODULES = [
  {
    icon: Map,
    title: "Leitura territorial viva",
    text: "Consolida malha urbana e contexto tecnico em uma base unica para engenharia de BT e planejamento regulatorio.",
    badge: "BASE CARTOGRAFICA",
    tone: "from-[#fb923c] to-[#f59e0b]",
  },
  {
    icon: Workflow,
    title: "Fluxo guiado por risco",
    text: "Prioriza trechos criticos, organiza seccionamento e reduz retrabalho entre escritorio, campo e operacao.",
    badge: "ORQUESTRACAO",
    tone: "from-[#0ea5e9] to-[#0284c7]",
  },
  {
    icon: Cpu,
    title: "Motor DG acionavel",
    text: "Executa cenarios de particionamento e transforma resultado tecnico em acao operacional com rastreabilidade.",
    badge: "INTELIGENCIA",
    tone: "from-[#14b8a6] to-[#0f766e]",
  },
];

const TIMELINE = [
  {
    step: "01",
    title: "Seleciona area",
    detail:
      "Poligono ou raio com leitura imediata do terreno, malha urbana e contexto de rede.",
  },
  {
    step: "02",
    title: "Executa DG",
    detail:
      "Particoes, condutores e trafos com diagnostico eletrico auditavel por cenario.",
  },
  {
    step: "03",
    title: "Exporta DXF",
    detail:
      "Saida pronta para CAD com ruas, meio-fio e camadas de engenharia padronizadas.",
  },
];

const PLANS = [
  {
    name: "Freemium",
    price: "R$ 0",
    cadence: "uso continuo",
    points: ["1 projeto ativo", "DXF essencial", "Base de aprendizado"],
  },
  {
    name: "Pro Operacional",
    price: "R$ 249",
    cadence: "por mes",
    points: ["Projetos ilimitados", "Motor DG", "Historico e auditoria"],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    cadence: "escala dedicada",
    points: ["SSO e governanca", "SLA contratual", "Ambiente isolado"],
  },
];

export default function LandingDraftPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f7f2e7] text-[#0f172a]">
      <style>
        {`@keyframes riseIn{0%{opacity:0;transform:translateY(22px)}100%{opacity:1;transform:translateY(0)}}
          @keyframes drift{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-10px,0)}}
          .lp-rise{animation:riseIn .8s ease forwards}
          .lp-drift{animation:drift 7s ease-in-out infinite}`}
      </style>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_14%,rgba(14,165,233,.22),transparent_24%),radial-gradient(circle_at_82%_12%,rgba(251,146,60,.25),transparent_30%),radial-gradient(circle_at_48%_92%,rgba(20,184,166,.2),transparent_26%)]" />
        <div className="absolute inset-0 opacity-40 [background:repeating-radial-gradient(circle_at_center,rgba(15,23,42,.08)_0_1px,transparent_1px_18px)]" />
      </div>

      <header className="sticky top-0 z-30 border-b border-[#0f172a]/15 bg-[#f7f2e7]/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="lp-drift rounded-2xl border border-[#0f172a]/15 bg-gradient-to-br from-[#0ea5e9] to-[#f97316] p-2 text-white shadow-[0_12px_28px_rgba(15,23,42,.2)]">
              <Compass size={20} />
            </div>
            <div>
              <p className="font-display text-lg font-black leading-none tracking-tight">
                sisTOPOGRAFIA
              </p>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0f172a]/70">
                plataforma corporativa para engenharia BT
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-2 text-sm font-bold">
            <a
              href="#modulos"
              className="rounded-xl border border-[#0f172a]/15 bg-white/70 px-4 py-2 transition hover:bg-white"
            >
              Modulos
            </a>
            <a
              href="#planos"
              className="rounded-xl border border-[#0f172a]/15 bg-[#0f172a] px-4 py-2 text-white transition hover:bg-[#1e293b]"
            >
              Planos
            </a>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid w-full max-w-7xl gap-10 px-4 pb-12 pt-10 md:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:pb-20 lg:pt-16">
          <div className="lp-rise" style={{ animationDelay: "0.05s" }}>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#0f172a]/20 bg-white/85 px-4 py-1 text-xs font-black uppercase tracking-[0.18em] text-[#0f172a]/80">
              <Sparkles size={14} />
              landing comercial reposicionada para conversao B2B
            </p>
            <h1 className="max-w-3xl font-display text-4xl font-black leading-[0.96] md:text-6xl">
              Planejamento eletrico com
              <span className="block bg-gradient-to-r from-[#0ea5e9] via-[#0f766e] to-[#f97316] bg-clip-text text-transparent">
                leitura urbana real.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#0f172a]/80 md:text-lg">
              Experiencia pensada para decisores tecnicos: contexto territorial,
              motor DG e entrega DXF em uma narrativa unica para campo,
              engenharia e gestao executiva.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <a
                href="#planos"
                className="inline-flex items-center gap-2 rounded-2xl border border-[#0f172a]/15 bg-[#0f172a] px-6 py-3 text-sm font-black uppercase tracking-[0.09em] text-white transition hover:-translate-y-0.5 hover:bg-[#1e293b]"
              >
                iniciar piloto
                <ArrowRight size={16} />
              </a>
              <a
                href="#modulos"
                className="inline-flex items-center gap-2 rounded-2xl border border-[#0f172a]/15 bg-white/80 px-6 py-3 text-sm font-black uppercase tracking-[0.09em] text-[#0f172a] transition hover:bg-white"
              >
                explorar modulos
              </a>
            </div>

            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              <Metric label="ganho em velocidade" value="2.6x" />
              <Metric label="retrabalho evitado" value="-41%" />
              <Metric label="consistencia tecnica" value="99.1%" />
            </div>
          </div>

          <aside
            className="lp-rise rounded-[28px] border border-[#0f172a]/12 bg-white/85 p-6 shadow-[0_24px_54px_rgba(15,23,42,.18)] backdrop-blur"
            style={{ animationDelay: "0.16s" }}
          >
            <div className="rounded-2xl border border-[#0f172a]/10 bg-[#111827] p-4 text-white">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a5f3fc]">
                cockpit operacional
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniKpi icon={Radar} title="area" value="7.3 km2" />
                <MiniKpi icon={Route} title="trechos" value="184" />
                <MiniKpi icon={Layers} title="particoes" value="16" />
                <MiniKpi icon={LineChart} title="cqt max" value="13.8%" />
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#0f172a]/10 bg-[#fff8ed] p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#92400e]">
                diferenciais imediatos
              </p>
              <div className="mt-3 space-y-2 text-sm text-[#1f2937]">
                <p className="flex items-start gap-2">
                  <BadgeCheck size={16} className="mt-0.5 text-[#0f766e]" />
                  ruas e meio-fio no DXF para leitura contextual imediata no CAD
                </p>
                <p className="flex items-start gap-2">
                  <BadgeCheck size={16} className="mt-0.5 text-[#0f766e]" />
                  cenarios DG comparaveis por camada para decisao de engenharia
                </p>
                <p className="flex items-start gap-2">
                  <BadgeCheck size={16} className="mt-0.5 text-[#0f766e]" />
                  narrativa visual pronta para propostas tecnicas e comerciais
                </p>
              </div>
            </div>
          </aside>
        </section>

        <section
          id="modulos"
          className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-10"
        >
          <div
            className="lp-rise mb-6 flex items-end justify-between gap-4"
            style={{ animationDelay: "0.24s" }}
          >
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0f172a]/65">
                arquitetura de valor
              </p>
              <h2 className="font-display text-3xl font-black md:text-4xl">
                Tres blocos para demonstrar valor tecnico sem friccao
              </h2>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {CORE_MODULES.map((item, index) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="lp-rise rounded-3xl border border-[#0f172a]/12 bg-white/90 p-6 shadow-[0_14px_28px_rgba(15,23,42,.14)] transition hover:-translate-y-1"
                  style={{ animationDelay: `${0.3 + index * 0.08}s` }}
                >
                  <div
                    className={`inline-flex rounded-2xl bg-gradient-to-r ${item.tone} p-2 text-white`}
                  >
                    <Icon size={18} />
                  </div>
                  <p className="mt-4 text-[11px] font-black uppercase tracking-[0.2em] text-[#0f172a]/55">
                    {item.badge}
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-black leading-tight">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#0f172a]/78">
                    {item.text}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-12">
          <div className="rounded-[30px] border border-[#0f172a]/10 bg-[#0f172a] p-6 text-white shadow-[0_20px_56px_rgba(15,23,42,.3)] md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#67e8f9]">
              fluxo operacional recomendado
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {TIMELINE.map((phase, index) => (
                <article
                  key={phase.step}
                  className="lp-rise rounded-2xl border border-white/15 bg-white/5 p-4"
                  style={{ animationDelay: `${0.4 + index * 0.08}s` }}
                >
                  <p className="text-xs font-black tracking-[0.18em] text-[#a5f3fc]">
                    ETAPA {phase.step}
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-black">
                    {phase.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-200">{phase.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="planos"
          className="mx-auto w-full max-w-7xl px-4 pb-12 pt-4 md:px-8 md:pb-16"
        >
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0f172a]/65">
                modelo comercial
              </p>
              <h2 className="font-display text-3xl font-black md:text-4xl">
                Freemium para entrada, Pro para recorrencia previsivel
              </h2>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-3xl border p-5 transition hover:-translate-y-1 ${plan.featured ? "border-[#0284c7] bg-[#ecfeff] shadow-[0_16px_32px_rgba(2,132,199,.22)]" : "border-[#0f172a]/10 bg-white/85 shadow-[0_12px_24px_rgba(15,23,42,.12)]"}`}
              >
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f172a]/60">
                  {plan.name}
                </p>
                <p className="mt-3 font-display text-4xl font-black">
                  {plan.price}
                </p>
                <p className="text-sm text-[#0f172a]/70">{plan.cadence}</p>
                <ul className="mt-4 space-y-2 text-sm text-[#0f172a]/75">
                  {plan.points.map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <ShieldCheck
                        size={16}
                        className="mt-0.5 text-[#0f766e]"
                      />
                      {point}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`mt-6 w-full rounded-xl border px-4 py-2 text-sm font-black uppercase tracking-[0.08em] transition ${plan.featured ? "border-[#0284c7] bg-[#0284c7] text-white hover:bg-[#0369a1]" : "border-[#0f172a]/15 bg-white hover:bg-slate-50"}`}
                >
                  escolher {plan.name.toLowerCase()}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 pb-16 md:px-8">
          <div className="rounded-3xl border border-[#0f172a]/12 bg-white/90 p-6 text-[#0f172a] shadow-[0_14px_28px_rgba(15,23,42,.12)] md:flex md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0f172a]/60">
                proximo passo
              </p>
              <h3 className="mt-2 font-display text-2xl font-black">
                Leve sua operacao de rede BT para um padrao corporativo.
              </h3>
            </div>
            <a
              href="#planos"
              className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-[#0f172a]/15 bg-[#0f172a] px-6 py-3 text-sm font-black uppercase tracking-[0.09em] text-white transition hover:bg-[#1e293b] md:mt-0"
            >
              solicitar demonstracao
              <ArrowRight size={16} />
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#0f172a]/10 bg-white/80 p-3 shadow-[0_10px_22px_rgba(15,23,42,.12)]">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0f172a]/55">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-black">{value}</p>
    </div>
  );
}

function MiniKpi({
  icon: Icon,
  title,
  value,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="mb-2 inline-flex rounded-md bg-white/10 p-2 text-[#7dd3fc]">
        <Icon size={15} />
      </div>
      <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
        {title}
      </p>
      <p className="font-display text-xl font-black text-white">{value}</p>
    </div>
  );
}
