/**
 * BT Radial – voltage module (E3-H1, E3-H2)
 *
 * QT segment computation and top-down qt propagation through the radial tree.
 *
 * Formula:
 *   QT_trecho = phaseFactor × P_kVA × Z_Ω_km × L_m / V_phase_V²
 *
 *   phaseFactor: MONO=2, BIF/TRI=1
 */

import { calculateCorrectedResistance } from '../cqtEngine.js';
import { lookupConductorById, type BtConductorEntry } from '../btCatalogService.js';
import {
    type BtRadialPhase,
    type BtRadialNodeResult,
    type BtRadialTerminalResult,
    type TreeNode,
} from './btTypes.js';

// ─── Propagation context ──────────────────────────────────────────────────────

export interface PropagationContext {
    phase: BtRadialPhase;
    temperatureC: number;
    phaseVoltageV: number;
    demandByNode: Map<string, number>;
    nodeResults: BtRadialNodeResult[];
    terminalResults: BtRadialTerminalResult[];
}

// ─── Qt segment formula ───────────────────────────────────────────────────────

/**
 * Compute the voltage-drop fraction for one segment.
 */
export function computeQtSegment(
    accumulatedDemandKva: number,
    conductor: BtConductorEntry,
    temperatureC: number,
    phase: BtRadialPhase,
    phaseVoltageV: number,
    lengthMeters: number,
): number {
    if (lengthMeters <= 0 || accumulatedDemandKva <= 0) {
        return 0;
    }
    const rCorr = calculateCorrectedResistance({
        resistance: conductor.resistance,
        alpha: conductor.alpha,
        divisorR: conductor.divisorR,
        temperatureC,
    });
    const impedance = Math.sqrt(rCorr ** 2 + conductor.reactance ** 2); // Ω/km
    const phaseFactor = phase === 'MONO' ? 2 : 1;
    return (phaseFactor * accumulatedDemandKva * impedance * lengthMeters) / phaseVoltageV ** 2;
}

// ─── Top-down propagation ─────────────────────────────────────────────────────

/**
 * Pre-order traversal: propagate accumulated qt from transformer root to leaves.
 * Terminal nodes also receive ramal qt contribution (E3-H2).
 */
export function propagateQt(
    tree: TreeNode,
    accumulatedQtFromRoot: number,
    qtSegmentAtThisNode: number,
    pathFromRoot: string[],
    ctx: PropagationContext,
): void {
    const currentPath = [...pathFromRoot, tree.id];
    const accumulatedDemandKva = ctx.demandByNode.get(tree.id) ?? 0;
    const voltageV = ctx.phaseVoltageV * (1 - accumulatedQtFromRoot);

    ctx.nodeResults.push({
        nodeId: tree.id,
        qtSegment: qtSegmentAtThisNode,
        qtAccumulated: accumulatedQtFromRoot,
        voltageV,
        accumulatedDemandKva,
        pathFromRoot: currentPath,
    });

    const isTerminal = tree.children.length === 0;
    if (isTerminal) {
        let qtRamal = 0;
        let ramalConductorId: string | null = null;
        let ramalLengthMeters: number | null = null;

        if (tree.load.ramal && tree.load.ramal.lengthMeters > 0) {
            const ramal = tree.load.ramal;
            ramalConductorId = ramal.conductorId;
            ramalLengthMeters = ramal.lengthMeters;

            const cat = lookupConductorById(ramal.conductorId);
            if (cat) {
                qtRamal = computeQtSegment(
                    accumulatedDemandKva,
                    cat,
                    ctx.temperatureC,
                    ctx.phase,
                    ctx.phaseVoltageV,
                    ramal.lengthMeters,
                );
            }
        }

        const qtTotal = accumulatedQtFromRoot + qtRamal;
        ctx.terminalResults.push({
            nodeId: tree.id,
            qtTerminal: accumulatedQtFromRoot,
            qtRamal,
            qtTotal,
            voltageEndV: ctx.phaseVoltageV * (1 - qtTotal),
            ramalConductorId,
            ramalLengthMeters,
        });
    }

    for (const { treeNode, edge } of tree.children) {
        const childDemand = ctx.demandByNode.get(treeNode.id) ?? 0;
        const cat = lookupConductorById(edge.conductorId);

        const qtSegment = cat
            ? computeQtSegment(
                  childDemand,
                  cat,
                  ctx.temperatureC,
                  ctx.phase,
                  ctx.phaseVoltageV,
                  edge.lengthMeters,
              )
            : 0;

        propagateQt(treeNode, accumulatedQtFromRoot + qtSegment, qtSegment, currentPath, ctx);
    }
}
