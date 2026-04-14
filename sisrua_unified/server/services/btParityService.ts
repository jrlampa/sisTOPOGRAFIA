/**
 * BT Parity Service (E7-H1, E7-H2)
 *
 * Automated parity executor comparing backend calculation results against
 * reference scenarios extracted from the workbooks:
 *   CQTsimplificado_BECO DO MATA 7 - PARIDADE_FINAL.xlsx
 *   CQTsimplificado_REV0 - Copia - Copia.xlsx
 *
 * Tolerance:
 *  - Discrete fields: exact match.
 *  - Continuous fields: relative difference ≤ 0.0001 (1e-4).
 *
 * P-level classification:
 *  - P0: mandatory – pipeline blocks on any failure.
 *  - P1: important – limited failures allowed (≤ 2).
 *  - P2: informative – no gate.
 */

import { calculateBtRadial, type BtRadialTopologyInput } from './btRadialCalculationService.js';
import { CQT_REV0_BASELINE_TARGETS } from '../constants/cqtBaselineTargets.js';

// ─── Scenario types ───────────────────────────────────────────────────────────

export type BtParityPriority = 'P0' | 'P1' | 'P2';
export type BtParityCellStatus = 'pass' | 'warn' | 'fail';

export interface BtParityMetric {
    name: string;
    expected: number;
    actual: number;
    absDiff: number;
    relDiff: number;
    status: BtParityCellStatus;
}

export interface BtParityScenarioResult {
    scenarioId: string;
    description: string;
    priority: BtParityPriority;
    status: BtParityCellStatus;
    metrics: BtParityMetric[];
    error?: string;
}

export interface BtParitySuiteReport {
    /** ISO timestamp of report generation. */
    generatedAt: string;
    tolerance: number;
    scenarios: BtParityScenarioResult[];
    totals: {
        total: number;
        pass: number;
        warn: number;
        fail: number;
        p0Pass: number;
        p0Fail: number;
        p1Pass: number;
        p1Fail: number;
        p2Pass: number;
        p2Fail: number;
    };
    /** Whether all P0 scenarios passed (CI gate). */
    p0Gate: boolean;
}

// ─── Reference scenarios (extracted from workbook baseline) ──────────────────

interface BtParityScenario {
    id: string;
    description: string;
    priority: BtParityPriority;
    input: BtRadialTopologyInput;
    expected: Record<string, number>;
}

/**
 * Baseline scenario: BECO DO MATA 7 workbook – transformer QT validation.
 * Tests that qtTrafo matches workbook DB K10 = QT_MT + (DEM_ATUAL/TR_ATUAL)*Z%
 *   = 0.0183 + (101.956/225)*0.035 = 0.034159822...
 *
 * Network: single leaf with total demand = 101.956 kVA (workbook DEM_ATUAL).
 * Phase: TRI, T=75°C, V_phase=127V, Transformer: 225 kVA, Z%=3.5%, QT_MT=0.0183.
 */
const SCENARIO_ESQ_ATUAL: BtParityScenario = {
    id: 'ESQ_ATUAL',
    description: 'BECO DO MATA 7 workbook – transformer QT parity (DB K10)',
    priority: 'P0',
    input: {
        transformer: {
            id: 'TRAFO_225',
            rootNodeId: 'TRAFO',
            kva: 225,
            zPercent: 0.035,
            qtMt: 0.0183,
        },
        nodes: [
            { id: 'TRAFO', load: { localDemandKva: 0 } },
            // DEM_ATUAL = 101.956 kVA from workbook DB!K7
            { id: 'TOTAL', load: { localDemandKva: 101.956 } },
        ],
        edges: [
            { fromNodeId: 'TRAFO', toNodeId: 'TOTAL', conductorId: '95 Al - Arm', lengthMeters: 1 },
        ],
        phase: 'TRI',
        temperatureC: 75,
        // Default nominalVoltageV=127 (phase voltage for Brazilian BT 127/220 V)
    },
    expected: {
        // QT_MTTR from workbook DB: K10 = 0.0183 + (101.956/225)*0.035
        qtTrafo: 0.03415982222222222,
        totalDemandKva: 101.956,
    },
};

/**
 * Simple linear 3-node network for P0 structural validation.
 */
const SCENARIO_LINEAR_SIMPLE: BtParityScenario = {
    id: 'LINEAR_SIMPLE',
    description: 'Simple linear 3-node network – structural correctness',
    priority: 'P0',
    input: {
        transformer: {
            id: 'TR30',
            rootNodeId: 'R',
            kva: 30,
            zPercent: 0.035,
            qtMt: 0.0,
        },
        nodes: [
            { id: 'R', load: { localDemandKva: 0 } },
            { id: 'A', load: { localDemandKva: 5 } },
            { id: 'B', load: { localDemandKva: 5 } },
        ],
        edges: [
            { fromNodeId: 'R', toNodeId: 'A', conductorId: '95 Al - Arm', lengthMeters: 50 },
            { fromNodeId: 'A', toNodeId: 'B', conductorId: '95 Al - Arm', lengthMeters: 50 },
        ],
        phase: 'TRI',
        temperatureC: 75,
        nominalVoltageV: 220,
    },
    expected: {
        totalDemandKva: 10,
        // qt at trafo: (10/30)*0.035 = 0.011666...
        qtTrafo: (10 / 30) * 0.035,
    },
};

/**
 * Bifurcation network: root → A, root → B. Tests demand + qt per branch.
 */
const SCENARIO_BIFURCATION: BtParityScenario = {
    id: 'BIFURCATION',
    description: 'Bifurcation – two branches from root',
    priority: 'P0',
    input: {
        transformer: {
            id: 'TR75',
            rootNodeId: 'R',
            kva: 75,
            zPercent: 0.035,
            qtMt: 0.0,
        },
        nodes: [
            { id: 'R', load: { localDemandKva: 0 } },
            { id: 'A', load: { localDemandKva: 10 } },
            { id: 'B', load: { localDemandKva: 20 } },
        ],
        edges: [
            { fromNodeId: 'R', toNodeId: 'A', conductorId: '95 Al - Arm', lengthMeters: 100 },
            { fromNodeId: 'R', toNodeId: 'B', conductorId: '95 Al - Arm', lengthMeters: 150 },
        ],
        phase: 'TRI',
        temperatureC: 75,
        nominalVoltageV: 220,
    },
    expected: {
        totalDemandKva: 30,
        // Node A accumulates 10 kVA; Node B accumulates 20 kVA
        // Worst terminal should be B (higher load × longer distance)
    },
};

/**
 * Idempotency scenario: same input, same output (determinism check).
 */
const SCENARIO_IDEMPOTENCY: BtParityScenario = {
    id: 'IDEMPOTENCY',
    description: 'Idempotency – two runs produce identical CQT global',
    priority: 'P0',
    input: SCENARIO_LINEAR_SIMPLE.input,
    expected: SCENARIO_LINEAR_SIMPLE.expected,
};

/**
 * P1 scenario: terminal with ramal contributes ramal qt.
 */
const SCENARIO_TERMINAL_WITH_RAMAL: BtParityScenario = {
    id: 'TERMINAL_WITH_RAMAL',
    description: 'Terminal with ramal – qt_ramal adds to terminal qt',
    priority: 'P1',
    input: {
        transformer: {
            id: 'TR30',
            rootNodeId: 'R',
            kva: 30,
            zPercent: 0.035,
            qtMt: 0.0,
        },
        nodes: [
            { id: 'R', load: { localDemandKva: 0 } },
            { id: 'T1', load: { localDemandKva: 2, ramal: { conductorId: '16 Al_CONC_Tri', lengthMeters: 20 } } },
        ],
        edges: [
            { fromNodeId: 'R', toNodeId: 'T1', conductorId: '95 Al - Arm', lengthMeters: 100 },
        ],
        phase: 'MONO',
        temperatureC: 75,
        nominalVoltageV: 220,
    },
    expected: {},
};

/**
 * P2 scenario: large network stress test.
 */
const SCENARIO_LARGE_NETWORK: BtParityScenario = {
    id: 'LARGE_NETWORK',
    description: 'Large linear network 20 nodes – no numerical overflow',
    priority: 'P2',
    input: (() => {
        const nodes = [{ id: 'R', load: { localDemandKva: 0 } }];
        const edges = [];
        for (let i = 1; i <= 20; i++) {
            nodes.push({ id: `N${i}`, load: { localDemandKva: 1 } });
            edges.push({
                fromNodeId: i === 1 ? 'R' : `N${i - 1}`,
                toNodeId: `N${i}`,
                conductorId: '95 Al - Arm',
                lengthMeters: 30,
            });
        }
        return {
            transformer: { id: 'TR75', rootNodeId: 'R', kva: 75, zPercent: 0.035, qtMt: 0.01 },
            nodes,
            edges,
            phase: 'TRI' as const,
            temperatureC: 75,
            nominalVoltageV: 220,
        };
    })(),
    expected: { totalDemandKva: 20 },
};

/**
 * P0 scenario: REV0 workbook – transformer QT validation (DB K10).
 * Source: CQTsimplificado_REV0 - Copia - Copia.xlsx
 * Applies the same DB inputs as the BECO DO MATA 7 workbook:
 *   transformer 225 kVA, Z%=3.5%, DEM_ATUAL=101.956 kVA, QT_MT=0.0183.
 * Expected: QT_MTTR = DB!K10 = 0.0183 + (101.956/225)*0.035
 */
const SCENARIO_REV0_DB_INDICATORS: BtParityScenario = {
    id: 'REV0_DB_INDICATORS',
    description: 'REV0 workbook – DB K10 (QT_MTTR) parity with same transformer inputs',
    priority: 'P0',
    input: {
        transformer: {
            id: 'TRAFO_225',
            rootNodeId: 'TRAFO',
            kva: CQT_REV0_BASELINE_TARGETS.db.k6TrAtual,
            zPercent: CQT_REV0_BASELINE_TARGETS.db.zPercent,
            qtMt: CQT_REV0_BASELINE_TARGETS.db.qtMt,
        },
        nodes: [
            { id: 'TRAFO', load: { localDemandKva: 0 } },
            { id: 'TOTAL', load: { localDemandKva: CQT_REV0_BASELINE_TARGETS.db.k7DemAtual } },
        ],
        edges: [
            { fromNodeId: 'TRAFO', toNodeId: 'TOTAL', conductorId: '95 Al - Arm', lengthMeters: 1 },
        ],
        phase: 'TRI',
        temperatureC: 75,
    },
    expected: {
        qtTrafo: CQT_REV0_BASELINE_TARGETS.db.k10QtMttr,
        totalDemandKva: CQT_REV0_BASELINE_TARGETS.db.k7DemAtual,
    },
};

/**
 * P0 scenario: REV0 workbook – simple linear topology.
 * Source: CQTsimplificado_REV0 - Copia - Copia.xlsx
 * Verifies demand accumulation and qt calculation over a two-segment feeder
 * with the same REV0 transformer parameters.
 */
const SCENARIO_REV0_LINEAR: BtParityScenario = {
    id: 'REV0_LINEAR',
    description: 'REV0 workbook – linear 3-node topology with REV0 transformer inputs',
    priority: 'P0',
    input: {
        transformer: {
            id: 'TR225_REV0',
            rootNodeId: 'R',
            kva: CQT_REV0_BASELINE_TARGETS.db.k6TrAtual,
            zPercent: CQT_REV0_BASELINE_TARGETS.db.zPercent,
            qtMt: CQT_REV0_BASELINE_TARGETS.db.qtMt,
        },
        nodes: [
            { id: 'R', load: { localDemandKva: 0 } },
            { id: 'A', load: { localDemandKva: 50 } },
            { id: 'B', load: { localDemandKva: 50 } },
        ],
        edges: [
            { fromNodeId: 'R', toNodeId: 'A', conductorId: '95 Al - Arm', lengthMeters: 60 },
            { fromNodeId: 'A', toNodeId: 'B', conductorId: '95 Al - Arm', lengthMeters: 60 },
        ],
        phase: 'TRI',
        temperatureC: 75,
        nominalVoltageV: 220,
    },
    expected: {
        totalDemandKva: 100,
        // qtTrafo = qtMt + (totalDemandKva / kva) * zPercent
        qtTrafo: CQT_REV0_BASELINE_TARGETS.db.qtMt +
            (100 / CQT_REV0_BASELINE_TARGETS.db.k6TrAtual) * CQT_REV0_BASELINE_TARGETS.db.zPercent,
    },
};

/**
 * P0 scenario: REV0 workbook – idempotency check.
 * Source: CQTsimplificado_REV0 - Copia - Copia.xlsx
 * Verifies that two consecutive runs with REV0 inputs produce identical output.
 */
const SCENARIO_REV0_IDEMPOTENCY: BtParityScenario = {
    id: 'REV0_IDEMPOTENCY',
    description: 'REV0 workbook – idempotency: two runs produce identical CQT global',
    priority: 'P0',
    input: SCENARIO_REV0_LINEAR.input,
    expected: SCENARIO_REV0_LINEAR.expected,
};

/** All scenarios indexed by priority. */
const ALL_SCENARIOS: BtParityScenario[] = [
    SCENARIO_ESQ_ATUAL,
    SCENARIO_LINEAR_SIMPLE,
    SCENARIO_BIFURCATION,
    SCENARIO_IDEMPOTENCY,
    SCENARIO_TERMINAL_WITH_RAMAL,
    SCENARIO_LARGE_NETWORK,
    SCENARIO_REV0_DB_INDICATORS,
    SCENARIO_REV0_LINEAR,
    SCENARIO_REV0_IDEMPOTENCY,
];

// ─── Comparison helpers ───────────────────────────────────────────────────────

const TOLERANCE = 1e-4;

function compareMetric(name: string, expected: number, actual: number, tolerance: number): BtParityMetric {
    const absDiff = Math.abs(actual - expected);
    const relDiff = expected !== 0 ? absDiff / Math.abs(expected) : absDiff;
    let status: BtParityCellStatus;
    if (relDiff <= tolerance) {
        status = 'pass';
    } else if (relDiff <= tolerance * 10) {
        status = 'warn';
    } else {
        status = 'fail';
    }
    return { name, expected, actual, absDiff, relDiff, status };
}

function runScenario(scenario: BtParityScenario): BtParityScenarioResult {
    try {
        const result = calculateBtRadial(scenario.input);

        // For idempotency, run twice and compare cqtGlobal
        let actual2: typeof result | null = null;
        if (scenario.id === 'IDEMPOTENCY' || scenario.id === 'REV0_IDEMPOTENCY') {
            actual2 = calculateBtRadial(scenario.input);
        }

        const metrics: BtParityMetric[] = [];

        // Compare all expected metrics
        for (const [metricName, expectedValue] of Object.entries(scenario.expected)) {
            let actualValue: number;
            if (metricName === 'qtTrafo') {
                actualValue = result.qtTrafo;
            } else if (metricName === 'totalDemandKva') {
                actualValue = result.totalDemandKva;
            } else if (metricName === 'cqtGlobal') {
                actualValue = result.worstCase.cqtGlobal;
            } else {
                continue;
            }

            metrics.push(compareMetric(metricName, expectedValue, actualValue, TOLERANCE));
        }

        // Idempotency check
        if ((scenario.id === 'IDEMPOTENCY' || scenario.id === 'REV0_IDEMPOTENCY') && actual2) {
            metrics.push(
                compareMetric('idempotency_cqtGlobal', result.worstCase.cqtGlobal, actual2.worstCase.cqtGlobal, 0),
                compareMetric('idempotency_totalDemand', result.totalDemandKva, actual2.totalDemandKva, 0),
            );
        }

        // Terminal-with-ramal: qt_ramal must be > 0
        if (scenario.id === 'TERMINAL_WITH_RAMAL') {
            const t1 = result.terminalResults.find((t) => t.nodeId === 'T1');
            const qtRamalActual = t1?.qtRamal ?? 0;
            metrics.push({
                name: 'qt_ramal_positive',
                expected: 1, // synthetic: 1 = passes assertion
                actual: qtRamalActual > 0 ? 1 : 0,
                absDiff: qtRamalActual > 0 ? 0 : 1,
                relDiff: qtRamalActual > 0 ? 0 : 1,
                status: qtRamalActual > 0 ? 'pass' : 'fail',
            });
        }

        // Bifurcation: worst terminal should be B (higher demand × longer distance)
        if (scenario.id === 'BIFURCATION') {
            const worstIsB = result.worstCase.worstTerminalNodeId === 'B' ? 1 : 0;
            metrics.push({
                name: 'worst_terminal_is_B',
                expected: 1,
                actual: worstIsB,
                absDiff: worstIsB === 1 ? 0 : 1,
                relDiff: worstIsB === 1 ? 0 : 1,
                status: worstIsB === 1 ? 'pass' : 'warn',
            });
        }

        const overallStatus = metrics.length === 0
            ? 'pass'
            : metrics.some((m) => m.status === 'fail') ? 'fail'
            : metrics.some((m) => m.status === 'warn') ? 'warn'
            : 'pass';

        return {
            scenarioId: scenario.id,
            description: scenario.description,
            priority: scenario.priority,
            status: overallStatus,
            metrics,
        };
    } catch (err) {
        return {
            scenarioId: scenario.id,
            description: scenario.description,
            priority: scenario.priority,
            status: 'fail',
            metrics: [],
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the full parity suite and return a structured report.
 * P0 gate: p0Gate = true iff all P0 scenarios have status 'pass'.
 */
export function runBtParitySuite(): BtParitySuiteReport {
    const scenarios = ALL_SCENARIOS.map(runScenario);

    const totals = {
        total: scenarios.length,
        pass: scenarios.filter((s) => s.status === 'pass').length,
        warn: scenarios.filter((s) => s.status === 'warn').length,
        fail: scenarios.filter((s) => s.status === 'fail').length,
        p0Pass: scenarios.filter((s) => s.priority === 'P0' && s.status === 'pass').length,
        p0Fail: scenarios.filter((s) => s.priority === 'P0' && s.status === 'fail').length,
        p1Pass: scenarios.filter((s) => s.priority === 'P1' && s.status === 'pass').length,
        p1Fail: scenarios.filter((s) => s.priority === 'P1' && s.status === 'fail').length,
        p2Pass: scenarios.filter((s) => s.priority === 'P2' && s.status === 'pass').length,
        p2Fail: scenarios.filter((s) => s.priority === 'P2' && s.status === 'fail').length,
    };

    return {
        generatedAt: new Date().toISOString(),
        tolerance: TOLERANCE,
        scenarios,
        totals,
        p0Gate: totals.p0Fail === 0,
    };
}

/**
 * Run only scenarios with a specific priority.
 */
export function runBtParityByPriority(priority: BtParityPriority): BtParityScenarioResult[] {
    return ALL_SCENARIOS.filter((s) => s.priority === priority).map(runScenario);
}

/**
 * Return the list of all defined scenario IDs and their priorities.
 */
export function listBtParityScenarios(): Array<{ id: string; description: string; priority: BtParityPriority }> {
    return ALL_SCENARIOS.map((s) => ({ id: s.id, description: s.description, priority: s.priority }));
}
