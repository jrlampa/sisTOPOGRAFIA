import React from "react";
import { Link } from "react-router-dom";

export function LandingHeader() {
  return (
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
  );
}
