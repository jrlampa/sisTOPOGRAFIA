/**
 * BT Radial – shared types (E1-H1, E1-H2)
 *
 * All input contracts, output contracts, and the validation-error class used
 * across the bt/* sub-modules.  Import from here instead of the orchestrator
 * to avoid circular dependencies.
 */

// ─── Input contracts (E1-H1) ─────────────────────────────────────────────────

export type BtRadialPhase = 'MONO' | 'BIF' | 'TRI';

export interface BtRadialNodeLoad {
    localDemandKva: number;
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
    kva: number;
    zPercent: number;
    qtMt: number;
}

export interface BtRadialTopologyInput {
    transformer: BtRadialTransformer;
    nodes: BtRadialNode[];
    edges: BtRadialEdge[];
    phase: BtRadialPhase;
    temperatureC?: number;
    /**
     * Phase voltage in V (default 127 V for Brazilian 127/220 V BT system).
     */
    nominalVoltageV?: number;
    eta?: number;
}

// ─── Output contracts (E1-H2) ────────────────────────────────────────────────

export interface BtRadialNodeResult {
    nodeId: string;
    qtSegment: number;
    qtAccumulated: number;
    voltageV: number;
    accumulatedDemandKva: number;
    pathFromRoot: string[];
}

export interface BtRadialTerminalResult {
    nodeId: string;
    qtTerminal: number;
    qtRamal: number;
    qtTotal: number;
    voltageEndV: number;
    ramalConductorId: string | null;
    ramalLengthMeters: number | null;
}

export interface BtRadialWorstCase {
    worstTerminalNodeId: string;
    cqtGlobal: number;
    criticalPath: string[];
    qtTrafo: number;
}

export interface BtRadialConsistencyAlert {
    code: string;
    message: string;
    severity: 'error' | 'warn';
}

export interface BtRadialCalculationOutput {
    qtTrafo: number;
    nodeResults: BtRadialNodeResult[];
    terminalResults: BtRadialTerminalResult[];
    worstCase: BtRadialWorstCase;
    totalDemandKva: number;
    consistencyAlerts: BtRadialConsistencyAlert[];
}

// ─── Internal tree type ───────────────────────────────────────────────────────

export interface TreeNode {
    id: string;
    load: BtRadialNodeLoad;
    children: Array<{ treeNode: TreeNode; edge: BtRadialEdge }>;
}

// ─── Telescopic analysis types (REDE NOVA intelligence) ──────────────────────

export interface TelescopicPathEdge {
    edgeId: string;
    suggestedConductorId: string;
    lengthM: number;
}

export interface TelescopicSuggestion {
    terminalNodeId: string;
    currentVoltageEndV: number;
    pathEdges: TelescopicPathEdge[];
    projectedVoltageEndV: number;
    saturationPct: number;
    requiresTransformerUpgrade: boolean;
}

export interface TelescopicAnalysisOutput {
    suggestions: TelescopicSuggestion[];
    lmaxByConductor: Record<string, number>;
}

// ─── Validation error (E1-H1) ────────────────────────────────────────────────

export class BtRadialValidationError extends Error {
    constructor(
        public readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = 'BtRadialValidationError';
    }
}
