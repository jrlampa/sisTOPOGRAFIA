import { AnimatePresence, motion } from 'framer-motion';
import type { GlobalState } from '../types';

type Props = {
  sessionDraft: GlobalState | null;
  onRestore: () => void;
  onDismiss: () => void;
};

export function SessionRecoveryBanner({ sessionDraft, onRestore, onDismiss }: Props) {
  return (
    <AnimatePresence>
      {sessionDraft && (
        <motion.div
          key="session-recovery"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="fixed top-4 left-1/2 z-[990] -translate-x-1/2 flex items-center gap-3 rounded-xl border border-blue-500/30 bg-slate-900/95 px-4 py-3 text-xs text-slate-100 shadow-2xl backdrop-blur-sm"
        >
          <span className="text-blue-300 font-semibold">
            Sessao anterior encontrada ({sessionDraft.btTopology?.poles.length ?? 0} postes).
          </span>
          <button
            onClick={onRestore}
            className="rounded border border-blue-500/40 px-2 py-1 text-blue-200 hover:bg-blue-500/20 transition-colors"
          >
            Restaurar
          </button>
          <button
            onClick={onDismiss}
            className="rounded border border-slate-600/60 px-2 py-1 text-slate-400 hover:bg-slate-700/40 transition-colors"
          >
            Descartar
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
