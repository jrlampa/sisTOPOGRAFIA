import React from "react";
import { motion } from "framer-motion";
import { Search, MapPin, MousePointer2, ArrowRight, Zap } from "lucide-react";
import type { AppLocale } from "../types";

type Props = {
  locale: AppLocale;
  onStartSearch: () => void;
  onMapClickAction: () => void;
};

const TEXTS = {
  "pt-BR": {
    title: "Pronto para começar?",
    subtitle: "Inicie seu projeto de engenharia agora.",
    primaryCta: "INICIAR PROJETO",
    microInstruction: "Clique em qualquer lugar do mapa ou pesquise um endereço.",
    searchLabel: "Pesquisar endereço",
    clickLabel: "Clicar no mapa",
  },
  "en-US": {
    title: "Ready to start?",
    subtitle: "Start your engineering project now.",
    primaryCta: "START PROJECT",
    microInstruction: "Click anywhere on the map or search for an address.",
    searchLabel: "Search address",
    clickLabel: "Click on map",
  },
  "es-ES": {
    title: "¿Listo para empezar?",
    subtitle: "Inicie su proyecto de ingeniería ahora.",
    primaryCta: "INICIAR PROYECTO",
    microInstruction: "Haga clic en cualquier lugar del mapa o busque una dirección.",
    searchLabel: "Buscar dirección",
    clickLabel: "Clic en el mapa",
  },
};

export function EmptyStateMapOverlay({
  locale,
  onStartSearch,
  onMapClickAction,
}: Props) {
  const t = TEXTS[locale] ?? TEXTS["pt-BR"];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-[450] flex items-center justify-center p-6 backdrop-blur-[2px] bg-slate-900/10 pointer-events-none"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="glass-card pointer-events-auto max-w-sm overflow-hidden border-sky-400/30 shadow-[0_32px_64px_-12px_rgba(15,23,42,0.3)] dark:border-white/10 dark:bg-slate-900/90 text-center"
      >
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          
          <motion.div
            initial={{ rotate: -10, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", damping: 12 }}
            className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-inner"
          >
            <Zap size={32} className="text-yellow-300 fill-yellow-300/20" />
          </motion.div>
          <h2 className="text-2xl font-black tracking-tight leading-tight">{t.title}</h2>
          <p className="mt-2 text-sm font-medium text-blue-100 opacity-90">
            {t.subtitle}
          </p>
        </div>

        <div className="p-8 space-y-6">
          <button
            onClick={onMapClickAction}
            className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 px-6 py-4 text-white shadow-[0_10px_20px_-5px_rgba(37,99,235,0.4)] transition-all hover:bg-blue-700 hover:shadow-[0_15px_30px_-10px_rgba(37,99,235,0.6)] active:scale-[0.97] active:duration-75"
          >
            <span className="text-sm font-black uppercase tracking-[0.15em]">{t.primaryCta}</span>
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-200 dark:border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
              <span className="bg-white px-2 text-slate-400 dark:bg-slate-900">OU</span>
            </div>
          </div>

          <button
            onClick={onStartSearch}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-slate-600 transition-all hover:border-blue-400 hover:text-blue-600 active:scale-[0.98] dark:border-white/5 dark:bg-white/5 dark:text-slate-400 dark:hover:border-blue-500/50 dark:hover:text-blue-400"
          >
            <Search size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">{t.searchLabel}</span>
          </button>

          <p className="text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            {t.microInstruction}
          </p>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/50 p-4 dark:border-white/5 dark:bg-white/5">
          <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            sisrua unified engine v2.0
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
