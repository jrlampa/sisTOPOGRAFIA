import React from "react";
import { Undo2, Redo2 } from "lucide-react";

interface HistoryControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

const HistoryControls: React.FC<HistoryControlsProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  return (
    <div
      role="group"
      aria-label="Histórico de ações"
      className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-sky-50/70 p-1 shadow-[0_10px_24px_rgba(148,163,184,0.16)] dark:border-white/10 dark:bg-white/5 dark:shadow-none"
    >
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`p-1.5 rounded transition-colors ${
          canUndo
            ? "text-slate-700 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 dark:text-slate-100 dark:hover:bg-white/10 dark:hover:text-white"
            : "cursor-not-allowed text-slate-300 dark:text-zinc-600"
        }`}
        title="Desfazer"
        aria-label="Desfazer"
      >
        <Undo2 size={18} />
      </button>
      <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-white/10" />
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={`p-1.5 rounded transition-colors ${
          canRedo
            ? "text-slate-700 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 dark:text-slate-100 dark:hover:bg-white/10 dark:hover:text-white"
            : "cursor-not-allowed text-slate-300 dark:text-zinc-600"
        }`}
        title="Refazer"
        aria-label="Refazer"
      >
        <Redo2 size={18} />
      </button>
    </div>
  );
};

export default HistoryControls;
