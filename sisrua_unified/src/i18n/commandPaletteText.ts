import type { AppLocale } from "../types";

type CommandPaletteText = {
  // Actions
  saveProject: string;
  openProject: string;
  exportDxf: string;
  exportGeoJson: string;
  exportCsv: string;
  resetTopology: string;
  exportHistoryJson: string;
  exportHistoryCsv: string;
  undo: string;
  redo: string;
  openHelp: string;
  openSettings: string;
  disableFocusMode: string;
  enableFocusMode: string;
  runDgOptimization: string;
  telescopicAnalysis: string;
  scenarioAsIs: string;
  scenarioProject: string;
  exitEditorMode: string;
  modeAddPole: string;
  modeAddEdge: string;
  modeAddTransformer: string;

  // Sections
  sectionFile: string;
  sectionExport: string;
  sectionMacros: string;
  sectionEdit: string;
  sectionGeneral: string;
  sectionEngineering: string;
  sectionVisualization: string;
};

const TEXTS: Record<AppLocale, CommandPaletteText> = {
  "pt-BR": {
    saveProject: "Salvar Projeto",
    openProject: "Abrir Projeto",
    exportDxf: "Exportar DXF",
    exportGeoJson: "Exportar GeoJSON",
    exportCsv: "Exportar Coordenadas CSV",
    resetTopology: "Limpar / Resetar Topologia BT",
    exportHistoryJson: "Exportar Histórico BT (JSON)",
    exportHistoryCsv: "Exportar Histórico BT (CSV)",
    undo: "Desfazer",
    redo: "Refazer",
    openHelp: "Abrir Ajuda",
    openSettings: "Configurações",
    disableFocusMode: "Desativar Modo Foco",
    enableFocusMode: "Ativar Modo Foco",
    runDgOptimization: "Otimização DG",
    telescopicAnalysis: "Análise Telescópica",
    scenarioAsIs: "Cenário: Rede Atual",
    scenarioProject: "Cenário: Rede Nova",
    exitEditorMode: "Sair do Modo Edição",
    modeAddPole: "Modo: Adicionar Poste",
    modeAddEdge: "Modo: Adicionar Vão",
    modeAddTransformer: "Modo: Adicionar Trafo",
    sectionFile: "Arquivo",
    sectionExport: "Exportação",
    sectionMacros: "Macros de Projeto",
    sectionEdit: "Edição",
    sectionGeneral: "Geral",
    sectionEngineering: "Engenharia",
    sectionVisualization: "Visualização",
  },
  "en-US": {
    saveProject: "Save Project",
    openProject: "Open Project",
    exportDxf: "Export DXF",
    exportGeoJson: "Export GeoJSON",
    exportCsv: "Export CSV Coordinates",
    resetTopology: "Clear / Reset LV Topology",
    exportHistoryJson: "Export LV History (JSON)",
    exportHistoryCsv: "Export LV History (CSV)",
    undo: "Undo",
    redo: "Redo",
    openHelp: "Open Help",
    openSettings: "Settings",
    disableFocusMode: "Disable Focus Mode",
    enableFocusMode: "Enable Focus Mode",
    runDgOptimization: "Generative Design Optimization",
    telescopicAnalysis: "Telescopic Analysis",
    scenarioAsIs: "Scenario: As-Is Network",
    scenarioProject: "Scenario: New Network",
    exitEditorMode: "Exit Editor Mode",
    modeAddPole: "Mode: Add Pole",
    modeAddEdge: "Mode: Add Span",
    modeAddTransformer: "Mode: Add Transformer",
    sectionFile: "File",
    sectionExport: "Export",
    sectionMacros: "Project Macros",
    sectionEdit: "Edit",
    sectionGeneral: "General",
    sectionEngineering: "Engineering",
    sectionVisualization: "Visualization",
  },
  "es-ES": {
    saveProject: "Guardar Proyecto",
    openProject: "Abrir Proyecto",
    exportDxf: "Exportar DXF",
    exportGeoJson: "Exportar GeoJSON",
    exportCsv: "Exportar Coordenadas CSV",
    resetTopology: "Limpiar / Restablecer Topología BT",
    exportHistoryJson: "Exportar Historial BT (JSON)",
    exportHistoryCsv: "Exportar Historial BT (CSV)",
    undo: "Deshacer",
    redo: "Rehacer",
    openHelp: "Abrir Ayuda",
    openSettings: "Configuraciones",
    disableFocusMode: "Desactivar Modo Enfoque",
    enableFocusMode: "Activar Modo Enfoque",
    runDgOptimization: "Optimización DG",
    telescopicAnalysis: "Análisis Telescópico",
    scenarioAsIs: "Escenario: Red Actual",
    scenarioProject: "Escenario: Nueva Red",
    exitEditorMode: "Salir del Modo Edición",
    modeAddPole: "Modo: Añadir Poste",
    modeAddEdge: "Modo: Añadir Vano",
    modeAddTransformer: "Modo: Añadir Transformador",
    sectionFile: "Archivo",
    sectionExport: "Exportación",
    sectionMacros: "Macros de Proyecto",
    sectionEdit: "Edición",
    sectionGeneral: "General",
    sectionEngineering: "Ingeniería",
    sectionVisualization: "Visualización",
  },
};

export function getCommandPaletteText(locale: AppLocale): CommandPaletteText {
  return TEXTS[locale] ?? TEXTS["pt-BR"];
}
