import { AppLocale } from "../types";

export const getGuidedTaskChecklistText = (locale: AppLocale) => {
  const translations = {
    "pt-BR": {
      regionLabel: "Checklist de início rápido",
      headerTitle: "Início rápido",
      expandLabel: "Expandir checklist",
      collapseLabel: "Recolher checklist",
      closeLabel: "Fechar checklist",
      successMsg: "✓ Projeto configurado!",
      taskArea: "Selecionar área no mapa",
      taskBt: "Lançar rede BT (postes)",
      taskTerrain: "Carregar terreno 2.5D",
      taskExport: "Exportar DXF",
    },
    "en-US": {
      regionLabel: "Quick start checklist",
      headerTitle: "Quick start",
      expandLabel: "Expand checklist",
      collapseLabel: "Collapse checklist",
      closeLabel: "Close checklist",
      successMsg: "✓ Project configured!",
      taskArea: "Select map area",
      taskBt: "Build LV network (poles)",
      taskTerrain: "Load 2.5D terrain",
      taskExport: "Export DXF",
    },
    "es-ES": {
      regionLabel: "Lista de inicio rápido",
      headerTitle: "Inicio rápido",
      expandLabel: "Expandir lista",
      collapseLabel: "Contraer lista",
      closeLabel: "Cerrar lista",
      successMsg: "✓ ¡Proyecto configurado!",
      taskArea: "Seleccionar área en el mapa",
      taskBt: "Construir red BT (postes)",
      taskTerrain: "Cargar terreno 2.5D",
      taskExport: "Exportar DXF",
    },
  };

  return translations[locale] || translations["pt-BR"];
};
