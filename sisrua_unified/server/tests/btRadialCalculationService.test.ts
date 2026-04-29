/**
 * Tests for btRadialCalculationService
 * Covers E1-H1 (validation), E1-H2 (output), E3-H1 (top-down qt),
 * E3-H2 (terminal+ramal), E4-H1 (worst case), E5-H1 (bottom-up demand),
 * E5-H2 (consistency checks).
 */

import {
    calculateBtRadial,
    BtRadialValidationError,
    type BtRadialTopologyInput,
} from '../services/btRadialCalculationService';
import { lookupConductorById } from '../services/btCatalogService';
import { calculateCorrectedResistance } from '../services/cqtEngine';

// ─── shared builders ──────────────────────────────────────────────────────────

const makeLinearInput = (overrides: Partial<BtRadialTopologyInput> = {}): BtRadialTopologyInput => ({
    transformer: {
        id: 'TR225',
        rootNodeId: 'R',
        kva: 225,
        zPercent: 0.035,
        qtMt: 0.0183,
    },
    nodes: [
        { id: 'R', load: { localDemandKva: 0 } },
        { id: 'A', load: { localDemandKva: 10 } },
        { id: 'B', load: { localDemandKva: 5 } },
    ],
    edges: [
        { fromNodeId: 'R', toNodeId: 'A', conductorId: '95 Al - Arm', lengthMeters: 50 },
        { fromNodeId: 'A', toNodeId: 'B', conductorId: '95 Al - Arm', lengthMeters: 50 },
    ],
    phase: 'TRI',
    temperatureC: 75,
    nominalVoltageV: 220,
    ...overrides,
});

// ─── E1-H1: Input validation ──────────────────────────────────────────────────

describe('btRadialCalculationService – validation (E1-H1)', () => {
    it('accepts a valid radial topology', () => {
        expect(() => calculateBtRadial(makeLinearInput())).not.toThrow();
    });

    it('rejects missing transformer rootNodeId', () => {
        const input = makeLinearInput();
        // @ts-expect-error: intentional bad input
        input.transformer.rootNodeId = '';
        expect(() => calculateBtRadial(input)).toThrow(BtRadialValidationError);
    });

    it('rejects rootNodeId not in nodes list', () => {
        const input = makeLinearInput();
        input.transformer.rootNodeId = 'DOES_NOT_EXIST';
        expect(() => calculateBtRadial(input)).toThrow(BtRadialValidationError);
    });

    it('rejects edge referencing unknown fromNodeId', () => {
        const input = makeLinearInput();
        input.edges = [{ fromNodeId: 'UNKNOWN', toNodeId: 'A', conductorId: '95 Al - Arm', lengthMeters: 50 }];
        expect(() => calculateBtRadial(input)).toThrow(BtRadialValidationError);
    });

    it('rejects edge referencing unknown toNodeId', () => {
        const input = makeLinearInput();
        input.edges = [{ fromNodeId: 'R', toNodeId: 'UNKNOWN', conductorId: '95 Al - Arm', lengthMeters: 50 }];
        expect(() => calculateBtRadial(input)).toThrow(BtRadialValidationError);
    });

    it('rejects edge without conductorId', () => {
        const input = makeLinearInput();
        // @ts-expect-error: intentional bad input
        input.edges = [{ fromNodeId: 'R', toNodeId: 'A', conductorId: '', lengthMeters: 50 }];
        expect(() => calculateBtRadial(input)).toThrow(BtRadialValidationError);
    });

    it('rejects edge with zero length', () => {
        const input = makeLinearInput();
        input.edges = [{ fromNodeId: 'R', toNodeId: 'A', conductorId: '95 Al - Arm', lengthMeters: 0 }];
        expect(() => calculateBtRadial(input)).toThrow(BtRadialValidationError);
    });

    it('rejects cycle in topology', () => {
        const input = makeLinearInput();
        // Add back-edge to create a cycle
        input.edges = [
            { fromNodeId: 'R', toNodeId: 'A', conductorId: '95 Al - Arm', lengthMeters: 50 },
            { fromNodeId: 'A', toNodeId: 'B', conductorId: '95 Al - Arm', lengthMeters: 50 },
            { fromNodeId: 'B', toNodeId: 'R', conductorId: '95 Al - Arm', lengthMeters: 50 },
        ];
        expect(() => calculateBtRadial(input)).toThrow(BtRadialValidationError);
    });
});

// ─── E1-H2: Output contract ───────────────────────────────────────────────────

describe('btRadialCalculationService – output contract (E1-H2)', () => {
    it('output contains all required top-level fields', () => {
        const result = calculateBtRadial(makeLinearInput());
        expect(typeof result.qtTrafo).toBe('number');
        expect(Array.isArray(result.nodeResults)).toBe(true);
        expect(Array.isArray(result.terminalResults)).toBe(true);
        expect(result.worstCase).toBeDefined();
        expect(typeof result.totalDemandKva).toBe('number');
        expect(Array.isArray(result.consistencyAlerts)).toBe(true);
    });

    it('worstCase contains required fields', () => {
        const result = calculateBtRadial(makeLinearInput());
        expect(typeof result.worstCase.worstTerminalNodeId).toBe('string');
        expect(typeof result.worstCase.cqtGlobal).toBe('number');
        expect(Array.isArray(result.worstCase.criticalPath)).toBe(true);
        expect(typeof result.worstCase.qtTrafo).toBe('number');
    });

    it('every nodeResult contains required fields', () => {
        const result = calculateBtRadial(makeLinearInput());
        for (const nr of result.nodeResults) {
            expect(typeof nr.nodeId).toBe('string');
            expect(typeof nr.qtSegment).toBe('number');
            expect(typeof nr.qtAccumulated).toBe('number');
            expect(typeof nr.voltageV).toBe('number');
            expect(typeof nr.accumulatedDemandKva).toBe('number');
            expect(Array.isArray(nr.pathFromRoot)).toBe(true);
        }
    });

    it('two runs with same input produce identical output (idempotency)', () => {
        const input = makeLinearInput();
        const r1 = calculateBtRadial(input);
        const r2 = calculateBtRadial(input);
        expect(r1.worstCase.cqtGlobal).toBe(r2.worstCase.cqtGlobal);
        expect(r1.totalDemandKva).toBe(r2.totalDemandKva);
        expect(r1.qtTrafo).toBe(r2.qtTrafo);
    });

    it('nodeResults are deterministic regardless of input node order', () => {
        const r1 = calculateBtRadial(makeLinearInput());
        const inputReversed = makeLinearInput();
        inputReversed.nodes = [...inputReversed.nodes].reverse();
        const r2 = calculateBtRadial(inputReversed);
        expect(r1.worstCase.cqtGlobal).toBe(r2.worstCase.cqtGlobal);
    });
});

// ─── E3-H1: Top-down qt propagation ──────────────────────────────────────────

describe('btRadialCalculationService – qt propagation (E3-H1)', () => {
    it('qtTrafo equals qt_mt + (demand/kva)*zPercent', () => {
        const input = makeLinearInput();
        // totalDemand = 15 kVA, kva = 225, z = 0.035, qtMt = 0.0183
        const result = calculateBtRadial(input);
        const expectedQtTrafo = 0.0183 + (15 / 225) * 0.035;
        expect(result.qtTrafo).toBeCloseTo(expectedQtTrafo, 10);
    });

    it('root node has qtAccumulated == qtTrafo', () => {
        const result = calculateBtRadial(makeLinearInput());
        const rootResult = result.nodeResults.find((n) => n.nodeId === 'R');
        expect(rootResult).toBeDefined();
        expect(rootResult!.qtAccumulated).toBeCloseTo(result.qtTrafo, 10);
    });

    it('qt is monotonically non-decreasing along a path', () => {
        const result = calculateBtRadial(makeLinearInput());
        const rNode = result.nodeResults.find((n) => n.nodeId === 'R')!;
        const aNode = result.nodeResults.find((n) => n.nodeId === 'A')!;
        const bNode = result.nodeResults.find((n) => n.nodeId === 'B')!;
        expect(aNode.qtAccumulated).toBeGreaterThanOrEqual(rNode.qtAccumulated);
        expect(bNode.qtAccumulated).toBeGreaterThanOrEqual(aNode.qtAccumulated);
    });

    it('voltageV decreases from root to terminal', () => {
        const result = calculateBtRadial(makeLinearInput());
        const rNode = result.nodeResults.find((n) => n.nodeId === 'R')!;
        const bNode = result.nodeResults.find((n) => n.nodeId === 'B')!;
        expect(bNode.voltageV).toBeLessThanOrEqual(rNode.voltageV);
    });

    it('terminal result exists for leaf node B', () => {
        const result = calculateBtRadial(makeLinearInput());
        const terminal = result.terminalResults.find((t) => t.nodeId === 'B');
        expect(terminal).toBeDefined();
    });

    it('bifurcation: root has two terminal results', () => {
        const input: BtRadialTopologyInput = {
            transformer: { id: 'TR75', rootNodeId: 'R', kva: 75, zPercent: 0.035, qtMt: 0 },
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
        };
        const result = calculateBtRadial(input);
        expect(result.terminalResults).toHaveLength(2);
    });

    it('qtSegment uses Ω/km with length conversion m->km', () => {
        const input = makeLinearInput({
            transformer: {
                id: 'TR225',
                rootNodeId: 'R',
                kva: 225,
                zPercent: 0,
                qtMt: 0,
            },
        });

        const result = calculateBtRadial(input);
        const aNode = result.nodeResults.find((n) => n.nodeId === 'A');
        expect(aNode).toBeDefined();

        const conductor = lookupConductorById('95 Al - Arm');
        expect(conductor).toBeDefined();

        const correctedResistance = calculateCorrectedResistance({
            resistance: conductor!.resistance,
            alpha: conductor!.alpha,
            divisorR: conductor!.divisorR,
            temperatureC: 75,
        });
        const impedance = Math.sqrt(
            correctedResistance ** 2 + conductor!.reactance ** 2,
        );
        const lengthKm = 50 / 1000;
        const expectedSegment =
            (1 * 15 * impedance * lengthKm) / (220 ** 2);

        expect(aNode!.qtSegment).toBeCloseTo(expectedSegment, 12);
    });
});

// ─── E3-H2: Terminal + ramal ──────────────────────────────────────────────────

describe('btRadialCalculationService – ramal at terminal (E3-H2)', () => {
    it('terminal without ramal has qtRamal == 0', () => {
        const result = calculateBtRadial(makeLinearInput());
        const terminal = result.terminalResults.find((t) => t.nodeId === 'B')!;
        expect(terminal.qtRamal).toBe(0);
        expect(terminal.ramalConductorId).toBeNull();
        expect(terminal.ramalLengthMeters).toBeNull();
    });

    it('terminal with ramal has qtRamal > 0', () => {
        const input = makeLinearInput();
        // Add ramal to B
        const bNode = input.nodes.find((n) => n.id === 'B')!;
        bNode.load.ramal = { conductorId: '16 Al_CONC_Tri', lengthMeters: 20 };

        const result = calculateBtRadial(input);
        const terminal = result.terminalResults.find((t) => t.nodeId === 'B')!;
        expect(terminal.qtRamal).toBeGreaterThan(0);
        expect(terminal.ramalConductorId).toBe('16 Al_CONC_Tri');
        expect(terminal.ramalLengthMeters).toBe(20);
    });

    it('qtTotal > qtTerminal when ramal is present', () => {
        const input = makeLinearInput();
        const bNode = input.nodes.find((n) => n.id === 'B')!;
        bNode.load.ramal = { conductorId: '16 Al_CONC_Tri', lengthMeters: 20 };

        const result = calculateBtRadial(input);
        const terminal = result.terminalResults.find((t) => t.nodeId === 'B')!;
        expect(terminal.qtTotal).toBeGreaterThan(terminal.qtTerminal);
    });

    it('voltageEndV is lower than voltageV at terminal node when ramal present', () => {
        const input = makeLinearInput();
        const bNode = input.nodes.find((n) => n.id === 'B')!;
        bNode.load.ramal = { conductorId: '16 Al_CONC_Tri', lengthMeters: 20 };

        const result = calculateBtRadial(input);
        const terminal = result.terminalResults.find((t) => t.nodeId === 'B')!;
        const nodeResult = result.nodeResults.find((n) => n.nodeId === 'B')!;
        expect(terminal.voltageEndV).toBeLessThanOrEqual(nodeResult.voltageV);
    });
});

// ─── E4-H1: Worst case and critical path ─────────────────────────────────────

describe('btRadialCalculationService – worst case (E4-H1)', () => {
    it('cqtGlobal is the maximum qtTotal across terminals', () => {
        const result = calculateBtRadial(makeLinearInput());
        const maxTerminalQt = Math.max(...result.terminalResults.map((t) => t.qtTotal));
        expect(result.worstCase.cqtGlobal).toBeCloseTo(maxTerminalQt, 12);
    });

    it('worstTerminalNodeId is the terminal with highest qtTotal', () => {
        const result = calculateBtRadial(makeLinearInput());
        const worst = result.terminalResults.reduce((a, b) => (a.qtTotal > b.qtTotal ? a : b));
        expect(result.worstCase.worstTerminalNodeId).toBe(worst.nodeId);
    });

    it('criticalPath includes transformer root', () => {
        const result = calculateBtRadial(makeLinearInput());
        expect(result.worstCase.criticalPath[0]).toBe('R');
    });

    it('criticalPath ends at worst terminal', () => {
        const result = calculateBtRadial(makeLinearInput());
        const { criticalPath, worstTerminalNodeId } = result.worstCase;
        expect(criticalPath[criticalPath.length - 1]).toBe(worstTerminalNodeId);
    });

    it('tie in qtTotal is resolved deterministically', () => {
        // Two equal branches — result must be stable
        const input: BtRadialTopologyInput = {
            transformer: { id: 'TR75', rootNodeId: 'R', kva: 75, zPercent: 0.035, qtMt: 0 },
            nodes: [
                { id: 'R', load: { localDemandKva: 0 } },
                { id: 'A', load: { localDemandKva: 10 } },
                { id: 'B', load: { localDemandKva: 10 } },
            ],
            edges: [
                { fromNodeId: 'R', toNodeId: 'A', conductorId: '95 Al - Arm', lengthMeters: 100 },
                { fromNodeId: 'R', toNodeId: 'B', conductorId: '95 Al - Arm', lengthMeters: 100 },
            ],
            phase: 'TRI',
            temperatureC: 75,
            nominalVoltageV: 220,
        };
        const r1 = calculateBtRadial(input);
        const r2 = calculateBtRadial(input);
        expect(r1.worstCase.worstTerminalNodeId).toBe(r2.worstCase.worstTerminalNodeId);
    });
});

// ─── E5-H1: Bottom-up demand ──────────────────────────────────────────────────

describe('btRadialCalculationService – demand accumulation (E5-H1)', () => {
    it('totalDemandKva equals sum of all node loads', () => {
        const result = calculateBtRadial(makeLinearInput());
        const expectedTotal = 0 + 10 + 5; // R + A + B
        expect(result.totalDemandKva).toBeCloseTo(expectedTotal, 10);
    });

    it('leaf node accumulated demand equals its local demand', () => {
        const result = calculateBtRadial(makeLinearInput());
        const bNode = result.nodeResults.find((n) => n.nodeId === 'B')!;
        expect(bNode.accumulatedDemandKva).toBeCloseTo(5, 10);
    });

    it('intermediate node accumulated demand equals local + children', () => {
        const result = calculateBtRadial(makeLinearInput());
        const aNode = result.nodeResults.find((n) => n.nodeId === 'A')!;
        // A local=10, B subtree=5
        expect(aNode.accumulatedDemandKva).toBeCloseTo(15, 10);
    });

    it('root node accumulated demand equals totalDemandKva', () => {
        const result = calculateBtRadial(makeLinearInput());
        const rootNode = result.nodeResults.find((n) => n.nodeId === 'R')!;
        expect(rootNode.accumulatedDemandKva).toBeCloseTo(result.totalDemandKva, 10);
    });
});

// ─── E5-H2: Consistency checks ────────────────────────────────────────────────

describe('btRadialCalculationService – consistency checks (E5-H2)', () => {
    it('valid input generates no error-level alerts', () => {
        const result = calculateBtRadial(makeLinearInput());
        const errorAlerts = result.consistencyAlerts.filter((a) => a.severity === 'error');
        expect(errorAlerts).toHaveLength(0);
    });

    it('each alert has code, message, severity', () => {
        const result = calculateBtRadial(makeLinearInput());
        for (const alert of result.consistencyAlerts) {
            expect(typeof alert.code).toBe('string');
            expect(typeof alert.message).toBe('string');
            expect(['error', 'warn']).toContain(alert.severity);
        }
    });

    it('extreme numerical input does not throw', () => {
        const input = makeLinearInput();
        input.nodes = [
            { id: 'R', load: { localDemandKva: 0 } },
            { id: 'A', load: { localDemandKva: 99999 } },
        ];
        input.edges = [{ fromNodeId: 'R', toNodeId: 'A', conductorId: '95 Al - Arm', lengthMeters: 1 }];
        input.transformer.kva = 30;
        expect(() => calculateBtRadial(input)).not.toThrow();
    });
});

// ─── Workbook parity: ESQ ATUAL baseline ─────────────────────────────────────

describe('btRadialCalculationService – workbook parity (ESQ ATUAL baseline)', () => {
    /**
     * From workbook DB sheet:
     * QT_MT = 0.0183, TR_ATUAL = 225 kVA, DEM_ATUAL = 101.956 kVA, Z% = 0.035
     * QT_TR = (101.956/225) * 0.035 = 0.015859822...
     * QT_MTTR = 0.0183 + 0.015859822... = 0.034159822...
     */
    const EXPECTED_QT_MTTR = 0.034159822222222222;

    it('qtTrafo matches workbook DB K10 (QT_MTTR) for 225 kVA scenario', () => {
        const input: BtRadialTopologyInput = {
            transformer: {
                id: 'TRAFO_225',
                rootNodeId: 'TRAFO',
                kva: 225,
                zPercent: 0.035,
                qtMt: 0.0183,
            },
            nodes: [
                { id: 'TRAFO', load: { localDemandKva: 0 } },
                { id: 'P1', load: { localDemandKva: 101.956 } },
            ],
            edges: [
                { fromNodeId: 'TRAFO', toNodeId: 'P1', conductorId: '95 Al - Arm', lengthMeters: 1 },
            ],
            phase: 'TRI',
            temperatureC: 75,
            nominalVoltageV: 220,
        };
        const result = calculateBtRadial(input);
        expect(result.qtTrafo).toBeCloseTo(EXPECTED_QT_MTTR, 10);
    });

    it('qtTrafo tolerance within 1e-4 relative (workbook parity gate)', () => {
        const input: BtRadialTopologyInput = {
            transformer: {
                id: 'TRAFO_225',
                rootNodeId: 'TRAFO',
                kva: 225,
                zPercent: 0.035,
                qtMt: 0.0183,
            },
            nodes: [
                { id: 'TRAFO', load: { localDemandKva: 0 } },
                { id: 'P1', load: { localDemandKva: 101.956 } },
            ],
            edges: [
                { fromNodeId: 'TRAFO', toNodeId: 'P1', conductorId: '95 Al - Arm', lengthMeters: 1 },
            ],
            phase: 'TRI',
            temperatureC: 75,
            nominalVoltageV: 220,
        };
        const result = calculateBtRadial(input);
        const relDiff = Math.abs(result.qtTrafo - EXPECTED_QT_MTTR) / EXPECTED_QT_MTTR;
        expect(relDiff).toBeLessThanOrEqual(1e-4);
    });
});
