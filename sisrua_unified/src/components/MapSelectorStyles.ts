import L from "leaflet";
import type { MapBtPole, MapBtTransformer } from "../types.map";

export const LEAFLET_ICON_BASE_URL = import.meta.env.BASE_URL;
export const POPUP_TOOLBAR_CLASS = "mt-1.5 flex items-center gap-2";
export const POPUP_FLAG_GRID_CLASS = "mt-1.5 grid grid-cols-2 gap-1.5";
export const POPUP_SELECT_CLASS =
  "h-7 w-full rounded border border-slate-300 bg-white px-1.5 text-[11px] font-semibold text-slate-700";

export const getFlagButtonClass = (
  isActive: boolean,
  variant: "existing" | "new" | "replace" | "remove",
) => {
  const baseClass =
    "h-6 rounded border bg-white text-xs font-bold transition-colors";

  if (variant === "new") {
    return `${baseClass} border-green-500 text-green-700 ${isActive ? "bg-green-100" : "hover:bg-green-50"}`;
  }

  if (variant === "replace") {
    return `${baseClass} border-yellow-400 text-yellow-700 ${isActive ? "bg-yellow-100" : "hover:bg-yellow-50"}`;
  }

  if (variant === "remove") {
    return `${baseClass} border-red-500 text-red-700 ${isActive ? "bg-red-100" : "hover:bg-red-50"}`;
  }

  return `${baseClass} border-fuchsia-500 text-fuchsia-700 ${isActive ? "bg-fuchsia-100" : "hover:bg-fuchsia-50"}`;
};

export const getIconActionButtonClass = (
  variant: "danger" | "sky" | "slate" | "violet" | "amber" | "rose" | "emerald",
  active = false,
) => {
  const baseClass =
    "inline-flex h-6 w-7 items-center justify-center rounded border transition-colors";

  if (variant === "danger") {
    return `${baseClass} border-red-500 text-red-500 ${active ? "bg-red-100" : "bg-red-500/10 hover:bg-red-100"}`;
  }

  if (variant === "sky") {
    return `${baseClass} border-sky-500 text-sky-600 bg-sky-500/10 hover:bg-sky-100`;
  }

  if (variant === "amber") {
    return `${baseClass} border-amber-500 text-amber-600 bg-amber-500/10 hover:bg-amber-100`;
  }

  if (variant === "rose") {
    return `${baseClass} border-rose-500 text-rose-600 bg-rose-500/10 hover:bg-rose-100`;
  }

  if (variant === "emerald") {
    return `${baseClass} border-emerald-500 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-100`;
  }

  if (variant === "violet") {
    return `${baseClass} ${active ? "border-violet-700 text-violet-700 bg-violet-100" : "border-slate-500 text-slate-600 bg-slate-100 hover:bg-slate-200"}`;
  }

  return `${baseClass} border-slate-500 text-slate-700 bg-slate-100 hover:bg-slate-200`;
};

export const getFlagColor = (
  flag: "existing" | "new" | "remove" | "replace",
  fallback: string,
) => {
  if (flag === "new") return "#22c55e";
  if (flag === "remove") return "#ef4444";
  if (flag === "replace") return "#facc15";
  return fallback;
};

export const getPoleChangeFlag = (pole: MapBtPole) =>
  pole.nodeChangeFlag ?? "existing";

export const getTransformerChangeFlag = (transformer: MapBtTransformer) =>
  transformer.transformerChangeFlag ?? "existing";

export const getCqtHeatmapColor = (dvPercent: number): string => {
  if (dvPercent > 7) return "#ef4444"; // Vermelho (Crítico)
  if (dvPercent > 5) return "#f97316"; // Laranja (Atenção)
  if (dvPercent > 3) return "#eab308"; // Amarelo (Alerta)
  return "#22c55e"; // Verde (Saudável)
};

export const DefaultIcon = L.icon({
  iconRetinaUrl: `${LEAFLET_ICON_BASE_URL}marker-icon-2x.png`,
  iconUrl: `${LEAFLET_ICON_BASE_URL}marker-icon.png`,
  shadowUrl: `${LEAFLET_ICON_BASE_URL}marker-shadow.png`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
