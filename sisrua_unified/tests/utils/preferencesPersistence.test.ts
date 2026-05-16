import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  loadPersistedAppSettings,
  persistAppSettings,
  loadFloatingLayerPanelUiState,
  persistFloatingLayerPanelUiState,
  loadSidebarUiState,
  persistSidebarUiState,
} from "../../src/utils/preferencesPersistence";
import type { AppSettings } from "../../src/types";
import {
  SETTINGS_STORAGE_KEY,
  STORAGE_VERSION_KEY,
  UI_STATE_STORAGE_KEY,
  CURRENT_STORAGE_VERSION,
} from "../../src/constants/magicNumbers";

// ---------------------------------------------------------------------------
// Minimal default settings for testing
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: AppSettings = {
  enableAI: true,
  exportMemorialPdfWithDxf: false,
  simplificationLevel: "low",
  orthogonalize: true,
  contourRenderMode: "spline",
  projection: "utm",
  locale: "pt-BR",
  theme: "dark",
  mapProvider: "vector",
  contourInterval: 5,
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
    cqtHeatmap: false,
    disablePopups: true,
  },
  projectMetadata: {
    projectName: "TEST",
    companyName: "TEST CO",
    engineerName: "ENG",
    date: "2024-01-01",
    scale: "N/A",
    revision: "R00",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeCompatibleVersion() {
  localStorage.setItem(STORAGE_VERSION_KEY, String(CURRENT_STORAGE_VERSION));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// loadPersistedAppSettings
// ---------------------------------------------------------------------------

describe("loadPersistedAppSettings", () => {
  it("returns the fallback when nothing is stored", () => {
    const result = loadPersistedAppSettings(DEFAULT_SETTINGS);
    expect(result.locale).toBe(DEFAULT_SETTINGS.locale);
    expect(result.enableAI).toBe(DEFAULT_SETTINGS.enableAI);
  });

  it("returns the fallback when storage version is incompatible", () => {
    localStorage.setItem(STORAGE_VERSION_KEY, "999");
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ locale: "en-US" }));
    const result = loadPersistedAppSettings(DEFAULT_SETTINGS);
    // Should use fallback because version check fails
    expect(result.locale).toBe(DEFAULT_SETTINGS.locale);
  });

  it("merges stored locale into returned settings when compatible version", () => {
    writeCompatibleVersion();
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ locale: "en-US" }));
    const result = loadPersistedAppSettings(DEFAULT_SETTINGS);
    expect(result.locale).toBe("en-US");
  });

  it("merges only boolean layer overrides from storage", () => {
    writeCompatibleVersion();
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ layers: { buildings: false, invalidKey: "not-boolean" } }),
    );
    const result = loadPersistedAppSettings(DEFAULT_SETTINGS);
    expect(result.layers.buildings).toBe(false);
  });

  it("preserves boolean exportMemorialPdfWithDxf from storage", () => {
    writeCompatibleVersion();
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ exportMemorialPdfWithDxf: true }),
    );
    const result = loadPersistedAppSettings(DEFAULT_SETTINGS);
    expect(result.exportMemorialPdfWithDxf).toBe(true);
  });

  it("preserves valid uiDensity from storage", () => {
    writeCompatibleVersion();
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ uiDensity: "compact" }));
    const result = loadPersistedAppSettings(DEFAULT_SETTINGS);
    expect(result.uiDensity).toBe("compact");
  });

  it("ignores invalid uiDensity and uses fallback", () => {
    writeCompatibleVersion();
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ uiDensity: "invalid-value" }));
    const result = loadPersistedAppSettings(DEFAULT_SETTINGS);
    expect(result.uiDensity).toBe(DEFAULT_SETTINGS.uiDensity);
  });

  it("merges projectMetadata from storage", () => {
    writeCompatibleVersion();
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ projectMetadata: { projectName: "MY PROJECT" } }),
    );
    const result = loadPersistedAppSettings(DEFAULT_SETTINGS);
    expect(result.projectMetadata.projectName).toBe("MY PROJECT");
    // Other fields from fallback should be preserved
    expect(result.projectMetadata.companyName).toBe(DEFAULT_SETTINGS.projectMetadata.companyName);
  });

  it("returns fallback when stored JSON is malformed", () => {
    writeCompatibleVersion();
    localStorage.setItem(SETTINGS_STORAGE_KEY, "not-json{{{");
    const result = loadPersistedAppSettings(DEFAULT_SETTINGS);
    expect(result.locale).toBe(DEFAULT_SETTINGS.locale);
  });

  it("returns fallback when stored value is not an object", () => {
    writeCompatibleVersion();
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(42));
    const result = loadPersistedAppSettings(DEFAULT_SETTINGS);
    expect(result.locale).toBe(DEFAULT_SETTINGS.locale);
  });
});

// ---------------------------------------------------------------------------
// persistAppSettings
// ---------------------------------------------------------------------------

describe("persistAppSettings", () => {
  it("writes settings to localStorage", () => {
    persistAppSettings(DEFAULT_SETTINGS);
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.locale).toBe("pt-BR");
  });

  it("round-trips through load/persist", () => {
    persistAppSettings({ ...DEFAULT_SETTINGS, locale: "es-ES" });
    const reloaded = loadPersistedAppSettings(DEFAULT_SETTINGS);
    expect(reloaded.locale).toBe("es-ES");
  });
});

// ---------------------------------------------------------------------------
// loadFloatingLayerPanelUiState
// ---------------------------------------------------------------------------

describe("loadFloatingLayerPanelUiState", () => {
  it("returns defaults when nothing is stored", () => {
    const state = loadFloatingLayerPanelUiState();
    expect(state.isExpanded).toBe(true);
    expect(state.searchQuery).toBe("");
  });

  it("returns stored state when available", () => {
    writeCompatibleVersion();
    localStorage.setItem(
      UI_STATE_STORAGE_KEY,
      JSON.stringify({ floatingLayerPanel: { isExpanded: false, searchQuery: "test" } }),
    );
    const state = loadFloatingLayerPanelUiState();
    expect(state.isExpanded).toBe(false);
    expect(state.searchQuery).toBe("test");
  });
});

// ---------------------------------------------------------------------------
// persistFloatingLayerPanelUiState
// ---------------------------------------------------------------------------

describe("persistFloatingLayerPanelUiState", () => {
  it("writes the panel state to localStorage", () => {
    persistFloatingLayerPanelUiState({ isExpanded: false, searchQuery: "rua" });
    const raw = localStorage.getItem(UI_STATE_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.floatingLayerPanel.isExpanded).toBe(false);
    expect(parsed.floatingLayerPanel.searchQuery).toBe("rua");
  });

  it("does not overwrite other UI state keys when persisting panel state", () => {
    writeCompatibleVersion();
    localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify({ sidebar: { isCollapsed: true } }));
    persistFloatingLayerPanelUiState({ isExpanded: false, searchQuery: "" });
    const raw = localStorage.getItem(UI_STATE_STORAGE_KEY);
    const parsed = JSON.parse(raw!);
    expect(parsed.sidebar?.isCollapsed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// loadSidebarUiState
// ---------------------------------------------------------------------------

describe("loadSidebarUiState", () => {
  it("returns default (not collapsed) when nothing is stored", () => {
    const state = loadSidebarUiState();
    expect(state.isCollapsed).toBe(false);
  });

  it("returns stored collapsed state", () => {
    writeCompatibleVersion();
    localStorage.setItem(
      UI_STATE_STORAGE_KEY,
      JSON.stringify({ sidebar: { isCollapsed: true } }),
    );
    const state = loadSidebarUiState();
    expect(state.isCollapsed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// persistSidebarUiState
// ---------------------------------------------------------------------------

describe("persistSidebarUiState", () => {
  it("writes sidebar state to localStorage", () => {
    persistSidebarUiState({ isCollapsed: true });
    const raw = localStorage.getItem(UI_STATE_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.sidebar.isCollapsed).toBe(true);
  });

  it("does not overwrite other UI state keys when persisting sidebar state", () => {
    writeCompatibleVersion();
    localStorage.setItem(
      UI_STATE_STORAGE_KEY,
      JSON.stringify({ floatingLayerPanel: { isExpanded: false, searchQuery: "q" } }),
    );
    persistSidebarUiState({ isCollapsed: true });
    const raw = localStorage.getItem(UI_STATE_STORAGE_KEY);
    const parsed = JSON.parse(raw!);
    expect(parsed.floatingLayerPanel?.isExpanded).toBe(false);
  });
});
