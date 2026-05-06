import { AppLocale } from "../types";

export interface MtTopologyPanelText {
  title: string;
  polesCount: string;
  edgesCount: string;
  verifiedStatus: string;
  noPoles: string;
  addStructure: string;
  sharedBtMessage: string;
  verifiedLabel: string;
  notVerifiedLabel: string;
  renameTitle: string;
  renamePlaceholder: string;
  doubleClickToRename: string;
  removePole: string;
  structuresTitle: string;
  mtStructuresLabel: string;
  structureSlotPlaceholder: string;
  structureSlotTitle: string;
  shortcutHint: string;
  edgesSectionTitle: string;
  noEdges: string;
  removeEdge: string;
  edgeTitle: string;
  conductorsLabel: string;
  statusLabel: string;
  existing: string;
  new: string;
  remove: string;
  replace: string;
  apply: string;
  noConductor: string;
  ext: string;
  newShort: string;
  addSpanMode: string;
}

export const mtTopologyPanelText: Record<AppLocale, MtTopologyPanelText> = {
  "pt-BR": {
    title: "Média Tensão",
    polesCount: "P",
    edgesCount: "V",
    verifiedStatus: "OK",
    noPoles: "Nenhum poste com MT cadastrado. Use o botão \"+ Poste\" acima.",
    addStructure: "+ Adicionar Estrutura",
    sharedBtMessage: "MT reutiliza os mesmos postes da BT. Selecione o poste no mapa ou na lista para informar estruturas n1-n4.",
    verifiedLabel: "Verificado",
    notVerifiedLabel: "Não verificado",
    renameTitle: "Renomear poste",
    renamePlaceholder: "Nome do poste",
    doubleClickToRename: "duplo clique para renomear",
    removePole: "Remover poste",
    structuresTitle: "Estruturas MT (n1-n4)",
    mtStructuresLabel: "n1-n4",
    structureSlotPlaceholder: "ex: 13N1, 13CE2…",
    structureSlotTitle: "Estrutura MT",
    shortcutHint: "Dica: Use SHIFT+M para alternar modo MT",
    edgesSectionTitle: "Vãos de MT",
    noEdges: "Nenhum vão de MT cadastrado.",
    removeEdge: "Remover vão",
    edgeTitle: "Vão",
    conductorsLabel: "Condutor MT",
    statusLabel: "Status",
    existing: "Existente",
    new: "Novo",
    remove: "Retirar",
    replace: "Substituir",
    apply: "Aplicar",
    noConductor: "Sem condutor MT informado",
    ext: "Ext",
    newShort: "Novo",
    addSpanMode: "Nenhum vão MT cadastrado. Use o modo \"Vão\" no mapa.",
  },
  "en-US": {
    title: "Medium Voltage",
    polesCount: "P",
    edgesCount: "E",
    verifiedStatus: "OK",
    noPoles: "No MT poles registered. Use the \"+ Pole\" button above.",
    addStructure: "+ Add Structure",
    sharedBtMessage: "MT reuses the same BT poles. Select the pole on the map or list to enter n1-n4 structures.",
    verifiedLabel: "Verified",
    notVerifiedLabel: "Not verified",
    renameTitle: "Rename pole",
    renamePlaceholder: "Pole name",
    doubleClickToRename: "double click to rename",
    removePole: "Remove pole",
    structuresTitle: "MT Structures (n1-n4)",
    mtStructuresLabel: "n1-n4",
    structureSlotPlaceholder: "e.g.: 13N1, 13CE2…",
    structureSlotTitle: "MT Structure",
    shortcutHint: "Tip: Use SHIFT+M to toggle MT mode",
    edgesSectionTitle: "MT Spans",
    noEdges: "No MT spans registered.",
    removeEdge: "Remove span",
    edgeTitle: "Span",
    conductorsLabel: "MT Conductor",
    statusLabel: "Status",
    existing: "Existing",
    new: "New",
    remove: "Remove",
    replace: "Replace",
    apply: "Apply",
    noConductor: "No MT conductor provided",
    ext: "Ext",
    newShort: "New",
    addSpanMode: "No MT spans registered. Use \"Span\" mode on the map.",
  },
  "es-ES": {
    title: "Media Tensión",
    polesCount: "P",
    edgesCount: "V",
    verifiedStatus: "OK",
    noPoles: "No hay postes MT registrados. Use el botón \"+ Poste\" arriba.",
    addStructure: "+ Añadir Estructura",
    sharedBtMessage: "MT reutiliza los mismos postes de BT. Seleccione el poste en el mapa o lista para informar estructuras n1-n4.",
    verifiedLabel: "Verificado",
    notVerifiedLabel: "No verificado",
    renameTitle: "Renombrar poste",
    renamePlaceholder: "Nombre del poste",
    doubleClickToRename: "doble clic para renombrar",
    removePole: "Eliminar poste",
    structuresTitle: "Estructuras MT (n1-n4)",
    mtStructuresLabel: "n1-n4",
    structureSlotPlaceholder: "ej: 13N1, 13CE2…",
    structureSlotTitle: "Estructura MT",
    shortcutHint: "Consejo: Use SHIFT+M para alternar modo MT",
    edgesSectionTitle: "Tramos MT",
    noEdges: "No hay tramos MT registrados.",
    removeEdge: "Eliminar tramo",
    edgeTitle: "Tramo",
    conductorsLabel: "Conductor MT",
    statusLabel: "Estado",
    existing: "Existente",
    new: "Nuevo",
    remove: "Retirar",
    replace: "Reemplazar",
    apply: "Aplicar",
    noConductor: "Sin conductor MT informado",
    ext: "Ext",
    newShort: "Nuevo",
    addSpanMode: "No hay tramos MT registrados. Use el modo \"Tramo\" en el mapa.",
  },
};

export const getMtTopologyPanelText = (locale: AppLocale) => mtTopologyPanelText[locale];
