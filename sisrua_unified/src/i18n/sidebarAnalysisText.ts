import type { AppLocale } from "../types";

type SidebarAnalysisText = {
  loadingAnalysis: string;
  loadingDxfLegend: string;
  loadingBatchUpload: string;
  terrainEngineTitle: string;
  terrainLoaded: string;
  terrainPending: string;
  btnGenerating: string;
  btnDownloadDxf: string;
};

const TEXTS: Record<AppLocale, SidebarAnalysisText> = {
  "pt-BR": {
    loadingAnalysis: "Carregando análise",
    loadingDxfLegend: "Carregando legenda DXF",
    loadingBatchUpload: "Carregando importação em lote",
    terrainEngineTitle: "MOTOR DE TERRENO",
    terrainLoaded: "Grade de alta resolução carregada",
    terrainPending: "Grade pendente...",
    btnGenerating: "GERANDO...",
    btnDownloadDxf: "BAIXAR DXF",
  },
  "en-US": {
    loadingAnalysis: "Loading analysis",
    loadingDxfLegend: "Loading DXF legend",
    loadingBatchUpload: "Loading batch import",
    terrainEngineTitle: "TERRAIN ENGINE",
    terrainLoaded: "High-resolution grid loaded",
    terrainPending: "Grid pending...",
    btnGenerating: "GENERATING...",
    btnDownloadDxf: "DOWNLOAD DXF",
  },
  "es-ES": {
    loadingAnalysis: "Cargando análisis",
    loadingDxfLegend: "Cargando leyenda DXF",
    loadingBatchUpload: "Cargando importación por lotes",
    terrainEngineTitle: "MOTOR DE TERRENO",
    terrainLoaded: "Cuadrícula de alta resolución cargada",
    terrainPending: "Cuadrícula pendiente...",
    btnGenerating: "GENERANDO...",
    btnDownloadDxf: "DESCARGAR DXF",
  },
};

export function getSidebarAnalysisText(locale: AppLocale): SidebarAnalysisText {
  return TEXTS[locale] ?? TEXTS["pt-BR"];
}
