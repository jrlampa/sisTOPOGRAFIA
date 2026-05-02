import React from "react";
import { Undo2, Redo2, RotateCcw, History } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { HistoryEntry } from "../hooks/useUndoRedo";
import type { AppLocale } from "../types";
import { getAppHeaderText } from "../i18n/appHeaderText";
import { trackHeaderAction, trackRework } from "../utils/analytics";

interface HistoryControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  past?: HistoryEntry<unknown>[];
  future?: HistoryEntry<unknown>[];
  locale: AppLocale;
}

const HistoryControls: React.FC<HistoryControlsProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  past = [],
  future = [],
  locale,
}) => {
  const [showHistory, setShowHistory] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const t = getAppHeaderText(locale);
  
  // Close when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowHistory(false);
      }
    };
    if (showHistory) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showHistory]);

  const recentPast = past.slice(-5).reverse();
  const recentFuture = future.slice(0, 5);

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={t.recentHistory}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!showHistory) trackHeaderAction("history_panel_open");
        setShowHistory(!showHistory);
      }}
      className="relative flex items-center gap-1 rounded-2xl border border-slate-200 bg-sky-50/70 p-1 shadow-[0_10px_24px_rgba(148,163,184,0.16)] dark:border-white/10 dark:bg-white/5 dark:shadow-none"
    >
      <button
        onClick={() => {
          trackRework("undo", "Header button");
          onUndo();
        }}
        disabled={!canUndo}
        className={`p-1.5 rounded-xl transition-all active:scale-95 ${
          canUndo
            ? "text-slate-700 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 dark:text-slate-100 dark:hover:bg-white/10 dark:hover:text-white"
            : "cursor-not-allowed text-slate-300 dark:text-zinc-600"
        }`}
        title={`${t.undoAction} (Ctrl+Z)`}
        aria-label={t.undoAction}
      >
        <Undo2 size={18} />
      </button>

      <button
        onClick={() => {
          if (!showHistory) trackHeaderAction("history_panel_open");
          setShowHistory(!showHistory);
        }}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all active:scale-95 font-bold text-xs ${
          showHistory
            ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
            : "text-slate-700 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 dark:text-slate-100 dark:hover:bg-white/10 dark:hover:text-white"
        }`}
        title={t.historyTooltip}
        aria-label={t.historyTooltip}
        aria-expanded={showHistory}
        aria-haspopup="true"
      >
        <History size={16} />
        <span className="hidden sm:inline">{t.recentHistory}</span>
      </button>

      <button
        onClick={() => {
          trackRework("redo", "Header button");
          onRedo();
        }}
        disabled={!canRedo}
        className={`p-1.5 rounded-xl transition-all active:scale-95 ${
          canRedo
            ? "text-slate-700 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 dark:text-slate-100 dark:hover:bg-white/10 dark:hover:text-white"
            : "cursor-not-allowed text-slate-300 dark:text-zinc-600"
        }`}
        title={`${t.redoAction} (Ctrl+Y)`}
        aria-label={t.redoAction}
      >
        <Redo2 size={18} />
      </button>

      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-full left-0 mt-2 z-50 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-slate-900"
          >
            <div className="mb-2 px-2 py-1 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                {t.recentHistory}
              </span>
              <RotateCcw size={12} className="text-slate-300" />
            </div>

            <div className="space-y-0.5">
              {recentFuture.map((entry, i) => (
                <div
                  key={`future-${i}`}
                  className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-400 opacity-60 line-through"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
                  {entry.label}
                </div>
              ))}

              <div className="flex items-center gap-3 px-3 py-2 text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/10 rounded-lg">
                <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                {t.present}
              </div>

              {recentPast.map((entry, i) => (
                <button
                  key={`past-${i}`}
                  onClick={() => {
                    trackRework("undo", `History jump: ${entry.label}`);
                    // One undo for each step back
                    for (let j = 0; j <= i; j++) onUndo();
                    setShowHistory(false);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                  {entry.label}
                </button>
              ))}

              {past.length === 0 && future.length === 0 && (
                <div className="px-3 py-4 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
                  {t.noActions}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HistoryControls;
