/**
 * BT Radial Calculation Service – orchestrator (E1-E5)
 *
 * This file is intentionally thin: it composes the bt/* sub-modules and
 * re-exports all public types so existing importers remain unaffected.
 *
 * Sub-module responsibilities:
 *   bt/btTypes.ts   – input/output contracts, BtRadialValidationError
 *   bt/btGraph.ts   – topology validation + tree construction
 *   bt/btDemand.ts  – bottom-up demand aggregation (E5-H1)
 *   bt/btVoltage.ts – QT segment formula + top-down propagation (E3-H1, E3-H2)
 *   bt/btCqt.ts     – worst-case detection + consistency alerts (E4-H1, E5-H2)
 *
 * Workbook parity: CQTsimplificado_BECO DO MATA 7 - PARIDADE_FINAL.xlsx
 *                  (canonical location: Light_estudo/)
 */

// ─── Re-export all public types (backward compatibility) ─────────────────────

export type {
    BtRadialPhase,
    BtRadialNodeLoad,
    BtRadialNode,
    BtRadialEdge,
    BtRadialTransformer,
    BtRadialTopologyInput,
    BtRadialNodeResult,
    BtRadialTerminalResult,
    BtRadialWorstCase,
    BtRadialConsistencyAlert,
    BtRadialCalculationOutput,
} from './bt/btTypes.js';

export { BtRadialValidationError } from './bt/btTypes.js';

// ─── Internal imports ─────────────────────────────────────────────────────────

import { getActiveConstants } from '../standards/index.js';
import { calculateDbIndicators } from './cqtEngine.js';
import { lookupTransformerById } from './btCatalogService.js';
import { validateRadialTopology, buildTree } from './bt/btGraph.js';
import { accumulateDemand } from './bt/btDemand.js';
import { propagateQt } from './bt/btVoltage.js';
import type { PropagationContext } from './bt/btVoltage.js';
import { buildWorstCase, buildConsistencyAlerts } from './bt/btCqt.js';
import { calculateManualDraggingCosts } from './btAccessibilityService.js';
import type {
    BtRadialTopologyInput,
    BtRadialNodeResult,
    BtRadialTerminalResult,
    BtRadialCalculationOutput,
} from './bt/btTypes.js';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calculate BT radial network: voltage drop (top-down) + demand (bottom-up).
 *
 * Throws BtRadialValidationError for invalid topologies.
 */
export function calculateBtRadial(input: BtRadialTopologyInput): BtRadialCalculationOutput {
    // Step 1: validate topology (E1-H1)
    const adj = validateRadialTopology(input);

    const constants = getActiveConstants();
    const nodeMap = new Map(input.nodes.map((n) => [n.id, n]));
    const temperatureC = input.temperatureC ?? constants.DEFAULT_AMBIENT_TEMP_C;
    const phaseVoltageV = input.nominalVoltageV ?? constants.BT_PHASE_VOLTAGE_V;
    const phase = input.phase;

    // Step 2: build directed tree
    const tree = buildTree(input.transformer.rootNodeId, adj, nodeMap);

    // Step 3: bottom-up demand (E5-H1)
    const demandByNode = new Map<string, number>();
    const totalDemandKva = accumulateDemand(tree, demandByNode);

    // Step 4: qt at transformer root (E3-H1)
    const trafoLookup = lookupTransformerById(String(input.transformer.kva));
    const zPercent = trafoLookup?.zPercent ?? input.transformer.zPercent;
    const dbResult = calculateDbIndicators({
        trAtual: input.transformer.kva,
        demAtual: totalDemandKva,
        qtMt: input.transformer.qtMt,
        trafosZ: [{ trafoKva: input.transformer.kva, qtFactor: zPercent }],
    });
    const qtTrafo = dbResult.k10QtMttr;

    // Step 5: top-down qt propagation (E3-H1, E3-H2)
    const nodeResults: BtRadialNodeResult[] = [];
    const terminalResults: BtRadialTerminalResult[] = [];

    const ctx: PropagationContext = {
        phase,
        temperatureC,
        phaseVoltageV,
        demandByNode,
        nodeResults,
        terminalResults,
    };

    propagateQt(tree, qtTrafo, 0, [], ctx);

    // Step 6: worst-case + CQT global (E4-H1)
    const worstCase = buildWorstCase(
        terminalResults,
        nodeResults,
        qtTrafo,
        input.transformer.rootNodeId,
    );

    // Step 6.1: accessibility & manual dragging calculation (New Feature)
    const accessibilityResults = calculateManualDraggingCosts(input.nodes.map(n => ({
        id: n.id,
        hasVehicleAccess: n.hasVehicleAccess ?? true,
        manualDragDistanceMeters: n.manualDragDistanceMeters,
        equipmentType: n.equipmentType
    })));

    const output: BtRadialCalculationOutput = {
        qtTrafo,
        nodeResults,
        terminalResults,
        worstCase,
        totalDemandKva,
        consistencyAlerts: [],
        accessibilityResults
    };

    // Step 7: consistency alerts (E5-H2)
    output.consistencyAlerts = buildConsistencyAlerts(input, output);

    return output;
}