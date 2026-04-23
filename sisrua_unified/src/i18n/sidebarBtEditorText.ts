import type { AppLocale } from "../types";

type SidebarBtEditorText = {
  editorTitle: string;
  scenarioActual: string;
  scenarioProject: string;
  btnActualNetwork: string;
  btnNewNetwork: string;
  btnNavigate: string;
  btnMove: string;
  btnAddPole: string;
  btnAddEdge: string;
  btnAddTransformer: string;
  insertPoleCoordinatesTitle: string;
  insertPoleCoordinatesBtn: string;
  dragPoleTitle: string;
  dragPoleHelp: string;
  actualNetworkActiveMsg: string;
  clandestineAreaMsg: (area: number) => string;
  pendingClassificationMsg: (count: number) => string;
  resetBtTopologyBtn: string;
  resetBtTopologyTitle: string;
  loadingBtPanel: string;
};

const TEXTS: Record<AppLocale, SidebarBtEditorText> = {
  "pt-BR": {
    editorTitle: "Editor BT",
    scenarioActual: "ATUAL",
    scenarioProject: "PROJETO",
    btnActualNetwork: "REDE ATUAL",
    btnNewNetwork: "REDE NOVA",
    btnNavigate: "NAVEGAR",
    btnMove: "MOVER",
    btnAddPole: "+ POSTE",
    btnAddEdge: "+ CONDUTOR",
    btnAddTransformer: "+ TRAFO",
    insertPoleCoordinatesTitle: "Inserir poste por coordenadas",
    insertPoleCoordinatesBtn: "INSERIR POR COORDENADA",
    dragPoleTitle: "Arraste fino de poste:",
    dragPoleHelp: "Clique e segure no poste para ajustar a posição no mapa.",
    actualNetworkActiveMsg: "Rede Atual ativa: você pode navegar e lançar poste, condutor e trafo na topologia existente.",
    clandestineAreaMsg: (area) => `Área clandestina: ${area} m²`,
    pendingClassificationMsg: (count) => `Classificação pendente em ${count} poste(s). DXF bloqueado até classificar.`,
    resetBtTopologyBtn: "ZERAR BT (LIMPAR TUDO)",
    resetBtTopologyTitle: "Remover toda a topologia BT",
    loadingBtPanel: "Carregando painel BT",
  },
  "en-US": {
    editorTitle: "LV Editor",
    scenarioActual: "CURRENT",
    scenarioProject: "PROJECT",
    btnActualNetwork: "CURRENT NETWORK",
    btnNewNetwork: "NEW NETWORK",
    btnNavigate: "NAVIGATE",
    btnMove: "MOVE",
    btnAddPole: "+ POLE",
    btnAddEdge: "+ CONDUCTOR",
    btnAddTransformer: "+ TRANSFORMER",
    insertPoleCoordinatesTitle: "Insert pole by coordinates",
    insertPoleCoordinatesBtn: "INSERT BY COORDINATE",
    dragPoleTitle: "Fine pole dragging:",
    dragPoleHelp: "Click and hold on the pole to adjust its position on the map.",
    actualNetworkActiveMsg: "Current Network active: you can navigate and add pole, conductor, and transformer to the existing topology.",
    clandestineAreaMsg: (area) => `Unregistered area: ${area} m²`,
    pendingClassificationMsg: (count) => `Pending classification on ${count} pole(s). DXF locked until classified.`,
    resetBtTopologyBtn: "RESET LV (CLEAR ALL)",
    resetBtTopologyTitle: "Remove all LV topology",
    loadingBtPanel: "Loading LV panel",
  },
  "es-ES": {
    editorTitle: "Editor BT",
    scenarioActual: "ACTUAL",
    scenarioProject: "PROYECTO",
    btnActualNetwork: "RED ACTUAL",
    btnNewNetwork: "RED NUEVA",
    btnNavigate: "NAVEGAR",
    btnMove: "MOVER",
    btnAddPole: "+ POSTE",
    btnAddEdge: "+ CONDUCTOR",
    btnAddTransformer: "+ TRANSFORMADOR",
    insertPoleCoordinatesTitle: "Insertar poste por coordenadas",
    insertPoleCoordinatesBtn: "INSERTAR POR COORDENADA",
    dragPoleTitle: "Arrastre fino de poste:",
    dragPoleHelp: "Haga clic y mantenga presionado el poste para ajustar su posición en el mapa.",
    actualNetworkActiveMsg: "Red Actual activa: puede navegar y agregar poste, conductor y transformador a la topología existente.",
    clandestineAreaMsg: (area) => `Área clandestina: ${area} m²`,
    pendingClassificationMsg: (count) => `Clasificación pendiente en ${count} poste(s). DXF bloqueado hasta clasificar.`,
    resetBtTopologyBtn: "VACIAR BT (BORRAR TODO)",
    resetBtTopologyTitle: "Eliminar toda la topología BT",
    loadingBtPanel: "Cargando panel BT",
  },
};

export function getSidebarBtEditorText(locale: AppLocale): SidebarBtEditorText {
  return TEXTS[locale] ?? TEXTS["pt-BR"];
}
