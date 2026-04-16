import { useState } from "react";
import { GlobalState, AppSettings } from "../types";

interface UseFileOperationsProps {
  appState: GlobalState;
  setAppState: (state: GlobalState, saveSnapshot: boolean) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

// NOTE: Do not update PROJECT_VERSION manually. Use ./scripts/update-version.sh instead.
// See VERSIONING.md for details about version management.
const PROJECT_VERSION = "1.1.1";

export function useFileOperations({
  appState,
  setAppState,
  onSuccess,
  onError,
}: UseFileOperationsProps) {
  const [isLoading, setIsLoading] = useState(false);

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

      onSuccess("Project Saved");
    } catch (error) {
      onError("Failed to save project");
    } finally {
      setIsLoading(false);
    }
  };

  const loadProject = (file: File) => {
    setIsLoading(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);

        if (!data || !data.state) {
          throw new Error("Invalid project file format");
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
        onSuccess("Project Loaded");
      } catch (error) {
        onError("Failed to load project");
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      onError("Failed to read file");
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
