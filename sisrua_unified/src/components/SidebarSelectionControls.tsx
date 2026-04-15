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
          <label className="text-[10px] font-black text-amber-800 dark:text-amber-100 uppercase tracking-[0.22em]">
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
              className={`w-full rounded-2xl border-2 border-amber-800/25 bg-amber-50 py-3 pl-12 pr-20 text-sm text-amber-950 shadow-inner transition-all placeholder:text-amber-700/70 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 dark:border-amber-500/45 dark:bg-zinc-950 dark:text-amber-100 dark:placeholder:text-amber-200/55 ${getValidationInputClassName(searchValidation.state)}`}
            />
            <Search
              className="absolute left-4 top-3.5 text-amber-600 dark:text-amber-200 group-focus-within:text-cyan-500 transition-colors"
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
                  className="absolute right-2 top-2 rounded-xl border-2 border-black/15 bg-amber-500 px-3 py-1.5 text-[10px] font-black text-white transition-all hover:bg-amber-600 disabled:opacity-50 dark:border-amber-300/25 dark:bg-cyan-600 dark:hover:bg-cyan-500"
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
            className="flex items-center gap-3 rounded-2xl border-2 border-cyan-700/30 bg-cyan-50 p-3 text-xs text-cyan-900 dark:border-cyan-400/45 dark:bg-cyan-950/35 dark:text-cyan-200"
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

      <div className="mx-1 h-px bg-amber-800/20 dark:bg-amber-500/30"></div>

      {/* Control Section */}
      <div className="space-y-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black text-amber-800 dark:text-amber-100 uppercase tracking-[0.22em]">
              Modo de seleção
            </label>
          </div>
          <div className="flex rounded-2xl border-2 border-amber-800/25 bg-amber-50 p-1 shadow-[4px_4px_0_rgba(124,45,18,0.12)] dark:border-amber-500/45 dark:bg-zinc-950 dark:shadow-[4px_4px_0_rgba(251,146,60,0.2)]">
            <button
              onClick={() => onSelectionModeChange("circle")}
              className={`flex-1 rounded-xl py-2 text-[10px] font-black transition-all ${selectionMode === "circle" ? "border-2 border-blue-600 bg-blue-600 text-white shadow-sm" : "text-amber-800 hover:text-amber-950 dark:text-amber-200 dark:hover:text-amber-50"}`}
            >
              RAIO
            </button>
            <button
              onClick={() => onSelectionModeChange("polygon")}
              className={`flex-1 rounded-xl py-2 text-[10px] font-black transition-all ${selectionMode === "polygon" ? "border-2 border-indigo-600 bg-indigo-600 text-white shadow-sm" : "text-amber-800 hover:text-amber-950 dark:text-amber-200 dark:hover:text-amber-50"}`}
            >
              POLÍGONO
            </button>
            <button
              onClick={() => onSelectionModeChange("measure")}
              className={`flex-none rounded-xl px-3 py-2 transition-all ${selectionMode === "measure" ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20" : "text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"}`}
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
              <label className="text-[10px] font-black text-amber-800 dark:text-amber-100 uppercase tracking-[0.22em]">
                Raio da região
              </label>
              <div className="rounded-xl border-2 border-amber-800/25 bg-white px-2.5 py-1 shadow-sm dark:border-amber-500/45 dark:bg-zinc-900">
                <span className="text-xs font-mono font-bold text-cyan-700 dark:text-cyan-300">
                  {radius}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-1">
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

      <div className="mx-1 h-px bg-amber-800/20 dark:bg-amber-500/30"></div>

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
              ? "cursor-not-allowed border-2 border-amber-800/25 bg-amber-100 text-amber-400 dark:border-amber-500/30 dark:bg-zinc-900 dark:text-amber-700"
              : "border-2 border-black/15 bg-gradient-to-r from-fuchsia-600 via-blue-600 to-cyan-500 text-white shadow-fuchsia-700/25 hover:brightness-110 dark:border-cyan-200/20"
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
