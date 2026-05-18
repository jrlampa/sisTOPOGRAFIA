import L from "leaflet";
import type { MapBtPole, MapBtTransformer } from "../types.map";

export const LEAFLET_ICON_BASE_URL = import.meta.env.BASE_URL;

// ─── Glassmorphism Popup Styles ──────────────────────────────────────────────
export const POPUP_CONTAINER_CLASS = "premium-map-popup";
export const POPUP_TOOLBAR_CLASS = "mt-2 flex items-center gap-2 border-t border-slate-100 pt-2 dark:border-white/10";
export const POPUP_FLAG_GRID_CLASS = "mt-2 grid grid-cols-2 gap-1.5";
export const POPUP_SELECT_CLASS =
  "h-8 w-full rounded-lg border border-slate-200 bg-white/50 px-2 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-200";

// ─── Botões de Ação ──────────────────────────────────────────────────────────
export const getFlagButtonClass = (
  isActive: boolean,
  variant: "existing" | "new" | "replace" | "remove",
) => {
  const baseClass =
    "h-7 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all active:scale-95";

  if (variant === "new") {
    return `${baseClass} border-green-500/30 text-green-600 ${isActive ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : "bg-green-500/5 hover:bg-green-500/10"}`;
  }

  if (variant === "replace") {
    return `${baseClass} border-amber-500/30 text-amber-600 ${isActive ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" : "bg-amber-500/5 hover:bg-amber-500/10"}`;
  }

  if (variant === "remove") {
    return `${baseClass} border-rose-500/30 text-rose-600 ${isActive ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" : "bg-rose-500/5 hover:bg-rose-500/10"}`;
  }

  return `${baseClass} border-blue-500/30 text-blue-600 ${isActive ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-blue-500/5 hover:bg-blue-500/10"}`;
};

export const getIconActionButtonClass = (
  variant: "danger" | "sky" | "slate" | "violet" | "amber" | "rose" | "emerald",
  active = false,
) => {
  const baseClass =
    "inline-flex h-7 w-8 items-center justify-center rounded-lg border transition-all active:scale-90 shadow-sm";

  const variants = {
    danger: "border-rose-500/30 text-rose-500 bg-rose-500/5 hover:bg-rose-500 hover:text-white",
    sky: "border-sky-500/30 text-sky-500 bg-sky-500/5 hover:bg-sky-500 hover:text-white",
    amber: "border-amber-500/30 text-amber-500 bg-amber-500/5 hover:bg-amber-500 hover:text-white",
    rose: "border-rose-500/30 text-rose-500 bg-rose-500/5 hover:bg-rose-500 hover:text-white",
    emerald: "border-emerald-500/30 text-emerald-500 bg-emerald-500/5 hover:bg-emerald-500 hover:text-white",
    violet: active 
      ? "border-violet-600 bg-violet-600 text-white shadow-lg shadow-violet-600/20" 
      : "border-slate-300 text-slate-500 bg-slate-50 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
    slate: "border-slate-300 text-slate-500 bg-slate-50 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
  };

  return `${baseClass} ${variants[variant]}`;
};

// ─── Cores e Marcadores ──────────────────────────────────────────────────────
export const getFlagColor = (
  flag: "existing" | "new" | "remove" | "replace",
  fallback: string,
) => {
  if (flag === "new") return "#22c55e";
  if (flag === "remove") return "#f43f5e";
  if (flag === "replace") return "#fbbf24";
  return fallback;
};

export const getPoleChangeFlag = (pole: MapBtPole) =>
  pole.nodeChangeFlag ?? "existing";

export const getTransformerChangeFlag = (transformer: MapBtTransformer) =>
  transformer.transformerChangeFlag ?? "existing";

export const getCqtHeatmapColor = (dvPercent: number): string => {
  if (dvPercent > 7) return "#ef4444"; // Red
  if (dvPercent > 5) return "#f97316"; // Orange
  if (dvPercent > 3) return "#fbbf24"; // Yellow
  return "#22c55e"; // Green
};

// ─── Custom Professional Icons ───────────────────────────────────────────────
const createHtmlIcon = (color: string, iconHtml: string) => L.divIcon({
  className: "custom-map-icon",
  html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-xl ring-2 ring-white/50 overflow-hidden">
           <div class="flex items-center justify-center w-full h-full" style="background-color: ${color}20">
             ${iconHtml}
           </div>
         </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

export const DefaultIcon = L.icon({
  iconRetinaUrl: `${LEAFLET_ICON_BASE_URL}marker-icon-2x.png`,
  iconUrl: `${LEAFLET_ICON_BASE_URL}marker-icon.png`,
  shadowUrl: `${LEAFLET_ICON_BASE_URL}marker-shadow.png`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export const LocationIcon = L.divIcon({
  className: "pulse-location-icon",
  html: `<div class="relative flex h-6 w-6">
           <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
           <span class="relative inline-flex rounded-full h-6 w-6 bg-sky-500 border-2 border-white shadow-lg"></span>
         </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});
