import React from 'react';
import { Link } from 'react-router-dom';

export function LandingFooter() {
  return (
    <footer className="border-t border-white/5 bg-[#071524]/80 px-6 py-10">
      <div className="mx-auto flex max-w-screen-xl flex-col items-center gap-6 md:flex-row md:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-slate-900 p-1">
            <img
              src="/branding/logo_sisrua_optimized.png"
              className="h-5 w-5 object-contain"
              alt=""
            />
          </span>
          <span className="font-display text-sm font-bold tracking-tight text-slate-300">
            sis<span className="text-cyan-400">TOPOGRAFIA</span>
          </span>
        </div>
        <div className="flex items-center gap-5">
          <img
            src="/branding/logo_im3.png"
            className="h-4 w-auto opacity-40 grayscale transition hover:opacity-70 hover:grayscale-0"
            alt="IM3"
          />
          <span className="text-[8px] font-black text-slate-700">×</span>
          <img
            src="/branding/logo_light_sa.gif"
            className="h-4 w-auto opacity-40 grayscale transition hover:opacity-70 hover:grayscale-0"
            alt="Light S.A."
          />
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <Link to="/ajuda" className="transition-colors hover:text-slate-400">
            Central de Ajuda
          </Link>
          <Link to="/status" className="transition-colors hover:text-slate-400">
            Status
          </Link>
          <span>© {new Date().getFullYear()} IM3 Brasil · Todos os direitos reservados</span>
        </div>
      </div>
    </footer>
  );
}
