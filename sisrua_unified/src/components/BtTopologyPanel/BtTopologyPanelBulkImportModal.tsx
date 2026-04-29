import React, { useEffect } from "react";
import { Copy, FileSpreadsheet, Play, SkipForward, X } from "lucide-react";
import { BulkImportReviewState } from "./useBtTopologyPanelBulkImport";
import type { AppLocale } from "../../types";
import { getBtTopologyPanelText } from "../../i18n/btTopologyPanelText";

interface BtTopologyPanelBulkImportModalProps {
  locale: AppLocale;
  isOpen: boolean;
  onClose: () => void;
  bulkRamalText: string;
  setBulkRamalText: (text: string) => void;
  bulkRamalFeedback: string;
  bulkImportReview: BulkImportReviewState | null;
  onApply: () => void;
  onFileSelect: (file: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onReviewNext: () => void;
}

const BtTopologyPanelBulkImportModal: React.FC<
  BtTopologyPanelBulkImportModalProps
> = ({
  locale,
  isOpen,
  onClose,
  bulkRamalText,
  setBulkRamalText,
  bulkRamalFeedback,
  bulkImportReview,
  onApply,
  onFileSelect,
  fileInputRef,
  onReviewNext,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const t = getBtTopologyPanelText(locale).bulkImport;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative flex h-[600px] w-full max-w-2xl flex-col rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 px-4 py-3 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2">
            <Copy className="text-blue-600 dark:text-blue-400" size={18} />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {t.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar importação"
            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="rounded-xl border border-blue-200 dark:border-blue-700/40 bg-blue-50 dark:bg-blue-950/30 p-3">
            <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
              {t.pasteData}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
            >
              <FileSpreadsheet
                size={14}
                className="text-emerald-600 dark:text-emerald-400"
              />
              {t.loadExcel}
            </button>
            <input
              type="file"
              className="hidden"
              ref={fileInputRef}
              accept=".xlsx,.xlsm,.xlsb"
              onChange={(e) =>
                e.target.files?.[0] && onFileSelect(e.target.files[0])
              }
            />
          </div>

          <textarea
            value={bulkRamalText}
            onChange={(e) => setBulkRamalText(e.target.value)}
            spellCheck={false}
            placeholder={t.placeholder}
            className="h-48 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 p-3 text-sm font-mono text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-700/40 outline-none transition-all resize-none shadow-inner"
          />

          {bulkRamalFeedback && (
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 p-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              {bulkRamalFeedback}
            </div>
          )}

          {bulkImportReview && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-700/40 bg-amber-50/50 dark:bg-amber-950/30 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  {t.reviewTitle}
                </span>
                <span className="text-xs font-bold text-amber-800 dark:text-amber-200">
                  {bulkImportReview.currentPoleIndex + 1} / {bulkImportReview.orderedPoleIds.length} {t.reviewSummary}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onReviewNext}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 transition-colors shadow-lg shadow-amber-200/30 dark:shadow-none"
                >
                  <SkipForward size={14} />
                  {t.btnReview}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 p-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            {t.btnCancel}
          </button>
          <button
            onClick={onApply}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-200/30 dark:shadow-none disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
            disabled={!bulkRamalText.trim()}
          >
            <Play size={14} />
            {t.btnImport}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BtTopologyPanelBulkImportModal;
