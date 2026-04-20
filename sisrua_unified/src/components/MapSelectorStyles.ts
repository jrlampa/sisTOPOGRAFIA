import L from "leaflet";
import { BtTransformer } from "../types";

export const LEAFLET_ICON_BASE_URL = import.meta.env.BASE_URL;
export const POPUP_TOOLBAR_CLASS = "mt-1.5 flex items-center gap-2";
export const POPUP_FLAG_GRID_CLASS = "mt-1.5 grid grid-cols-2 gap-1.5";

export const getFlagButtonClass = (
  isActive: boolean,
  variant: "existing" | "new" | "replace" | "remove",
) => {
  const baseClass =
    "h-6 rounded border bg-white text-[10px] font-bold transition-colors";

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
  variant: "danger" | "sky" | "slate" | "violet",
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

export const getPoleChangeFlag = (pole: {
  nodeChangeFlag?: "existing" | "new" | "remove" | "replace";
}) => pole.nodeChangeFlag ?? "existing";

export const getTransformerChangeFlag = (transformer: BtTransformer) =>
  transformer.transformerChangeFlag ?? "existing";

export const DefaultIcon = L.icon({
  iconRetinaUrl: `${LEAFLET_ICON_BASE_URL}marker-icon-2x.png`,
  iconUrl: `${LEAFLET_ICON_BASE_URL}marker-icon.png`,
  shadowUrl: `${LEAFLET_ICON_BASE_URL}marker-shadow.png`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
