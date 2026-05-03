export interface EngineeringStandard {
  id: string;
  name: string;
  country: string;
  constants: {
    BT_PHASE_VOLTAGE_V: number;
    BT_LINE_REFERENCE_VOLTAGE_V: number;
    BT_PHASE_FACTOR: number;
    QT_MT_FRACTION: number;
    Z_TRAFO_PERCENT: number;
    DEFAULT_TRAFO_KVA: number;
    DEFAULT_AMBIENT_TEMP_C: number;
    BT_TRI_PHASE_ETA: number;
    FREQUENCY_HZ: number;
  };
  conductors: {
    lowTempLimits: string[];
    ramalWeights: Record<string, number>;
  };
  units: "metric" | "imperial";
}
