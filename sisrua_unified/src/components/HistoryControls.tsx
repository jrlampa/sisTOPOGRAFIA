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
      className="flex items-center gap-1 rounded-2xl border-2 border-amber-800/35 bg-amber-50 p-1 shadow-[4px_4px_0_rgba(124,45,18,0.18)] dark:border-amber-500/45 dark:bg-zinc-900 dark:shadow-[4px_4px_0_rgba(251,146,60,0.2)]"
    >
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`p-1.5 rounded transition-colors ${
          canUndo
            ? "text-amber-900 hover:bg-amber-100 hover:text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 dark:text-amber-100 dark:hover:bg-zinc-800 dark:hover:text-white"
            : "text-amber-300 dark:text-zinc-600 cursor-not-allowed"
        }`}
        title="Desfazer"
        aria-label="Desfazer"
      >
        <Undo2 size={18} />
      </button>
      <div className="w-px h-4 bg-amber-300 dark:bg-amber-600/40 mx-1" />
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={`p-1.5 rounded transition-colors ${
          canRedo
            ? "text-amber-900 hover:bg-amber-100 hover:text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 dark:text-amber-100 dark:hover:bg-zinc-800 dark:hover:text-white"
            : "text-amber-300 dark:text-zinc-600 cursor-not-allowed"
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
