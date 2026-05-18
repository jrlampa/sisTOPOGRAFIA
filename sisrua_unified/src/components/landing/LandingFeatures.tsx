import React from "react";
import { 
  Map, 
  FileDown, 
  Building2, 
  ShieldCheck, 
  Zap, 
  BarChart3 
} from "lucide-react";
import { FEATURES } from "./LandingData";

const ICON_MAP: Record<string, any> = {
  Map,
  FileDown,
  Building2,
  ShieldCheck,
  Zap,
  BarChart3
};

export function LandingFeatures() {
  return (
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
          {FEATURES.map((f) => {
            const Icon = ICON_MAP[f.icon];
            return (
              <div
                key={f.title}
                className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-cyan-500/20 hover:bg-white/10"
              >
                <span
                  className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-${f.color}-500/15`}
                >
                  <Icon className={`h-5 w-5 text-${f.color}-400`} />
                </span>
                <h3 className="mb-2 text-sm font-bold text-slate-100">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-400">
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
