import React from "react";
import { AlertTriangle, AlertCircle, Info, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Violation } from "../types";

interface BtViolationJumpListProps {
  violations: Violation[];
  onJumpToLocation: (lat: number, lng: number) => void;
}

const TYPE_CONFIG = {
  critical: {
    icon: AlertCircle,
    rowClass:
      "border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-950/20",
    iconClass: "text-red-500",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
    label: "Crítico",
  },
  warning: {
    icon: AlertTriangle,
    rowClass:
      "border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-950/20",
    iconClass: "text-amber-500",
    badgeClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    label: "Alerta",
  },
  info: {
    icon: Info,
    rowClass:
      "border-sky-200 bg-sky-50 dark:border-sky-500/20 dark:bg-sky-950/20",
    iconClass: "text-sky-500",
    badgeClass: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
    label: "Info",
  },
} as const;

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

export function BtViolationJumpList({
  violations,
  onJumpToLocation,
}: BtViolationJumpListProps) {
  const { sorted, criticalCount, warnCount } = React.useMemo(() => {
    const nextSorted = [...violations].sort(
      (a, b) => (SEVERITY_ORDER[a.type] ?? 3) - (SEVERITY_ORDER[b.type] ?? 3),
    );

    let nextCriticalCount = 0;
    let nextWarnCount = 0;

    for (const violation of violations) {
      if (violation.type === "critical") {
        nextCriticalCount += 1;
      } else if (violation.type === "warning") {
        nextWarnCount += 1;
      }
    }

    return {
      sorted: nextSorted,
      criticalCount: nextCriticalCount,
      warnCount: nextWarnCount,
    };
  }, [violations]);

  if (sorted.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {/* Summary header */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Ocorrências
        </span>
        {criticalCount > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-500/20 dark:text-red-300">
            {criticalCount} crítico{criticalCount > 1 ? "s" : ""}
          </span>
        )}
        {warnCount > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
            {warnCount} alerta{warnCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Violation rows */}
      <AnimatePresence initial={false}>
        {sorted.map((v, i) => {
          const cfg = TYPE_CONFIG[v.type];
          const Icon = cfg.icon;

          return (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`flex items-start gap-3 rounded-xl border p-3 ${cfg.rowClass}`}
            >
              <Icon size={15} className={`mt-0.5 shrink-0 ${cfg.iconClass}`} />
              <p className="flex-1 text-xs leading-snug text-slate-700 dark:text-slate-200">
                {v.message}
              </p>
              <button
                onClick={() => onJumpToLocation(v.location.lat, v.location.lng)}
                title="Localizar no mapa"
                aria-label={`Ir para: ${v.message}`}
                className="shrink-0 flex items-center gap-1 rounded-lg border border-current/30 px-2 py-1 text-[10px] font-bold uppercase tracking-wide opacity-70 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <MapPin size={10} />
                Ir
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
