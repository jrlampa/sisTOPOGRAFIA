import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HelpCircle, X } from "lucide-react";
import type { AppLocale } from "../types";
import { getHelpModalText } from "../i18n/helpModalText";

type Props = {
  isOpen: boolean;
  locale: AppLocale;
  onClose: () => void;
};

export function HelpModal({ isOpen, locale, onClose }: Props) {
  const text = getHelpModalText(locale);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[995] flex items-center justify-center p-4">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm"
            aria-label={text.closeLabel}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            className="relative z-10 flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-cyan-200/40 bg-white/95 shadow-2xl shadow-slate-900/20 backdrop-blur dark:border-cyan-500/20 dark:bg-slate-950/95"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-200/70 px-6 py-5 dark:border-slate-800">
              <div>
                <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-700 dark:border-cyan-400/30 dark:text-cyan-200">
                  <HelpCircle size={14} />
                  /help
                </p>
                <h2
                  id="help-modal-title"
                  className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100"
                >
                  {text.title}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {text.subtitle}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                  {text.quickOpenHint}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                title={text.closeLabel}
                aria-label={text.closeLabel}
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <X size={18} />
              </button>
            </header>

            <div className="grid gap-4 overflow-y-auto p-6 md:grid-cols-2">
              <section className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  {text.shortcutsTitle}
                </h3>
                <ul className="space-y-2">
                  {text.shortcuts.map((shortcut) => (
                    <li
                      key={`${shortcut.key}-${shortcut.action}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/70"
                    >
                      <span className="text-slate-700 dark:text-slate-200">
                        {shortcut.action}
                      </span>
                      <kbd className="rounded-lg border border-cyan-300/50 bg-cyan-500/10 px-2 py-1 font-mono text-xs font-semibold text-cyan-700 dark:border-cyan-500/40 dark:text-cyan-200">
                        {shortcut.key}
                      </kbd>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  {text.workflowTitle}
                </h3>
                <ol className="space-y-3">
                  {text.steps.map((step) => (
                    <li
                      key={step.title}
                      className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-700 dark:bg-slate-950/70"
                    >
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {step.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {step.description}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <footer className="border-t border-slate-200/70 px-6 py-4 text-xs font-medium text-slate-600 dark:border-slate-800 dark:text-slate-300">
              {text.footerNote}
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
