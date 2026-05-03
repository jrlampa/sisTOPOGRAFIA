import React from "react";
import { getCommandPaletteText } from "../i18n/commandPaletteText";
import { AppLocale } from "../types";

export function useAppCommandPalette({
  locale,
  handleSaveProject,
  handleLoadProject,
  handleDownloadDxf,
  handleDownloadGeoJSON,
  handleDownloadCoordinatesCsv,
  handleResetBtTopology,
  exportBtHistoryJson,
  exportBtHistoryCsv,
  undo,
  redo,
  setIsHelpOpen,
  openSettings,
  isFocusModeManual,
  setIsFocusModeManual,
  handleRunDgOptimization,
  handleTriggerTelescopicAnalysis,
  setBtNetworkScenario,
  setBtEditorMode,
  setSelectedPoleId,
  setIsCommandPaletteOpen,
}: {
  locale: AppLocale;
  handleSaveProject: () => void;
  handleLoadProject: (file: File) => void;
  handleDownloadDxf: () => void;
  handleDownloadGeoJSON: () => void;
  handleDownloadCoordinatesCsv: () => void;
  handleResetBtTopology: () => void;
  exportBtHistoryJson: () => void;
  exportBtHistoryCsv: () => void;
  undo: () => void;
  redo: () => void;
  setIsHelpOpen: (open: boolean) => void;
  openSettings: () => void;
  isFocusModeManual: boolean;
  setIsFocusModeManual: (manual: boolean) => void;
  handleRunDgOptimization: () => void;
  handleTriggerTelescopicAnalysis: () => void;
  setBtNetworkScenario: (scenario: "asis" | "projeto") => void;
  setBtEditorMode: (mode: any) => void;
  setSelectedPoleId: (id: string) => void;
  setIsCommandPaletteOpen: (open: boolean) => void;
}) {
  const handleGoToPole = React.useCallback(
    (poleId: string) => {
      setSelectedPoleId(poleId);
      setIsCommandPaletteOpen(false);
    },
    [setSelectedPoleId, setIsCommandPaletteOpen],
  );

  const handleOpenProjectFromCommandPalette = React.useCallback(() => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".srua,.json";
    fileInput.onchange = (event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        handleLoadProject(file);
      }
    };
    fileInput.click();
  }, [handleLoadProject]);

  const i18nCmd = React.useMemo(() => getCommandPaletteText(locale), [locale]);

  const commandPaletteActions = React.useMemo(() => [
    {
      id: "save",
      label: i18nCmd.saveProject,
      section: i18nCmd.sectionFile,
      shortcut: "Ctrl+S",
      onSelect: handleSaveProject,
    },
    {
      id: "open",
      label: i18nCmd.openProject,
      section: i18nCmd.sectionFile,
      shortcut: "Ctrl+O",
      onSelect: handleOpenProjectFromCommandPalette,
    },
    {
      id: "dxf",
      label: i18nCmd.exportDxf,
      section: i18nCmd.sectionExport,
      shortcut: "Alt+D",
      onSelect: handleDownloadDxf,
    },
    {
      id: "geojson",
      label: i18nCmd.exportGeoJson,
      section: i18nCmd.sectionExport,
      onSelect: handleDownloadGeoJSON,
    },
    {
      id: "csv",
      label: i18nCmd.exportCsv,
      section: i18nCmd.sectionExport,
      onSelect: handleDownloadCoordinatesCsv,
    },
    {
      id: "reset-topology",
      label: i18nCmd.resetTopology,
      section: i18nCmd.sectionMacros,
      onSelect: handleResetBtTopology,
    },
    {
      id: "export-history",
      label: i18nCmd.exportHistoryJson,
      section: i18nCmd.sectionMacros,
      onSelect: exportBtHistoryJson,
    },
    {
      id: "export-history-csv",
      label: i18nCmd.exportHistoryCsv,
      section: i18nCmd.sectionMacros,
      onSelect: exportBtHistoryCsv,
    },
    {
      id: "undo",
      label: i18nCmd.undo,
      section: i18nCmd.sectionEdit,
      shortcut: "Ctrl+Z",
      onSelect: undo,
    },
    {
      id: "redo",
      label: i18nCmd.redo,
      section: i18nCmd.sectionEdit,
      shortcut: "Ctrl+Y",
      onSelect: redo,
    },
    {
      id: "help",
      label: i18nCmd.openHelp,
      section: i18nCmd.sectionGeneral,
      shortcut: "/",
      onSelect: () => setIsHelpOpen(true),
    },
    {
      id: "settings",
      label: i18nCmd.openSettings,
      section: i18nCmd.sectionGeneral,
      shortcut: "S",
      onSelect: openSettings,
    },
    {
      id: "focus-mode",
      label: isFocusModeManual ? i18nCmd.disableFocusMode : i18nCmd.enableFocusMode,
      section: i18nCmd.sectionGeneral,
      shortcut: "Ctrl+F",
      onSelect: () => setIsFocusModeManual(!isFocusModeManual),
    },
    {
      id: "dg",
      label: i18nCmd.runDgOptimization,
      section: i18nCmd.sectionEngineering,
      onSelect: () => handleRunDgOptimization(),
    },
    {
      id: "telescopic",
      label: i18nCmd.telescopicAnalysis,
      section: i18nCmd.sectionEngineering,
      onSelect: handleTriggerTelescopicAnalysis,
    },
    {
      id: "mode-asis",
      label: i18nCmd.scenarioAsIs,
      section: i18nCmd.sectionVisualization,
      onSelect: () => setBtNetworkScenario("asis"),
    },
    {
      id: "mode-proj",
      label: i18nCmd.scenarioProject,
      section: i18nCmd.sectionVisualization,
      onSelect: () => setBtNetworkScenario("projeto"),
    },
    {
      id: "editor-none",
      label: i18nCmd.exitEditorMode,
      section: i18nCmd.sectionEdit,
      onSelect: () => setBtEditorMode("none"),
    },
    {
      id: "editor-pole",
      label: i18nCmd.modeAddPole,
      section: i18nCmd.sectionEdit,
      onSelect: () => setBtEditorMode("pole"),
    },
    {
      id: "editor-transformer",
      label: i18nCmd.modeAddTransformer,
      section: i18nCmd.sectionEdit,
      onSelect: () => setBtEditorMode("transformer"),
    },
    {
      id: "editor-edge",
      label: i18nCmd.modeAddEdge,
      section: i18nCmd.sectionEdit,
      onSelect: () => setBtEditorMode("edge"),
    },
  ], [
    i18nCmd,
    handleSaveProject,
    handleOpenProjectFromCommandPalette,
    handleDownloadDxf,
    handleDownloadGeoJSON,
    handleDownloadCoordinatesCsv,
    handleResetBtTopology,
    exportBtHistoryJson,
    exportBtHistoryCsv,
    undo,
    redo,
    setIsHelpOpen,
    openSettings,
    isFocusModeManual,
    setIsFocusModeManual,
    handleRunDgOptimization,
    handleTriggerTelescopicAnalysis,
    setBtNetworkScenario,
    setBtEditorMode,
  ]);

  return { commandPaletteActions, handleGoToPole };
}
