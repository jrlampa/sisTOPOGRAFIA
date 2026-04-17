/**
 * PageShell.tsx — Shell de layout para páginas internas do SaaS.
 *
 * Envolve o conteúdo das páginas autenticadas com:
 *   - AppNavigation no topo
 *   - Fundo com atmosfera glassmorphism
 *   - Área de conteúdo scrollável
 */
import React from "react";
import { AppNavigation } from "./AppNavigation";

interface PageShellProps {
  children: React.ReactNode;
  isDark?: boolean;
  onToggleTheme?: () => void;
  role?: "plataforma" | "cliente" | "viewer";
}

export function PageShell({
  children,
  isDark = false,
  onToggleTheme,
  role = "cliente",
}: PageShellProps) {
  return (
    <div
      className={`min-h-screen font-sans transition-colors duration-300 ${
        isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
      }`}
    >
      {/* Atmosfera de fundo */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <span
          className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }}
        />
        <span
          className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #06b6d4 0%, transparent 70%)" }}
        />
      </div>

      {/* Navegação */}
      <AppNavigation
        isDark={isDark}
        onToggleTheme={onToggleTheme}
        role={role}
      />

      {/* Conteúdo */}
      <main className="relative z-10 mx-auto max-w-screen-2xl px-4 py-8 lg:px-6">
        {children}
      </main>
    </div>
  );
}
