export interface MapConductorEntry {
  id: string;
  quantity: number;
  conductorName: string;
}

export interface MapBtPoleStructures {
  si1?: string;
  si2?: string;
  si3?: string;
  si4?: string;
}

export interface MapBtPoleRamalEntry {
  id: string;
  quantity: number;
  ramalType?: string;
  notes?: string;
}

export interface MapBtPole {
  id: string;
  lat: number;
  lng: number;
  title: string;
  ramais?: MapBtPoleRamalEntry[];
  poleSpec?: {
    heightM?: number;
    nominalEffortDan?: number;
  };
  conditionStatus?: "bom_estado" | "desaprumado" | "trincado" | "condenado";
  equipmentNotes?: string;
  generalNotes?: string;
  verified?: boolean;
  btStructures?: MapBtPoleStructures;
  nodeChangeFlag?: "existing" | "new" | "remove" | "replace";
  circuitBreakPoint?: boolean;
}

export interface MapBtTransformer {
  id: string;
  poleId?: string;
  lat: number;
  lng: number;
  title: string;
  projectPowerKva?: number;
  monthlyBillBrl: number;
  demandKva?: number;
  demandKw?: number;
  readings: Array<{
    id: string;
    kwhMonth?: number;
    unitRateBrlPerKwh?: number;
    billedBrl?: number;
    currentMaxA?: number;
    temperatureFactor?: number;
    autoCalculated?: boolean;
  }>;
  verified?: boolean;
  transformerChangeFlag?: "existing" | "new" | "remove" | "replace";
}

export interface MapBtEdge {
  id: string;
  fromPoleId: string;
  toPoleId: string;
  lengthMeters?: number;
  cqtLengthMeters?: number;
  conductors: MapConductorEntry[];
  replacementFromConductors?: MapConductorEntry[];
  verified?: boolean;
  removeOnExecution?: boolean;
  edgeChangeFlag?: "existing" | "new" | "remove" | "replace";
}

export interface MapBtTopology {
  poles: MapBtPole[];
  transformers: MapBtTransformer[];
  edges: MapBtEdge[];
}

export interface MapMtPoleStructures {
  n1?: string;
  n2?: string;
  n3?: string;
  n4?: string;
}

export interface MapMtPole {
  id: string;
  lat: number;
  lng: number;
  title: string;
  mtStructures?: MapMtPoleStructures;
  verified?: boolean;
  nodeChangeFlag?: "existing" | "new" | "remove" | "replace";
}

export interface MapMtEdge {
  id: string;
  fromPoleId: string;
  toPoleId: string;
  lengthMeters?: number;
  verified?: boolean;
  edgeChangeFlag?: "existing" | "new" | "remove" | "replace";
}

export interface MapMtTopology {
  poles: MapMtPole[];
  edges: MapMtEdge[];
}
