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
      className="flex items-center gap-1 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-lg p-1 border border-slate-200 dark:border-slate-700 shadow-sm"
    >
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`p-1.5 rounded transition-colors ${
          canUndo
            ? "text-slate-700 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
            : "text-slate-400 dark:text-slate-600 cursor-not-allowed"
        }`}
        title="Desfazer"
        aria-label="Desfazer"
      >
        <Undo2 size={18} />
      </button>
      <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={`p-1.5 rounded transition-colors ${
          canRedo
            ? "text-slate-700 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
            : "text-slate-400 dark:text-slate-600 cursor-not-allowed"
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
