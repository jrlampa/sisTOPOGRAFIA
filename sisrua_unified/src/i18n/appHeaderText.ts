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
  openHelp: string;
  autoSaveSaving: string;
  autoSaveError: string;
  autoSaveSuccess: string;
  recentHistory: string;
  present: string;
  noActions: string;
  undoAction: string;
  redoAction: string;
  historyTooltip: string;
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
    openHelp: "Abrir ajuda",
    autoSaveSaving: "sincronizando",
    autoSaveError: "erro ao sincronizar",
    autoSaveSuccess: "salvo agora",
    recentHistory: "Histórico Recente",
    present: "Presente",
    noActions: "Sem ações registradas",
    undoAction: "Desfazer",
    redoAction: "Refazer",
    historyTooltip: "Ver histórico de ações",
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
    openHelp: "Open help",
    autoSaveSaving: "syncing",
    autoSaveError: "sync error",
    autoSaveSuccess: "saved now",
    recentHistory: "Recent History",
    present: "Present",
    noActions: "No actions recorded",
    undoAction: "Undo",
    redoAction: "Redo",
    historyTooltip: "View action history",
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
    saveProject: "Guardar projeto",
    openProject: "Abrir projeto",
    selectProjectFile: "Seleccionar archivo de projeto",
    openSettings: "Abrir configuraciones",
    openHelp: "Abrir ayuda",
    autoSaveSaving: "sincronizando",
    autoSaveError: "error al sincronizar",
    autoSaveSuccess: "guardado ahora",
    recentHistory: "Historial Reciente",
    present: "Presente",
    noActions: "No hay acciones registradas",
    undoAction: "Deshacer",
    redoAction: "Rehacer",
    historyTooltip: "Ver historial de acciones",
    },
    };


export function getAppHeaderText(locale: AppLocale): AppHeaderText {
  return TEXTS[locale] ?? TEXTS["pt-BR"];
}
