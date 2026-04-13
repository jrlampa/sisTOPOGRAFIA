import { GlobalState } from "../types";
import { DEFAULT_LOCATION } from "../constants";
import { EMPTY_BT_TOPOLOGY } from "../utils/btNormalization";
import { loadPersistedAppSettings } from "../utils/preferencesPersistence";

const DEFAULT_APP_STATE: GlobalState = {
  center: DEFAULT_LOCATION,
  radius: 500,
  selectionMode: "circle",
  polygon: [],
  measurePath: [],
  settings: {
    enableAI: true,
    simplificationLevel: "low",
    orthogonalize: true,
    contourRenderMode: "spline",
    projection: "utm",
    theme: "dark",
    mapProvider: "vector",
    contourInterval: 5,
    projectType: "ramais",
    btNetworkScenario: "asis",
    btEditorMode: "none",
    btTransformerCalculationMode: "automatic",
    clandestinoAreaM2: 0,
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
    },
    projectMetadata: {
      projectName: "PROJECT OSM-01",
      companyName: "ENG CORP",
      engineerName: "ENG. LEAD",
      date: new Date().toLocaleDateString("pt-BR"),
      scale: "N/A",
      revision: "R00",
    },
  },
  btTopology: EMPTY_BT_TOPOLOGY,
  btExportSummary: null,
  btExportHistory: [],
};

export const INITIAL_APP_STATE: GlobalState = {
  ...DEFAULT_APP_STATE,
  settings: loadPersistedAppSettings(DEFAULT_APP_STATE.settings),
};
