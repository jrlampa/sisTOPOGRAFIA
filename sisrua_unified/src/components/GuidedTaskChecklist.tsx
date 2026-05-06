import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X } from "lucide-react";
import { getGuidedTaskChecklistText } from "../i18n/guidedTaskChecklistText";
import { AppLocale } from "../types";

export interface GuidedTask {
  id: string;
  label: string;
  done: boolean;
}

interface GuidedTaskChecklistProps {
  /** Controlled task list — parent derives done state from app state */
  tasks: GuidedTask[];
  locale: AppLocale;
  onDismiss?: () => void;
}

const STORAGE_KEY = "sisrua.guided_checklist.dismissed";

export function GuidedTaskChecklist({
  tasks,
  locale,
  onDismiss,
}: GuidedTaskChecklistProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "true",
  );

  const t = getGuidedTaskChecklistText(locale);

  // Auto-collapse once all done
  useEffect(() => {
    if (tasks.every((t) => t.done) && !collapsed) {
      const timer = setTimeout(() => setCollapsed(true), 800);
      return () => clearTimeout(timer);
    }
  }, [tasks, collapsed]);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed) return null;

  const doneCount = tasks.filter((t) => t.done).length;
  const allDone = doneCount === tasks.length;

  return (
    <AnimatePresence>
      <motion.div
        key="guided-checklist"
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
        className="fixed bottom-6 right-6 z-[9000] w-60 rounded-2xl border border-white/20 bg-white/90 dark:bg-slate-900/90 shadow-2xl backdrop-blur-xl"
        role="region"
        aria-label={t.regionLabel}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
              {t.headerTitle}
            </span>
            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
              {doneCount}/{tasks.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCollapsed((c) => !c)}
              aria-label={
                collapsed ? t.expandLabel : t.collapseLabel
              }
              className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              {collapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            <button
              onClick={handleDismiss}
              aria-label={t.closeLabel}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mx-4 mb-1 h-1 rounded-full bg-slate-100 dark:bg-white/10">
          <motion.div
            className="h-full rounded-full bg-blue-500"
            initial={false}
            animate={{ width: `${(doneCount / tasks.length) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        {/* Task list */}
        <AnimatePresence>
          {!collapsed && (
            <motion.ul
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              {tasks.map((task, i) => (
                <motion.li
                  key={task.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 px-4 py-2.5 last:pb-4"
                >
                  {task.done ? (
                    <CheckCircle2
                      size={16}
                      className="shrink-0 text-emerald-500"
                      strokeWidth={2.5}
                    />
                  ) : (
                    <Circle
                      size={16}
                      className={`shrink-0 ${i === doneCount ? "text-blue-400 animate-pulse" : "text-slate-300 dark:text-slate-600"}`}
                    />
                  )}
                  <span
                    className={`text-xs leading-snug transition-colors ${
                      task.done
                        ? "text-slate-400 line-through dark:text-slate-600"
                        : i === doneCount
                          ? "font-bold text-slate-800 dark:text-slate-100"
                          : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {task.label}
                  </span>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>

        {/* All done — celebration line */}
        <AnimatePresence>
          {allDone && !collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-emerald-100 dark:border-emerald-500/20 px-4 py-2 text-center text-[11px] font-bold text-emerald-600 dark:text-emerald-400"
            >
              {t.successMsg}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
