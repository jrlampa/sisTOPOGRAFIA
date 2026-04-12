import { constantsService } from "./constantsService.js";
import { logger } from "../utils/logger.js";
import { getCabosByScenario } from "../constants/cqtLookupTables.js";
import { calculateCorrectedResistance, calculateIb } from "./cqtEngine.js";

type BtProjectType = "ramais" | "geral" | "clandestino";

const CURRENT_TO_DEMAND_CONVERSION = 0.375;

interface BtPoleRamalEntry {
  quantity: number;
  ramalType?: string;
}

interface BtPoleNode {
  id: string;
  lat: number;
  lng: number;
  ramais?: BtPoleRamalEntry[];
  circuitBreakPoint?: boolean;
}

interface BtTransformerReading {
  id?: string;
  currentMaxA?: number;
  temperatureFactor?: number;
  billedBrl?: number;
  unitRateBrlPerKwh?: number;
  autoCalculated?: boolean;
}

interface BtTransformer {
  id: string;
  poleId?: string;
  demandKw: number;
  /** Transformer nameplate rating in kVA, sent from frontend as projectPowerKva. */
  projectPowerKva?: number;
  readings: BtTransformerReading[];
}

interface BtEdge {
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

interface BtTopology {
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
  estimatedDemandKw: number;
}

export interface BtSectioningImpact {
  unservedPoleIds: string[];
  unservedClients: number;
  estimatedDemandKw: number;
  loadCenter: { lat: number; lng: number } | null;
  suggestedPoleId: string | null;
}

export interface BtClandestinoDisplay {
  demandKw: number;
  areaMin: number;
  areaMax: number;
  demandKva: number | null;
  diversificationFactor: number | null;
  finalDemandKva: number;
}

export interface BtTransformerDerived {
  transformerId: string;
  demandKw: number;
  monthlyBillBrl: number;
}

export interface BtDerivedResponse {
  summary: {
    poles: number;
    transformers: number;
    edges: number;
    totalLengthMeters: number;
    transformerDemandKw: number;
  };
  pointDemandKva: number;
  criticalPoleId: string | null;
  accumulatedByPole: BtPoleAccumulatedDemand[];
  estimatedByTransformer: BtTransformerEstimatedDemand[];
  sectioningImpact: BtSectioningImpact;
  clandestinoDisplay: BtClandestinoDisplay;
  transformersDerived: BtTransformerDerived[];
}

const CLANDESTINO_RAMAL_TYPE = "Clandestino";
const BT_PHASE_VOLTAGE_V = 127;
const BT_LINE_REFERENCE_VOLTAGE_V = 220;
// TRI (3-phase) factor per workbook: MONO=6, BIF=2, TRI=1.
// BT trunk cables are 3-phase by default (verified against Light workbook LADO 1/LADO 2).
const BT_PHASE_FACTOR = 1;
// Medium-voltage line losses fraction (workbook DB K4 = QT_MT = 0.0183).
const QT_MT_FRACTION = 0.0183;
// Transformer short-circuit impedance percentage (workbook TRAFOS_Z: all = 0.035 = 3.5%).
const Z_TRAFO_PERCENT = 0.035;
// Default transformer rated capacity (kVA) when not provided.
const DEFAULT_TRAFO_KVA = 225;
const DEFAULT_AMBIENT_TEMP_C = 30;
const BT_TRI_PHASE_ETA = 3;
const LOW_TEMP_LIMIT_CONDUCTORS = new Set([
  "13 AL - DX",
  "13 AL - TX",
  "13 AL - QX",
  "21 AL - QX",
  "53 AL - QX",
]);

// Workbook RAMAL!B5:U5 coefficients used by V = SUM(tipo * peso)
// and TOTAL_DO_TRECHO = AA24 * (V / W16).
const RAMAL_WEIGHT_BY_TYPE_ATUAL = new Map<string, number>([
  ["5 CC", 66],
  ["8 CC", 88],
  ["13 CC", 116],
  ["21 CC", 151],
  ["33 CC", 205],
  ["53 CC", 272],
  ["67 CC", 313],
  ["85 CC", 366],
  ["107 CC", 418],
  ["127 CC", 466],
  ["253 CC", 710],
  ["13 DX 6 AWG", 78],
  ["13 TX 6 AWG", 80],
  ["13 QX 6 AWG", 72],
  ["21 QX 4 AWG", 95],
  ["53 QX 1/0", 165],
  ["85 QX 3/0", 220],
  ["107 QX 4/0", 254],
  ["70 MMX", 227],
  ["185 MMX", 423],
]);

const toFixed2 = (value: number | undefined | null): number => {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return 0;
  }
  return Number(value.toFixed(2));
};

const getPoleClientsByProjectType = (
  projectType: BtProjectType,
  topology: BtTopology,
  poleId: string,
): number => {
  const pole = topology.poles.find((item) => item.id === poleId);
  if (!pole) {
    return 0;
  }

  const ramais = pole.ramais ?? [];
  if (projectType === "clandestino") {
    return ramais
      .filter(
        (ramal) =>
          (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) ===
          CLANDESTINO_RAMAL_TYPE,
      )
      .reduce((sum, ramal) => sum + ramal.quantity, 0);
  }

  return ramais
    .filter(
      (ramal) =>
        (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) !== CLANDESTINO_RAMAL_TYPE,
    )
    .reduce((sum, ramal) => sum + ramal.quantity, 0);
};

const getRamalWeightByType = (ramalType?: string): number | null => {
  if (!ramalType || typeof ramalType !== "string") {
    return null;
  }

  const normalized = ramalType.trim().toUpperCase();
  for (const [type, weight] of RAMAL_WEIGHT_BY_TYPE_ATUAL.entries()) {
    if (type.toUpperCase() === normalized) {
      return weight;
    }
  }

  return null;
};

const getClandestinoDemandKvaByAreaAndClients = (
  areaM2: number,
  clients: number,
): number => {
  const areaToKva = constantsService.getSync<Record<string, number>>(
    "clandestino",
    "AREA_TO_KVA",
  );
  const clientToDiversifFactor = constantsService.getSync<
    Record<string, number>
  >("clandestino", "CLIENT_TO_DIVERSIF_FACTOR");

  if (!areaToKva || !clientToDiversifFactor) {
    return 0;
  }

  const baseKva = areaToKva[String(Math.round(areaM2))];
  const diversificationFactor =
    clientToDiversifFactor[String(Math.round(clients))];

  if (!Number.isFinite(baseKva) || !Number.isFinite(diversificationFactor)) {
    return 0;
  }

  return toFixed2(baseKva * diversificationFactor);
};

const calculateRamalDmdiKva = (
  projectType: BtProjectType,
  aa24DemandBase: number,
  sumClientsX: number,
  ab35LookupDmdi: number,
): number => {
  if (projectType === "clandestino") {
    return toFixed2(ab35LookupDmdi);
  }

  if (
    !Number.isFinite(aa24DemandBase) ||
    !Number.isFinite(sumClientsX) ||
    sumClientsX <= 0
  ) {
    return 0;
  }

  return toFixed2(aa24DemandBase / sumClientsX);
};

interface TransformerOwnershipData {
  localClientByPole: Map<string, number>;
  ownerTransformerByPole: Map<string, string>;
}

const calculateTransformerOwnershipData = (
  topology: BtTopology,
  projectType: BtProjectType,
): TransformerOwnershipData => {
  const allPoleIds = new Set(topology.poles.map((pole) => pole.id));
  const circuitBreakPoleIds = new Set(
    topology.poles
      .filter((pole) => pole.circuitBreakPoint)
      .map((pole) => pole.id),
  );

  const localClientByPole = new Map<string, number>();
  for (const pole of topology.poles) {
    localClientByPole.set(
      pole.id,
      getPoleClientsByProjectType(projectType, topology, pole.id),
    );
  }

  const adjacentPoles = new Map<string, string[]>();
  for (const poleId of allPoleIds) {
    adjacentPoles.set(poleId, []);
  }

  const activeEdges = topology.edges.filter((edge) => {
    const edgeFlag =
      edge.edgeChangeFlag ?? (edge.removeOnExecution ? "remove" : "existing");
    return edgeFlag !== "remove";
  });

  for (const edge of activeEdges) {
    adjacentPoles.get(edge.fromPoleId)?.push(edge.toPoleId);
    adjacentPoles.get(edge.toPoleId)?.push(edge.fromPoleId);
  }

  const transformerPoleEntries = topology.transformers
    .filter(
      (transformer) => transformer.poleId && allPoleIds.has(transformer.poleId),
    )
    .map((transformer) => ({
      transformerId: transformer.id,
      poleId: transformer.poleId as string,
    }));

  const distanceToTransformer = new Map<string, number>();
  const ownerTransformerByPole = new Map<string, string>();
  for (const poleId of allPoleIds) {
    distanceToTransformer.set(poleId, Number.POSITIVE_INFINITY);
  }

  const queue: Array<{ poleId: string; transformerId: string }> = [];
  for (const entry of transformerPoleEntries) {
    const knownDistance =
      distanceToTransformer.get(entry.poleId) ?? Number.POSITIVE_INFINITY;
    const knownOwner = ownerTransformerByPole.get(entry.poleId);
    if (
      knownDistance > 0 ||
      (knownDistance === 0 && (!knownOwner || entry.transformerId < knownOwner))
    ) {
      distanceToTransformer.set(entry.poleId, 0);
      ownerTransformerByPole.set(entry.poleId, entry.transformerId);
    }
    queue.push({ poleId: entry.poleId, transformerId: entry.transformerId });
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const currentDistance =
      distanceToTransformer.get(current.poleId) ?? Number.POSITIVE_INFINITY;
    const owner = ownerTransformerByPole.get(current.poleId);
    if (!owner || owner !== current.transformerId) {
      continue;
    }

    if (circuitBreakPoleIds.has(current.poleId)) {
      continue;
    }

    const neighbors = adjacentPoles.get(current.poleId) ?? [];
    for (const neighborId of neighbors) {
      const knownDistance =
        distanceToTransformer.get(neighborId) ?? Number.POSITIVE_INFINITY;
      const knownOwner = ownerTransformerByPole.get(neighborId);
      const nextDistance = currentDistance + 1;

      if (
        nextDistance < knownDistance ||
        (nextDistance === knownDistance && (!knownOwner || owner < knownOwner))
      ) {
        distanceToTransformer.set(neighborId, nextDistance);
        ownerTransformerByPole.set(neighborId, owner);
        queue.push({ poleId: neighborId, transformerId: owner });
      }
    }
  }

  return { localClientByPole, ownerTransformerByPole };
};

const calculateAccumulatedDemandByPole = (
  topology: BtTopology,
  projectType: BtProjectType,
  clandestinoAreaM2: number,
): BtPoleAccumulatedDemand[] => {
  const allPoleIds = new Set(topology.poles.map((pole) => pole.id));
  for (const edge of topology.edges) {
    allPoleIds.add(edge.fromPoleId);
    allPoleIds.add(edge.toPoleId);
  }

  const adjacentPoles = new Map<string, string[]>();
  const localClientByPole = new Map<string, number>();

  for (const pole of topology.poles) {
    const localClients = getPoleClientsByProjectType(
      projectType,
      topology,
      pole.id,
    );
    localClientByPole.set(pole.id, localClients);
  }

  for (const poleId of allPoleIds) {
    adjacentPoles.set(poleId, []);
  }

  for (const edge of topology.edges) {
    adjacentPoles.get(edge.fromPoleId)?.push(edge.toPoleId);
    adjacentPoles.get(edge.toPoleId)?.push(edge.fromPoleId);
  }

  const circuitBreakPoleIds = new Set(
    topology.poles
      .filter((pole) => pole.circuitBreakPoint)
      .map((pole) => pole.id),
  );

  const transformerPoleIds = new Set(
    topology.transformers
      .map((transformer) => transformer.poleId)
      .filter(
        (poleId): poleId is string =>
          poleId !== undefined && allPoleIds.has(poleId),
      ),
  );

  const distanceToTransformer = new Map<string, number>();
  const parentByPole = new Map<string, string>();
  for (const poleId of allPoleIds) {
    distanceToTransformer.set(poleId, Number.POSITIVE_INFINITY);
  }

  const queue: string[] = [];
  for (const poleId of transformerPoleIds) {
    distanceToTransformer.set(poleId, 0);
    queue.push(poleId);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (circuitBreakPoleIds.has(current)) {
      continue;
    }

    const currentDistance =
      distanceToTransformer.get(current) ?? Number.POSITIVE_INFINITY;
    const neighbors = adjacentPoles.get(current) ?? [];
    for (const neighbor of neighbors) {
      const knownDistance =
        distanceToTransformer.get(neighbor) ?? Number.POSITIVE_INFINITY;
      if (knownDistance > currentDistance + 1) {
        distanceToTransformer.set(neighbor, currentDistance + 1);
        parentByPole.set(neighbor, current);
        queue.push(neighbor);
      }
    }
  }

  const totalClients = Array.from(localClientByPole.values()).reduce(
    (sum, value) => sum + value,
    0,
  );
  const transformerDemandKva = topology.transformers.reduce(
    (sum, transformer) => sum + transformer.demandKw,
    0,
  );

  const localWeightedRamalByPole = new Map<string, number>();
  let hasUnknownRamalWeight = false;
  for (const pole of topology.poles) {
    const ramais = pole.ramais ?? [];
    const localWeighted = ramais.reduce((sum, ramal) => {
      const isClandestino =
        (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE;
      if (projectType === "clandestino" ? !isClandestino : isClandestino) {
        return sum;
      }

      const quantity = Number.isFinite(ramal.quantity) ? ramal.quantity : 0;
      if (quantity <= 0) {
        return sum;
      }

      const weight = getRamalWeightByType(ramal.ramalType);
      if (weight === null) {
        hasUnknownRamalWeight = true;
        return sum;
      }

      return sum + quantity * weight;
    }, 0);

    localWeightedRamalByPole.set(pole.id, localWeighted);
  }

  const totalWeightedRamal = Array.from(
    localWeightedRamalByPole.values(),
  ).reduce((sum, value) => sum + value, 0);
  const useWorkbookWeightedDemand =
    projectType !== "clandestino" &&
    !hasUnknownRamalWeight &&
    totalWeightedRamal > 0 &&
    Number.isFinite(transformerDemandKva) &&
    transformerDemandKva > 0;

  const avgDemandPerClientRaw =
    projectType === "clandestino"
      ? 0
      : Number.isFinite(transformerDemandKva) &&
          Number.isFinite(totalClients) &&
          totalClients > 0
        ? transformerDemandKva / totalClients
        : 0;

  const memo = new Map<string, BtPoleAccumulatedDemand>();

  const visit = (
    poleId: string,
    activePath: Set<string>,
  ): BtPoleAccumulatedDemand => {
    const cached = memo.get(poleId);
    if (cached) {
      return cached;
    }

    if (activePath.has(poleId)) {
      const cycleFallback: BtPoleAccumulatedDemand = {
        poleId,
        localClients: localClientByPole.get(poleId) ?? 0,
        accumulatedClients: localClientByPole.get(poleId) ?? 0,
        localTrechoDemandKva: 0,
        accumulatedDemandKva: 0,
      };
      memo.set(poleId, cycleFallback);
      return cycleFallback;
    }

    const nextPath = new Set(activePath);
    nextPath.add(poleId);

    const localClients = localClientByPole.get(poleId) ?? 0;
    const isCircuitBreakPole = circuitBreakPoleIds.has(poleId);

    const children = isCircuitBreakPole
      ? []
      : (adjacentPoles.get(poleId) ?? []).filter(
          (neighborId) => parentByPole.get(neighborId) === poleId,
        );

    const childrenResults = children.map((childPoleId) =>
      visit(childPoleId, nextPath),
    );
    const downstreamClients = childrenResults.reduce(
      (sum, child) => sum + child.accumulatedClients,
      0,
    );
    const accumulatedClients = localClients + downstreamClients;

    const localTrechoDemandKva =
      projectType === "clandestino"
        ? getClandestinoDemandKvaByAreaAndClients(
            clandestinoAreaM2,
            localClients,
          )
        : useWorkbookWeightedDemand
          ? transformerDemandKva *
            ((localWeightedRamalByPole.get(poleId) ?? 0) / totalWeightedRamal)
          : localClients * avgDemandPerClientRaw;

    const downstreamAccumulatedKva = childrenResults.reduce(
      (sum, child) => sum + child.accumulatedDemandKva,
      0,
    );
    const accumulatedDemandKva =
      projectType === "clandestino"
        ? getClandestinoDemandKvaByAreaAndClients(
            clandestinoAreaM2,
            accumulatedClients,
          )
        : downstreamAccumulatedKva + localTrechoDemandKva;

    const result: BtPoleAccumulatedDemand = {
      poleId,
      localClients,
      accumulatedClients,
      localTrechoDemandKva,
      accumulatedDemandKva,
    };

    memo.set(poleId, result);
    return result;
  };

  const results = Array.from(allPoleIds).map((poleId) =>
    visit(poleId, new Set()),
  );

  return results
    .sort((a, b) => b.accumulatedDemandKva - a.accumulatedDemandKva)
    .map((item) => ({
      ...item,
      localTrechoDemandKva: toFixed2(item.localTrechoDemandKva),
      accumulatedDemandKva: toFixed2(item.accumulatedDemandKva),
    }));
};

const calculateEstimatedDemandByTransformer = (
  topology: BtTopology,
  projectType: BtProjectType,
  clandestinoAreaM2: number,
): BtTransformerEstimatedDemand[] => {
  if (topology.transformers.length === 0 || topology.poles.length === 0) {
    return [];
  }

  const hasLinkedTransformers = topology.transformers.some(
    (transformer) => !!transformer.poleId,
  );
  if (!hasLinkedTransformers) {
    return topology.transformers.map((transformer) => ({
      transformerId: transformer.id,
      assignedClients: 0,
      estimatedDemandKw: 0,
    }));
  }

  const { localClientByPole, ownerTransformerByPole } =
    calculateTransformerOwnershipData(topology, projectType);

  const assignedClientsByTransformer = new Map<string, number>();
  for (const transformer of topology.transformers) {
    assignedClientsByTransformer.set(transformer.id, 0);
  }

  for (const [poleId, localClients] of localClientByPole.entries()) {
    const ownerTransformerId = ownerTransformerByPole.get(poleId);
    if (!ownerTransformerId) {
      continue;
    }

    assignedClientsByTransformer.set(
      ownerTransformerId,
      (assignedClientsByTransformer.get(ownerTransformerId) ?? 0) +
        localClients,
    );
  }

  const totalClients = Array.from(localClientByPole.values()).reduce(
    (sum, value) => sum + value,
    0,
  );
  const measuredDemandKw = topology.transformers.reduce((sum, transformer) => {
    if (transformer.readings.length === 0) {
      return sum;
    }

    return sum + (transformer.demandKw ?? 0);
  }, 0);
  const demandPerClientKw =
    totalClients > 0 ? measuredDemandKw / totalClients : 0;

  return topology.transformers.map((transformer) => {
    const assignedClients =
      assignedClientsByTransformer.get(transformer.id) ?? 0;
    if (transformer.readings.length > 0) {
      return {
        transformerId: transformer.id,
        assignedClients,
        estimatedDemandKw: toFixed2(transformer.demandKw ?? 0),
      };
    }

    const estimatedDemandKw =
      projectType === "clandestino"
        ? getClandestinoDemandKvaByAreaAndClients(
            clandestinoAreaM2,
            assignedClients,
          )
        : toFixed2(assignedClients * demandPerClientKw);

    return {
      transformerId: transformer.id,
      assignedClients,
      estimatedDemandKw,
    };
  });
};

const calculateSummary = (topology: BtTopology) => {
  const totalLengthMeters = topology.edges.reduce(
    (acc, edge) => acc + (edge.lengthMeters || 0),
    0,
  );
  const transformerDemandKw = topology.transformers.reduce(
    (acc, transformer) => acc + (transformer.demandKw || 0),
    0,
  );

  return {
    poles: topology.poles.length,
    transformers: topology.transformers.length,
    edges: topology.edges.length,
    totalLengthMeters,
    transformerDemandKw,
  };
};

const getEdgeConductorName = (edge: BtEdge): string | null => {
  if (!edge.conductors || edge.conductors.length === 0) {
    return null;
  }

  const selected = edge.conductors[edge.conductors.length - 1]?.conductorName;
  if (!selected || typeof selected !== "string") {
    return null;
  }

  return selected.trim();
};

const calculateVoltageDropPercent = (
  accumulatedDemandKva: number,
  correctedResistanceOhmPerKm: number,
  reactanceOhmPerKm: number,
  lengthMeters: number,
): number => {
  if (
    !Number.isFinite(accumulatedDemandKva) ||
    !Number.isFinite(correctedResistanceOhmPerKm) ||
    !Number.isFinite(lengthMeters) ||
    accumulatedDemandKva <= 0 ||
    correctedResistanceOhmPerKm <= 0 ||
    lengthMeters <= 0
  ) {
    return 0;
  }

  // Workbook parity (Light LADO 1 coluna L):
  // dV% = F * P_kVA * sqrt(R^2 + X^2) * L_m / (V_linha^2 / 100)
  // Verified against workbook: F=1(TRI), V_linha=220 → divisor=484
  const x =
    Number.isFinite(reactanceOhmPerKm) && reactanceOhmPerKm > 0
      ? reactanceOhmPerKm
      : 0;
  const impedance = Math.sqrt(correctedResistanceOhmPerKm ** 2 + x ** 2);
  const divisor = BT_LINE_REFERENCE_VOLTAGE_V ** 2 / 100;
  return (
    (BT_PHASE_FACTOR * accumulatedDemandKva * impedance * lengthMeters) /
    divisor
  );
};

const estimateConductorTemperatureC = (
  conductorName: string,
  accumulatedDemandKva: number,
  ampacityA: number,
): number => {
  if (
    !Number.isFinite(accumulatedDemandKva) ||
    accumulatedDemandKva <= 0 ||
    !Number.isFinite(ampacityA) ||
    ampacityA <= 0
  ) {
    return DEFAULT_AMBIENT_TEMP_C;
  }

  const tempLimitC = LOW_TEMP_LIMIT_CONDUCTORS.has(conductorName) ? 70 : 90;
  const deltaTempAt30 = tempLimitC - DEFAULT_AMBIENT_TEMP_C;
  if (deltaTempAt30 <= 0) {
    return DEFAULT_AMBIENT_TEMP_C;
  }

  // Workbook parity (coluna J):
  // T = 30 + ACUMULADA / (((220*SQRT(3))/1000) * ETA * K_TERM_30)
  // Equivalent current form:
  // Ib = ACUMULADA*1000/(SQRT(3)*220*ETA)  and  K_TERM_30 = Iz/DELTA_TEMP_30
  // => T = 30 + Ib * (DELTA_TEMP_30 / Iz)
  const ibA = calculateIb({
    acumuladaKva: accumulatedDemandKva,
    fase: "TRI",
    eta: BT_TRI_PHASE_ETA,
    tensaoTrifasicaV: BT_LINE_REFERENCE_VOLTAGE_V,
  });

  if (!Number.isFinite(ibA) || ibA <= 0) {
    return DEFAULT_AMBIENT_TEMP_C;
  }

  const t = DEFAULT_AMBIENT_TEMP_C + ibA * (deltaTempAt30 / ampacityA);
  return Number.isFinite(t) && t > 0 ? t : DEFAULT_AMBIENT_TEMP_C;
};

const getPoleRamalQuantitiesByProjectType = (
  projectType: BtProjectType,
  pole: BtPoleNode | undefined,
): number[] => {
  if (!pole || !Array.isArray(pole.ramais) || pole.ramais.length === 0) {
    return [];
  }

  const isClandestinoProject = projectType === "clandestino";
  return pole.ramais
    .filter((ramal) => {
      const isClandestinoRamal =
        (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE;
      return isClandestinoProject ? isClandestinoRamal : !isClandestinoRamal;
    })
    .map((ramal) => ramal.quantity)
    .filter((quantity) => Number.isFinite(quantity) && quantity > 0);
};

const enrichWithVoltagePropagation = (
  topology: BtTopology,
  projectType: BtProjectType,
  accumulatedByPole: BtPoleAccumulatedDemand[],
): BtPoleAccumulatedDemand[] => {
  if (accumulatedByPole.length === 0 || topology.edges.length === 0) {
    return accumulatedByPole;
  }

  const activeEdges = topology.edges.filter((edge) => {
    const edgeFlag =
      edge.edgeChangeFlag ?? (edge.removeOnExecution ? "remove" : "existing");
    return edgeFlag !== "remove";
  });

  if (activeEdges.length === 0) {
    return accumulatedByPole;
  }

  const hasAnyConductor = activeEdges.some(
    (edge) => !!getEdgeConductorName(edge),
  );
  if (!hasAnyConductor) {
    return accumulatedByPole;
  }

  // Build impedance lookup with conductor thermal coefficients.
  // Workbook parity:
  // R_CORR = (R / DIVISOR_R) * (1 + alpha * (T - 20))
  // dV% uses sqrt(R_CORR² + X²)
  const impedanceByConductor = new Map<
    string,
    {
      resistance: number;
      reactance: number;
      alpha: number;
      divisorR: number;
      ampacity: number;
    }
  >();
  for (const cabo of getCabosByScenario("atual")) {
    if (typeof cabo.name === "string" && Number.isFinite(cabo.resistance)) {
      impedanceByConductor.set(cabo.name.trim().toUpperCase(), {
        resistance: cabo.resistance,
        reactance: Number.isFinite(cabo.reactance) ? cabo.reactance : 0,
        alpha: Number.isFinite(cabo.alpha) ? cabo.alpha : 0,
        divisorR: Number.isFinite(cabo.divisorR) ? cabo.divisorR : 1,
        ampacity: Number.isFinite(cabo.ampacity) ? cabo.ampacity : 0,
      });
    }
  }

  const adjacency = new Map<
    string,
    Array<{ neighborId: string; edge: BtEdge }>
  >();
  for (const pole of topology.poles) {
    adjacency.set(pole.id, []);
  }
  for (const edge of activeEdges) {
    if (!adjacency.has(edge.fromPoleId)) {
      adjacency.set(edge.fromPoleId, []);
    }
    if (!adjacency.has(edge.toPoleId)) {
      adjacency.set(edge.toPoleId, []);
    }
    adjacency.get(edge.fromPoleId)?.push({ neighborId: edge.toPoleId, edge });
    adjacency.get(edge.toPoleId)?.push({ neighborId: edge.fromPoleId, edge });
  }

  const rootPoleIds = topology.transformers
    .map((transformer) => transformer.poleId)
    .filter(
      (poleId): poleId is string =>
        typeof poleId === "string" && adjacency.has(poleId),
    );

  if (rootPoleIds.length === 0) {
    return accumulatedByPole;
  }

  // Map root pole → transformer for initial QT_MTTR loss lookup
  const transformerByRootPole = new Map<string, BtTransformer>();
  for (const transformer of topology.transformers) {
    if (typeof transformer.poleId === "string") {
      transformerByRootPole.set(transformer.poleId, transformer);
    }
  }

  const visited = new Set<string>();
  const queue: string[] = [];
  const parentByPole = new Map<
    string,
    { parentPoleId: string; edge: BtEdge }
  >();

  for (const rootPoleId of rootPoleIds) {
    if (!visited.has(rootPoleId)) {
      visited.add(rootPoleId);
      queue.push(rootPoleId);
    }
  }

  while (queue.length > 0) {
    const currentPoleId = queue.shift();
    if (!currentPoleId) {
      continue;
    }

    const neighbors = adjacency.get(currentPoleId) ?? [];
    for (const { neighborId, edge } of neighbors) {
      if (visited.has(neighborId)) {
        continue;
      }
      visited.add(neighborId);
      parentByPole.set(neighborId, { parentPoleId: currentPoleId, edge });
      queue.push(neighborId);
    }
  }

  const demandByPoleId = new Map(
    accumulatedByPole.map((item) => [item.poleId, item]),
  );
  const poleById = new Map(topology.poles.map((pole) => [pole.id, pole]));
  const rootSet = new Set(rootPoleIds);

  const worstImpedanceByConductor = Array.from(
    impedanceByConductor.entries(),
  ).reduce<{
    conductorName: string;
    resistance: number;
    reactance: number;
    alpha: number;
    divisorR: number;
    ampacity: number;
    impedance: number;
  } | null>((current, [conductorName, imp]) => {
    if (!Number.isFinite(imp.resistance) || imp.resistance <= 0) {
      return current;
    }

    const x =
      Number.isFinite(imp.reactance) && imp.reactance > 0 ? imp.reactance : 0;
    const impedance = Math.sqrt(imp.resistance ** 2 + x ** 2);

    if (!current || impedance > current.impedance) {
      return {
        conductorName,
        resistance: imp.resistance,
        reactance: x,
        alpha: imp.alpha,
        divisorR: imp.divisorR,
        ampacity: imp.ampacity,
        impedance,
      };
    }

    return current;
  }, null);

  return accumulatedByPole.map((item) => {
    if (!parentByPole.has(item.poleId) && !rootSet.has(item.poleId)) {
      return item;
    }

    let dvAccumPercent = 0;

    // For root (transformer) poles add initial MT+transformer impedance loss.
    // Workbook parity: QT_MTTR% = (QT_MT + QT_TR) * 100
    //   QT_MT  = 0.0183 (fixed MV line losses, workbook DB K4)
    //   QT_TR  = (P_demand_kVA / TR_rated_kVA) * 0.035 (workbook TRAFOS_Z, same for all sizes)
    // Walk back to root to find which transformer owns this branch.
    let branchRootPoleId: string | undefined;
    {
      let cursor = item.poleId;
      let g = 0;
      while (parentByPole.has(cursor) && g <= activeEdges.length + 1) {
        cursor = parentByPole.get(cursor)!.parentPoleId;
        g++;
      }
      if (rootSet.has(cursor)) {
        branchRootPoleId = cursor;
      }
    }

    if (branchRootPoleId !== undefined) {
      const trafo = transformerByRootPole.get(branchRootPoleId);
      // Workbook parity (DB!K10/K19/K26): QT_TR uses trafo demand as numerator.
      // Prefer explicit transformer demand; fall back to accumulated root demand.
      const totalDemandKva =
        trafo && Number.isFinite(trafo.demandKw) && (trafo.demandKw ?? 0) > 0
          ? (trafo.demandKw as number)
          : (demandByPoleId.get(branchRootPoleId)?.accumulatedDemandKva ?? 0);
      const trafoRatedKva =
        trafo &&
        Number.isFinite(trafo.projectPowerKva) &&
        (trafo.projectPowerKva ?? 0) > 0
          ? (trafo.projectPowerKva as number)
          : DEFAULT_TRAFO_KVA;
      const qtTr =
        trafoRatedKva > 0
          ? (totalDemandKva / trafoRatedKva) * Z_TRAFO_PERCENT
          : 0;
      dvAccumPercent += (QT_MT_FRACTION + qtTr) * 100;
    }

    let cursorPoleId = item.poleId;
    let guard = 0;

    while (parentByPole.has(cursorPoleId) && guard <= activeEdges.length + 1) {
      const relation = parentByPole.get(cursorPoleId);
      if (!relation) {
        break;
      }

      const conductorName = getEdgeConductorName(relation.edge);
      const imp = conductorName
        ? impedanceByConductor.get(conductorName.toUpperCase())
        : undefined;

      if (imp && Number.isFinite(imp.resistance)) {
        const segmentDemandKva =
          demandByPoleId.get(cursorPoleId)?.accumulatedDemandKva ??
          item.accumulatedDemandKva;

        const conductorTemperatureC = estimateConductorTemperatureC(
          conductorName?.toUpperCase() ?? "",
          segmentDemandKva,
          imp.ampacity,
        );
        const correctedResistance = calculateCorrectedResistance({
          resistance: imp.resistance,
          alpha: imp.alpha,
          divisorR: imp.divisorR,
          temperatureC: conductorTemperatureC,
        });

        dvAccumPercent += calculateVoltageDropPercent(
          segmentDemandKva,
          correctedResistance,
          imp.reactance,
          relation.edge.cqtLengthMeters ?? relation.edge.lengthMeters ?? 0,
        );
      }

      cursorPoleId = relation.parentPoleId;
      guard += 1;
    }

    const voltageV = Math.max(
      0,
      BT_PHASE_VOLTAGE_V * (1 - dvAccumPercent / 100),
    );
    const cqtStatus: "OK" | "ATENÇÃO" | "CRÍTICO" =
      dvAccumPercent > 8 ? "CRÍTICO" : dvAccumPercent > 5 ? "ATENÇÃO" : "OK";

    let worstRamalVoltageV: number | undefined;
    let worstRamalDvPercent: number | undefined;
    let worstRamalStatus: "OK" | "ATENÇÃO" | "CRÍTICO" | undefined;

    const pole = poleById.get(item.poleId);
    const ramalQuantities = getPoleRamalQuantitiesByProjectType(
      projectType,
      pole,
    );
    const maxRamalQuantity =
      ramalQuantities.length > 0 ? Math.max(...ramalQuantities) : 0;

    if (
      item.localClients > 0 &&
      item.localTrechoDemandKva > 0 &&
      maxRamalQuantity > 0 &&
      worstImpedanceByConductor
    ) {
      const worstRamalDemandKva =
        (item.localTrechoDemandKva * maxRamalQuantity) / item.localClients;

      const ramalTemperatureC = estimateConductorTemperatureC(
        worstImpedanceByConductor.conductorName,
        worstRamalDemandKva,
        worstImpedanceByConductor.ampacity,
      );
      const ramalCorrectedResistance = calculateCorrectedResistance({
        resistance: worstImpedanceByConductor.resistance,
        alpha: worstImpedanceByConductor.alpha,
        divisorR: worstImpedanceByConductor.divisorR,
        temperatureC: ramalTemperatureC,
      });

      const ramalExtraDvPercent = calculateVoltageDropPercent(
        worstRamalDemandKva,
        ramalCorrectedResistance,
        worstImpedanceByConductor.reactance,
        30,
      );
      const ramalTotalDvPercent = dvAccumPercent + ramalExtraDvPercent;
      const ramalVoltageV = Math.max(
        0,
        BT_PHASE_VOLTAGE_V * (1 - ramalTotalDvPercent / 100),
      );

      worstRamalVoltageV = toFixed2(ramalVoltageV);
      worstRamalDvPercent = toFixed2(ramalTotalDvPercent);
      worstRamalStatus =
        ramalTotalDvPercent > 8
          ? "CRÍTICO"
          : ramalTotalDvPercent > 5
            ? "ATENÇÃO"
            : "OK";
    }

    return {
      ...item,
      voltageV: toFixed2(voltageV),
      dvAccumPercent: toFixed2(dvAccumPercent),
      cqtStatus,
      worstRamalVoltageV,
      worstRamalDvPercent,
      worstRamalStatus,
    };
  });
};

const distanceMetersBetween = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number => {
  const earthRadius = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const calculateSectioningImpact = (
  topology: BtTopology,
  projectType: BtProjectType,
  clandestinoAreaM2: number,
): BtSectioningImpact => {
  if (topology.poles.length === 0) {
    return {
      unservedPoleIds: [],
      unservedClients: 0,
      estimatedDemandKw: 0,
      loadCenter: null,
      suggestedPoleId: null,
    };
  }

  const { localClientByPole, ownerTransformerByPole } =
    calculateTransformerOwnershipData(topology, projectType);
  const unservedPoles = topology.poles.filter(
    (pole) => !ownerTransformerByPole.has(pole.id),
  );
  const unservedPoleIds = unservedPoles.map((pole) => pole.id);
  const unservedClients = unservedPoles.reduce(
    (sum, pole) => sum + (localClientByPole.get(pole.id) ?? 0),
    0,
  );

  const totalClients = Array.from(localClientByPole.values()).reduce(
    (sum, v) => sum + v,
    0,
  );
  const measuredDemandKw = topology.transformers.reduce(
    (sum, t) => (t.readings.length === 0 ? sum : sum + (t.demandKw ?? 0)),
    0,
  );
  const demandPerClientKw =
    totalClients > 0 ? measuredDemandKw / totalClients : 0;

  const estimatedDemandKw =
    projectType === "clandestino"
      ? getClandestinoDemandKvaByAreaAndClients(
          clandestinoAreaM2,
          unservedClients,
        )
      : toFixed2(unservedClients * demandPerClientKw);

  if (unservedPoles.length === 0) {
    return {
      unservedPoleIds,
      unservedClients,
      estimatedDemandKw,
      loadCenter: null,
      suggestedPoleId: null,
    };
  }

  const weighted = unservedPoles.map((pole) => ({
    pole,
    weight: Math.max(localClientByPole.get(pole.id) ?? 0, 1),
  }));
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  const loadCenter = {
    lat:
      weighted.reduce((sum, item) => sum + item.pole.lat * item.weight, 0) /
      (totalWeight || 1),
    lng:
      weighted.reduce((sum, item) => sum + item.pole.lng * item.weight, 0) /
      (totalWeight || 1),
  };

  let suggestedPoleId: string | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const pole of unservedPoles) {
    const d = distanceMetersBetween(loadCenter, {
      lat: pole.lat,
      lng: pole.lng,
    });
    if (d < nearestDistance) {
      nearestDistance = d;
      suggestedPoleId = pole.id;
    }
  }

  return {
    unservedPoleIds,
    unservedClients,
    estimatedDemandKw,
    loadCenter,
    suggestedPoleId,
  };
};

const calculateClandestinoDisplay = (
  topology: BtTopology,
  clandestinoAreaM2: number,
): BtClandestinoDisplay => {
  const areaToKva = constantsService.getSync<Record<string, number>>(
    "clandestino",
    "AREA_TO_KVA",
  );
  const clientToDiversifFactor = constantsService.getSync<
    Record<string, number>
  >("clandestino", "CLIENT_TO_DIVERSIF_FACTOR");

  const numericAreaKeys = areaToKva
    ? Object.keys(areaToKva).map(Number).filter(Number.isFinite)
    : [];
  const areaMin = numericAreaKeys.length > 0 ? Math.min(...numericAreaKeys) : 0;
  const areaMax = numericAreaKeys.length > 0 ? Math.max(...numericAreaKeys) : 0;

  const areaKey = String(Math.round(clandestinoAreaM2));
  const demandKva =
    areaToKva && Number.isFinite(areaToKva[areaKey])
      ? areaToKva[areaKey]
      : null;
  const demandKw = demandKva ?? 0;

  const totalClients = topology.poles.reduce(
    (acc, pole) =>
      acc + (pole.ramais ?? []).reduce((sum, ramal) => sum + ramal.quantity, 0),
    0,
  );
  const clientKey = String(Math.round(totalClients));
  const diversificationFactor =
    clientToDiversifFactor && Number.isFinite(clientToDiversifFactor[clientKey])
      ? clientToDiversifFactor[clientKey]
      : null;

  const finalDemandKva =
    demandKva !== null && diversificationFactor !== null
      ? toFixed2(demandKva * diversificationFactor)
      : 0;

  return {
    demandKw,
    areaMin,
    areaMax,
    demandKva,
    diversificationFactor,
    finalDemandKva,
  };
};

const calculateTransformersDerived = (
  topology: BtTopology,
): BtTransformerDerived[] => {
  return topology.transformers.map((transformer) => {
    const readings = transformer.readings;
    const monthlyBillBrl = readings.reduce(
      (acc, r) => acc + (r.billedBrl ?? 0),
      0,
    );
    if (readings.length === 0) {
      return { transformerId: transformer.id, demandKw: 0, monthlyBillBrl };
    }
    const correctedDemands = readings.map((r) => {
      const currentMaxA = r.currentMaxA ?? 0;
      const temperatureFactor = r.temperatureFactor ?? 1;
      return currentMaxA * CURRENT_TO_DEMAND_CONVERSION * temperatureFactor;
    });
    const demandKw = toFixed2(Math.max(...correctedDemands, 0));
    return { transformerId: transformer.id, demandKw, monthlyBillBrl };
  });
};

export const computeBtDerivedState = (
  topology: BtTopology,
  projectType: BtProjectType,
  clandestinoAreaM2: number,
): BtDerivedResponse => {
  logger.info("[BtDerivedService] Starting computation", {
    projectType,
    clandestinoAreaM2,
    poleCount: topology.poles.length,
    transformerCount: topology.transformers.length,
    edgeCount: topology.edges.length,
  });

  const summary = calculateSummary(topology);

  const totalClients = topology.poles.reduce((sum, pole) => {
    return sum + getPoleClientsByProjectType(projectType, topology, pole.id);
  }, 0);

  const pointDemandKva = calculateRamalDmdiKva(
    projectType,
    summary.transformerDemandKw,
    totalClients,
    getClandestinoDemandKvaByAreaAndClients(clandestinoAreaM2, totalClients),
  );

  const accumulatedByPoleBase = calculateAccumulatedDemandByPole(
    topology,
    projectType,
    clandestinoAreaM2,
  );
  const accumulatedByPole = enrichWithVoltagePropagation(
    topology,
    projectType,
    accumulatedByPoleBase,
  );
  const estimatedByTransformer = calculateEstimatedDemandByTransformer(
    topology,
    projectType,
    clandestinoAreaM2,
  );
  const sectioningImpact = calculateSectioningImpact(
    topology,
    projectType,
    clandestinoAreaM2,
  );
  const clandestinoDisplay = calculateClandestinoDisplay(
    topology,
    clandestinoAreaM2,
  );
  const transformersDerived = calculateTransformersDerived(topology);

  logger.info("[BtDerivedService] Computation complete", {
    pointDemandKva,
    accumulatedByPoleCount: accumulatedByPole.length,
  });

  return {
    summary,
    pointDemandKva,
    criticalPoleId: accumulatedByPole[0]?.poleId ?? null,
    accumulatedByPole,
    estimatedByTransformer,
    sectioningImpact,
    clandestinoDisplay,
    transformersDerived,
  };
};
