import React from "react";
import {
  ArrowRight,
  BadgeCheck,
  Zap,
  Cpu,
  Layers,
  LineChart,
  Map,
  Radar,
  Route,
  ShieldCheck,
  Sparkles,
  Workflow,
  Database,
  Box,
  CheckCircle2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getLandingPageText } from "../i18n/landingPageText";
import { AppLocale } from "../types";
import { normalizeAppLocale, SUPPORTED_APP_LOCALES } from "../i18n/appLocale";

export default function LandingDraftPage() {
  const { i18n } = useTranslation();
  const currentLocale = normalizeAppLocale(i18n.language);
  const t = getLandingPageText(currentLocale);

  const changeLanguage = (lang: AppLocale) => {
    i18n.changeLanguage(lang);
  };

  const CORE_MODULES = [
    {
      icon: Map,
      title: t.module1Title,
      text: t.module1Text,
      badge: t.module1Badge,
      tone: "from-[#fb923c] to-[#f59e0b]",
    },
    {
      icon: Zap,
      title: t.module2Title,
      text: t.module2Text,
      badge: t.module2Badge,
      tone: "from-[#0ea5e9] to-[#0284c7]",
    },
    {
      icon: Database,
      title: t.module3Title,
      text: t.module3Text,
      badge: t.module3Badge,
      tone: "from-[#14b8a6] to-[#0f766e]",
    },
  ];

  const TIMELINE = [
    {
      step: "01",
      title: t.timelineStep1Title,
      detail: t.timelineStep1Detail,
    },
    {
      step: "02",
      title: t.timelineStep2Title,
      detail: t.timelineStep2Detail,
    },
    {
      step: "03",
      title: t.timelineStep3Title,
      detail: t.timelineStep3Detail,
    },
  ];

  const PLANS = [
    {
      name: t.plan1Name,
      price: t.plan1Price,
      cadence: t.plan1Cadence,
      points: t.plan1Points,
    },
    {
      name: t.plan2Name,
      price: t.plan2Price,
      cadence: t.plan2Cadence,
      points: t.plan2Points,
      featured: true,
    },
    {
      name: t.plan3Name,
      price: t.plan3Price,
      cadence: t.plan3Cadence,
      points: t.plan3Points,
    },
  ];

  return (
    <div className="relative min-h-screen overflow-x-hidden app-shell font-sans selection:bg-brand-500/30">
      {/* ── Atmosfera Enterprise ── */}
      <div className="app-shell-atmosphere">
        <div className="app-shell-orb app-shell-orb-1" />
        <div className="app-shell-orb app-shell-orb-2" />
        <div className="app-shell-orb app-shell-orb-3" />
      </div>

      <header className="app-header sticky top-0 z-50 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6 lg:px-10">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-500/20">
              <Zap size={22} className="animate-pulse" />
            </div>
            <div>
              <p className="font-display text-xl font-black leading-none tracking-tight text-app-title">
                sis<span className="text-brand-600">TOPOGRAFIA</span>
              </p>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-app-subtle/80">
                {t.headerSub}
              </p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            <div className="flex items-center gap-1 rounded-full bg-white/10 p-1 border border-white/5">
              {SUPPORTED_APP_LOCALES.map((lang) => (
                <button
                  key={lang}
                  onClick={() => changeLanguage(lang)}
                  className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full transition-all ${
                    currentLocale === lang
                      ? "bg-brand-600 text-white shadow-sm"
                      : "text-app-subtle/60 hover:text-app-subtle hover:bg-white/5"
                  }`}
                >
                  {lang.split("-")[0]}
                </button>
              ))}
            </div>

            <a
              href="#modulos"
              className="text-sm font-bold text-app-subtle transition-colors hover:text-brand-600"
            >
              {t.navModules}
            </a>
            <a
              href="#planos"
              className="btn-enterprise flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black uppercase tracking-wider"
            >
              {t.navPlans}
            </a>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-6 pb-20 pt-16 lg:flex-row lg:items-center lg:px-10">
          <div className="flex-1 space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/5 px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-brand-700">
              <Sparkles size={14} className="text-brand-500" />
              {t.heroBadge}
            </div>
            <h1 className="max-w-3xl font-display text-4xl font-black leading-[1.1] text-app-title md:text-6xl lg:text-7xl">
              {t.heroTitle}
              <span className="mt-2 block bg-gradient-to-r from-brand-600 via-brand-500 to-cyan-500 bg-clip-text text-transparent">
                {t.heroTitleHighlight}
              </span>
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-app-subtle md:text-xl">
              {t.heroDesc}
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              <a
                href="/app"
                className="btn-enterprise flex items-center gap-3 rounded-2xl bg-brand-600 px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-brand-500/25 hover:bg-brand-700"
              >
                {t.btnPilot}
                <ArrowRight size={18} />
              </a>
              <a
                href="#modulos"
                className="btn-enterprise flex items-center gap-3 rounded-2xl px-8 py-4 text-sm font-black uppercase tracking-widest text-app-title"
              >
                {t.btnExplore}
              </a>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Metric label={t.metricSpeed} value="2.6x" />
              <Metric label={t.metricRework} value="-41%" />
              <Metric label={t.metricConsistency} value="99.1%" />
            </div>
          </div>

          <aside className="lg:w-[420px]">
            <div className="glass-panel overflow-hidden rounded-[2.5rem] p-2 shadow-2xl">
              <div className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-inner relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-cyan-500/20 transition-all duration-700" />
                
                <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-400">
                    {t.cockpitTitle}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-cyan-500/60 uppercase tracking-tighter">Live Engineering</span>
                    <div className="h-2 w-2 animate-pulse rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <MiniKpi icon={Radar} title={t.miniKpiArea} value="7.3 km²" />
                  <MiniKpi icon={Route} title={t.miniKpiEdges} value="184" />
                  <MiniKpi icon={Layers} title={t.miniKpiPartitions} value="16" />
                  <MiniKpi icon={LineChart} title={t.miniKpiCqt} value="13.8%" />
                </div>
              </div>

              <div className="mt-2 rounded-[2rem] bg-white/40 p-6 backdrop-blur-md">
                <p className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-brand-700">
                  {t.diffTitle}
                </p>
                <div className="space-y-4 text-sm font-medium text-app-subtle">
                  {[t.diffPoint1, t.diffPoint2, t.diffPoint3].map((text, i) => (
                    <p key={i} className="flex items-start gap-3">
                      <BadgeCheck
                        size={18}
                        className="mt-0.5 shrink-0 text-emerald-600"
                      />
                      <span>{text}</span>
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section
          id="modulos"
          className="mx-auto w-full max-w-7xl px-6 py-20 lg:px-10"
        >
          <div className="mb-12">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-600">
              {t.archTitleBadge}
            </p>
            <h2 className="mt-4 font-display text-3xl font-black text-app-title md:text-5xl">
              {t.archTitle}
            </h2>
          </div>
          <div className="grid gap-8 lg:grid-cols-3">
            {CORE_MODULES.map((item, _index) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="glass-panel glass-panel-hover group rounded-[2rem] p-8"
                >
                  <div
                    className={`inline-flex rounded-2xl bg-gradient-to-r ${item.tone} p-3 text-white shadow-lg`}
                  >
                    <Icon size={24} />
                  </div>
                  <p className="mt-8 text-[11px] font-black uppercase tracking-[0.2em] text-app-subtle/60">
                    {item.badge}
                  </p>
                  <h3 className="mt-3 font-display text-2xl font-black leading-tight text-app-title">
                    {item.title}
                  </h3>
                  <p className="mt-4 text-base leading-relaxed text-app-subtle/80">
                    {item.text}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── Nova Seção: Metadados BIM & Conformidade ── */}
        <section className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="glass-panel rounded-[2.5rem] p-8 lg:p-12 flex flex-col justify-center">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg">
                <Box size={24} />
              </div>
              <h2 className="font-display text-3xl font-black text-app-title md:text-4xl">
                Half-way BIM: <br/>
                <span className="text-brand-600 text-2xl md:text-3xl">Inteligência de Ativos</span>
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-app-subtle">
                Cada elemento exportado carrega o DNA da rede. Do esforço nominal do poste à impedância do condutor, garantimos que o DXF seja o ponto de partida para um gêmeo digital real.
              </p>
              <div className="mt-10 space-y-4">
                <div className="flex items-center gap-4 text-sm font-bold text-app-title">
                  <CheckCircle2 size={20} className="text-emerald-500" />
                  <span>Atributos ANEEL nativos em cada layer</span>
                </div>
                <div className="flex items-center gap-4 text-sm font-bold text-app-title">
                  <CheckCircle2 size={20} className="text-emerald-500" />
                  <span>Sincronização com normas de concessionárias</span>
                </div>
                <div className="flex items-center gap-4 text-sm font-bold text-app-title">
                  <CheckCircle2 size={20} className="text-emerald-500" />
                  <span>Rastreabilidade total de modificações</span>
                </div>
              </div>
            </div>
            
            <div className="glass-premium rounded-[2.5rem] p-8 lg:p-12 bg-gradient-to-br from-slate-900 to-slate-950 text-white flex flex-col items-center justify-center text-center">
              <div className="relative mb-8 h-48 w-48 flex items-center justify-center">
                <div className="absolute inset-0 border-[1px] border-cyan-500/20 rounded-full animate-[spin_10s_linear_infinite]" />
                <div className="absolute inset-4 border-[1px] border-cyan-500/40 rounded-full animate-[spin_6s_linear_infinite_reverse]" />
                <div className="absolute inset-8 border-[1px] border-cyan-500/60 rounded-full animate-[spin_4s_linear_infinite]" />
                <Cpu size={64} className="text-cyan-400" />
              </div>
              <h3 className="font-display text-2xl font-black">Motor DG Certificado</h3>
              <p className="mt-4 text-sm text-slate-400 max-w-xs">
                Algoritmos de particionamento e cálculo elétrico validados por suítes de teste de regressão exaustivas.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-4 w-full">
                <div className="rounded-2xl bg-white/5 p-4 border border-white/10">
                  <p className="text-[20px] font-black text-cyan-400">99.8%</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500">Acurácia Elétrica</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4 border border-white/10">
                  <p className="text-[20px] font-black text-cyan-400">SOC2</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500">Readiness</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-10">
          <div className="glass-premium rounded-[3rem] p-8 text-white lg:p-12 glass-overlay overflow-hidden">
            <div className="relative z-10">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                {t.timelineBadge}
              </p>
              <div className="mt-10 grid gap-8 md:grid-cols-3">
                {TIMELINE.map((phase) => (
                  <article
                    key={phase.step}
                    className="group relative rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all hover:bg-white/10"
                  >
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-cyan-400">
                      <span className="font-display text-lg font-black">{phase.step}</span>
                    </div>
                    <h3 className="font-display text-2xl font-black text-white">
                      {phase.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-300">
                      {phase.detail}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="planos" className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-10">
          <div className="mb-16 text-center lg:text-left">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-600">
              {t.plansBadge}
            </p>
            <h2 className="mt-4 font-display text-3xl font-black text-app-title md:text-5xl">
              {t.plansTitle}
            </h2>
          </div>
          <div className="grid gap-8 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <article
                key={plan.name}
                className={`glass-panel glass-panel-hover flex flex-col rounded-[2.5rem] p-8 ${
                  plan.featured ? "border-brand-500/50 ring-2 ring-brand-500/20" : ""
                }`}
              >
                <div className="mb-8">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-app-subtle/60">
                    {plan.name}
                  </p>
                  <p className="mt-4 font-display text-5xl font-black text-app-title">
                    {plan.price}
                  </p>
                  <p className="mt-2 text-sm font-bold text-brand-600 uppercase tracking-widest">
                    {plan.cadence}
                  </p>
                </div>
                <ul className="mb-10 flex flex-grow flex-col gap-4">
                  {plan.points.map((point) => (
                    <li key={point} className="flex items-start gap-3 text-sm font-medium text-app-subtle">
                      <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand-500" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`btn-enterprise w-full rounded-2xl py-4 text-sm font-black uppercase tracking-widest transition-all ${
                    plan.featured
                      ? "bg-brand-600 text-white hover:bg-brand-700"
                      : "text-app-title hover:bg-white/40"
                  }`}
                >
                  {t.btnSelectPlan(plan.name)}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-6 pb-24 lg:px-10">
          <div className="glass-premium flex flex-col items-center justify-between gap-8 rounded-[3rem] p-8 text-center md:flex-row md:p-12 md:text-left">
            <div className="max-w-xl">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                {t.ctaTitleBadge}
              </p>
              <h3 className="mt-4 font-display text-3xl font-black text-white md:text-4xl">
                {t.ctaTitle}
              </h3>
            </div>
            <a
              href="#planos"
              className="btn-enterprise flex items-center gap-3 rounded-2xl bg-white px-10 py-5 text-sm font-black uppercase tracking-widest text-brand-950 transition-transform hover:scale-105"
            >
              {t.btnDemo}
              <ArrowRight size={20} />
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-brand-500/10 bg-white/20 py-12 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row lg:px-10">
          <p className="text-xs font-bold text-app-subtle/60 uppercase tracking-widest">
            {t.footerRights}
          </p>
          <div className="flex gap-8">
            <a href="#" className="text-xs font-black uppercase tracking-widest text-app-subtle transition-colors hover:text-brand-600">
              {t.footerLinks.privacy}
            </a>
            <a href="#" className="text-xs font-black uppercase tracking-widest text-app-subtle transition-colors hover:text-brand-600">
              {t.footerLinks.terms}
            </a>
            <a href="#" className="text-xs font-black uppercase tracking-widest text-app-subtle transition-colors hover:text-brand-600">
              {t.footerLinks.support}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel glass-panel-hover rounded-2xl p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-app-subtle/50">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-black text-app-title">{value}</p>
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
    <div className="rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:bg-white/10">
      <div className="mb-3 inline-flex rounded-xl bg-cyan-500/10 p-2 text-cyan-400">
        <Icon size={18} />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
        {title}
      </p>
      <p className="mt-1 font-display text-xl font-black text-white tracking-tight">{value}</p>
    </div>
  );
}

