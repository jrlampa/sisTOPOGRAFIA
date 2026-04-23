import type { AppLocale } from "../types";

type BtTopologyPanelText = {
  projectTypeTitle: string;
  projectTypeRamais: string;
  projectTypeClandestino: string;
  btnBulkImport: string;
  
  stats: {
    componentsTitle: string;
    poles: string;
    transformers: string;
    edges: string;
    metricsTitle: string;
    networkLengthMeters: string;
  };

  poleVerification: {
    title: string;
    selectedPole: string;
    noPole: string;
    placeholderPoleName: string;
    selectPoleTitle: string;
    btnMarkVerified: string;
    btnMarkUnverified: string;
    flagRemove: string;
    flagNew: string;
    flagReplace: string;
    flagExisting: string;
    activeCircuitBreak: string;
    sizeEffortTitle: string;
    heightM: string;
    effortDan: string;
    structuresTitle: string;
    poleStateTitle: string;
    selectState: string;
    stateGood: string;
    stateLeaning: string;
    stateCracked: string;
    stateCondemned: string;
    equipmentsTitle: string;
    equipmentsPlaceholder: string;
    generalNotesTitle: string;
    generalNotesPlaceholder: string;
    ramaisTitle: string;
    btnAddRamal: string;
    noRamais: string;
    btnRemoveRamal: string;
    freeObservation: string;
    quickNotes: {
      deteriorated: string;
      splices: string;
      noInsulation: string;
      long: string;
      crossing: string;
      other: string;
    };
  };

  transformerEdge: {
    transformerTitleAsis: string;
    transformerTitleProject: string;
    noTransformer: string;
    placeholderTransformerName: string;
    btnMarkVerified: string;
    btnMarkUnverified: string;
    demandKva: string;

    edgeTitleAsis: string;
    edgeTitleProject: string;
    edgeComposition: string;
    btnAddConductor: string;

    edgeTitle: string;
    noEdge: string;
    placeholderEdgeName: string;
    conductorPhase: string;
    conductorNeutral: string;
    conductorStreetLight: string;
    replaceConductor: string;
  };

  bulkImport: {
    title: string;
    pasteData: string;
    loadExcel: string;
    placeholder: string;
    btnCancel: string;
    btnReview: string;
    btnImport: string;
    reviewTitle: string;
    reviewSummary: string;
  };
};

const TEXTS: Record<AppLocale, BtTopologyPanelText> = {
  "pt-BR": {
    projectTypeTitle: "Tipo de Projeto",
    projectTypeRamais: "Ramais (Padrão)",
    projectTypeClandestino: "Clandestino (Carga por Área)",
    btnBulkImport: "Importação em Massa",

    stats: {
      componentsTitle: "Componentes",
      poles: "Postes",
      transformers: "Trafos",
      edges: "Trechos",
      metricsTitle: "Métricas",
      networkLengthMeters: "m de rede",
    },

    poleVerification: {
      title: "Postes / Verificação",
      selectedPole: "Poste selecionado",
      noPole: "Nenhum poste cadastrado.",
      placeholderPoleName: "Nome/seleção do poste",
      selectPoleTitle: "Selecionar poste",
      btnMarkVerified: "Marcar poste como verificado",
      btnMarkUnverified: "Marcar como não verificado",
      flagRemove: "Remoção",
      flagNew: "Novo",
      flagReplace: "Substituição",
      flagExisting: "Existente",
      activeCircuitBreak: "Separação física ativa: o circuito do trafo para neste poste.",
      sizeEffortTitle: "Tamanho / Esforço nominal",
      heightM: "Altura (m)",
      effortDan: "Esforço (daN)",
      structuresTitle: "Estruturas BT (si1-si4)",
      poleStateTitle: "Estado do poste",
      selectState: "Selecione o estado",
      stateGood: "Bom estado",
      stateLeaning: "Desaprumado",
      stateCracked: "Trincado",
      stateCondemned: "Condenado",
      equipmentsTitle: "Equipamentos",
      equipmentsPlaceholder: "Ex.: chave fusível, trafo 75 kVA, luminária, religador...",
      generalNotesTitle: "Observações gerais",
      generalNotesPlaceholder: "Ex.: acesso restrito, interferência com muro, vegetação próxima...",
      ramaisTitle: "Ramais do poste",
      btnAddRamal: "Ramal",
      noRamais: "Sem ramais cadastrados neste poste.",
      btnRemoveRamal: "Remover ramal",
      freeObservation: "Obs. livre...",
      quickNotes: {
        deteriorated: "Deteriorado",
        splices: "Emendas",
        noInsulation: "Sem isolamento",
        long: "Longo",
        crossing: "Cruzamento",
        other: "Outro",
      },
    },

    transformerEdge: {
      transformerTitleAsis: "Transformador (leituras atuais)",
      transformerTitleProject: "Transformador (projeto)",
      noTransformer: "Nenhum transformador inserido.",
      placeholderTransformerName: "Nome do Trafo",
      btnMarkVerified: "Marcar Verificado",
      btnMarkUnverified: "Verificado",
      demandKva: "Demanda:",

      edgeTitleAsis: "Condutor (existente)",
      edgeTitleProject: "Condutor (projeto)",
      edgeComposition: "Composição:",
      btnAddConductor: "Adicionar Condutor",

      edgeTitle: "Trecho de rede BT",
      noEdge: "Nenhum trecho inserido.",
      placeholderEdgeName: "Identificação do Trecho",
      conductorPhase: "Fases",
      conductorNeutral: "Neutro",
      conductorStreetLight: "Ilum.",
      replaceConductor: "Substituir condutores de",
    },

    bulkImport: {
      title: "Importação em Massa",
      pasteData: "Colar Dados (Tabular)",
      loadExcel: "Carregar Excel",
      placeholder: "Cole os dados aqui (formato tabular)...",
      btnCancel: "Cancelar",
      btnReview: "Revisar",
      btnImport: "Importar",
      reviewTitle: "Revisar Importação",
      reviewSummary: "itens processados",
    },
  },
  "en-US": {
    projectTypeTitle: "Project Type",
    projectTypeRamais: "Connections (Standard)",
    projectTypeClandestino: "Unregistered (Load by Area)",
    btnBulkImport: "Bulk Import",

    stats: {
      componentsTitle: "Components",
      poles: "Poles",
      transformers: "Transformers",
      edges: "Spans",
      metricsTitle: "Metrics",
      networkLengthMeters: "m of network",
    },

    poleVerification: {
      title: "Poles / Verification",
      selectedPole: "Selected pole",
      noPole: "No pole registered.",
      placeholderPoleName: "Pole name/selection",
      selectPoleTitle: "Select pole",
      btnMarkVerified: "Mark pole as verified",
      btnMarkUnverified: "Mark as unverified",
      flagRemove: "Remove",
      flagNew: "New",
      flagReplace: "Replace",
      flagExisting: "Existing",
      activeCircuitBreak: "Active physical separation: the transformer circuit ends at this pole.",
      sizeEffortTitle: "Size / Nominal Effort",
      heightM: "Height (m)",
      effortDan: "Effort (daN)",
      structuresTitle: "LV Structures (si1-si4)",
      poleStateTitle: "Pole state",
      selectState: "Select state",
      stateGood: "Good condition",
      stateLeaning: "Leaning",
      stateCracked: "Cracked",
      stateCondemned: "Condemned",
      equipmentsTitle: "Equipment",
      equipmentsPlaceholder: "e.g., fuse cutout, 75 kVA transformer, luminaire, recloser...",
      generalNotesTitle: "General notes",
      generalNotesPlaceholder: "e.g., restricted access, interference with wall, nearby vegetation...",
      ramaisTitle: "Pole connections",
      btnAddRamal: "Connection",
      noRamais: "No connections registered on this pole.",
      btnRemoveRamal: "Remove connection",
      freeObservation: "Free note...",
      quickNotes: {
        deteriorated: "Deteriorated",
        splices: "Splices",
        noInsulation: "No insulation",
        long: "Long",
        crossing: "Crossing",
        other: "Other",
      },
    },

    transformerEdge: {
      transformerTitleAsis: "Transformer (current readings)",
      transformerTitleProject: "Transformer (project)",
      noTransformer: "No transformer inserted.",
      placeholderTransformerName: "Transformer Name",
      btnMarkVerified: "Mark Verified",
      btnMarkUnverified: "Verified",
      demandKva: "Demand:",

      edgeTitleAsis: "Conductor (existing)",
      edgeTitleProject: "Conductor (project)",
      edgeComposition: "Composition:",
      btnAddConductor: "Add Conductor",

      edgeTitle: "LV network span",
      noEdge: "No span inserted.",
      placeholderEdgeName: "Span Identification",
      conductorPhase: "Phases",
      conductorNeutral: "Neutral",
      conductorStreetLight: "Street Light",
      replaceConductor: "Replace conductors from",
    },

    bulkImport: {
      title: "Bulk Import",
      pasteData: "Paste Data (Tabular)",
      loadExcel: "Load Excel",
      placeholder: "Paste data here (tabular format)...",
      btnCancel: "Cancel",
      btnReview: "Review",
      btnImport: "Import",
      reviewTitle: "Review Import",
      reviewSummary: "items processed",
    },
  },
  "es-ES": {
    projectTypeTitle: "Tipo de Proyecto",
    projectTypeRamais: "Acometidas (Estándar)",
    projectTypeClandestino: "Clandestino (Carga por Área)",
    btnBulkImport: "Importación Masiva",

    stats: {
      componentsTitle: "Componentes",
      poles: "Postes",
      transformers: "Trafos",
      edges: "Tramos",
      metricsTitle: "Métricas",
      networkLengthMeters: "m de red",
    },

    poleVerification: {
      title: "Postes / Verificación",
      selectedPole: "Poste seleccionado",
      noPole: "Ningún poste registrado.",
      placeholderPoleName: "Nombre/selección del poste",
      selectPoleTitle: "Seleccionar poste",
      btnMarkVerified: "Marcar poste como verificado",
      btnMarkUnverified: "Marcar como no verificado",
      flagRemove: "Remoción",
      flagNew: "Nuevo",
      flagReplace: "Reemplazo",
      flagExisting: "Existente",
      activeCircuitBreak: "Separación física activa: el circuito del trafo termina en este poste.",
      sizeEffortTitle: "Tamaño / Esfuerzo nominal",
      heightM: "Altura (m)",
      effortDan: "Esfuerzo (daN)",
      structuresTitle: "Estructuras BT (si1-si4)",
      poleStateTitle: "Estado del poste",
      selectState: "Seleccione el estado",
      stateGood: "Buen estado",
      stateLeaning: "Inclinado",
      stateCracked: "Agrietado",
      stateCondemned: "Condenado",
      equipmentsTitle: "Equipos",
      equipmentsPlaceholder: "Ej.: cortacircuitos, trafo 75 kVA, luminaria, reconectador...",
      generalNotesTitle: "Observaciones generales",
      generalNotesPlaceholder: "Ej.: acceso restringido, interferencia con muro, vegetación cercana...",
      ramaisTitle: "Acometidas del poste",
      btnAddRamal: "Acometida",
      noRamais: "Sin acometidas registradas en este poste.",
      btnRemoveRamal: "Eliminar acometida",
      freeObservation: "Nota libre...",
      quickNotes: {
        deteriorated: "Deteriorado",
        splices: "Empalmes",
        noInsulation: "Sin aislamiento",
        long: "Largo",
        crossing: "Cruce",
        other: "Otro",
      },
    },

    transformerEdge: {
      transformerTitleAsis: "Transformador (lecturas actuales)",
      transformerTitleProject: "Transformador (proyecto)",
      noTransformer: "Ningún transformador insertado.",
      placeholderTransformerName: "Nombre del Trafo",
      btnMarkVerified: "Marcar Verificado",
      btnMarkUnverified: "Verificado",
      demandKva: "Demanda:",

      edgeTitleAsis: "Conductor (existente)",
      edgeTitleProject: "Conductor (proyecto)",
      edgeComposition: "Composición:",
      btnAddConductor: "Añadir Conductor",

      edgeTitle: "Tramo de red BT",
      noEdge: "Ningún tramo insertado.",
      placeholderEdgeName: "Identificación del Tramo",
      conductorPhase: "Fases",
      conductorNeutral: "Neutro",
      conductorStreetLight: "Ilum.",
      replaceConductor: "Reemplazar conductores de",
    },

    bulkImport: {
      title: "Importación Masiva",
      pasteData: "Pegar Datos (Tabular)",
      loadExcel: "Cargar Excel",
      placeholder: "Pegue los datos aquí (formato tabular)...",
      btnCancel: "Cancelar",
      btnReview: "Revisar",
      btnImport: "Importar",
      reviewTitle: "Revisar Importación",
      reviewSummary: "ítems procesados",
    },
  },
};

export function getBtTopologyPanelText(locale: AppLocale): BtTopologyPanelText {
  return TEXTS[locale] ?? TEXTS["pt-BR"];
}
