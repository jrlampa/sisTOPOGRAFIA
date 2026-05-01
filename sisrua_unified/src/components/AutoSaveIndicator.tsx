import React from "react";
import { CloudUpload, AlertCircle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { AppLocale } from "../types";
import { getAppHeaderText } from "../i18n/appHeaderText";

interface Props {
  status: "idle" | "saving" | "error";
  lastSaved?: string;
  locale: AppLocale;
}

export function AutoSaveIndicator({ status, locale }: Props) {
  const t = getAppHeaderText(locale);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm transition-all duration-300">
      <AnimatePresence mode="wait">
        {status === "saving" && (
          <motion.div
            key="saving"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-center gap-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400"
          >
            <CloudUpload size={12} className="animate-pulse" />
            {t.autoSaveSaving}
          </motion.div>
        )}

        {status === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 dark:text-slate-500"
          >
            <CheckCircle2 size={12} className="text-emerald-500" />
            {t.autoSaveSuccess}
          </motion.div>
        )}

        {status === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-center gap-1.5 text-xs font-bold text-rose-500"
          >
            <AlertCircle size={12} />
            {t.autoSaveError}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
