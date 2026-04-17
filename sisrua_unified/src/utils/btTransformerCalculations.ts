import { BtTransformerReading } from "../types";
import { CURRENT_TO_DEMAND_CONVERSION } from "../constants/btPhysicalConstants";

export const getTransformerDemandKva = (transformer: {
  demandKva?: number;
  demandKw?: number;
  readings?: BtTransformerReading[];
}): number => {
  const readings = transformer.readings ?? [];
  const hasUsableReadings = readings.some((reading) =>
    Number.isFinite(reading.currentMaxA),
  );

  if (hasUsableReadings) {
    const correctedDemands = readings.map((reading) => {
      const currentMaxA = reading.currentMaxA ?? 0;
      const temperatureFactor = reading.temperatureFactor ?? 1;
      const maxDemandKva = currentMaxA * CURRENT_TO_DEMAND_CONVERSION;
      return maxDemandKva * temperatureFactor;
    });

    return Number(Math.max(...correctedDemands, 0).toFixed(2));
  }

  const rawDemand = transformer.demandKva ?? transformer.demandKw ?? 0;
  return Number.isFinite(rawDemand) ? rawDemand : 0;
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

export const calculateTransformerDemandKva = (
  readings: BtTransformerReading[],
): number => {
  if (readings.length === 0) {
    return 0;
  }

  const correctedDemands = readings.map((reading) => {
    const currentMaxA = reading.currentMaxA ?? 0;
    const temperatureFactor = reading.temperatureFactor ?? 1;
    const maxDemandKva = currentMaxA * CURRENT_TO_DEMAND_CONVERSION;
    return maxDemandKva * temperatureFactor;
  });

  return Number(Math.max(...correctedDemands, 0).toFixed(2));
};

/** @deprecated Use calculateTransformerDemandKva. Maintained for compatibility. */
export const calculateTransformerDemandKw = calculateTransformerDemandKva;

export const calculateTransformerMonthlyBill = (
  readings: BtTransformerReading[],
): number => {
  return readings.reduce((acc, reading) => acc + (reading.billedBrl ?? 0), 0);
};
