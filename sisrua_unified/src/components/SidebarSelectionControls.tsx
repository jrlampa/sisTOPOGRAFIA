import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Map as MapIcon, Search, TrendingUp } from "lucide-react";
import {
  FormFieldMessage,
  getValidationInputClassName,
} from "./FormFieldFeedback";
import { MAX_RADIUS, MIN_RADIUS } from "../constants";
import type { GeoLocation, SelectionMode } from "../types";
import { getSearchQueryFeedback } from "../utils/validation";

type Props = {
  center: GeoLocation;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  isSearching: boolean;
  handleSearch: (e: React.FormEvent) => Promise<void>;
  selectionMode: SelectionMode;
  onSelectionModeChange: (mode: SelectionMode) => void;
  radius: number;
  onRadiusChange: (radius: number) => void;
  saveSnapshot: () => void;
  onAnalyze: () => void;
  isProcessing: boolean;
  isPolygonValid: boolean;
};

export function SidebarSelectionControls({
  center,
  searchQuery,
  setSearchQuery,
  isSearching,
  handleSearch,
  selectionMode,
  onSelectionModeChange,
  radius,
  onRadiusChange,
  saveSnapshot,
  onAnalyze,
  isProcessing,
  isPolygonValid,
}: Props) {
  const searchValidation = getSearchQueryFeedback(searchQuery);

  return (
    <>
      {/* Search Card */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-600 dark:text-slate-300">
            Área alvo
          </label>
        </div>
        <form onSubmit={handleSearch} className="space-y-2">
          <div className="relative group">
            <input
              type="text"
              placeholder="Cidade, endereço ou coordenadas (UTM)"
              aria-label="Buscar área"
              aria-describedby="area-alvo-feedback"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full rounded-2xl border border-sky-200 bg-white py-3 pl-12 pr-20 text-sm text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] transition-all placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500 ${getValidationInputClassName(searchValidation.state)}`}
            />
            <Search
              className="absolute left-4 top-3.5 text-slate-400 transition-colors group-focus-within:text-cyan-500 dark:text-slate-500"
              size={18}
            />
            <AnimatePresence>
              {searchQuery.trim() && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  type="submit"
                  disabled={isSearching || searchValidation.state === "error"}
                  className="absolute right-2 top-2 rounded-xl border border-cyan-200 bg-cyan-500 px-3 py-1.5 text-[10px] font-black text-white transition-all hover:bg-cyan-600 disabled:opacity-50 dark:border-cyan-300/20 dark:bg-cyan-600 dark:hover:bg-cyan-500"
                >
                  {isSearching ? (
                    <Loader2 className="animate-spin" size={12} />
                  ) : (
                    "BUSCAR"
                  )}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          <FormFieldMessage
            id="area-alvo-feedback"
            tone={searchValidation.state}
            message={searchValidation.message}
          />
        </form>

        {center.label && (
          <motion.div
            layoutId="location-badge"
            className="flex items-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50/80 p-3 text-xs text-cyan-900 dark:border-cyan-400/25 dark:bg-cyan-950/35 dark:text-cyan-200"
          >
            <div className="rounded-xl bg-cyan-100 p-1.5 dark:bg-cyan-900/60">
              <MapIcon size={14} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold truncate">{center.label}</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono italic">
                {center.lat.toPrecision(7)}, {center.lng.toPrecision(7)}
              </span>
            </div>
          </motion.div>
        )}
      </div>

      <div className="mx-1 h-px bg-slate-200 dark:bg-white/10"></div>

      {/* Control Section */}
      <div className="space-y-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
              <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-600 dark:text-slate-300">
              Modo de seleção
            </label>
          </div>
          <div className="flex rounded-2xl border border-sky-200 bg-sky-50/70 p-1 shadow-[0_12px_24px_rgba(148,163,184,0.14)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <button
              onClick={() => onSelectionModeChange("circle")}
              className={`flex-1 rounded-xl py-2 text-[10px] font-black transition-all ${selectionMode === "circle" ? "bg-cyan-100 text-cyan-700 shadow-sm ring-1 ring-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-100 dark:ring-cyan-400/25" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"}`}
            >
              RAIO
            </button>
            <button
              onClick={() => onSelectionModeChange("polygon")}
              className={`flex-1 rounded-xl py-2 text-[10px] font-black transition-all ${selectionMode === "polygon" ? "bg-cyan-100 text-cyan-700 shadow-sm ring-1 ring-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-100 dark:ring-cyan-400/25" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"}`}
            >
              POLÍGONO
            </button>
            <button
              onClick={() => onSelectionModeChange("measure")}
              className={`flex-none rounded-xl px-3 py-2 transition-all ${selectionMode === "measure" ? "bg-cyan-100 text-cyan-700 shadow-sm ring-1 ring-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-100 dark:ring-cyan-400/25" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"}`}
              title="Modo perfil"
            >
              <TrendingUp size={14} />
            </button>
          </div>
        </div>

        {selectionMode === "circle" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-600 dark:text-slate-300">
                Raio da região
              </label>
              <div className="rounded-xl border border-sky-200 bg-white px-2.5 py-1 shadow-sm dark:border-white/10 dark:bg-white/5">
                <span className="text-xs font-mono font-bold text-cyan-700 dark:text-cyan-300">
                  {radius}
                </span>
                <span className="ml-1 text-[10px] text-slate-500 dark:text-slate-400">
                  METROS
                </span>
              </div>
            </div>
            <div className="relative pt-1">
              <input
                type="range"
                aria-label="Raio da região"
                min={MIN_RADIUS}
                max={MAX_RADIUS}
                step={10}
                value={radius}
                onMouseDown={saveSnapshot}
                onTouchStart={saveSnapshot}
                onChange={(e) => onRadiusChange(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-600 hover:accent-cyan-500 dark:hover:accent-cyan-400 shadow-inner"
              />
              <div className="flex justify-between mt-2 text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                <span>{MIN_RADIUS}m</span>
                <span>{MAX_RADIUS}m</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <div className="mx-1 h-px bg-slate-200 dark:bg-white/10"></div>

      {/* Action Button */}
      <div>
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onAnalyze}
          disabled={
            isProcessing || (selectionMode === "polygon" && !isPolygonValid)
          }
          className={`group w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-xs tracking-widest uppercase transition-all shadow-xl ${
            isProcessing || (selectionMode === "polygon" && !isPolygonValid)
              ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-600"
              : "border border-blue-400/20 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-[0_18px_36px_rgba(79,70,229,0.28)] hover:brightness-110 dark:border-cyan-200/20"
          }`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              PROCESSANDO...
            </>
          ) : (
            <>
              <div className="rounded bg-white/10 p-1 transition-transform group-hover:rotate-12">
                <TrendingUp size={16} />
              </div>
              ANALISAR REGIÃO
            </>
          )}
        </motion.button>
        {selectionMode === "polygon" && (
          <FormFieldMessage
            className="mt-2"
            tone={isPolygonValid ? "default" : "error"}
            message={
              isPolygonValid
                ? "Poligono pronto para análise."
                : "Desenhe ao menos 3 pontos válidos para habilitar a análise da área."
            }
          />
        )}
      </div>
    </>
  );
}
