export interface GeoLocation {
  lat: number;
  lng: number;
  label?: string;
}

export interface OsmNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

export interface OsmWay {
  type: "way";
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

export interface OsmMember {
  type: string;
  ref: number;
  role: string;
  geometry?: { lat: number; lon: number }[];
}

export interface OsmRelation {
  type: "relation";
  id: number;
  members: OsmMember[];
  tags?: Record<string, string>;
}

export type OsmElement = OsmNode | OsmWay | OsmRelation;

export interface OverpassResponse {
  version: number;
  generator: string;
  osm3s: {
    timestamp_osm_base: string;
    copyright: string;
  };
  elements: OsmElement[];
}

export interface DxfOptions {
  radius: number;
  center: GeoLocation;
  includeBuildings: boolean;
  includeRoads: boolean;
  includeNature: boolean;
  includeDetails: boolean; // street furniture, lights, etc
}

export interface AnalysisStats {
  totalBuildings: number;
  totalRoads: number;
  totalNature: number;
  avgHeight: number;
  maxHeight: number;
}

export interface TerrainPoint {
  lat: number;
  lng: number;
  elevation: number;
}

export type TerrainGrid = TerrainPoint[][];

export interface ProjectMetadata {
  projectName: string;
  companyName: string;
  engineerName: string;
  date: string;
  scale: string;
  revision: string;
}

export interface Violation {
  id: string;
  type: "warning" | "critical" | "info";
  message: string;
  location: GeoLocation;
}

export interface LayerConfig {
  [key: string]: boolean;
  buildings: boolean;
  roads: boolean;
  curbs: boolean;
  nature: boolean;
  terrain: boolean;
  contours: boolean;
  slopeAnalysis: boolean;
  furniture: boolean;
  labels: boolean;
  dimensions: boolean;
  grid: boolean;
  btNetwork: boolean;
  mtNetwork: boolean;
}

export type ProjectionType = "local" | "utm";
export type AppTheme = "light" | "dark";
export type MapProvider = "vector" | "satellite";
export type SimplificationLevel = "off" | "low" | "medium" | "high";
export type ContourRenderMode = "spline" | "polyline";
export type BtProjectType = "ramais" | "geral" | "clandestino";
export type BtEditorMode =
  | "none"
  | "move-pole"
  | "add-pole"
  | "add-transformer"
  | "add-edge";

export type MtEditorMode =
  | "none"
  | "mt-add-pole"
  | "mt-add-edge"
  | "mt-move-pole";
export type BtNetworkScenario = "asis" | "projeto" | "proj1" | "proj2";
export type BtTransformerCalculationMode = "automatic" | "manual";
export type BtCqtScenario = "atual" | "proj1" | "proj2";
export type BtQtPontoCalculationMethod = "impedance_modulus" | "power_factor";

export interface BtCqtDmdiInputs {
  clandestinoEnabled: boolean;
  aa24DemandBase: number;
  sumClientsX: number;
  ab35LookupDmdi: number;
}

export interface BtCqtComputationInputs {
  scenario: BtCqtScenario;
  qtPontoCalculationMethod?: BtQtPontoCalculationMethod;
  powerFactor?: number;
  dmdi?: BtCqtDmdiInputs;
  geral?: {
    pontoRamal: string;
    qtMttr: number;
    esqCqtByPonto: Record<string, number>;
    dirCqtByPonto: Record<string, number>;
  };
  db?: {
    trAtual: number;
    demAtual: number;
    qtMt: number;
    trafosZ?: Array<{ trafoKva: number; qtFactor: number }>;
  };
  branches?: Array<{
    trechoId: string;
    fase: "MONO" | "BIF" | "TRI";
    acumuladaKva: number;
    eta: number;
    tensaoTrifasicaV: number;
    conductorName: string;
    lengthMeters?: number;
    temperatureC?: number;
    ponto?: string;
    lado?: "ESQUERDO" | "DIREITO";
  }>;
}

export interface BtRamalEntry {
  id: string;
  quantity: number;
  conductorName: string;
}

export type BtRamalConditionNote =
  | "deteriorado"
  | "emendas"
  | "sem_isolamento"
  | "ramal_longo"
  | "cruzamento"
  | "outro";

export interface BtPoleRamalEntry {
  id: string;
  quantity: number;
  ramalType?: string;
  notes?: string;
}

export interface BtPoleSpec {
  heightM?: number;
  nominalEffortDan?: number;
}

export interface BtPoleBtStructures {
  si1?: string;
  si2?: string;
  si3?: string;
  si4?: string;
}

export type BtPoleConditionStatus =
  | "bom_estado"
  | "desaprumado"
  | "trincado"
  | "condenado";

/** @deprecated Use PoleNode instead. Será removido após migração completa para arquitetura Poste-Driven. */
export interface BtPoleNode {
  id: string;
  lat: number;
  lng: number;
  title: string;
  ramais?: BtPoleRamalEntry[];
  poleSpec?: BtPoleSpec;
  conditionStatus?: BtPoleConditionStatus;
  equipmentNotes?: string;
  generalNotes?: string;
  verified?: boolean;
  btStructures?: BtPoleBtStructures;
  nodeChangeFlag?: "existing" | "new" | "remove" | "replace";
  circuitBreakPoint?: boolean;
}

export interface BtTransformerReading {
  id: string;
  // Legacy billing fields (kept optional for backward compatibility)
  kwhMonth?: number;
  unitRateBrlPerKwh?: number;
  billedBrl?: number;
  // Workbook-aligned demand inputs
  currentMaxA?: number;
  temperatureFactor?: number;
  autoCalculated?: boolean;
}

export interface BtTransformer {
  id: string;
  poleId?: string;
  lat: number;
  lng: number;
  title: string;
  projectPowerKva?: number;
  monthlyBillBrl: number;
  demandKva?: number;
  /** @deprecated Use demandKva. */
  demandKw?: number;
  readings: BtTransformerReading[];
  verified?: boolean;
  transformerChangeFlag?: "existing" | "new" | "remove" | "replace";
}

export interface BtEdge {
  id: string;
  fromPoleId: string;
  toPoleId: string;
  lengthMeters?: number;
  // Optional electrical length used only for CQT calculations (not map geometry).
  cqtLengthMeters?: number;
  conductors: BtRamalEntry[];
  mtConductors?: BtRamalEntry[];
  replacementFromConductors?: BtRamalEntry[];
  verified?: boolean;
  removeOnExecution?: boolean;
  edgeChangeFlag?: "existing" | "new" | "remove" | "replace";
}

/** @deprecated Use NetworkTopology instead. Será removido após migração completa para arquitetura Poste-Driven. */
export interface BtTopology {
  poles: BtPoleNode[];
  transformers: BtTransformer[];
  edges: BtEdge[];
}

export interface BtExportSummary {
  btContextUrl: string;
  criticalPoleId: string;
  criticalAccumulatedClients: number;
  criticalAccumulatedDemandKva: number;
  cqt?: {
    scenario?: BtCqtScenario;
    dmdi?: number;
    p31?: number;
    p32?: number;
    k10QtMttr?: number;
    parityStatus?: "complete" | "partial" | "missing";
    parityPassed?: number;
    parityFailed?: number;
  };
  verifiedPoles?: number;
  totalPoles?: number;
  verifiedEdges?: number;
  totalEdges?: number;
  verifiedTransformers?: number;
  totalTransformers?: number;
}

export interface BtExportHistoryEntry extends BtExportSummary {
  exportedAt: string;
  projectType: BtProjectType;
}

export interface AppSettings {
  enableAI: boolean;
  simplificationLevel: SimplificationLevel;
  orthogonalize: boolean;
  contourRenderMode: ContourRenderMode;
  layers: LayerConfig;
  projection: ProjectionType;
  theme: AppTheme;
  mapProvider: MapProvider;
  projectMetadata: ProjectMetadata;
  contourInterval: number;
  projectType?: BtProjectType;
  btNetworkScenario?: BtNetworkScenario;
  btEditorMode?: BtEditorMode;
  btTransformerCalculationMode?: BtTransformerCalculationMode;
  btQtPontoCalculationMethod?: BtQtPontoCalculationMethod;
  btCqtPowerFactor?: number;
  clandestinoAreaM2?: number;
  mtEditorMode?: MtEditorMode;
}

export type SelectionMode = "circle" | "polygon" | "measure";

// ─── Estruturas MT (Média Tensão) ─────────────────────────────────────────────

export interface MtPoleStructures {
  n1?: string;
  n2?: string;
  n3?: string;
  n4?: string;
}

/** @deprecated Use PoleNode instead. Será removido após migração completa para arquitetura Poste-Driven. */
export interface MtPoleNode {
  id: string;
  lat: number;
  lng: number;
  title: string;
  mtStructures?: MtPoleStructures;
  verified?: boolean;
  nodeChangeFlag?: "existing" | "new" | "remove" | "replace";
}

/** @deprecated Use NetworkEdge instead. Será removido após migração completa para arquitetura Poste-Driven. */
export interface MtEdge {
  id: string;
  fromPoleId: string;
  toPoleId: string;
  lengthMeters?: number;
  conductors?: BtRamalEntry[];
  verified?: boolean;
  edgeChangeFlag?: "existing" | "new" | "remove" | "replace";
}

/** @deprecated Use NetworkTopology instead. Será removido após migração completa para arquitetura Poste-Driven. */
export interface MtTopology {
  poles: MtPoleNode[];
  edges: MtEdge[];
}

// ─── Estado Global ─────────────────────────────────────────────────────────────

export interface GlobalState {
  center: GeoLocation;
  radius: number;
  selectionMode: SelectionMode;
  polygon: GeoLocation[];
  measurePath: GeoLocation[];
  settings: AppSettings;
  btTopology?: BtTopology;
  btExportSummary?: BtExportSummary | null;
  btExportHistory?: BtExportHistoryEntry[];
  mtTopology?: MtTopology;
  /** Topologia unificada Poste-Driven. Coexiste com btTopology/mtTopology durante migração. */
  network?: NetworkTopology;
}

// ─── Poste-Driven: modelo unificado ───────────────────────────────────────────
// PoleNode é o Aggregate Root: tudo que existe fisicamente em um poste reside aqui.
// Arestas (NetworkEdge) conectam postes e carregam apenas condutor + distância.

export type PoleEquipmentType =
  | "trafo"
  | "medicao"
  | "religador"
  | "chave_faca"
  | "chave_seccionadora"
  | "para_raios"
  | "banco_capacitor"
  | "iluminacao"
  | "outro";

export interface PoleEquipmentEntry {
  id: string;
  type: PoleEquipmentType;
  label?: string;
  notes?: string;
}

/** Poste unificado — Aggregate Root da rede elétrica.
 *  Superset backward-compatible de BtPoleNode + MtPoleNode.
 *  Campos legados opcionais para migração incremental. */
export interface PoleNode {
  id: string;
  lat: number;
  lng: number;
  title: string;

  // Participação nas redes
  hasBt?: boolean;
  hasMt?: boolean;

  // Estruturas físicas
  btStructures?: BtPoleBtStructures; // si1–si4 (estruturas BT)
  mtStructures?: MtPoleStructures; // n1–n4  (estruturas MT)

  // Equipamentos instalados (catálogo estruturado)
  equipments?: PoleEquipmentEntry[];

  // Ramais de clientes fixados neste poste
  ramais?: BtPoleRamalEntry[];

  // Características físicas do poste
  poleSpec?: BtPoleSpec;
  conditionStatus?: BtPoleConditionStatus;

  // Metadados
  verified?: boolean;
  generalNotes?: string;
  /** @deprecated Usar equipments[]. Mantido para migração de dados legados. */
  equipmentNotes?: string;
  nodeChangeFlag?: "existing" | "new" | "remove" | "replace";
  circuitBreakPoint?: boolean;
}

/** Aresta unificada — conecta dois PoleNodes carregando dados de condutor e distância.
 *  Superset backward-compatible de BtEdge + MtEdge. */
export interface NetworkEdge {
  id: string;
  fromPoleId: string;
  toPoleId: string;
  lengthMeters?: number;
  /** Comprimento elétrico usado apenas para cálculos CQT. */
  cqtLengthMeters?: number;

  btConductors?: BtRamalEntry[]; // condutores BT neste vão
  mtConductors?: BtRamalEntry[]; // condutores MT neste vão
  replacementFromConductors?: BtRamalEntry[];

  verified?: boolean;
  removeOnExecution?: boolean;
  edgeChangeFlag?: "existing" | "new" | "remove" | "replace";
}

/** Topologia unificada Poste-Driven.
 *  poles[] são a fonte de verdade de tudo que existe fisicamente nos postes.
 *  edges[] carregam apenas condutor + distância entre postes.
 *  transformers[] mantidos separados pois possuem ciclo de vida próprio (leituras, kVA). */
export interface NetworkTopology {
  poles: PoleNode[];
  edges: NetworkEdge[];
  transformers: BtTransformer[];
}
