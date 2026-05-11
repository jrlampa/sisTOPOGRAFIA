import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Map as MapIcon, Search, TrendingUp, Compass, Hexagon, Circle } from "lucide-react";
import {
  FormFieldMessage,
  getValidationInputClassName,
} from "./FormFieldFeedback";
import { MAX_RADIUS, MIN_RADIUS } from "../constants";
import type { GeoLocation, SelectionMode } from "../types";
import { getSearchQueryFeedback } from "../utils/validation";
import type { AppLocale } from "../types";
import { getSidebarSelectionText } from "../i18n/sidebarSelectionText";

type Props = {
  locale: AppLocale;
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
  locale,
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
  const t = getSidebarSelectionText(locale);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Search Card */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 flex items-center gap-2">
            <Compass size={14} className="text-cyan-500" />
            {t.targetArea}
          </label>
        </div>
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="relative group">
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              aria-label={t.targetArea}
              aria-describedby="area-alvo-feedback"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full rounded-2xl border-2 bg-slate-900/50 py-3.5 pl-12 pr-20 text-xs font-bold text-white shadow-inner transition-all placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 dark:border-white/10 ${getValidationInputClassName(searchValidation.state, "dark")}`}
            />
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-cyan-400"
              size={18}
            />
            <AnimatePresence>
              {searchQuery.trim() && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: 10 }}
                  type="submit"
                  disabled={isSearching || searchValidation.state === "error"}
                  className="absolute right-2 top-2 bottom-2 rounded-xl bg-cyan-600 px-4 text-[10px] font-black text-white transition-all shadow-lg shadow-cyan-600/20 hover:bg-cyan-500 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isSearching ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <span className="uppercase tracking-widest">{t.btnSearch}</span>
                  )}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          <FormFieldMessage
            id="area-alvo-feedback"
            tone={searchValidation.state}
            message={searchValidation.message}
            palette="dark"
          />
        </form>

        <AnimatePresence>
          {center.label && (
            <motion.div
              layoutId="location-badge"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 shadow-inner"
            >
              <div className="rounded-xl bg-cyan-500/20 p-2 text-cyan-400 ring-1 ring-cyan-500/30">
                <MapIcon size={16} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-cyan-100 truncate">{center.label}</span>
                <span className="text-[10px] text-cyan-500/80 font-mono tracking-widest">
                  {center.lat.toPrecision(7)}, {center.lng.toPrecision(7)}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="h-px bg-white/5" />

      {/* Control Section */}
      <div className="space-y-6">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
              {t.selectionMode}
            </label>
          </div>
          <div className="flex gap-2 p-1 rounded-2xl border border-white/5 bg-slate-900/40 shadow-inner">
            <button
              onClick={() => onSelectionModeChange("circle")}
              className={`flex-1 rounded-xl py-2.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${selectionMode === "circle" ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
            >
              <Circle size={14} />
              {t.modeRadius}
            </button>
            <button
              onClick={() => onSelectionModeChange("polygon")}
              className={`flex-1 rounded-xl py-2.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${selectionMode === "polygon" ? "bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-600/20" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
            >
              <Hexagon size={14} />
              {t.modePolygon}
            </button>
            <button
              onClick={() => onSelectionModeChange("measure")}
              className={`px-4 rounded-xl flex items-center justify-center transition-all ${selectionMode === "measure" ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
              title={t.modeProfileTitle}
            >
              <TrendingUp size={16} />
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {selectionMode === "circle" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 bg-white/5 p-4 rounded-2xl border border-white/5"
            >
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                  {t.regionRadius}
                </label>
                <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 shadow-sm">
                  <span className="text-xs font-mono font-black text-cyan-400">
                    {radius}
                  </span>
                  <span className="ml-1 text-[10px] font-bold text-cyan-500/80 uppercase">
                    {t.meters}
                  </span>
                </div>
              </div>
              <div className="relative pt-2">
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
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 shadow-inner outline-none focus:ring-2 focus:ring-cyan-500/30"
                />
                <div className="flex justify-between mt-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  <span>{MIN_RADIUS}m</span>
                  <span>{MAX_RADIUS}m</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="h-px bg-white/5" />

      {/* Action Button */}
      <div className="pt-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onAnalyze}
          disabled={
            isProcessing || (selectionMode === "polygon" && !isPolygonValid)
          }
          className={`group w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] tracking-[0.25em] uppercase transition-all shadow-xl ${
            isProcessing || (selectionMode === "polygon" && !isPolygonValid)
              ? "cursor-not-allowed border border-white/5 bg-white/5 text-slate-500"
              : "border border-indigo-500/30 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:brightness-110"
          }`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="animate-spin text-white/50" size={16} />
              {t.btnProcessing}
            </>
          ) : (
            <>
              <div className="rounded-lg bg-white/20 p-1.5 transition-transform group-hover:rotate-12 ring-1 ring-white/30">
                <TrendingUp size={14} />
              </div>
              {t.btnAnalyzeRegion}
            </>
          )}
        </motion.button>
        {selectionMode === "polygon" && (
          <FormFieldMessage
            className="mt-3 text-center"
            tone={isPolygonValid ? "success" : "error"}
            message={
              isPolygonValid
                ? t.polygonReady
                : t.polygonInvalid
            }
            palette="dark"
          />
        )}
      </div>
    </motion.div>
  );
}
