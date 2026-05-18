import React from "react";
import { Link } from "react-router-dom";

export function LandingHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#020617]/60 backdrop-blur-2xl transition-all">
      <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-6">
        <Link
          to="/"
          className="flex items-center gap-3 transition-transform hover:scale-105 active:scale-95"
          aria-label="sisTOPOGRAFIA Home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-900 p-1.5 shadow-xl shadow-cyan-500/20">
            <img
              src="/branding/logo_sisrua_optimized.png"
              className="h-full w-full object-contain"
              alt="Logo"
            />
          </span>
          <div className="flex flex-col leading-none">
            <span className="font-display text-sm font-black tracking-tight text-white uppercase italic">
              sis<span className="text-cyan-400">TOPOGRAFIA</span>
            </span>
            <span className="text-[8px] font-black tracking-[0.4em] text-slate-500 uppercase ml-0.5">UNIFIED</span>
          </div>
        </Link>

        <nav
          className="hidden items-center gap-8 md:flex"
          aria-label="Menu principal"
        >
          <a
            href="#features"
            className="text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-cyan-400"
          >
            Módulos
          </a>
          <a
            href="#planos"
            className="text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-cyan-400"
          >
            Plano Enterprise
          </a>
          <a
            href="#faq"
            className="text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-cyan-400"
          >
            Suporte
          </a>
        </nav>

        <div className="flex items-center gap-4">
          <a
            href="#acesso"
            className="text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all hover:text-white"
          >
            Login
          </a>
          <a
            href="#acesso"
            className="rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] text-white shadow-lg shadow-cyan-500/20 transition-all hover:scale-105 active:scale-95 hover:brightness-110"
          >
            Try Free
          </a>
        </div>
      </div>
    </header>
  );
}
