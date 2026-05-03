import { getEngineeringStandard } from "../../standards/index.js";

const activeStandard = getEngineeringStandard(); // Default to "br" for now
const { constants, conductors } = activeStandard;

export const CURRENT_TO_DEMAND_CONVERSION = 0.375;
export const CLANDESTINO_RAMAL_TYPE = "Clandestino";

export const BT_PHASE_VOLTAGE_V = constants.BT_PHASE_VOLTAGE_V;
export const BT_LINE_REFERENCE_VOLTAGE_V = constants.BT_LINE_REFERENCE_VOLTAGE_V;
export const BT_PHASE_FACTOR = constants.BT_PHASE_FACTOR;
export const QT_MT_FRACTION = constants.QT_MT_FRACTION;
export const Z_TRAFO_PERCENT = constants.Z_TRAFO_PERCENT;
export const DEFAULT_TRAFO_KVA = constants.DEFAULT_TRAFO_KVA;
export const DEFAULT_AMBIENT_TEMP_C = constants.DEFAULT_AMBIENT_TEMP_C;
export const BT_TRI_PHASE_ETA = constants.BT_TRI_PHASE_ETA;

export const LOW_TEMP_LIMIT_CONDUCTORS = new Set(conductors.lowTempLimits);

export const RAMAL_WEIGHT_BY_TYPE_ATUAL = new Map<string, number>(
  Object.entries(conductors.ramalWeights)
);

export const toFixed2 = (value: number | undefined | null): number => {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return 0;
  }
  return Number(value.toFixed(2));
};
