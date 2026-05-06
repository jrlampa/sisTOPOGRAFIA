/**
 * NotFoundPage.tsx — Página 404 do sisTOPOGRAFIA.
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Compass, Home, Map } from "lucide-react";
import { PageShell } from "../components/PageShell";

export default function NotFoundPage() {
  const [isDark, setIsDark] = useState(true);

  return (
    <PageShell isDark={isDark} onToggleTheme={() => setIsDark((v) => !v)}>
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-500/15">
          <Compass className="h-10 w-10 text-indigo-400" />
        </span>
        <h1 className={`text-5xl font-black ${isDark ? "text-slate-50" : "text-slate-900"}`}>
          404
        </h1>
        <p className={`mt-3 text-lg font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
          Página não encontrada
        </p>
        <p className={`mt-2 text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>
          A rota acessada não existe. Verifique o endereço ou navegue pelo menu.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all hover:bg-indigo-500"
          >
            <Home className="h-4 w-4" />
            Início
          </Link>
          <Link
            to="/dashboard"
            className={`flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition-all ${
              isDark
                ? "border-white/15 text-slate-300 hover:border-white/30 hover:text-slate-100"
                : "border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            <Map className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
