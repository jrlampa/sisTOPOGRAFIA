import { BtTransformerReading, BtTopology } from '../types';
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
