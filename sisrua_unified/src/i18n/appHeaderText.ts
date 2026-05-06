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
  autoSaveAt: string;
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
    autoSaveAt: "salvo às",
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
    autoSaveAt: "saved at",
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
    saveProject: "Guardar proyecto",
    openProject: "Abrir proyecto",
    selectProjectFile: "Seleccionar archivo de proyecto",
    openSettings: "Abrir configuraciones",
    openHelp: "Abrir ayuda",
    autoSaveSaving: "sincronizando",
    autoSaveError: "error al sincronizar",
    autoSaveSuccess: "guardado ahora",
    autoSaveAt: "guardado a las",
    recentHistory: "Historial Reciente",
    present: "Presente",
    noActions: "No hay acciones registradas",
    undoAction: "Deshacer",
    redoAction: "Rehacer",
    historyTooltip: "Ver historial de acciones",
  },
};

type ExtraHeaderKeys = {
  closeMenu: string;
  openMenu: string;
  menu: string;
  navigate: string;
  execute: string;
};

const EXTRA_TEXTS: Record<AppLocale, ExtraHeaderKeys> = {
  "pt-BR": {
    closeMenu: "Fechar menu",
    openMenu: "Abrir menu",
    menu: "Menu",
    navigate: "Navegar",
    execute: "Executar",
  },
  "en-US": {
    closeMenu: "Close menu",
    openMenu: "Open menu",
    menu: "Menu",
    navigate: "Navigate",
    execute: "Execute",
  },
  "es-ES": {
    closeMenu: "Cerrar menú",
    openMenu: "Abrir menú",
    menu: "Menú",
    navigate: "Navegar",
    execute: "Ejecutar",
  },
};

export function getAppHeaderText(
  locale: AppLocale,
): AppHeaderText & ExtraHeaderKeys {
  const base = TEXTS[locale] ?? TEXTS["pt-BR"];
  const extra = EXTRA_TEXTS[locale] ?? EXTRA_TEXTS["pt-BR"];
  return { ...base, ...extra };
}
