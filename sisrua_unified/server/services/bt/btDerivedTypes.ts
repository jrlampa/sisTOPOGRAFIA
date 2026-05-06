export type BtProjectType = "ramais" | "geral" | "clandestino";

export interface BtPoleRamalEntry {
  quantity: number;
  ramalType?: string;
}

export interface BtPoleNode {
  id: string;
  lat: number;
  lng: number;
  ramais?: BtPoleRamalEntry[];
  circuitBreakPoint?: boolean;
}

export interface BtTransformerReading {
  id?: string;
  currentMaxA?: number;
  temperatureFactor?: number;
  billedBrl?: number;
  unitRateBrlPerKwh?: number;
  autoCalculated?: boolean;
}

export interface BtTransformer {
  id: string;
  poleId?: string;
  demandKva?: number;
  /** @deprecated Use demandKva. */
  demandKw?: number;
  /** Transformer nameplate rating in kVA, sent from frontend as projectPowerKva. */
  projectPowerKva?: number;
  readings: BtTransformerReading[];
}

export interface BtEdge {
  fromPoleId: string;
  toPoleId: string;
  lengthMeters?: number;
  cqtLengthMeters?: number;
  conductors?: Array<{
    conductorName: string;
    quantity?: number;
  }>;
  removeOnExecution?: boolean;
  edgeChangeFlag?: "existing" | "new" | "remove" | "replace";
}

export interface BtTopology {
  poles: BtPoleNode[];
  transformers: BtTransformer[];
  edges: BtEdge[];
}

export interface BtPoleAccumulatedDemand {
  poleId: string;
  localClients: number;
  accumulatedClients: number;
  localTrechoDemandKva: number;
  accumulatedDemandKva: number;
  voltageV?: number;
  dvAccumPercent?: number;
  cqtStatus?: "OK" | "ATENÇÃO" | "CRÍTICO";
  worstRamalVoltageV?: number;
  worstRamalDvPercent?: number;
  worstRamalStatus?: "OK" | "ATENÇÃO" | "CRÍTICO";
}

export interface BtTransformerEstimatedDemand {
  transformerId: string;
  assignedClients: number;
  estimatedDemandKva: number;
  /** @deprecated Use estimatedDemandKva. */
  estimatedDemandKw?: number;
}

export interface BtSectioningImpact {
  unservedPoleIds: string[];
  unservedClients: number;
  estimatedDemandKva: number;
  /** @deprecated Use estimatedDemandKva. */
  estimatedDemandKw?: number;
  loadCenter: { lat: number; lng: number } | null;
  suggestedPoleId: string | null;
}

export interface BtClandestinoDisplay {
  demandKva: number;
  /** @deprecated Use demandKva. */
  demandKw?: number;
  areaMin: number;
  areaMax: number;
  baseDemandKva: number | null;
  /** @deprecated Use baseDemandKva. */
  demandKvaLegacy?: number | null;
  diversificationFactor: number | null;
  finalDemandKva: number;
}

export interface BtTransformerDerived {
  transformerId: string;
  demandKva: number;
  /** @deprecated Use demandKva. */
  demandKw?: number;
  monthlyBillBrl: number;
}

export interface BtDerivedResponse {
  summary: {
    poles: number;
    transformers: number;
    edges: number;
    totalLengthMeters: number;
    transformerDemandKva: number;
    /** @deprecated Use transformerDemandKva. */
    transformerDemandKw?: number;
  };
  pointDemandKva: number;
  criticalPoleId: string | null;
  accumulatedByPole: BtPoleAccumulatedDemand[];
  estimatedByTransformer: BtTransformerEstimatedDemand[];
  sectioningImpact: BtSectioningImpact;
  clandestinoDisplay: BtClandestinoDisplay;
  transformersDerived: BtTransformerDerived[];
}
