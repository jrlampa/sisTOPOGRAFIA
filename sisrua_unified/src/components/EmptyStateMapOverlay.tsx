import React from "react";
import { motion } from "framer-motion";
import { Search, MapPin, MousePointer2, FileDown, Zap } from "lucide-react";
import type { AppLocale } from "../types";

type Props = {
  locale: AppLocale;
  onStartSearch: () => void;
  onMapClickAction: () => void;
};

const TEXTS = {
  "pt-BR": {
    title: "Guia de Inicialização",
    subtitle: "Siga os passos para criar sua rede inteligente.",
    step1: "1. Importar KML",
    step1Desc: "Arraste um arquivo KML para o mapa ou clique em abrir projeto.",
    step2: "2. Definir Centro de Carga",
    step2Desc: "Clique no mapa ou pesquise o endereço para iniciar a seleção.",
    step3: "3. Design Generativo",
    step3Desc: "Acesse o painel lateral para gerar e otimizar a rede.",
    actionSearch: "Pesquisar Endereço",
    actionClick: "Selecionar no Mapa",
  },
  "en-US": {
    title: "Getting Started Guide",
    subtitle: "Follow these steps to create your smart network.",
    step1: "1. Import KML",
    step1Desc: "Drag a KML file onto the map or click open project.",
    step2: "2. Define Load Center",
    step2Desc: "Click on the map or search for an address to begin selection.",
    step3: "3. Generative Design",
    step3Desc: "Open the side panel to generate and optimize the network.",
    actionSearch: "Search Address",
    actionClick: "Select on Map",
  },
  "es-ES": {
    title: "Guía de Inicio",
    subtitle: "Siga los pasos para crear su red inteligente.",
    step1: "1. Importar KML",
    step1Desc: "Arrastre un archivo KML al mapa o haga clic en abrir proyecto.",
    step2: "2. Definir Centro de Carga",
    step2Desc: "Haga clic en el mapa o busque una dirección para iniciar.",
    step3: "3. Diseño Generativo",
    step3Desc: "Abra el panel lateral para generar y optimizar la red.",
    actionSearch: "Buscar Dirección",
    actionClick: "Seleccionar en Mapa",
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
      className="absolute inset-0 z-[450] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm pointer-events-none"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="glass-card pointer-events-auto w-full max-w-md overflow-hidden rounded-3xl border border-sky-400/30 bg-white/95 shadow-[0_32px_64px_-12px_rgba(15,23,42,0.3)] dark:border-white/10 dark:bg-slate-900/95"
      >
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white text-center">
          <h2 className="text-xl font-black tracking-tight">{t.title}</h2>
          <p className="mt-1 text-xs font-medium text-blue-100 opacity-90">{t.subtitle}</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Step 1 */}
          <div className="flex items-start gap-4 rounded-2xl bg-slate-50 p-4 border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700/50">
            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
              <FileDown size={16} />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{t.step1}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.step1Desc}</div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative flex flex-col gap-3 rounded-2xl bg-white p-4 border-2 border-indigo-500 shadow-lg shadow-indigo-500/10 dark:bg-slate-800 dark:border-indigo-400">
            <div className="absolute -top-1.5 -right-1.5 flex h-3 w-3 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
            </div>
            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
                <MapPin size={16} />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{t.step2}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.step2Desc}</div>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={onMapClickAction}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-indigo-50 py-2 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
              >
                <MousePointer2 size={14} />
                {t.actionClick}
              </button>
              <button
                onClick={onStartSearch}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-indigo-50 py-2 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
              >
                <Search size={14} />
                {t.actionSearch}
              </button>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-4 rounded-2xl bg-slate-50 p-4 border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700/50 opacity-60">
            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400">
              <Zap size={16} />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{t.step3}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.step3Desc}</div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
