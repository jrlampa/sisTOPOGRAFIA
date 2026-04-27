import type { AppSettings, LayerConfig } from "../types";
import { normalizeAppLocale } from "../i18n/appLocale";
import {
  CURRENT_STORAGE_VERSION,
  SETTINGS_STORAGE_KEY,
  STORAGE_VERSION_KEY,
  UI_STATE_STORAGE_KEY,
} from "../constants/magicNumbers";

type FloatingLayerPanelUiState = {
  isExpanded: boolean;
  searchQuery: string;
};

type SidebarUiState = {
  isCollapsed: boolean;
};

type PersistedUiState = {
  floatingLayerPanel?: Partial<FloatingLayerPanelUiState>;
  sidebar?: Partial<SidebarUiState>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toBooleanRecord = (value: unknown): Partial<LayerConfig> => {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      ([, entryValue]) => typeof entryValue === "boolean",
    ),
  ) as Partial<LayerConfig>;
};

const isStorageVersionCompatible = (): boolean => {
  try {
    const version = localStorage.getItem(STORAGE_VERSION_KEY);
    return version === null || Number(version) === CURRENT_STORAGE_VERSION;
  } catch {
    return false;
  }
};

const markStorageVersion = (): void => {
  try {
    localStorage.setItem(STORAGE_VERSION_KEY, String(CURRENT_STORAGE_VERSION));
  } catch {
    // Ignore storage write failures.
  }
};

const readJson = <T>(key: string): T | null => {
  if (!isStorageVersionCompatible()) {
    return null;
  }

  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeJson = (key: string, value: unknown): void => {
  try {
    markStorageVersion();
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage write failures.
  }
};

export const loadPersistedAppSettings = (
  fallback: AppSettings,
): AppSettings => {
  const parsed = readJson<unknown>(SETTINGS_STORAGE_KEY);

  if (!isRecord(parsed)) {
    return fallback;
  }

  const layers = toBooleanRecord(parsed.layers);
  const projectMetadata = isRecord(parsed.projectMetadata)
    ? parsed.projectMetadata
    : {};
  const locale = normalizeAppLocale(
    typeof parsed.locale === "string" ? parsed.locale : fallback.locale,
  );
  const exportMemorialPdfWithDxf =
    typeof parsed.exportMemorialPdfWithDxf === "boolean"
      ? parsed.exportMemorialPdfWithDxf
      : fallback.exportMemorialPdfWithDxf;
  const mergedLayers = {
    ...fallback.layers,
    ...layers,
  } as LayerConfig;

  return {
    ...fallback,
    ...parsed,
    exportMemorialPdfWithDxf,
    locale,
    layers: mergedLayers,
    projectMetadata: {
      ...fallback.projectMetadata,
      ...projectMetadata,
    },
  };
};

export const persistAppSettings = (settings: AppSettings): void => {
  writeJson(SETTINGS_STORAGE_KEY, settings);
};

export const loadFloatingLayerPanelUiState = (): FloatingLayerPanelUiState => {
  const parsed = readJson<PersistedUiState>(UI_STATE_STORAGE_KEY);
  const panelState = parsed?.floatingLayerPanel;

  return {
    isExpanded:
      typeof panelState?.isExpanded === "boolean"
        ? panelState.isExpanded
        : true,
    searchQuery:
      typeof panelState?.searchQuery === "string" ? panelState.searchQuery : "",
  };
};

export const persistFloatingLayerPanelUiState = (
  state: FloatingLayerPanelUiState,
): void => {
  const parsed = readJson<PersistedUiState>(UI_STATE_STORAGE_KEY);
  const nextState: PersistedUiState = {
    ...(parsed && isRecord(parsed) ? parsed : {}),
    floatingLayerPanel: state,
  };

  writeJson(UI_STATE_STORAGE_KEY, nextState);
};

export const loadSidebarUiState = (): SidebarUiState => {
  const parsed = readJson<PersistedUiState>(UI_STATE_STORAGE_KEY);
  const sidebarState = parsed?.sidebar;

  return {
    isCollapsed:
      typeof sidebarState?.isCollapsed === "boolean"
        ? sidebarState.isCollapsed
        : false,
  };
};

export const persistSidebarUiState = (state: SidebarUiState): void => {
  const parsed = readJson<PersistedUiState>(UI_STATE_STORAGE_KEY);
  const nextState: PersistedUiState = {
    ...(parsed && isRecord(parsed) ? parsed : {}),
    sidebar: state,
  };

  writeJson(UI_STATE_STORAGE_KEY, nextState);
};
