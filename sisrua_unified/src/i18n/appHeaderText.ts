import type { AppLocale } from "../types";

type AppHeaderText = {
  backendStatusOnline: string;
  backendStatusDegraded: string;
  backendStatusOffline: string;
  apiOnline: string;
  apiDegraded: string;
  apiOffline: string;
  geoelectricEngineering: string;
  toggleSidebarOpen: string;
  toggleSidebarClose: string;
  mapModeInfo: string;
  saveProject: string;
  openProject: string;
  selectProjectFile: string;
  openSettings: string;
};

const TEXTS: Record<AppLocale, AppHeaderText> = {
  "pt-BR": {
    backendStatusOnline: "Backend online",
    backendStatusDegraded: "Backend degradado",
    backendStatusOffline: "Backend offline",
    apiOnline: "API ONLINE",
    apiDegraded: "API DEGRADADA",
    apiOffline: "API OFFLINE",
    geoelectricEngineering: "Engenharia Geoelétrica",
    toggleSidebarOpen: "Mostrar painel lateral",
    toggleSidebarClose: "Engavetar painel lateral",
    mapModeInfo: "Modo mapa: keyboard+mouse",
    saveProject: "Salvar projeto",
    openProject: "Abrir projeto",
    selectProjectFile: "Selecionar arquivo de projeto",
    openSettings: "Abrir configurações",
  },
  "en-US": {
    backendStatusOnline: "Backend online",
    backendStatusDegraded: "Backend degraded",
    backendStatusOffline: "Backend offline",
    apiOnline: "API ONLINE",
    apiDegraded: "API DEGRADED",
    apiOffline: "API OFFLINE",
    geoelectricEngineering: "Geoelectric Engineering",
    toggleSidebarOpen: "Show sidebar",
    toggleSidebarClose: "Hide sidebar",
    mapModeInfo: "Map mode: keyboard+mouse",
    saveProject: "Save project",
    openProject: "Open project",
    selectProjectFile: "Select project file",
    openSettings: "Open settings",
  },
  "es-ES": {
    backendStatusOnline: "Backend en línea",
    backendStatusDegraded: "Backend degradado",
    backendStatusOffline: "Backend fuera de línea",
    apiOnline: "API EN LÍNEA",
    apiDegraded: "API DEGRADADA",
    apiOffline: "API FUERA DE LÍNEA",
    geoelectricEngineering: "Ingeniería Geoeléctrica",
    toggleSidebarOpen: "Mostrar panel lateral",
    toggleSidebarClose: "Ocultar panel lateral",
    mapModeInfo: "Modo mapa: teclado+ratón",
    saveProject: "Guardar proyecto",
    openProject: "Abrir proyecto",
    selectProjectFile: "Seleccionar archivo de proyecto",
    openSettings: "Abrir configuraciones",
  },
};

export function getAppHeaderText(locale: AppLocale): AppHeaderText {
  return TEXTS[locale] ?? TEXTS["pt-BR"];
}
