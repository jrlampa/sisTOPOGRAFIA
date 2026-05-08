import React from "react";
import { useAuth } from "../auth/AuthProvider";
import { LandingAtmosphere } from "../components/landing/LandingAtmosphere";
import { LandingHeader } from "../components/landing/LandingHeader";
import { LandingHero } from "../components/landing/LandingHero";
import { LandingAuth } from "../components/landing/LandingAuth";
import { LandingFeatures } from "../components/landing/LandingFeatures";
import { LandingPricing } from "../components/landing/LandingPricing";
import { LandingFaq } from "../components/landing/LandingFaq";
import { LandingFooter } from "../components/landing/LandingFooter";
import { Globe } from "lucide-react";

/**
 * LandingPage.tsx — Página de marketing/produto enterprise do sisTOPOGRAFIA.
 * Modularizada para cumprir os limites de volumetria (Clean Code).
 * Interface 100% pt-BR conforme diretrizes do projeto.
 */
export default function LandingPage() {
  const { mode, awaitingEmailConfirmation } = useAuth();

  return (
    <div data-theme="dark" className="min-h-screen bg-[#071524] font-sans text-slate-100">
      <LandingAtmosphere />
      <LandingHeader />

      <div className="relative z-10">
        <LandingHero mode={mode} awaitingEmailConfirmation={awaitingEmailConfirmation} />
        <LandingAuth />
        <LandingFeatures />
        <LandingPricing />
        <LandingFaq />

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
              Para planos Enterprise, demonstrações técnicas ou perguntas sobre compliance.
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

        <LandingFooter />
      </div>
    </div>
  );
}
