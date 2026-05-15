/**
 * AdminPagePrimitives.tsx — Componentes reutilizáveis do Painel Administrativo.
 *
 * Exporta: COR_CLASSES, PainelCard, InfoCard, PapelBadge
 */
import React from "react";
import { AlertCircle, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

// ─── Mapa estático de classes Tailwind por cor (JIT-safe) ─────────────────────

export type CorEntry = {
  border: string;
  darkBorder: string;
  bg: string;
  darkBg: string;
  hoverBg: string;
  darkHoverBg: string;
  iconBg: string;
  darkIconBg: string;
  iconBorder: string;
  darkIconBorder: string;
  iconText: string;
  darkIconText: string;
  titleText: string;
  darkTitleText: string;
};

// eslint-disable-next-line react-refresh/only-export-components -- color-map constant co-located with AdminPage components
export const COR_CLASSES: Record<string, CorEntry> = {
  emerald: {
    border: "border-emerald-700/30",
    darkBorder: "dark:border-emerald-500/40",
    bg: "bg-emerald-50",
    darkBg: "dark:bg-emerald-950/20",
    hoverBg: "hover:bg-emerald-100",
    darkHoverBg: "dark:hover:bg-emerald-950/30",
    iconBg: "bg-emerald-100",
    darkIconBg: "dark:bg-emerald-900/40",
    iconBorder: "border-emerald-300/50",
    darkIconBorder: "dark:border-emerald-700/50",
    iconText: "text-emerald-700",
    darkIconText: "dark:text-emerald-300",
    titleText: "text-emerald-900",
    darkTitleText: "dark:text-emerald-100",
  },
  blue: {
    border: "border-blue-700/30",
    darkBorder: "dark:border-blue-500/40",
    bg: "bg-blue-50",
    darkBg: "dark:bg-blue-950/20",
    hoverBg: "hover:bg-blue-100",
    darkHoverBg: "dark:hover:bg-blue-950/30",
    iconBg: "bg-blue-100",
    darkIconBg: "dark:bg-blue-900/40",
    iconBorder: "border-blue-300/50",
    darkIconBorder: "dark:border-blue-700/50",
    iconText: "text-blue-700",
    darkIconText: "dark:text-blue-300",
    titleText: "text-blue-900",
    darkTitleText: "dark:text-blue-100",
  },
  indigo: {
    border: "border-indigo-700/30",
    darkBorder: "dark:border-indigo-500/40",
    bg: "bg-indigo-50",
    darkBg: "dark:bg-indigo-950/20",
    hoverBg: "hover:bg-indigo-100",
    darkHoverBg: "dark:hover:bg-indigo-950/30",
    iconBg: "bg-indigo-100",
    darkIconBg: "dark:bg-indigo-900/40",
    iconBorder: "border-indigo-300/50",
    darkIconBorder: "dark:border-indigo-700/50",
    iconText: "text-indigo-700",
    darkIconText: "dark:text-indigo-300",
    titleText: "text-indigo-900",
    darkTitleText: "dark:text-indigo-100",
  },
  violet: {
    border: "border-violet-700/30",
    darkBorder: "dark:border-violet-500/40",
    bg: "bg-violet-50",
    darkBg: "dark:bg-violet-950/20",
    hoverBg: "hover:bg-violet-100",
    darkHoverBg: "dark:hover:bg-violet-950/30",
    iconBg: "bg-violet-100",
    darkIconBg: "dark:bg-violet-900/40",
    iconBorder: "border-violet-300/50",
    darkIconBorder: "dark:border-violet-700/50",
    iconText: "text-violet-700",
    darkIconText: "dark:text-violet-300",
    titleText: "text-violet-900",
    darkTitleText: "dark:text-violet-100",
  },
  amber: {
    border: "border-amber-700/30",
    darkBorder: "dark:border-amber-500/40",
    bg: "bg-amber-50",
    darkBg: "dark:bg-amber-950/20",
    hoverBg: "hover:bg-amber-100",
    darkHoverBg: "dark:hover:bg-amber-950/30",
    iconBg: "bg-amber-100",
    darkIconBg: "dark:bg-amber-900/40",
    iconBorder: "border-amber-300/50",
    darkIconBorder: "dark:border-amber-700/50",
    iconText: "text-amber-700",
    darkIconText: "dark:text-amber-300",
    titleText: "text-amber-900",
    darkTitleText: "dark:text-amber-100",
  },
  orange: {
    border: "border-orange-700/30",
    darkBorder: "dark:border-orange-500/40",
    bg: "bg-orange-50",
    darkBg: "dark:bg-orange-950/20",
    hoverBg: "hover:bg-orange-100",
    darkHoverBg: "dark:hover:bg-orange-950/30",
    iconBg: "bg-orange-100",
    darkIconBg: "dark:bg-orange-900/40",
    iconBorder: "border-orange-300/50",
    darkIconBorder: "dark:border-orange-700/50",
    iconText: "text-orange-700",
    darkIconText: "dark:text-orange-300",
    titleText: "text-orange-900",
    darkTitleText: "dark:text-orange-100",
  },
  rose: {
    border: "border-rose-700/30",
    darkBorder: "dark:border-rose-500/40",
    bg: "bg-rose-50",
    darkBg: "dark:bg-rose-950/20",
    hoverBg: "hover:bg-rose-100",
    darkHoverBg: "dark:hover:bg-rose-950/30",
    iconBg: "bg-rose-100",
    darkIconBg: "dark:bg-rose-900/40",
    iconBorder: "border-rose-300/50",
    darkIconBorder: "dark:border-rose-700/50",
    iconText: "text-rose-700",
    darkIconText: "dark:text-rose-300",
    titleText: "text-rose-900",
    darkTitleText: "dark:text-rose-100",
  },
  teal: {
    border: "border-teal-700/30",
    darkBorder: "dark:border-teal-500/40",
    bg: "bg-teal-50",
    darkBg: "dark:bg-teal-950/20",
    hoverBg: "hover:bg-teal-100",
    darkHoverBg: "dark:hover:bg-teal-950/30",
    iconBg: "bg-teal-100",
    darkIconBg: "dark:bg-teal-900/40",
    iconBorder: "border-teal-300/50",
    darkIconBorder: "dark:border-teal-700/50",
    iconText: "text-teal-700",
    darkIconText: "dark:text-teal-300",
    titleText: "text-teal-900",
    darkTitleText: "dark:text-teal-100",
  },
  cyan: {
    border: "border-cyan-700/30",
    darkBorder: "dark:border-cyan-500/40",
    bg: "bg-cyan-50",
    darkBg: "dark:bg-cyan-950/20",
    hoverBg: "hover:bg-cyan-100",
    darkHoverBg: "dark:hover:bg-cyan-950/30",
    iconBg: "bg-cyan-100",
    darkIconBg: "dark:bg-cyan-900/40",
    iconBorder: "border-cyan-300/50",
    darkIconBorder: "dark:border-cyan-700/50",
    iconText: "text-cyan-700",
    darkIconText: "dark:text-cyan-300",
    titleText: "text-cyan-900",
    darkTitleText: "dark:text-cyan-100",
  },
  red: {
    border: "border-red-700/30",
    darkBorder: "dark:border-red-500/40",
    bg: "bg-red-50",
    darkBg: "dark:bg-red-950/20",
    hoverBg: "hover:bg-red-100",
    darkHoverBg: "dark:hover:bg-red-950/30",
    iconBg: "bg-red-100",
    darkIconBg: "dark:bg-red-900/40",
    iconBorder: "border-red-300/50",
    darkIconBorder: "dark:border-red-700/50",
    iconText: "text-red-700",
    darkIconText: "dark:text-red-300",
    titleText: "text-red-900",
    darkTitleText: "dark:text-red-100",
  },
  purple: {
    border: "border-purple-700/30",
    darkBorder: "dark:border-purple-500/40",
    bg: "bg-purple-50",
    darkBg: "dark:bg-purple-950/20",
    hoverBg: "hover:bg-purple-100",
    darkHoverBg: "dark:hover:bg-purple-950/30",
    iconBg: "bg-purple-100",
    darkIconBg: "dark:bg-purple-900/40",
    iconBorder: "border-purple-300/50",
    darkIconBorder: "dark:border-purple-700/50",
    iconText: "text-purple-700",
    darkIconText: "dark:text-purple-300",
    titleText: "text-purple-900",
    darkTitleText: "dark:text-purple-100",
  },
  stone: {
    border: "border-stone-700/30",
    darkBorder: "dark:border-stone-500/40",
    bg: "bg-stone-50",
    darkBg: "dark:bg-stone-950/20",
    hoverBg: "hover:bg-stone-100",
    darkHoverBg: "dark:hover:bg-stone-950/30",
    iconBg: "bg-stone-100",
    darkIconBg: "dark:bg-stone-900/40",
    iconBorder: "border-stone-300/50",
    darkIconBorder: "dark:border-stone-700/50",
    iconText: "text-stone-700",
    darkIconText: "dark:text-stone-300",
    titleText: "text-stone-900",
    darkTitleText: "dark:text-stone-100",
  },
  lime: {
    border: "border-lime-700/30",
    darkBorder: "dark:border-lime-500/40",
    bg: "bg-lime-50",
    darkBg: "dark:bg-lime-950/20",
    hoverBg: "hover:bg-lime-100",
    darkHoverBg: "dark:hover:bg-lime-950/30",
    iconBg: "bg-lime-100",
    darkIconBg: "dark:bg-lime-900/40",
    iconBorder: "border-lime-300/50",
    darkIconBorder: "dark:border-lime-700/50",
    iconText: "text-lime-700",
    darkIconText: "dark:text-lime-300",
    titleText: "text-lime-900",
    darkTitleText: "dark:text-lime-100",
  },
};

// ─── PainelCard ───────────────────────────────────────────────────────────────

export interface PainelCardProps {
  titulo: string;
  descricao: string;
  icone: React.ElementType;
  cor: string;
  aberto: boolean;
  onToggle: () => void;
  carregando: boolean;
  erro?: string;
  children: React.ReactNode;
}

export function PainelCard({
  titulo,
  descricao,
  icone: Icone,
  cor,
  aberto,
  onToggle,
  carregando,
  erro,
  children,
}: PainelCardProps) {
  const cc = COR_CLASSES[cor] ?? COR_CLASSES.emerald;
  const idTitulo = `card-title-${titulo.replace(/\s+/g, "-").toLowerCase()}`;
  const idPainel = `card-panel-${titulo.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div
      className={`glass-panel rounded-2xl border-2 ${cc.border} ${cc.darkBorder} overflow-hidden`}
    >
      <button
        onClick={onToggle}
        aria-expanded={aberto}
        aria-controls={idPainel}
        className={`w-full flex items-center justify-between p-4 ${cc.bg} ${cc.darkBg} ${cc.hoverBg} ${cc.darkHoverBg} transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${cc.iconBg} ${cc.darkIconBg} border ${cc.iconBorder} ${cc.darkIconBorder}`}
            aria-hidden="true"
          >
            <Icone size={18} className={`${cc.iconText} ${cc.darkIconText}`} />
          </div>
          <div className="text-left">
            <p
              id={idTitulo}
              className={`font-bold ${cc.titleText} ${cc.darkTitleText} text-sm`}
            >
              {titulo}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {descricao}
            </p>
          </div>
        </div>
        {aberto ? (
          <ChevronUp size={16} className="text-slate-500 shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-slate-500 shrink-0" />
        )}
      </button>
      {aberto && (
        <div 
          id={idPainel}
          role="region"
          aria-labelledby={idTitulo}
          className="p-4 border-t border-slate-200/70 dark:border-slate-700/50"
        >
          {carregando && (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm py-2" aria-live="polite">
              <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
              <span>Carregando...</span>
            </div>
          )}
          {erro && !carregando && (
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-sm py-2" role="alert">
              <AlertCircle size={14} aria-hidden="true" />
              <span>{erro}</span>
            </div>
          )}
          {!carregando && !erro && children}
        </div>
      )}
    </div>
  );
}

// ─── InfoCard ─────────────────────────────────────────────────────────────────

export function InfoCard({
  label,
  valor,
  ok,
}: {
  label: string;
  valor: string;
  ok?: boolean;
}) {
  const corValor =
    ok === undefined
      ? "text-slate-800 dark:text-slate-200"
      : ok
        ? "text-emerald-700 dark:text-emerald-300"
        : "text-rose-700 dark:text-rose-300";
  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 bg-white/50 dark:bg-slate-900/40 px-3 py-2">
      <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
        {label}
      </p>
      <p className={`font-bold text-sm mt-0.5 ${corValor}`}>{valor}</p>
    </div>
  );
}

// ─── PapelBadge ───────────────────────────────────────────────────────────────

export function PapelBadge({ papel }: { papel: string }) {
  const cores: Record<string, string> = {
    admin: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    technician:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    viewer: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    guest: "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500",
  };
  const cor = cores[papel] ?? "bg-gray-100 text-gray-600";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${cor}`}
    >
      {papel}
    </span>
  );
}
