import React from "react";
import { ArrowRight, Sparkles, BadgeCheck } from "lucide-react";
import { Link } from "react-router-dom";

interface LandingHeroProps {
  mode: string;
  awaitingEmailConfirmation: boolean;
}

export function LandingHero({ mode, awaitingEmailConfirmation }: LandingHeroProps) {
  return (
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
          to={mode === "authenticated" && !awaitingEmailConfirmation ? "/app" : "/"}
          onClick={(event) => {
            if (mode !== "authenticated" || awaitingEmailConfirmation) {
              event.preventDefault();
              document.getElementById("acesso")?.scrollIntoView({ behavior: "smooth" });
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
  );
}
