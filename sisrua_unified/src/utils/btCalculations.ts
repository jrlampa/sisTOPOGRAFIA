import { BtProjectType, BtTransformerReading, BtTopology } from '../types';
import {
  CLANDESTINO_AREA_TO_KVA,
  CLANDESTINO_CLIENT_TO_DIVERSIF_FACTOR,
  CLANDESTINO_MAX_AREA_M2,
  CLANDESTINO_MAX_CLIENTS,
  CLANDESTINO_MIN_AREA_M2,
  CLANDESTINO_MIN_CLIENTS
} from '../constants/clandestinoWorkbookRules';

const HOURS_PER_MONTH_REFERENCE = 720;
const CLANDESTINO_RAMAL_TYPE = 'Clandestino';
const CURRENT_TO_DEMAND_CONVERSION = 0.375;

const getPoleClientsByProjectType = (projectType: BtProjectType, topology: BtTopology, poleId: string): number => {
  const pole = topology.poles.find((item) => item.id === poleId);
  if (!pole) {
    return 0;
  }

  const ramais = pole.ramais ?? [];
  if (projectType === 'clandestino') {
    return ramais
      .filter((ramal) => ramal.ramalType === CLANDESTINO_RAMAL_TYPE)
      .reduce((sum, ramal) => sum + ramal.quantity, 0);
  }

  return ramais
    // Backward compatibility: legacy ramais without `ramalType` are considered normal.
    .filter((ramal) => ramal.ramalType !== CLANDESTINO_RAMAL_TYPE)
    .reduce((sum, ramal) => sum + ramal.quantity, 0);
};

export const calculateTransformerEnergyKwh = (readings: BtTransformerReading[]): number => {
  return readings.reduce((acc, reading) => {
    if (!reading.unitRateBrlPerKwh || reading.unitRateBrlPerKwh <= 0 || !reading.billedBrl) {
      return acc;
    }
    return acc + reading.billedBrl / reading.unitRateBrlPerKwh;
  }, 0);
};

export const calculateTransformerDemandKw = (readings: BtTransformerReading[]): number => {
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
  return Number((Math.max(...correctedDemands, 0)).toFixed(2));
};

export const calculateTransformerMonthlyBill = (readings: BtTransformerReading[]): number => {
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
  max: CLANDESTINO_MAX_AREA_M2
});

export const getClandestinoClientsRange = () => ({
  min: CLANDESTINO_MIN_CLIENTS,
  max: CLANDESTINO_MAX_CLIENTS
});

export const getClandestinoKvaByArea = (areaM2: number): number | null => {
  const areaKey = parseInteger(areaM2);
  if (areaKey === null) {
    return null;
  }

  return CLANDESTINO_AREA_TO_KVA[areaKey] ?? null;
};

export const getClandestinoDiversificationFactorByClients = (clients: number): number | null => {
  const clientsKey = parseInteger(clients);
  if (clientsKey === null) {
    return null;
  }

  return CLANDESTINO_CLIENT_TO_DIVERSIF_FACTOR[clientsKey] ?? null;
};

export const calculateClandestinoDemandKvaByAreaAndClients = (areaM2: number, clients: number): number => {
  const baseKva = getClandestinoKvaByArea(areaM2);
  const diversificationFactor = getClandestinoDiversificationFactorByClients(clients);

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

export const calculatePointDemandKva = ({
  projectType,
  transformerDemandKw,
  clandestinoAreaM2,
  clandestinoClients
}: CalculatePointDemandKvaInput): number => {
  if (projectType === 'clandestino') {
    return calculateClandestinoDemandKvaByAreaAndClients(clandestinoAreaM2, clandestinoClients);
  }

  return Number(transformerDemandKw.toFixed(2));
};

export const calculateAccumulatedDemandKva = ({
  projectType,
  clandestinoAreaM2,
  accumulatedClients,
  downstreamAccumulatedKva,
  totalTrechoKva
}: CalculateAccumulatedDemandKvaInput): number => {
  if (projectType === 'clandestino') {
    return calculateClandestinoDemandKvaByAreaAndClients(clandestinoAreaM2, accumulatedClients);
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
  const totalLengthMeters = topology.edges.reduce((acc, edge) => acc + (edge.lengthMeters || 0), 0);
  const transformerDemandKw = topology.transformers.reduce((acc, transformer) => acc + transformer.demandKw, 0);

  return {
    poles: topology.poles.length,
    transformers: topology.transformers.length,
    edges: topology.edges.length,
    totalLengthMeters,
    transformerDemandKw
  };
};

export const calculateAccumulatedDemandByPole = (
  topology: BtTopology,
  projectType: BtProjectType,
  clandestinoAreaM2: number
): BtPoleAccumulatedDemand[] => {
  const allPoleIds = new Set(topology.poles.map((pole) => pole.id));
  for (const edge of topology.edges) {
    allPoleIds.add(edge.fromPoleId);
    allPoleIds.add(edge.toPoleId);
  }

  const adjacentPoles = new Map<string, string[]>();
  const localClientByPole = new Map<string, number>();

  for (const pole of topology.poles) {
    const localClients = getPoleClientsByProjectType(projectType, topology, pole.id);
    localClientByPole.set(pole.id, localClients);
  }

  for (const poleId of allPoleIds) {
    adjacentPoles.set(poleId, []);
  }

  for (const edge of topology.edges) {
    adjacentPoles.get(edge.fromPoleId)?.push(edge.toPoleId);
    adjacentPoles.get(edge.toPoleId)?.push(edge.fromPoleId);
  }

  const transformerPoleIds = new Set(
    topology.transformers
      .map((transformer) => transformer.poleId)
      .filter((poleId): poleId is string => poleId !== undefined && allPoleIds.has(poleId))
  );

  const distanceToTransformer = new Map<string, number>();
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

    const currentDistance = distanceToTransformer.get(current) ?? Number.POSITIVE_INFINITY;
    const neighbors = adjacentPoles.get(current) ?? [];
    for (const neighbor of neighbors) {
      const knownDistance = distanceToTransformer.get(neighbor) ?? Number.POSITIVE_INFINITY;
      if (knownDistance > currentDistance + 1) {
        distanceToTransformer.set(neighbor, currentDistance + 1);
        queue.push(neighbor);
      }
    }
  }

  const totalClients = Array.from(localClientByPole.values()).reduce((sum, value) => sum + value, 0);
  const transformerDemandKva = topology.transformers.reduce((sum, transformer) => sum + transformer.demandKw, 0);
  const avgDemandPerClient = totalClients > 0 ? transformerDemandKva / totalClients : 0;

  const memo = new Map<string, BtPoleAccumulatedDemand>();

  const visit = (poleId: string, activePath: Set<string>): BtPoleAccumulatedDemand => {
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
        accumulatedDemandKva: 0
      };
      memo.set(poleId, cycleFallback);
      return cycleFallback;
    }

    const nextPath = new Set(activePath);
    nextPath.add(poleId);

    const localClients = localClientByPole.get(poleId) ?? 0;
    const currentDistance = distanceToTransformer.get(poleId) ?? Number.POSITIVE_INFINITY;

    // Children are poles farther from the transformer than the current pole.
    // This makes accumulation run from the network ends toward the transformer.
    const children = (adjacentPoles.get(poleId) ?? []).filter((neighborId) => {
      const neighborDistance = distanceToTransformer.get(neighborId) ?? Number.POSITIVE_INFINITY;
      if (Number.isFinite(currentDistance) && Number.isFinite(neighborDistance)) {
        return neighborDistance > currentDistance;
      }

      // If no transformer is reachable in this component, avoid arbitrary cycles by
      // not traversing sideways in unknown direction.
      return false;
    });

    const childrenResults = children.map((childPoleId) => visit(childPoleId, nextPath));
    const downstreamClients = childrenResults.reduce((sum, child) => sum + child.accumulatedClients, 0);
    const accumulatedClients = localClients + downstreamClients;

    const localTrechoDemandKva = projectType === 'clandestino'
      ? calculateClandestinoDemandKvaByAreaAndClients(clandestinoAreaM2, localClients)
      : Number((localClients * avgDemandPerClient).toFixed(2));

    const downstreamAccumulatedKva = childrenResults.reduce((sum, child) => sum + child.accumulatedDemandKva, 0);
    const accumulatedDemandKva = calculateAccumulatedDemandKva({
      projectType,
      clandestinoAreaM2,
      accumulatedClients,
      downstreamAccumulatedKva,
      totalTrechoKva: localTrechoDemandKva
    });

    const result: BtPoleAccumulatedDemand = {
      poleId,
      localClients,
      accumulatedClients,
      localTrechoDemandKva,
      accumulatedDemandKva
    };

    memo.set(poleId, result);
    return result;
  };

  const results = Array.from(allPoleIds).map((poleId) => visit(poleId, new Set()));
  return results.sort((a, b) => b.accumulatedDemandKva - a.accumulatedDemandKva);
};
