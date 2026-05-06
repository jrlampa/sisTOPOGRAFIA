/**
 * Breadcrumb.tsx — Trilha de navegação baseada na rota atual.
 *
 * Exibe o caminho da página em formato "Início / Dashboard" etc.
 * Suporta todas as rotas definidas em router.tsx.
 */
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

// ─── Mapa de rotas → rótulos legíveis ─────────────────────────────────────

const ROUTE_LABELS: Record<string, string> = {
  "/": "Início",
  "/dashboard": "Dashboard",
  "/app": "Projeto",
  "/admin": "Admin",
  "/saas-admin": "Admin SaaS",
  "/ajuda": "Ajuda",
  "/status": "Status",
  "/landing": "Início",
};

interface BreadcrumbSegment {
  label: string;
  path: string;
  isLast: boolean;
}

function buildSegments(pathname: string): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [
    { label: "Início", path: "/", isLast: false },
  ];

  if (pathname === "/" || pathname === "/landing") {
    segments[0].isLast = true;
    return segments;
  }

  const label = ROUTE_LABELS[pathname] ?? pathname.replace("/", "");
  segments.push({ label, path: pathname, isLast: true });
  return segments;
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface BreadcrumbProps {
  isDark?: boolean;
  /** Segmento extra para contexto dentro de uma página (ex: "Editor BT"). */
  subContext?: string;
  className?: string;
}

// ─── Componente ───────────────────────────────────────────────────────────

export function Breadcrumb({
  isDark = false,
  subContext,
  className = "",
}: BreadcrumbProps) {
  const { pathname } = useLocation();
  const segments = buildSegments(pathname);

  // Se houver contexto extra, adiciona como último segmento (não clicável)
  if (subContext && segments.length > 0) {
    segments[segments.length - 1].isLast = false;
    segments.push({ label: subContext, path: "", isLast: true });
  }

  const textBase = isDark ? "text-slate-400" : "text-slate-500";
  const textActive = isDark ? "text-slate-100" : "text-slate-800";
  const textLink = isDark
    ? "text-slate-400 hover:text-slate-200 transition-colors"
    : "text-slate-500 hover:text-slate-700 transition-colors";

  return (
    <nav
      aria-label="Trilha de navegação"
      className={`flex items-center gap-1 text-xs font-medium select-none ${className}`}
    >
      {segments.map((seg, i) => (
        <React.Fragment key={seg.path || seg.label}>
          {i === 0 && (
            <Home
              className={`h-3 w-3 shrink-0 ${textBase}`}
              aria-hidden="true"
            />
          )}
          {i > 0 && (
            <ChevronRight
              className={`h-3 w-3 shrink-0 ${textBase}`}
              aria-hidden="true"
            />
          )}
          {seg.isLast || !seg.path ? (
            <span
              className={textActive}
              aria-current={seg.isLast ? "page" : undefined}
            >
              {seg.label}
            </span>
          ) : (
            <Link to={seg.path} className={textLink}>
              {seg.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

export default Breadcrumb;
