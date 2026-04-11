/**
 * BT Radial – CQT module (E4-H1, E5-H2)
 *
 * Worst-case terminal identification, CQT global computation, and
 * cross-consistency validation alerts.
 */

import {
    type BtRadialTopologyInput,
    type BtRadialCalculationOutput,
    type BtRadialConsistencyAlert,
    type BtRadialNodeResult,
    type BtRadialTerminalResult,
    type BtRadialWorstCase,
} from './btTypes.js';

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

    const worstNodeResult = nodeResults.find((r) => r.nodeId === worstTerminalNodeId);
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
            code: 'TRAFO_KVA_INVALID',
            message: 'Transformer kVA must be a positive number.',
            severity: 'error',
        });
    }

    if (output.totalDemandKva === 0) {
        alerts.push({
            code: 'ZERO_TOTAL_DEMAND',
            message: 'Total accumulated demand at transformer is zero. No voltage drop can be computed.',
            severity: 'warn',
        });
    }

    if (output.worstCase.cqtGlobal > 0.5) {
        alerts.push({
            code: 'CQT_HIGH',
            message: `CQT global ${output.worstCase.cqtGlobal.toFixed(4)} exceeds 50% voltage drop. Network may be undersized.`,
            severity: 'warn',
        });
    }

    for (const t of output.terminalResults) {
        if (t.voltageEndV < 0) {
            alerts.push({
                code: 'VOLTAGE_NEGATIVE',
                message: `Terminal node "${t.nodeId}" has negative voltage ${t.voltageEndV.toFixed(2)} V.`,
                severity: 'warn',
            });
        }
    }

    return alerts;
}
