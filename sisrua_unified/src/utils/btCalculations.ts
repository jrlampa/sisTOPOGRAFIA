import { BtTransformerReading, BtTopology } from '../types';

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

export const calculateClandestinoDemandKw = (areaM2: number): number => {
  if (areaM2 <= 0) {
    return 0;
  }

  // Operational rule used in the BT module until workbook formulas are fully integrated.
  return areaM2 * 0.012;
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
