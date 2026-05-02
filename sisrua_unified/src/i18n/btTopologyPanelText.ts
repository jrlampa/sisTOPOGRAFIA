import type { AppLocale } from "../types";

type BtTopologyPanelText = {
  projectTypeTitle: string;
  projectTypeRamais: string;
  projectTypeClandestino: string;
  clandestinoAreaTitle: string;
  clandestinoAreaPlaceholder: string;
  btnBulkImport: string;
  massEditTitle: string;
  
  stats: {
    componentsTitle: string;
    poles: string;
    transformers: string;
    edges: string;
    metricsTitle: string;
    networkLengthMeters: string;
    trafoUtilTitle: string;
    spansTitle: string;
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
    stateProjected: string;
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

  dashboard: {
    tabInfra: string;
    tabElectrical: string;
    tabCommercial: string;
    poleContext: string;
    transformerContext: string;
    edgeContext: string;
    noSelection: string;
    mediumVoltageContext: string;
    mediumVoltageStructures: string;
    mediumVoltageConnections: string;
    notAvailable: string;
    spansCount: (count: number) => string;
  };
  popup: {
    flag: string;
    verified: string;
    notVerified: string;
    noConductor: string;
    linkedMtConductor: string;
    leaving: string;
    noLeavingConductor: string;
  };
};

const TEXTS: Record<AppLocale, BtTopologyPanelText> = {
  "pt-BR": {
    projectTypeTitle: "Tipo de Projeto",
    projectTypeRamais: "Ramais (Padrão)",
    projectTypeClandestino: "Clandestino (Carga por Área)",
    clandestinoAreaTitle: "Área de clandestinos (m²)",
    clandestinoAreaPlaceholder: "Informe a área em m²",
    btnBulkImport: "Importação em Massa",
    massEditTitle: "Edição em Massa",

    stats: {
      componentsTitle: "Componentes",
      poles: "Postes",
      transformers: "Trafos",
      edges: "Trechos",
      metricsTitle: "Métricas",
      networkLengthMeters: "Comprimento da Rede (m)",
      trafoUtilTitle: "Util. Trafo",
      spansTitle: "Vãos (m)",
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
      stateProjected: "Projetado",
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

    dashboard: {
      tabInfra: "Infra",
      tabElectrical: "Elétrica",
      tabCommercial: "Comercial",
      poleContext: "Poste",
      transformerContext: "Trafo",
      edgeContext: "Vão",
      noSelection: "Selecione um item no mapa",
      mediumVoltageContext: "Contexto de Média Tensão (MT)",
      mediumVoltageStructures: "Estruturas MT",
      mediumVoltageConnections: "Conexões MT",
      notAvailable: "N/D",
      spansCount: (count: number) => `${count} trecho(s)`,
    },
    popup: {
      flag: "Flag",
      verified: "Verificado",
      notVerified: "Não verificado",
      noConductor: "Sem condutor informado",
      linkedMtConductor: "Condutor MT Vinculado",
      leaving: "Sai",
      noLeavingConductor: "Sem condutor de saída definido",
    },
  },
  "en-US": {
    projectTypeTitle: "Project Type",
    projectTypeRamais: "Connections (Standard)",
    projectTypeClandestino: "Unregistered (Load by Area)",
    clandestinoAreaTitle: "Unregistered area (m²)",
    clandestinoAreaPlaceholder: "Enter area in m²",
    btnBulkImport: "Bulk Import",
    massEditTitle: "Bulk Edit",

    stats: {
      componentsTitle: "Components",
      poles: "Poles",
      transformers: "Transformers",
      edges: "Spans",
      metricsTitle: "Metrics",
      networkLengthMeters: "Network Length (m)",
      trafoUtilTitle: "Trafo Util.",
      spansTitle: "Spans (m)",
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
      stateProjected: "Projected",
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

    dashboard: {
      tabInfra: "Infra",
      tabElectrical: "Electrical",
      tabCommercial: "Commercial",
      poleContext: "Pole",
      transformerContext: "Trafo",
      edgeContext: "Span",
      noSelection: "Select an item on the map",
      mediumVoltageContext: "Medium Voltage Context (MV)",
      mediumVoltageStructures: "MV Structures",
      mediumVoltageConnections: "MV Connections",
      notAvailable: "N/A",
      spansCount: (count: number) => `${count} span(s)`,
    },
    popup: {
      flag: "Flag",
      verified: "Verified",
      notVerified: "Not verified",
      noConductor: "No conductor informed",
      linkedMtConductor: "Linked MT Conductor",
      leaving: "Leaves",
      noLeavingConductor: "No leaving conductor defined",
    },
  },
  "es-ES": {
    projectTypeTitle: "Tipo de Proyecto",
    projectTypeRamais: "Acometidas (Estándar)",
    projectTypeClandestino: "Clandestino (Carga por Área)",
    clandestinoAreaTitle: "Área clandestina (m²)",
    clandestinoAreaPlaceholder: "Informe el área en m²",
    btnBulkImport: "Importación Masiva",
    massEditTitle: "Edición Masiva",

    stats: {
      componentsTitle: "Componentes",
      poles: "Postes",
      transformers: "Trafos",
      edges: "Tramos",
      metricsTitle: "Métricas",
      networkLengthMeters: "Longitud de Red (m)",
      trafoUtilTitle: "Util. Trafo",
      spansTitle: "Vanos (m)",
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
      stateProjected: "Proyectado",
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

    dashboard: {
      tabInfra: "Infra",
      tabElectrical: "Eléctrica",
      tabCommercial: "Comercial",
      poleContext: "Poste",
      transformerContext: "Trafo",
      edgeContext: "Tramo",
      noSelection: "Seleccione um item en el mapa",
      mediumVoltageContext: "Contexto de Media Tensión (MT)",
      mediumVoltageStructures: "Estructuras MT",
      mediumVoltageConnections: "Conexiones MT",
      notAvailable: "N/D",
      spansCount: (count: number) => `${count} tramo(s)`,
    },
    popup: {
      flag: "Flag",
      verified: "Verificado",
      notVerified: "No verificado",
      noConductor: "Sin conductor informado",
      linkedMtConductor: "Conductor MT Vinculado",
      leaving: "Sale",
      noLeavingConductor: "Sin conductor de salida definido",
    },
  },
};

export function getBtTopologyPanelText(locale: AppLocale): BtTopologyPanelText {
  return TEXTS[locale] ?? TEXTS["pt-BR"];
}
