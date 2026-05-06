import type { AppLocale } from "../types";

type SidebarSelectionText = {
  targetArea: string;
  searchPlaceholder: string;
  btnSearch: string;
  selectionMode: string;
  modeRadius: string;
  modePolygon: string;
  modeProfileTitle: string;
  regionRadius: string;
  meters: string;
  btnProcessing: string;
  btnAnalyzeRegion: string;
  polygonReady: string;
  polygonInvalid: string;
};

const TEXTS: Record<AppLocale, SidebarSelectionText> = {
  "pt-BR": {
    targetArea: "Área alvo",
    searchPlaceholder: "Cidade, endereço ou coordenadas (UTM)",
    btnSearch: "BUSCAR",
    selectionMode: "Modo de seleção",
    modeRadius: "RAIO",
    modePolygon: "POLÍGONO",
    modeProfileTitle: "Modo perfil",
    regionRadius: "Raio da região",
    meters: "METROS",
    btnProcessing: "PROCESSANDO...",
    btnAnalyzeRegion: "ANALISAR REGIÃO",
    polygonReady: "Polígono pronto para análise.",
    polygonInvalid: "Desenhe ao menos 3 pontos válidos para habilitar a análise da área.",
  },
  "en-US": {
    targetArea: "Target Area",
    searchPlaceholder: "City, address or coordinates (UTM)",
    btnSearch: "SEARCH",
    selectionMode: "Selection mode",
    modeRadius: "RADIUS",
    modePolygon: "POLYGON",
    modeProfileTitle: "Profile mode",
    regionRadius: "Region radius",
    meters: "METERS",
    btnProcessing: "PROCESSING...",
    btnAnalyzeRegion: "ANALYZE REGION",
    polygonReady: "Polygon ready for analysis.",
    polygonInvalid: "Draw at least 3 valid points to enable area analysis.",
  },
  "es-ES": {
    targetArea: "Área objetivo",
    searchPlaceholder: "Ciudad, dirección o coordenadas (UTM)",
    btnSearch: "BUSCAR",
    selectionMode: "Modo de selección",
    modeRadius: "RADIO",
    modePolygon: "POLÍGONO",
    modeProfileTitle: "Modo perfil",
    regionRadius: "Radio de la región",
    meters: "METROS",
    btnProcessing: "PROCESANDO...",
    btnAnalyzeRegion: "ANALIZAR REGIÓN",
    polygonReady: "Polígono listo para análisis.",
    polygonInvalid: "Dibuje al menos 3 puntos válidos para habilitar el análisis del área.",
  },
};

export function getSidebarSelectionText(locale: AppLocale): SidebarSelectionText {
  return TEXTS[locale] ?? TEXTS["pt-BR"];
}
