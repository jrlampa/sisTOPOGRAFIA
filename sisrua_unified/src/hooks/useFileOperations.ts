import { useState } from "react";
import { GlobalState } from "../types";
import { normalizeAppLocale } from "../i18n/appLocale";

interface UseFileOperationsProps {
  appState: GlobalState;
  setAppState: (
    state: GlobalState | ((prev: GlobalState) => GlobalState),
    addToHistory: boolean,
  ) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

// NOTE: Do not update PROJECT_VERSION manually. Use ./scripts/update-version.sh instead.
// See VERSIONING.md for details about version management.
const PROJECT_VERSION = "0.9.0";

const FILE_OPERATION_TEXT = {
  "pt-BR": {
    projectSaved: "Projeto salvo",
    saveFailed: "Falha ao salvar o projeto",
    projectLoaded: "Projeto carregado",
    loadFailed: "Falha ao carregar o projeto",
    invalidProjectFile: "Formato de arquivo de projeto inválido",
    readFailed: "Falha ao ler o arquivo",
  },
  "en-US": {
    projectSaved: "Project saved",
    saveFailed: "Failed to save project",
    projectLoaded: "Project loaded",
    loadFailed: "Failed to load project",
    invalidProjectFile: "Invalid project file format",
    readFailed: "Failed to read file",
  },
  "es-ES": {
    projectSaved: "Proyecto guardado",
    saveFailed: "Error al guardar el proyecto",
    projectLoaded: "Proyecto cargado",
    loadFailed: "Error al cargar el proyecto",
    invalidProjectFile: "Formato de archivo de proyecto no válido",
    readFailed: "Error al leer el archivo",
  },
} as const;

export function useFileOperations({
  appState,
  setAppState,
  onSuccess,
  onError,
}: UseFileOperationsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const locale = normalizeAppLocale(appState.settings.locale);
  const text = FILE_OPERATION_TEXT[locale];

  const saveProject = () => {
    try {
      setIsLoading(true);
      const rawProjectName = (
        appState.settings.projectMetadata.projectName || ""
      ).trim();
      const normalizedProjectName =
        rawProjectName.replace(/\.(srua|osmpro|json)$/i, "") || "projeto";

      const projectData = {
        state: appState,
        timestamp: new Date().toISOString(),
        version: PROJECT_VERSION,
      };

      const blob = new Blob([JSON.stringify(projectData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${normalizedProjectName}.srua`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onSuccess(text.projectSaved);
    } catch {
      onError(text.saveFailed);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProject = (file: File) => {
    setIsLoading(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const fileContent = e.target?.result as string;
        const data = JSON.parse(fileContent);

        if (!data || !data.state) {
          throw new Error(text.invalidProjectFile);
        }

        const loadedState = data.state as GlobalState;
        // Backward compatibility for older .osmpro/.json files created before contour mode existed
        if (!loadedState.settings.contourRenderMode) {
          loadedState.settings.contourRenderMode = "spline";
        }
        if (!loadedState.settings.projectType) {
          loadedState.settings.projectType = "ramais";
        }
        if (!loadedState.settings.btNetworkScenario) {
          loadedState.settings.btNetworkScenario = "asis";
        }
        if (!loadedState.settings.btEditorMode) {
          loadedState.settings.btEditorMode = "none";
        }
        if (!loadedState.settings.btTransformerCalculationMode) {
          loadedState.settings.btTransformerCalculationMode = "automatic";
        }
        if (typeof loadedState.settings.clandestinoAreaM2 !== "number") {
          loadedState.settings.clandestinoAreaM2 = 0;
        }
        if (typeof loadedState.settings.layers.btNetwork !== "boolean") {
          loadedState.settings.layers.btNetwork = true;
        }
        if (!loadedState.btTopology) {
          loadedState.btTopology = {
            poles: [],
            transformers: [],
            edges: [],
          };
        }
        if (loadedState.btExportSummary === undefined) {
          loadedState.btExportSummary = null;
        }
        if (!Array.isArray(loadedState.btExportHistory)) {
          loadedState.btExportHistory = [];
        }

        setAppState(loadedState, true);
        onSuccess(text.projectLoaded);
      } catch {
        onError(text.loadFailed);
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      onError(text.readFailed);
      setIsLoading(false);
    };

    reader.readAsText(file);
  };

  return {
    saveProject,
    loadProject,
    isLoading,
  };
}
