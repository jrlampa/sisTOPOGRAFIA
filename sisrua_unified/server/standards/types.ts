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
    // --- Compliance & Urbanism (T2) ---
    NBR9050_MIN_SIDEWALK_FREE_WIDTH_M: number;
    NBR9050_MIN_CALCADA_WIDTH_M: number;
    POLE_STANDARD_DIAMETER_M: number;
    ENVIRONMENTAL_BUFFER_RADIUS_M: number;
  };
  conductors: {
    lowTempLimits: string[];
    ramalWeights: Record<string, number>;
  };
  units: "metric" | "imperial";
}
