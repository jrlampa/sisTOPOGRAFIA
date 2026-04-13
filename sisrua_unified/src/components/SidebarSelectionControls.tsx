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
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            Area Alvo
          </label>
        </div>
        <form onSubmit={handleSearch} className="space-y-2">
          <div className="relative group">
            <input
              type="text"
              placeholder="Cidade, Endereco ou Coordenadas (UTM)"
              aria-label="Search area"
              aria-describedby="area-alvo-feedback"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full bg-slate-900 border rounded-xl py-3 pl-12 pr-20 text-sm focus:outline-none focus:ring-2 transition-all shadow-inner ${getValidationInputClassName(searchValidation.state)}`}
            />
            <Search
              className="absolute left-4 top-3.5 text-slate-600 group-focus-within:text-blue-500 transition-colors"
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
                  className="absolute right-2 top-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20"
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
            className="flex items-center gap-3 text-xs text-blue-400 bg-blue-500/5 p-3 rounded-xl border border-blue-500/10"
          >
            <div className="p-1.5 bg-blue-500/10 rounded-lg">
              <MapIcon size={14} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold truncate">{center.label}</span>
              <span className="text-[10px] text-slate-400 font-mono italic">
                {center.lat.toPrecision(7)}, {center.lng.toPrecision(7)}
              </span>
            </div>
          </motion.div>
        )}
      </div>

      <div className="h-px bg-white/5 mx-2"></div>

      {/* Control Section */}
      <div className="space-y-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Modo de Selecao
            </label>
          </div>
          <div className="flex p-1 bg-slate-900 rounded-xl border border-white/5">
            <button
              onClick={() => onSelectionModeChange("circle")}
              className={`flex-1 text-[10px] font-bold py-2 rounded-lg transition-all ${selectionMode === "circle" ? "bg-slate-800 text-blue-400 shadow-xl border border-white/5" : "text-slate-400 hover:text-slate-200"}`}
            >
              RAIO
            </button>
            <button
              onClick={() => onSelectionModeChange("polygon")}
              className={`flex-1 text-[10px] font-bold py-2 rounded-lg transition-all ${selectionMode === "polygon" ? "bg-slate-800 text-blue-400 shadow-xl border border-white/5" : "text-slate-400 hover:text-slate-200"}`}
            >
              POLIGONO
            </button>
            <button
              onClick={() => onSelectionModeChange("measure")}
              className={`flex-none px-3 py-2 rounded-lg transition-all ${selectionMode === "measure" ? "bg-emerald-600 text-white shadow-xl shadow-emerald-500/10" : "text-slate-400 hover:text-slate-200"}`}
              title="Modo Perfil"
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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                Raio da Regiao
              </label>
              <div className="bg-slate-900 border border-white/5 px-2.5 py-1 rounded-lg">
                <span className="text-xs font-mono font-bold text-blue-400">
                  {radius}
                </span>
                <span className="text-[10px] text-slate-400 ml-1">METROS</span>
              </div>
            </div>
            <div className="relative pt-1">
              <input
                type="range"
                aria-label="Raio da regiao"
                min={MIN_RADIUS}
                max={MAX_RADIUS}
                step={10}
                value={radius}
                onMouseDown={saveSnapshot}
                onTouchStart={saveSnapshot}
                onChange={(e) => onRadiusChange(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
              />
              <div className="flex justify-between mt-2 text-[9px] font-bold text-slate-400 uppercase">
                <span>{MIN_RADIUS}m</span>
                <span>{MAX_RADIUS}m</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <div className="h-px bg-white/5 mx-2"></div>

      {/* Action Button */}
      <div>
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onAnalyze}
          disabled={
            isProcessing || (selectionMode === "polygon" && !isPolygonValid)
          }
          className={`group w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-xs tracking-widest uppercase transition-all shadow-2xl ${
            isProcessing || (selectionMode === "polygon" && !isPolygonValid)
              ? "bg-slate-800 text-slate-600 cursor-not-allowed border border-white/5"
              : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-blue-500/30"
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
              ANALISAR REGIAO
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
