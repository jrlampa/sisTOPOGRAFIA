import { GlobalState } from "../types";
import type { AppLocale, AppTheme } from "../types";
import { DEFAULT_LOCATION } from "../constants";
import { EMPTY_BT_TOPOLOGY } from "../utils/btNormalization";
import { EMPTY_MT_TOPOLOGY } from "../utils/mtNormalization";
import { loadPersistedAppSettings } from "../utils/preferencesPersistence";

/** Detecta o esquema de cores preferido do sistema operacional. */
function detectSystemTheme(): AppTheme {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

function detectPreferredLocale(): AppLocale {
  return "pt-BR";
}

const DEFAULT_LOCALE = detectPreferredLocale();

const DEFAULT_APP_STATE: GlobalState = {
  center: DEFAULT_LOCATION,
  radius: 500,
  selectionMode: "circle",
  polygon: [],
  measurePath: [],
  settings: {
    enableAI: true,
    exportMemorialPdfWithDxf: false,
    simplificationLevel: "low",
    orthogonalize: true,
    contourRenderMode: "spline",
    projection: "utm",
    locale: DEFAULT_LOCALE,
    theme: detectSystemTheme(),
    mapProvider: "vector",
    contourInterval: 5,
    projectType: "ramais",
    btNetworkScenario: "asis",
    btEditorMode: "none",
    btTransformerCalculationMode: "automatic",
    btQtPontoCalculationMethod: "impedance_modulus",
    btCqtPowerFactor: 0.92,
    clandestinoAreaM2: 0,
    mtEditorMode: "none",
    layers: {
      buildings: true,
      roads: true,
      curbs: true,
      nature: true,
      terrain: true,
      contours: false,
      slopeAnalysis: false,
      furniture: true,
      labels: true,
      dimensions: false,
      grid: false,
      btNetwork: true,
      mtNetwork: true,
      electricalAudit: false,
    },
    projectMetadata: {
      projectName: "PROJECT OSM-01",
      companyName: "ENG CORP",
      engineerName: "ENG. LEAD",
      date: new Date().toLocaleDateString(DEFAULT_LOCALE),
      scale: "N/A",
      revision: "R00",
    },
  },
  btTopology: EMPTY_BT_TOPOLOGY,
  mtTopology: EMPTY_MT_TOPOLOGY,
  btExportSummary: null,
  btExportHistory: [],
  dgDecisionHistory: [],
};

export const INITIAL_APP_STATE: GlobalState = {
  ...DEFAULT_APP_STATE,
  settings: {
    ...loadPersistedAppSettings(DEFAULT_APP_STATE.settings),
    locale: DEFAULT_LOCALE,
  },
};
