import React from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { PLANS } from "./LandingData";

export function LandingPricing() {
  return (
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
  );
}
