/**
 * AppNavigation.tsx — Barra de navegação principal do SaaS enterprise.
 *
 * Exibida em todas as páginas autenticadas (Dashboard, Projeto, Admin, etc.).
 * Responsiva, com suporte a modo escuro e indicação de rota ativa.
 */
import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Building2,
  ChevronDown,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Settings,
  Shield,
  ShieldCheck,
  X,
  Activity,
} from "lucide-react";

// ─── Tipos ─────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
  /** Somente visível para admins da plataforma */
  plataformaOnly?: boolean;
}

interface AppNavigationProps {
  isDark?: boolean;
  onToggleTheme?: () => void;
  /** Papel do usuário logado: plataforma | cliente | viewer */
  role?: "plataforma" | "cliente" | "viewer";
}

// ─── Rotas de navegação ────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",   to: "/dashboard",   icon: LayoutDashboard },
  { label: "Projeto",     to: "/app",         icon: Map             },
  { label: "Admin",       to: "/admin",       icon: Settings,        plataformaOnly: false },
  { label: "Admin SaaS",  to: "/saas-admin",  icon: ShieldCheck,     plataformaOnly: true  },
  { label: "Ajuda",       to: "/ajuda",       icon: HelpCircle      },
  { label: "Status",      to: "/status",      icon: Activity        },
];

// ─── Componente ───────────────────────────────────────────────────────────

export function AppNavigation({ isDark = false, onToggleTheme, role = "cliente" }: AppNavigationProps) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.plataformaOnly || role === "plataforma",
  );

  const linkBase =
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150";
  const linkActive =
    "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30";
  const linkInactive = isDark
    ? "text-slate-400 hover:text-slate-200 hover:bg-white/5"
    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100";

  function handleLogout() {
    // Limpa sessão local e redireciona para landing
    localStorage.removeItem("sisrua_token");
    navigate("/");
  }

  return (
    <nav
      className={`relative z-40 w-full border-b ${
        isDark
          ? "border-white/10 bg-slate-900/80 backdrop-blur-xl"
          : "border-slate-200 bg-white/90 backdrop-blur-xl"
      }`}
      aria-label="Navegação principal"
    >
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4 lg:px-6">
        {/* Logotipo */}
        <NavLink
          to="/"
          className="flex items-center gap-2 select-none"
          aria-label="Página inicial sisTOPOGRAFIA"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 shadow-md shadow-indigo-500/30">
            <Map className="h-4 w-4 text-white" />
          </span>
          <span
            className={`text-sm font-bold tracking-tight ${
              isDark ? "text-slate-100" : "text-slate-800"
            }`}
          >
            sis<span className="text-indigo-500">TOPOGRAFIA</span>
          </span>
          <span className="hidden rounded bg-indigo-600/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-400 sm:block">
            SaaS
          </span>
        </NavLink>

        {/* Links desktop */}
        <div className="hidden items-center gap-1 md:flex">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkInactive}`
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* Ações direita */}
        <div className="flex items-center gap-2">
          {/* Toggle tema */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className={`rounded-lg p-2 text-xs transition-colors ${
                isDark
                  ? "text-slate-400 hover:bg-white/10 hover:text-slate-200"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
              aria-label="Alternar tema claro/escuro"
              title="Alternar tema"
            >
              {isDark ? "☀️" : "🌙"}
            </button>
          )}

          {/* Menu usuário */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isDark
                  ? "text-slate-400 hover:bg-white/10 hover:text-slate-200"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
              aria-expanded={userMenuOpen}
              aria-label="Menu do usuário"
            >
              <span className="hidden sm:block">Minha Conta</span>
              <ChevronDown className="h-4 w-4" />
            </button>
            {userMenuOpen && (
              <div
                className={`absolute right-0 top-full mt-1 w-52 rounded-xl border shadow-xl ${
                  isDark
                    ? "border-white/10 bg-slate-800"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="p-1">
                  <NavLink
                    to="/admin"
                    onClick={() => setUserMenuOpen(false)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isDark ? "text-slate-300 hover:bg-white/10" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Building2 className="h-4 w-4" />
                    Painel Administrativo
                  </NavLink>
                  {role === "plataforma" && (
                    <NavLink
                      to="/saas-admin"
                      onClick={() => setUserMenuOpen(false)}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                        isDark ? "text-slate-300 hover:bg-white/10" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <Shield className="h-4 w-4 text-indigo-400" />
                      Admin da Plataforma
                    </NavLink>
                  )}
                  <div className={`my-1 h-px ${isDark ? "bg-white/10" : "bg-slate-100"}`} />
                  <button
                    onClick={handleLogout}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isDark
                        ? "text-rose-400 hover:bg-rose-500/10"
                        : "text-rose-600 hover:bg-rose-50"
                    }`}
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Botão mobile */}
          <button
            className="rounded-lg p-2 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          >
            {mobileOpen ? (
              <X className={`h-5 w-5 ${isDark ? "text-slate-300" : "text-slate-600"}`} />
            ) : (
              <Menu className={`h-5 w-5 ${isDark ? "text-slate-300" : "text-slate-600"}`} />
            )}
          </button>
        </div>
      </div>

      {/* Menu mobile dropdown */}
      {mobileOpen && (
        <div
          className={`border-t px-4 py-3 md:hidden ${
            isDark ? "border-white/10 bg-slate-900" : "border-slate-100 bg-white"
          }`}
        >
          <div className="flex flex-col gap-1">
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? linkActive : linkInactive}`
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* Overlay para fechar menus ao clicar fora */}
      {(mobileOpen || userMenuOpen) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => { setMobileOpen(false); setUserMenuOpen(false); }}
          aria-hidden="true"
        />
      )}
    </nav>
  );
}
