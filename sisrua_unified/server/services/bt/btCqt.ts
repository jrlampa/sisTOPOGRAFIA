/**
 * BT Radial – CQT module (E4-H1, E5-H2)
 *
 * Worst-case terminal identification, CQT global computation, and
 * cross-consistency validation alerts.
 *
 * Regulatory limits:
 *   - ANEEL PRODIST Módulo 8: CQT máx. 7% (nominais), urgente 8%
 *   - Tensão mínima em BT: 127 V × (1 − 0,08) = 116,84 V
 */

import {
  type BtRadialTopologyInput,
  type BtRadialCalculationOutput,
  type BtRadialConsistencyAlert,
  type BtRadialNodeResult,
  type BtRadialTerminalResult,
  type BtRadialWorstCase,
} from "./btTypes.js";
import { getActiveConstants } from "../../standards/index.js";

/** ANEEL PRODIST Módulo 8 — limite de queda de tensão urgente para BT */
const ANEEL_CQT_LIMIT = 0.08;
/** ANEEL — tensão mínima admissível na BT (127 × 0,92 = 116,84 V) */
const ANEEL_VOLTAGE_MIN_FRACTION = 1 - ANEEL_CQT_LIMIT;

/**
 * Identify the worst terminal (highest qtTotal) and build the worstCase object.
 */
export function buildWorstCase(
  terminalResults: BtRadialTerminalResult[],
  nodeResults: BtRadialNodeResult[],
  qtTrafo: number,
  rootNodeId: string,
): BtRadialWorstCase {
  let worstTerminal: BtRadialTerminalResult | undefined;
  for (const t of terminalResults) {
    if (!worstTerminal || t.qtTotal > worstTerminal.qtTotal) {
      worstTerminal = t;
    }
  }

  const cqtGlobal = worstTerminal?.qtTotal ?? qtTrafo;
  const worstTerminalNodeId = worstTerminal?.nodeId ?? rootNodeId;

  const worstNodeResult = nodeResults.find(
    (r) => r.nodeId === worstTerminalNodeId,
  );
  const criticalPath = worstNodeResult?.pathFromRoot ?? [rootNodeId];

  return { worstTerminalNodeId, cqtGlobal, criticalPath, qtTrafo };
}

/**
 * Build consistency alerts (E5-H2).
 */
export function buildConsistencyAlerts(
  input: BtRadialTopologyInput,
  output: BtRadialCalculationOutput,
): BtRadialConsistencyAlert[] {
  const alerts: BtRadialConsistencyAlert[] = [];

  if (!(input.transformer.kva > 0)) {
    alerts.push({
      code: "TRAFO_KVA_INVALID",
      message: "Transformer kVA must be a positive number.",
      severity: "error",
    });
  }

  if (output.totalDemandKva === 0) {
    alerts.push({
      code: "ZERO_TOTAL_DEMAND",
      message:
        "Total accumulated demand at transformer is zero. No voltage drop can be computed.",
      severity: "warn",
    });
  }

  // ANEEL PRODIST Módulo 8: limite urgente de 8% de queda de tensão
  if (output.worstCase.cqtGlobal > ANEEL_CQT_LIMIT) {
    alerts.push({
      code: "CQT_HIGH",
      message: `CQT global ${(output.worstCase.cqtGlobal * 100).toFixed(2)}% excede o limite ANEEL PRODIST Módulo 8 de 8% de queda de tensão.`,
      severity: "warn",
    });
  }

  // Sobrecarga do transformador: demanda acumulada supera a potência nominal
  if (
    input.transformer.kva > 0 &&
    output.totalDemandKva > input.transformer.kva
  ) {
    alerts.push({
      code: "TRAFO_OVERLOAD",
      message: `Demanda acumulada ${output.totalDemandKva.toFixed(1)} kVA supera a potência nominal do transformador ${input.transformer.kva} kVA (${((output.totalDemandKva / input.transformer.kva) * 100).toFixed(1)}% de carregamento).`,
      severity: "warn",
    });
  }

  const constants = getActiveConstants();
  const phaseVoltageV = input.nominalVoltageV ?? constants.BT_PHASE_VOLTAGE_V;
  const voltageMinV = phaseVoltageV * ANEEL_VOLTAGE_MIN_FRACTION;

  for (const t of output.terminalResults) {
    if (t.voltageEndV < 0) {
      alerts.push({
        code: "VOLTAGE_NEGATIVE",
        message: `Nó terminal "${t.nodeId}" com tensão negativa ${t.voltageEndV.toFixed(2)} V.`,
        severity: "warn",
      });
    } else if (t.voltageEndV < voltageMinV) {
      alerts.push({
        code: "VOLTAGE_LOW",
        message: `Nó terminal "${t.nodeId}" com tensão ${t.voltageEndV.toFixed(2)} V abaixo do limite ANEEL de ${voltageMinV.toFixed(2)} V (${(ANEEL_CQT_LIMIT * 100).toFixed(0)}% de queda máx.).`,
        severity: "warn",
      });
    }
  }

  return alerts;
}
