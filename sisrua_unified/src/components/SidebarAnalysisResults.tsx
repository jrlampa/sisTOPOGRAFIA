import React, { Suspense } from "react";
import { AlertCircle, Download, Loader2, Mountain } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { AnalysisStats, TerrainGrid } from "../types";
import type { ToastType } from "./Toast";
import { lazyWithRetry } from "../utils/lazyWithRetry";
import type { AppLocale } from "../types";
import { getSidebarAnalysisText } from "../i18n/sidebarAnalysisText";

const Dashboard = React.lazy(() => lazyWithRetry(() => import("./Dashboard")));
const DxfLegend = React.lazy(() => lazyWithRetry(() => import("./DxfLegend")));
const BatchUpload = React.lazy(() =>
  lazyWithRetry(() => import("./BatchUpload")),
);

const InlineSuspenseFallback = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-amber-800/25 bg-amber-50 p-4 text-xs font-semibold uppercase tracking-wide text-amber-900 shadow-[4px_4px_0_rgba(124,45,18,0.16)] dark:border-amber-500/45 dark:bg-zinc-900 dark:text-amber-100 dark:shadow-[4px_4px_0_rgba(251,146,60,0.22)]">
    <Loader2 size={14} className="animate-spin" />
    {label}
  </div>
);

interface SidebarAnalysisResultsProps {
  locale: AppLocale;
  osmData: unknown;
  stats: AnalysisStats | null;
  analysisText: string;
  terrainData: TerrainGrid | null;
  error: string | null;
  handleDownloadDxf: () => Promise<void>;
  isDownloading: boolean;
  showToast: (message: string, type: ToastType) => void;
}

export function SidebarAnalysisResults({
  locale,
  osmData,
  stats,
  analysisText,
  terrainData,
  error,
  handleDownloadDxf,
  isDownloading,
  showToast,
}: SidebarAnalysisResultsProps) {
  const t = getSidebarAnalysisText(locale);

  return (
    <>
      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-rose-100 border-2 border-rose-700/35 p-4 rounded-2xl flex items-start gap-3 text-rose-800 dark:bg-rose-950/40 dark:border-rose-400/45 dark:text-rose-200 text-sm overflow-hidden"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p className="font-medium">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analysis Results */}
      <AnimatePresence>
        {!!osmData && stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6 mt-auto overflow-visible"
          >
            <div className="mx-1 h-px bg-amber-800/20 dark:bg-amber-500/30" />

            <Suspense
              fallback={<InlineSuspenseFallback label={t.loadingAnalysis} />}
            >
              <Dashboard stats={stats} analysisText={analysisText} />
            </Suspense>

            <Suspense
              fallback={
                <InlineSuspenseFallback label={t.loadingDxfLegend} />
              }
            >
              <DxfLegend />
            </Suspense>

            <Suspense
              fallback={
                <InlineSuspenseFallback label={t.loadingBatchUpload} />
              }
            >
              <BatchUpload
                onError={(message) => showToast(message, "error")}
                onInfo={(message) => showToast(message, "info")}
              />
            </Suspense>

            <div className="flex items-center gap-4 rounded-3xl border-2 border-sky-500/10 bg-gradient-to-br from-sky-50 to-white p-5 dark:border-sky-500/20 dark:bg-zinc-950">
              <div
                className={`rounded-2xl p-3 shadow-inner ${terrainData ? "bg-sky-500 text-white dark:bg-sky-500/20 dark:text-sky-400" : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500"}`}
              >
                <Mountain size={20} />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black uppercase tracking-widest text-sky-900/70 dark:text-sky-400">
                  {t.terrainEngineTitle}
                </span>
                <span className="text-base font-black text-sky-950 dark:text-sky-100 leading-tight">
                  {terrainData
                    ? t.terrainLoaded
                    : t.terrainPending}
                </span>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02, x: 5 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDownloadDxf}
              disabled={isDownloading}
              className="group flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-black/15 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-500 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-600/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <div className="p-1 rounded bg-white/10 group-hover:animate-bounce">
                  <Download size={18} />
                </div>
              )}
              {isDownloading ? t.btnGenerating : t.btnDownloadDxf}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
