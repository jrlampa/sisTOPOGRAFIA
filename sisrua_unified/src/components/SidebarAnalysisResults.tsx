import React, { Suspense } from 'react';
import { AlertCircle, Download, Loader2, Mountain } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AnalysisStats, TerrainGrid } from '../types';
import type { ToastType } from './Toast';

const Dashboard = React.lazy(() => import('./Dashboard'));
const DxfLegend = React.lazy(() => import('./DxfLegend'));
const BatchUpload = React.lazy(() => import('./BatchUpload'));

const InlineSuspenseFallback = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-slate-900/60 p-4 text-xs font-semibold uppercase tracking-wide text-slate-300 backdrop-blur-sm">
    <Loader2 size={14} className="animate-spin" />
    {label}
  </div>
);

interface SidebarAnalysisResultsProps {
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
  osmData,
  stats,
  analysisText,
  terrainData,
  error,
  handleDownloadDxf,
  isDownloading,
  showToast,
}: SidebarAnalysisResultsProps) {
  return (
    <>
      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-rose-500/10 border border-rose-500/25 p-4 rounded-xl flex items-start gap-3 text-rose-700 dark:text-rose-300 text-sm overflow-hidden"
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
            <div className="h-px bg-slate-200/70 dark:bg-white/10 mx-1" />

            <Suspense fallback={<InlineSuspenseFallback label="Carregando análise" />}>
              <Dashboard stats={stats} analysisText={analysisText} />
            </Suspense>

            <Suspense fallback={<InlineSuspenseFallback label="Carregando legenda DXF" />}>
              <DxfLegend />
            </Suspense>

            <Suspense fallback={<InlineSuspenseFallback label="Carregando importação em lote" />}>
              <BatchUpload
                onError={(message) => showToast(message, 'error')}
                onInfo={(message) => showToast(message, 'info')}
              />
            </Suspense>

            <div className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/55 backdrop-blur-md">
              <div className={`p-2 rounded-lg ${terrainData ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-500'}`}>
                <Mountain size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">MOTOR DE TERRENO</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {terrainData ? 'Grade de alta resolução carregada' : 'Grade pendente...'}
                </span>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02, x: 5 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDownloadDxf}
              disabled={isDownloading}
              className="group w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl flex items-center justify-center gap-3 font-black text-xs tracking-widest uppercase shadow-xl shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDownloading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <div className="p-1 rounded bg-white/10 group-hover:animate-bounce">
                  <Download size={18} />
                </div>
              )}
              {isDownloading ? 'GERANDO...' : 'BAIXAR DXF'}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
