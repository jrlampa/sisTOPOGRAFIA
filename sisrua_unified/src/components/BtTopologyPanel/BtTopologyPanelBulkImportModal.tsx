import React from "react";
import { Copy, FileSpreadsheet, Play, SkipForward, X, Check } from "lucide-react";
import { BulkImportReviewState } from "./useBtTopologyPanelBulkImport";

interface BtTopologyPanelBulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  bulkRamalText: string;
  setBulkRamalText: (text: string) => void;
  bulkRamalFeedback: string;
  bulkImportReview: BulkImportReviewState | null;
  onApply: () => void;
  onFileSelect: (file: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onReviewNext: () => void;
}

const BtTopologyPanelBulkImportModal: React.FC<BtTopologyPanelBulkImportModalProps> = ({
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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative flex h-[600px] w-full max-w-2xl flex-col rounded-xl border border-slate-700 bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50">
          <div className="flex items-center gap-2">
            <Copy className="text-blue-600" size={18} />
            <h3 className="text-sm font-bold text-slate-800">Importação em Massa - Ramais BT</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs text-blue-800 leading-relaxed">
              Arraste seu arquivo Excel (.xlsx) para o mapa ou cole a tabela abaixo (incluindo cabeçalhos <strong>POSTE</strong> e tipos de ramal como <strong>13 CC</strong>).
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              Selecionar Planilha
            </button>
            <input
              type="file"
              className="hidden"
              ref={fileInputRef}
              accept=".xlsx,.xlsm,.xlsb"
              onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
            />
          </div>

          <textarea
            value={bulkRamalText}
            onChange={(e) => setBulkRamalText(e.target.value)}
            spellCheck={false}
            placeholder="Cole aqui os dados da sua tabela..."
            className="h-48 w-full rounded-lg border border-slate-300 p-3 text-[11px] font-mono text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all resize-none shadow-inner"
          />

          {bulkRamalFeedback && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs font-medium text-slate-600">
              {bulkRamalFeedback}
            </div>
          )}

          {bulkImportReview && (
            <div className="rounded-xl border border-amber-300 bg-amber-50/50 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Revisão Assistida</span>
                <span className="text-[10px] font-bold text-amber-800">
                  Poste {bulkImportReview.currentPoleIndex + 1} de {bulkImportReview.orderedPoleIds.length}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onReviewNext}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 transition-colors shadow-lg shadow-amber-200"
                >
                  <SkipForward size={14} />
                  Próximo Poste
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 p-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors">
            Cancelar
          </button>
          <button
            onClick={onApply}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none"
            disabled={!bulkRamalText.trim()}
          >
            <Play size={14} />
            Aplicar Importação
          </button>
        </div>
      </div>
    </div>
  );
};

export default BtTopologyPanelBulkImportModal;
