import { BtProjectType, BtTransformerReading, BtTopology } from "../types";
import {
  CLANDESTINO_AREA_TO_KVA,
  CLANDESTINO_CLIENT_TO_DIVERSIF_FACTOR,
  CLANDESTINO_MAX_AREA_M2,
  CLANDESTINO_MAX_CLIENTS,
  CLANDESTINO_MIN_AREA_M2,
  CLANDESTINO_MIN_CLIENTS,
} from "../constants/clandestinoWorkbookRules";

const HOURS_PER_MONTH_REFERENCE = 720;
const CLANDESTINO_RAMAL_TYPE = "Clandestino";
const CURRENT_TO_DEMAND_CONVERSION = 0.375;

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

let activeClandestinoAreaToKva: Record<number, number> =
  CLANDESTINO_AREA_TO_KVA;
let activeClandestinoClientToDiversifFactor: Record<number, number> =
  CLANDESTINO_CLIENT_TO_DIVERSIF_FACTOR;
let clandestinoRulesLoadPromise: Promise<boolean> | null = null;

const isLookupRecord = (value: unknown): value is Record<string, number> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(
    (item) => typeof item === "number" && Number.isFinite(item),
  );
};

const toNumericRecord = (
  value: Record<string, number>,
): Record<number, number> =>
  Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [Number(key), item])
      .filter(
        ([key, item]) => Number.isInteger(key) && typeof item === "number",
      ),
  ) as Record<number, number>;

export const loadClandestinoWorkbookRules = async (): Promise<boolean> => {
  if (clandestinoRulesLoadPromise) {
    return clandestinoRulesLoadPromise;
  }

  clandestinoRulesLoadPromise = (async () => {
    try {
      const response = await fetch("/api/constants/clandestino");
      if (!response.ok) {
        return false;
      }

      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return false;
      }

      const { areaToKva, clientToDiversifFactor } = payload as {
        areaToKva?: unknown;
        clientToDiversifFactor?: unknown;
      };

      if (
        !isLookupRecord(areaToKva) ||
        !isLookupRecord(clientToDiversifFactor)
      ) {
        return false;
      }

      activeClandestinoAreaToKva = toNumericRecord(areaToKva);
      activeClandestinoClientToDiversifFactor = toNumericRecord(
        clientToDiversifFactor,
      );
      return true;
    } catch {
      return false;
    }
  })();

  return clandestinoRulesLoadPromise;
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
      .filter((ramal) => ramal.ramalType === CLANDESTINO_RAMAL_TYPE)
      .reduce((sum, ramal) => sum + ramal.quantity, 0);
  }

  return (
    ramais
      // Backward compatibility: legacy ramais without `ramalType` are considered normal.
      .filter((ramal) => ramal.ramalType !== CLANDESTINO_RAMAL_TYPE)
      .reduce((sum, ramal) => sum + ramal.quantity, 0)
  );
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

export const calculateTransformerEnergyKwh = (
  readings: BtTransformerReading[],
): number => {
  return readings.reduce((acc, reading) => {
    if (
      !reading.unitRateBrlPerKwh ||
      reading.unitRateBrlPerKwh <= 0 ||
      !reading.billedBrl
    ) {
      return acc;
    }
    return acc + reading.billedBrl / reading.unitRateBrlPerKwh;
  }, 0);
};

export const calculateTransformerDemandKw = (
  readings: BtTransformerReading[],
): number => {
  if (readings.length === 0) {
    return 0;
  }

  // Workbook parity: DEMANDA_MAX = CORRENTE_MAX * 0.375
  // DEMANDA_CORRIGIDA = DEMANDA_MAX * FATOR_TEMPERATURA
  const correctedDemands = readings.map((reading) => {
    const currentMaxA = reading.currentMaxA ?? 0;
    const temperatureFactor = reading.temperatureFactor ?? 1;
    const maxDemandKw = currentMaxA * CURRENT_TO_DEMAND_CONVERSION;
    return maxDemandKw * temperatureFactor;
  });

  // Use the highest corrected demand among informed readings.
  return Number(Math.max(...correctedDemands, 0).toFixed(2));
};

export const calculateTransformerMonthlyBill = (
  readings: BtTransformerReading[],
): number => {
  return readings.reduce((acc, reading) => acc + (reading.billedBrl ?? 0), 0);
};

const parseInteger = (value: number): number | null => {
  if (!Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.round(value);
  return normalized === value ? normalized : null;
};

export const getClandestinoAreaRange = () => ({
  min: CLANDESTINO_MIN_AREA_M2,
  max: CLANDESTINO_MAX_AREA_M2,
});

export const getClandestinoClientsRange = () => ({
  min: CLANDESTINO_MIN_CLIENTS,
  max: CLANDESTINO_MAX_CLIENTS,
});

export const getClandestinoKvaByArea = (areaM2: number): number | null => {
  const areaKey = parseInteger(areaM2);
  if (areaKey === null) {
    return null;
  }

  return activeClandestinoAreaToKva[areaKey] ?? null;
};

export const getClandestinoDiversificationFactorByClients = (
  clients: number,
): number | null => {
  const clientsKey = parseInteger(clients);
  if (clientsKey === null) {
    return null;
  }

  return activeClandestinoClientToDiversifFactor[clientsKey] ?? null;
};

export const calculateClandestinoDemandKvaByAreaAndClients = (
  areaM2: number,
  clients: number,
): number => {
  const baseKva = getClandestinoKvaByArea(areaM2);
  const diversificationFactor =
    getClandestinoDiversificationFactorByClients(clients);

  if (baseKva === null || diversificationFactor === null) {
    return 0;
  }

  return Number((baseKva * diversificationFactor).toFixed(2));
};

interface CalculatePointDemandKvaInput {
  projectType: BtProjectType;
  transformerDemandKw: number;
  clandestinoAreaM2: number;
  clandestinoClients: number;
}

interface CalculateRamalDmdiInput {
  projectType: BtProjectType;
  aa24DemandBase: number;
  sumClientsX: number;
  ab35LookupDmdi: number;
}

interface CalculateAccumulatedDemandKvaInput {
  projectType: BtProjectType;
  clandestinoAreaM2: number;
  accumulatedClients: number;
  downstreamAccumulatedKva: number;
  totalTrechoKva: number;
}

export interface BtPoleAccumulatedDemand {
  poleId: string;
  localClients: number;
  accumulatedClients: number;
  localTrechoDemandKva: number;
  accumulatedDemandKva: number;
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

export interface BtTransformerConflictGroup {
  poleIds: string[];
  transformerIds: string[];
}

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

  return {
    localClientByPole,
    ownerTransformerByPole,
  };
};

export const calculatePointDemandKva = ({
  projectType,
  transformerDemandKw,
  clandestinoAreaM2,
  clandestinoClients,
}: CalculatePointDemandKvaInput): number => {
  const ab35LookupDmdi = calculateClandestinoDemandKvaByAreaAndClients(
    clandestinoAreaM2,
    clandestinoClients,
  );

  return calculateRamalDmdiKva({
    projectType,
    aa24DemandBase: transformerDemandKw,
    sumClientsX: clandestinoClients,
    ab35LookupDmdi,
  });
};

export const calculateRamalDmdiKva = ({
  projectType,
  aa24DemandBase,
  sumClientsX,
  ab35LookupDmdi,
}: CalculateRamalDmdiInput): number => {
  if (projectType === "clandestino") {
    return Number(ab35LookupDmdi.toFixed(2));
  }

  if (
    !Number.isFinite(aa24DemandBase) ||
    !Number.isFinite(sumClientsX) ||
    sumClientsX <= 0
  ) {
    // Workbook IFERROR parity for AA30 when denominator is empty/zero.
    return 0;
  }

  return Number((aa24DemandBase / sumClientsX).toFixed(2));
};

export const calculateAccumulatedDemandKva = ({
  projectType,
  clandestinoAreaM2,
  accumulatedClients,
  downstreamAccumulatedKva,
  totalTrechoKva,
}: CalculateAccumulatedDemandKvaInput): number => {
  if (projectType === "clandestino") {
    return calculateClandestinoDemandKvaByAreaAndClients(
      clandestinoAreaM2,
      accumulatedClients,
    );
  }

  // Mirrors GERAL[ACUMULADA] normal branch: acumulada dos filhos + total do trecho.
  return Number((downstreamAccumulatedKva + totalTrechoKva).toFixed(2));
};

export const calculateClandestinoDemandKw = (areaM2: number): number => {
  const demandKva = getClandestinoKvaByArea(areaM2);
  if (demandKva === null) {
    return 0;
  }

  // Workbook table values are in kVA; app keeps demand field in kW for UI consistency.
  return demandKva;
};

export const calculateBtSummary = (topology: BtTopology) => {
  const totalLengthMeters = topology.edges.reduce(
    (acc, edge) => acc + (edge.lengthMeters || 0),
    0,
  );
  const transformerDemandKw = topology.transformers.reduce(
    (acc, transformer) => acc + transformer.demandKw,
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

export const calculateAccumulatedDemandByPole = (
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

  // Multi-source BFS from all transformer poles to orient the flow from leaves to nearest transformer.
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    // A pole marked as circuit break is an electrical endpoint: traversal can reach
    // it, but cannot continue beyond it.
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
        ? calculateClandestinoDemandKvaByAreaAndClients(
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
        ? calculateAccumulatedDemandKva({
            projectType,
            clandestinoAreaM2,
            accumulatedClients,
            downstreamAccumulatedKva,
            totalTrechoKva: localTrechoDemandKva,
          })
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
      localTrechoDemandKva: Number(item.localTrechoDemandKva.toFixed(2)),
      accumulatedDemandKva: Number(item.accumulatedDemandKva.toFixed(2)),
    }));
};

export const calculateEstimatedDemandByTransformer = (
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
        estimatedDemandKw: Number((transformer.demandKw ?? 0).toFixed(2)),
      };
    }

    const estimatedDemandKw =
      projectType === "clandestino"
        ? calculateClandestinoDemandKvaByAreaAndClients(
            clandestinoAreaM2,
            assignedClients,
          )
        : Number((assignedClients * demandPerClientKw).toFixed(2));

    return {
      transformerId: transformer.id,
      assignedClients,
      estimatedDemandKw,
    };
  });
};

export const calculateSectioningImpact = (
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

  const estimatedDemandKw =
    projectType === "clandestino"
      ? calculateClandestinoDemandKvaByAreaAndClients(
          clandestinoAreaM2,
          unservedClients,
        )
      : Number((unservedClients * demandPerClientKw).toFixed(2));

  if (unservedPoles.length === 0) {
    return {
      unservedPoleIds,
      unservedClients,
      estimatedDemandKw,
      loadCenter: null,
      suggestedPoleId: null,
    };
  }

  const weighted = unservedPoles.map((pole) => {
    const clients = localClientByPole.get(pole.id) ?? 0;
    return {
      pole,
      weight: clients > 0 ? clients : 1,
    };
  });

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
    const currentDistance = distanceMetersBetween(loadCenter, {
      lat: pole.lat,
      lng: pole.lng,
    });
    if (currentDistance < nearestDistance) {
      nearestDistance = currentDistance;
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

export const findTransformerConflictsWithoutSectioning = (
  topology: BtTopology,
): BtTransformerConflictGroup[] => {
  if (topology.transformers.length < 2 || topology.poles.length === 0) {
    return [];
  }

  const poleById = new Map(topology.poles.map((pole) => [pole.id, pole]));
  const circuitBreakPoleIds = new Set(
    topology.poles
      .filter((pole) => pole.circuitBreakPoint)
      .map((pole) => pole.id),
  );

  const adjacentPoles = new Map<string, string[]>();
  for (const pole of topology.poles) {
    adjacentPoles.set(pole.id, []);
  }

  // A pole marked as circuit break should segment electrical islands.
  // Ignore edges touching a break pole when building connectivity groups.
  for (const edge of topology.edges) {
    const edgeFlag =
      edge.edgeChangeFlag ?? (edge.removeOnExecution ? "remove" : "existing");
    if (edgeFlag === "remove") {
      continue;
    }

    if (
      circuitBreakPoleIds.has(edge.fromPoleId) ||
      circuitBreakPoleIds.has(edge.toPoleId)
    ) {
      continue;
    }

    if (
      !adjacentPoles.has(edge.fromPoleId) ||
      !adjacentPoles.has(edge.toPoleId)
    ) {
      continue;
    }

    adjacentPoles.get(edge.fromPoleId)?.push(edge.toPoleId);
    adjacentPoles.get(edge.toPoleId)?.push(edge.fromPoleId);
  }

  const transformersByPoleId = new Map<string, string[]>();
  for (const transformer of topology.transformers) {
    const poleId = transformer.poleId;
    if (!poleId || !poleById.has(poleId)) {
      continue;
    }

    const current = transformersByPoleId.get(poleId) ?? [];
    current.push(transformer.id);
    transformersByPoleId.set(poleId, current);
  }

  const visited = new Set<string>();
  const conflicts: BtTransformerConflictGroup[] = [];

  for (const pole of topology.poles) {
    if (visited.has(pole.id)) {
      continue;
    }

    const stack = [pole.id];
    const componentPoleIds: string[] = [];
    const componentTransformerIds: string[] = [];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || visited.has(current)) {
        continue;
      }

      visited.add(current);
      componentPoleIds.push(current);

      const poleTransformers = transformersByPoleId.get(current) ?? [];
      componentTransformerIds.push(...poleTransformers);

      const neighbors = adjacentPoles.get(current) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }

    if (componentTransformerIds.length >= 2) {
      const uniqueTransformerIds = Array.from(
        new Set(componentTransformerIds),
      ).sort((a, b) => a.localeCompare(b));
      if (uniqueTransformerIds.length >= 2) {
        conflicts.push({
          poleIds: componentPoleIds,
          transformerIds: uniqueTransformerIds,
        });
      }
    }
  }

  return conflicts;
};
