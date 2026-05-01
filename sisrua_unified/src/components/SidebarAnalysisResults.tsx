import React, { Suspense } from "react";
import { AlertCircle, Download, Loader2, Mountain, Table } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { AnalysisStats, TerrainGrid, Violation } from "../types";
import type { ToastType } from "./Toast";
import { lazyWithRetry } from "../utils/lazyWithRetry";
import type { AppLocale } from "../types";
import { getSidebarAnalysisText } from "../i18n/sidebarAnalysisText";
import { DashboardSkeleton, TableSkeleton } from "./Skeleton";
import { BtViolationJumpList } from "./BtViolationJumpList";

const Dashboard = React.lazy(() => lazyWithRetry(() => import("./Dashboard")));
const DxfLegend = React.lazy(() => lazyWithRetry(() => import("./DxfLegend")));
const BatchUpload = React.lazy(() =>
  lazyWithRetry(() => import("./BatchUpload")),
);

const InlineSuspenseFallback = ({
  type = "dashboard",
}: {
  label?: string;
  type?: "dashboard" | "table";
}) => (type === "dashboard" ? <DashboardSkeleton /> : <TableSkeleton />);

interface SidebarAnalysisResultsProps {
  locale: AppLocale;
  osmData: unknown;
  stats: AnalysisStats | null;
  analysisText: string;
  terrainData: TerrainGrid | null;
  error: string | null;
  handleDownloadDxf: () => Promise<void>;
  handleDownloadCoordinatesCsv: () => void;
  isDownloading: boolean;
  showToast: (message: string, type: ToastType) => void;
  /** Number of topology validation errors blocking a clean DXF export */
  pendingValidationErrors?: number;
  /** Violations to display with jump-to-map capability */
  violations?: Violation[];
  /** Called when the user clicks "Ir" on a violation — jump map to location */
  onJumpToViolation?: (lat: number, lng: number) => void;
}

export function SidebarAnalysisResults({
  locale,
  osmData,
  stats,
  analysisText,
  terrainData,
  error,
  handleDownloadDxf,
  handleDownloadCoordinatesCsv,
  isDownloading,
  showToast,
  pendingValidationErrors = 0,
  violations = [],
  onJumpToViolation,
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

            <Suspense fallback={<InlineSuspenseFallback type="dashboard" />}>
              <Dashboard stats={stats} analysisText={analysisText} />
            </Suspense>

            {/* Violation jump list — only shown when violations are provided */}
            {violations.length > 0 && (
              <BtViolationJumpList
                violations={violations}
                onJumpToLocation={(lat, lng) => onJumpToViolation?.(lat, lng)}
              />
            )}

            <Suspense
              fallback={
                <div className="h-20 w-full animate-pulse bg-slate-100 dark:bg-white/5 rounded-2xl" />
              }
            >
              <DxfLegend />
            </Suspense>

            <Suspense fallback={<TableSkeleton rows={2} />}>
              <BatchUpload
                onError={(message) => showToast(message, "error")}
                onInfo={(message) => showToast(message, "info")}
              />
            </Suspense>

            <div
              aria-live="polite"
              className="flex items-center gap-4 rounded-3xl border-2 border-sky-500/10 bg-gradient-to-br from-sky-50 to-white p-5 dark:border-sky-500/20 dark:bg-zinc-950"
            >
              <div
                className={`rounded-2xl p-3 shadow-inner ${terrainData ? "bg-sky-500 text-white dark:bg-sky-500/20 dark:text-sky-400" : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500"}`}
              >
                <Mountain size={20} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black uppercase tracking-widest text-sky-900/70 dark:text-sky-400">
                  {t.terrainEngineTitle}
                </span>
                <span className="text-base font-black text-sky-950 dark:text-sky-100 leading-tight">
                  {terrainData ? t.terrainLoaded : t.terrainPending}
                </span>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02, x: 5 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDownloadCoordinatesCsv}
              className="group flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-amber-800/25 bg-gradient-to-r from-amber-600 to-orange-500 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-amber-600/20 transition-all hover:brightness-110"
            >
              <div className="p-1 rounded bg-white/10 group-hover:animate-bounce">
                <Table size={18} />
              </div>
              {t.btnDownloadCoordinatesCsv}
            </motion.button>

            {/* Pre-flight check indicator */}
            <div
              aria-live="polite"
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                pendingValidationErrors > 0
                  ? "border-amber-400/50 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-500/30"
                  : "border-emerald-400/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-500/30"
              }`}
            >
              <span className="text-base leading-none" aria-hidden="true">
                {pendingValidationErrors > 0 ? "⚠" : "✓"}
              </span>
              <span>
                {pendingValidationErrors > 0
                  ? `${pendingValidationErrors} erro${pendingValidationErrors > 1 ? "s" : ""} de topologia pendente${pendingValidationErrors > 1 ? "s" : ""}`
                  : "Pronto para exportar"}
              </span>
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
