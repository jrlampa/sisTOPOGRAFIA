import { AnimatePresence, motion } from 'framer-motion';
import type { GlobalState, AppLocale } from '../types';

const TEXTS = {
  "pt-BR": {
    found: (count: number) => `Sessão anterior encontrada (${count} postes).`,
    restore: "Restaurar",
    discard: "Descartar",
  },
  "en-US": {
    found: (count: number) => `Previous session found (${count} poles).`,
    restore: "Restore",
    discard: "Discard",
  },
  "es-ES": {
    found: (count: number) => `Sesión anterior encontrada (${count} postes).`,
    restore: "Restaurar",
    discard: "Descartar",
  },
} as const;

type Props = {
  locale?: AppLocale;
  sessionDraft: GlobalState | null;
  onRestore: () => void;
  onDismiss: () => void;
};

export function SessionRecoveryBanner({ locale = "pt-BR", sessionDraft, onRestore, onDismiss }: Props) {
  const t = TEXTS[locale] ?? TEXTS["pt-BR"];
  return (
    <AnimatePresence>
      {sessionDraft && (
        <motion.div
          key="session-recovery"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="fixed top-4 left-1/2 z-[990] -translate-x-1/2 flex items-center gap-3 rounded-xl border border-cyan-500/25 dark:border-cyan-500/35 bg-white/90 dark:bg-slate-900/95 px-4 py-3 text-xs text-slate-800 dark:text-slate-100 shadow-2xl backdrop-blur-md w-[calc(100vw-2rem)] max-w-max"
        >
          <span className="text-cyan-700 dark:text-cyan-300 font-semibold">
            {t.found(sessionDraft.btTopology?.poles.length ?? 0)}
          </span>
          <button
            onClick={onRestore}
            className="rounded border border-cyan-500/35 dark:border-cyan-500/45 px-2 py-1 text-cyan-700 dark:text-cyan-200 hover:bg-cyan-500/10 dark:hover:bg-cyan-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
          >
            {t.restore}
          </button>
          <button
            onClick={onDismiss}
            className="rounded border border-slate-300 dark:border-slate-600/60 px-2 py-1 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
          >
            {t.discard}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
