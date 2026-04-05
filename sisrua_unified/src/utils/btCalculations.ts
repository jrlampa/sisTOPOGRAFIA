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

export const calculateTransformerEnergyKwh = (readings: BtTransformerReading[]): number => {
  return readings.reduce((acc, reading) => {
    if (reading.unitRateBrlPerKwh <= 0) {
      return acc;
    }
    return acc + reading.billedBrl / reading.unitRateBrlPerKwh;
  }, 0);
};

export const calculateTransformerDemandKw = (readings: BtTransformerReading[]): number => {
  const energyKwh = calculateTransformerEnergyKwh(readings);
  if (energyKwh <= 0) {
    return 0;
  }
  return energyKwh / HOURS_PER_MONTH_REFERENCE;
};

export const calculateTransformerMonthlyBill = (readings: BtTransformerReading[]): number => {
  return readings.reduce((acc, reading) => acc + reading.billedBrl, 0);
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

  const outgoingByPole = new Map<string, BtTopology['edges']>();
  const incomingClientByPole = new Map<string, number>();

  for (const edge of topology.edges) {
    const outgoing = outgoingByPole.get(edge.fromPoleId) ?? [];
    outgoing.push(edge);
    outgoingByPole.set(edge.fromPoleId, outgoing);

    const edgeClients = edge.conductors.reduce((sum, item) => sum + item.quantity, 0);
    incomingClientByPole.set(edge.toPoleId, (incomingClientByPole.get(edge.toPoleId) ?? 0) + edgeClients);
  }

  const totalClients = Array.from(incomingClientByPole.values()).reduce((sum, value) => sum + value, 0);
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
        localClients: incomingClientByPole.get(poleId) ?? 0,
        accumulatedClients: incomingClientByPole.get(poleId) ?? 0,
        localTrechoDemandKva: 0,
        accumulatedDemandKva: 0
      };
      memo.set(poleId, cycleFallback);
      return cycleFallback;
    }

    const nextPath = new Set(activePath);
    nextPath.add(poleId);

    const localClients = incomingClientByPole.get(poleId) ?? 0;
    const children = outgoingByPole.get(poleId) ?? [];

    const childrenResults = children.map((edge) => visit(edge.toPoleId, nextPath));
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
