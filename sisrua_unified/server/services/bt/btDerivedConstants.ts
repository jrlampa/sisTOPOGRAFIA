export const CURRENT_TO_DEMAND_CONVERSION = 0.375;

export const CLANDESTINO_RAMAL_TYPE = "Clandestino";
export const BT_PHASE_VOLTAGE_V = 127;
export const BT_LINE_REFERENCE_VOLTAGE_V = 220;
// TRI (3-phase) factor per workbook: MONO=6, BIF=2, TRI=1.
// BT trunk cables are 3-phase by default (verified against Light workbook LADO 1/LADO 2).
export const BT_PHASE_FACTOR = 1;
// Medium-voltage line losses fraction (workbook DB K4 = QT_MT = 0.0183).
export const QT_MT_FRACTION = 0.0183;
// Transformer short-circuit impedance percentage (workbook TRAFOS_Z: all = 0.035 = 3.5%).
export const Z_TRAFO_PERCENT = 0.035;
// Default transformer rated capacity (kVA) when not provided.
export const DEFAULT_TRAFO_KVA = 225;
export const DEFAULT_AMBIENT_TEMP_C = 30;
export const BT_TRI_PHASE_ETA = 3;
export const LOW_TEMP_LIMIT_CONDUCTORS = new Set([
  "13 AL - DX",
  "13 AL - TX",
  "13 AL - QX",
  "21 AL - QX",
  "53 AL - QX",
]);

// Workbook RAMAL!B5:U5 coefficients used by V = SUM(tipo * peso)
// and TOTAL_DO_TRECHO = AA24 * (V / W16).
export const RAMAL_WEIGHT_BY_TYPE_ATUAL = new Map<string, number>([
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

export const toFixed2 = (value: number | undefined | null): number => {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return 0;
  }
  return Number(value.toFixed(2));
};
