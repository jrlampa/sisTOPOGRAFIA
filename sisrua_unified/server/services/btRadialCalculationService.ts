/**
 * BT Radial Calculation Service
 *
 * Sprint 1-3 backlog implementation:
 *  E1-H1 – Input contract and radial validation
 *  E1-H2 – Auditable output contract
 *  E2-H1 – Conductor/transformer catalog lookup (via btCatalogService)
 *  E3-H1 – Top-down voltage-drop (qt) propagation, pre-order
 *  E3-H2 – Physical terminal + ramal qt contribution
 *  E4-H1 – CQT global, worst-case node, critical-path tracing
 *  E5-H1 – Bottom-up demand aggregation, post-order
 *  E5-H2 – Cross-consistency validation (qt × demand)
 *
 * Workbook parity: CQTsimplificado_BECO DO MATA 7 - PARIDADE_FINAL.xlsx
 *
 * Formula used (matches workbook for Brazilian 127/220 V BT system):
 *   QT_trecho = P_kVA × Z_Ω_per_km × L_m / V_phase_V²
 *
 * Where:
 *   P_kVA  – accumulated demand at the "from" node (kVA)
 *   Z_Ω_per_km – corrected impedance magnitude (Ω/km): √(R_corr² + X²)
 *   L_m    – segment length in metres
 *   V_phase_V – phase voltage in V (default 127 V for 127/220 V BT)
 *
 * This is equivalent to the standard drop formula P_W × Z_Ω / V² because:
 *   P_kVA × Z_km × L_m = (P_kVA × 1000) × (Z_km / 1000) × L_m
 *                        = P_W × Z_Ω  (where Z_Ω = Z_km × L_m / 1000)
 *
 * Tolerance: discrete exact, continuous relative ≤ 1 × 10⁻⁴.
 */

import { calculateCorrectedResistance, calculateDbIndicators } from './cqtEngine.js';
import {
    lookupConductorById,
    lookupTransformerById,
    type BtConductorEntry,
} from './btCatalogService.js';

// ─── Input contracts (E1-H1) ─────────────────────────────────────────────────

export type BtRadialPhase = 'MONO' | 'BIF' | 'TRI';

export interface BtRadialNodeLoad {
    /** Local demand in kVA at this node (sum of connections). */
    localDemandKva: number;
    /** Optional ramal at a terminal node. */
    ramal?: {
        conductorId: string;
        lengthMeters: number;
    };
}

export interface BtRadialNode {
    id: string;
    load: BtRadialNodeLoad;
}

export interface BtRadialEdge {
    fromNodeId: string;
    toNodeId: string;
    conductorId: string;
    lengthMeters: number;
}

export interface BtRadialTransformer {
    id: string;
    rootNodeId: string;
    /** Transformer nameplate rating in kVA. */
    kva: number;
    /** Short-circuit impedance percentage (e.g. 0.035 for 3.5%). */
    zPercent: number;
    /** Medium-voltage voltage-drop fraction already computed upstream. */
    qtMt: number;
}

export interface BtRadialTopologyInput {
    transformer: BtRadialTransformer;
    nodes: BtRadialNode[];
    edges: BtRadialEdge[];
    /** Operating phase: MONO | BIF | TRI. */
    phase: BtRadialPhase;
    /** Conductor temperature in °C (default 75). */
    temperatureC?: number;
    /**
     * Phase voltage in V used as the reference for QT fractions.
     * Defaults to 127 V (Brazilian 127/220 V BT system, phase-to-neutral voltage).
     */
    nominalVoltageV?: number;
    /** Efficiency factor η (default 1.0, reserved for future use). */
    eta?: number;
}

// ─── Output contracts (E1-H2) ────────────────────────────────────────────────

export interface BtRadialNodeResult {
    nodeId: string;
    /** Qt voltage-drop contributed by the segment arriving at this node (fraction). */
    qtSegment: number;
    /** Accumulated qt from transformer to this node (fraction). */
    qtAccumulated: number;
    /** Voltage at this node in V (= phaseVoltageV × (1 − qtAccumulated)). */
    voltageV: number;
    /** Demand accumulated from this node downstream (kVA). */
    accumulatedDemandKva: number;
    /** IDs of the nodes on the path from transformer to this node (inclusive). */
    pathFromRoot: string[];
}

export interface BtRadialTerminalResult {
    nodeId: string;
    /** Qt at the network terminal (same as qtAccumulated of the terminal node). */
    qtTerminal: number;
    /** Ramal qt contribution, 0 if no ramal. */
    qtRamal: number;
    /** Total qt = qtTerminal + qtRamal. */
    qtTotal: number;
    /** Voltage at the physical end of the ramal in V. */
    voltageEndV: number;
    /** Ramal conductor ID (null if no ramal). */
    ramalConductorId: string | null;
    /** Ramal length in m (null if no ramal). */
    ramalLengthMeters: number | null;
}

export interface BtRadialWorstCase {
    /** Terminal node ID with highest qtTotal. */
    worstTerminalNodeId: string;
    /** CQT global = max qtTotal across all terminals (fraction). */
    cqtGlobal: number;
    /** Path of node IDs from transformer root to worst terminal (inclusive). */
    criticalPath: string[];
    /** Qt at transformer root (fraction). */
    qtTrafo: number;
}

export interface BtRadialConsistencyAlert {
    code: string;
    message: string;
    severity: 'error' | 'warn';
}

export interface BtRadialCalculationOutput {
    /** Qt fraction at transformer root. */
    qtTrafo: number;
    /** Per-node qt and demand results (pre-order traversal order). */
    nodeResults: BtRadialNodeResult[];
    /** Per-terminal results including ramal. */
    terminalResults: BtRadialTerminalResult[];
    /** Worst-case and CQT global. */
    worstCase: BtRadialWorstCase;
    /** Demand accumulated at transformer root (kVA). */
    totalDemandKva: number;
    /** Consistency alerts (E5-H2). */
    consistencyAlerts: BtRadialConsistencyAlert[];
}

// ─── Validation errors (E1-H1) ───────────────────────────────────────────────

export class BtRadialValidationError extends Error {
    constructor(
        public readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = 'BtRadialValidationError';
    }
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface TreeNode {
    id: string;
    load: BtRadialNodeLoad;
    children: Array<{ treeNode: TreeNode; edge: BtRadialEdge }>;
}

// ─── Voltage drop formula ─────────────────────────────────────────────────────

/**
 * Compute voltage-drop fraction for one segment.
 *
 * Formula: QT = phaseFactor × P_kVA × Z_Ω_km × L_m / V_phase_V²
 *
 * Phase factors:
 *  TRI  → 1   (balanced 3-phase, reference = phase-to-neutral voltage)
 *  BIF  → 1   (2-phase, reference = phase-to-phase voltage ≈ V supplied)
 *  MONO → 2   (single-phase 2-wire: current flows both ways)
 */
function computeQtSegment(
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
    return phaseFactor * accumulatedDemandKva * impedance * lengthMeters / (phaseVoltageV ** 2);
}

// ─── Topology validation (E1-H1) ─────────────────────────────────────────────

/** Validate the topology and return a directed adjacency map (from root outward). */
function validateRadialTopology(input: BtRadialTopologyInput): Map<string, BtRadialEdge[]> {
    const { transformer, nodes, edges } = input;

    if (!transformer || !transformer.rootNodeId) {
        throw new BtRadialValidationError('NO_TRANSFORMER', 'Topology must define a transformer with rootNodeId.');
    }

    const nodeIds = new Set(nodes.map((n) => n.id));

    if (!nodeIds.has(transformer.rootNodeId)) {
        throw new BtRadialValidationError(
            'ROOT_NODE_NOT_FOUND',
            `Transformer rootNodeId "${transformer.rootNodeId}" not found in nodes list.`,
        );
    }

    for (const edge of edges) {
        if (!nodeIds.has(edge.fromNodeId)) {
            throw new BtRadialValidationError(
                'EDGE_NODE_NOT_FOUND',
                `Edge fromNodeId "${edge.fromNodeId}" references an unknown node.`,
            );
        }
        if (!nodeIds.has(edge.toNodeId)) {
            throw new BtRadialValidationError(
                'EDGE_NODE_NOT_FOUND',
                `Edge toNodeId "${edge.toNodeId}" references an unknown node.`,
            );
        }
        if (!edge.conductorId) {
            throw new BtRadialValidationError(
                'EDGE_MISSING_CONDUCTOR',
                `Edge from "${edge.fromNodeId}" to "${edge.toNodeId}" has no conductorId.`,
            );
        }
        if (!(edge.lengthMeters > 0)) {
            throw new BtRadialValidationError(
                'EDGE_INVALID_LENGTH',
                `Edge from "${edge.fromNodeId}" to "${edge.toNodeId}" must have a positive length.`,
            );
        }
    }

    // Build undirected adjacency for DFS cycle detection
    const adj = new Map<string, BtRadialEdge[]>();
    for (const id of nodeIds) {
        adj.set(id, []);
    }
    for (const edge of edges) {
        adj.get(edge.fromNodeId)!.push(edge);
        // Reverse direction for undirected traversal
        adj.get(edge.toNodeId)!.push({ ...edge, fromNodeId: edge.toNodeId, toNodeId: edge.fromNodeId });
    }

    // DFS cycle detection from root
    const visited = new Set<string>();
    const stack: Array<{ id: string; parentId: string | null }> = [
        { id: transformer.rootNodeId, parentId: null },
    ];
    while (stack.length > 0) {
        const { id, parentId } = stack.pop()!;
        if (visited.has(id)) {
            throw new BtRadialValidationError(
                'CYCLE_DETECTED',
                `Topology contains a cycle at node "${id}". Radial topology required.`,
            );
        }
        visited.add(id);
        for (const edge of adj.get(id) ?? []) {
            if (edge.toNodeId !== parentId) {
                stack.push({ id: edge.toNodeId, parentId: id });
            }
        }
    }

    return adj;
}

// ─── Tree construction ────────────────────────────────────────────────────────

function buildTree(
    rootId: string,
    adj: Map<string, BtRadialEdge[]>,
    nodeMap: Map<string, BtRadialNode>,
): TreeNode {
    const visited = new Set<string>();

    function buildSubtree(nodeId: string): TreeNode {
        visited.add(nodeId);
        const node = nodeMap.get(nodeId)!;
        const children: TreeNode['children'] = [];
        for (const edge of adj.get(nodeId) ?? []) {
            if (!visited.has(edge.toNodeId)) {
                children.push({ treeNode: buildSubtree(edge.toNodeId), edge });
            }
        }
        return { id: nodeId, load: node.load, children };
    }

    return buildSubtree(rootId);
}

// ─── Bottom-up demand accumulation (E5-H1) ────────────────────────────────────

function accumulateDemand(tree: TreeNode, demandByNode: Map<string, number>): number {
    let total = tree.load.localDemandKva;
    for (const { treeNode } of tree.children) {
        total += accumulateDemand(treeNode, demandByNode);
    }
    demandByNode.set(tree.id, total);
    return total;
}

// ─── Top-down qt propagation (E3-H1, E3-H2) ──────────────────────────────────

interface PropagationContext {
    phase: BtRadialPhase;
    temperatureC: number;
    phaseVoltageV: number;
    demandByNode: Map<string, number>;
    nodeResults: BtRadialNodeResult[];
    terminalResults: BtRadialTerminalResult[];
}

function propagateQt(
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
        // E3-H2: ramal at terminal
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
        const voltageEndV = ctx.phaseVoltageV * (1 - qtTotal);

        ctx.terminalResults.push({
            nodeId: tree.id,
            qtTerminal: accumulatedQtFromRoot,
            qtRamal,
            qtTotal,
            voltageEndV,
            ramalConductorId,
            ramalLengthMeters,
        });
    }

    // Recurse into children
    for (const { treeNode, edge } of tree.children) {
        const childDemand = ctx.demandByNode.get(treeNode.id) ?? 0;
        const cat = lookupConductorById(edge.conductorId);

        const qtSegment = cat
            ? computeQtSegment(childDemand, cat, ctx.temperatureC, ctx.phase, ctx.phaseVoltageV, edge.lengthMeters)
            : 0;

        propagateQt(treeNode, accumulatedQtFromRoot + qtSegment, qtSegment, currentPath, ctx);
    }
}

// ─── Consistency checks (E5-H2) ───────────────────────────────────────────────

function buildConsistencyAlerts(
    input: BtRadialTopologyInput,
    output: BtRadialCalculationOutput,
): BtRadialConsistencyAlert[] {
    const alerts: BtRadialConsistencyAlert[] = [];

    // Check: transformer kVA must be positive
    if (!(input.transformer.kva > 0)) {
        alerts.push({
            code: 'TRAFO_KVA_INVALID',
            message: 'Transformer kVA must be a positive number.',
            severity: 'error',
        });
    }

    // Check: demand at transformer should be positive for a useful calculation
    if (output.totalDemandKva === 0) {
        alerts.push({
            code: 'ZERO_TOTAL_DEMAND',
            message: 'Total accumulated demand at transformer is zero. No voltage drop can be computed.',
            severity: 'warn',
        });
    }

    // Check: CQT global > 0.5 is a regulatory concern (> 50% voltage drop is extreme)
    if (output.worstCase.cqtGlobal > 0.5) {
        alerts.push({
            code: 'CQT_HIGH',
            message: `CQT global ${output.worstCase.cqtGlobal.toFixed(4)} exceeds 50% voltage drop. Network may be undersized.`,
            severity: 'warn',
        });
    }

    // Check: all terminal voltages should be >= 0 (physically, voltage can't be negative)
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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calculate BT radial network: voltage drop (top-down) + demand (bottom-up).
 *
 * Throws BtRadialValidationError for invalid topologies.
 */
export function calculateBtRadial(input: BtRadialTopologyInput): BtRadialCalculationOutput {
    // Step 1: validate radial topology (E1-H1)
    const adj = validateRadialTopology(input);

    const nodeMap = new Map(input.nodes.map((n) => [n.id, n]));
    const temperatureC = input.temperatureC ?? 75;
    // Default phase voltage = 127 V (Brazilian 127/220 V BT system)
    const phaseVoltageV = input.nominalVoltageV ?? 127;
    const phase = input.phase;

    // Step 2: build tree
    const tree = buildTree(input.transformer.rootNodeId, adj, nodeMap);

    // Step 3: bottom-up demand aggregation (E5-H1)
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

    // Step 5: top-down qt propagation (E3-H1)
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

    // Step 6: determine worst case (E4-H1)
    let worstTerminal: BtRadialTerminalResult | undefined;
    for (const t of terminalResults) {
        if (!worstTerminal || t.qtTotal > worstTerminal.qtTotal) {
            worstTerminal = t;
        }
    }

    const cqtGlobal = worstTerminal?.qtTotal ?? qtTrafo;
    const worstTerminalNodeId = worstTerminal?.nodeId ?? input.transformer.rootNodeId;

    const worstNodeResult = nodeResults.find((r) => r.nodeId === worstTerminalNodeId);
    const criticalPath = worstNodeResult?.pathFromRoot ?? [input.transformer.rootNodeId];

    const worstCase: BtRadialWorstCase = {
        worstTerminalNodeId,
        cqtGlobal,
        criticalPath,
        qtTrafo,
    };

    const output: BtRadialCalculationOutput = {
        qtTrafo,
        nodeResults,
        terminalResults,
        worstCase,
        totalDemandKva,
        consistencyAlerts: [],
    };

    // Step 7: consistency checks (E5-H2)
    output.consistencyAlerts = buildConsistencyAlerts(input, output);

    return output;
}
