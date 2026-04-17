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
  React.useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDark ? "dark" : "light",
    );
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <div
      className={`app-shell relative min-h-screen overflow-hidden font-sans transition-colors duration-500 ${
        isDark ? "text-slate-200" : "text-slate-900"
      }`}
    >
      <div className="app-shell-atmosphere" aria-hidden="true">
        <span className="app-shell-orb app-shell-orb-1" />
        <span className="app-shell-orb app-shell-orb-2" />
        <span className="app-shell-orb app-shell-orb-3" />
      </div>

      <AppNavigation
        isDark={isDark}
        onToggleTheme={onToggleTheme}
        role={role}
      />

      <main className="relative z-10 mx-auto w-full max-w-screen-2xl px-4 py-8 lg:px-6">
        {children}
      </main>
    </div>
  );
}
