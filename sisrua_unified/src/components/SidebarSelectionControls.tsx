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
          <label className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-[0.2em]">
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
              className={`w-full bg-white/75 dark:bg-slate-900/55 backdrop-blur-md border border-slate-200/90 dark:border-white/10 rounded-xl py-3 pl-12 pr-20 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all shadow-inner text-slate-800 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-500 ${getValidationInputClassName(searchValidation.state)}`}
            />
            <Search
              className="absolute left-4 top-3.5 text-slate-400 dark:text-slate-500 group-focus-within:text-cyan-500 transition-colors"
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
                  className="absolute right-2 top-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-cyan-500/20"
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
            className="flex items-center gap-3 text-xs text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 p-3 rounded-xl border border-cyan-500/20"
          >
            <div className="p-1.5 bg-cyan-500/15 rounded-lg">
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

      <div className="h-px bg-slate-200/70 dark:bg-white/10 mx-1"></div>

      {/* Control Section */}
      <div className="space-y-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-[0.2em]">
              Modo de seleção
            </label>
          </div>
          <div className="flex p-1 bg-white/70 dark:bg-slate-900/55 backdrop-blur-md rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
            <button
              onClick={() => onSelectionModeChange("circle")}
              className={`flex-1 text-[10px] font-bold py-2 rounded-lg transition-all ${selectionMode === "circle" ? "bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 shadow-md border border-slate-200 dark:border-white/10" : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              RAIO
            </button>
            <button
              onClick={() => onSelectionModeChange("polygon")}
              className={`flex-1 text-[10px] font-bold py-2 rounded-lg transition-all ${selectionMode === "polygon" ? "bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 shadow-md border border-slate-200 dark:border-white/10" : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              POLÍGONO
            </button>
            <button
              onClick={() => onSelectionModeChange("measure")}
              className={`flex-none px-3 py-2 rounded-lg transition-all ${selectionMode === "measure" ? "bg-emerald-500 dark:bg-emerald-600 text-white shadow-md shadow-emerald-500/20" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
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
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                Raio da região
              </label>
              <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-white/5 px-2.5 py-1 rounded-lg shadow-sm">
                <span className="text-xs font-mono font-bold text-cyan-700 dark:text-cyan-300">
                  {radius}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-1">METROS</span>
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

      <div className="h-px bg-slate-200/70 dark:bg-white/10 mx-1"></div>

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
              ? "bg-slate-200/50 dark:bg-slate-800/50 backdrop-blur-md text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-300/50 dark:border-white/5"
              : "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-500/20 text-white hover:shadow-blue-500/40"
          }`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              PROCESSANDO...
            </>
          ) : (
            <>
              <div className="p-1 rounded bg-white/10 group-hover:rotate-12 transition-transform">
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
