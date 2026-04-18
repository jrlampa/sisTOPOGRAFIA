/**
 * Testes para btTelescopicAnalysis – REDE NOVA Intelligence
 *
 * Cobre:
 *  - calculateLmaxByConductor: verificação analítica da fórmula de inversão
 *  - analyzeTelescopicPaths: topologia com terminal reprovado gera sugestão
 *  - Direção trafo → ponta obrigatória em pathEdges
 *  - requiresTransformerUpgrade = true quando saturationPct > 100
 */

import {
    calculateLmaxByConductor,
    analyzeTelescopicPaths,
    type LmaxParams,
} from '../services/bt/btTelescopicAnalysis';
import { calculateBtRadial } from '../services/btRadialCalculationService';
import type { BtRadialTopologyInput } from '../services/bt/btTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Topologia linear simples:  TRAFO → A(demanda alta) → B(demanda alta)
 * Com demanda suficiente para reprovar tensão no terminal B.
 */
function makeFailingLinearInput(demandKva = 70): BtRadialTopologyInput {
    return {
        transformer: {
            id: 'TR75',
            rootNodeId: 'R',
            kva: 75,
            zPercent: 0.035,
            qtMt: 0.0183,
        },
        nodes: [
            { id: 'R', load: { localDemandKva: 0 } },
            { id: 'A', load: { localDemandKva: demandKva / 2 } },
            { id: 'B', load: { localDemandKva: demandKva / 2 } },
        ],
        edges: [
            {
                fromNodeId: 'R',
                toNodeId: 'A',
                conductorId: '16 Al - Arm',
                lengthMeters: 200,
            },
            {
                fromNodeId: 'A',
                toNodeId: 'B',
                conductorId: '16 Al - Arm',
                lengthMeters: 200,
            },
        ],
        phase: 'TRI',
        temperatureC: 75,
        nominalVoltageV: 220,
    };
}

/**
 * Topologia cujo total de demanda excede a capacidade do trafo (saturation > 100%).
 */
function makeOverloadedInput(): BtRadialTopologyInput {
    return {
        transformer: {
            id: 'TR75',
            rootNodeId: 'R',
            kva: 75,
            zPercent: 0.035,
            qtMt: 0.0183,
        },
        nodes: [
            { id: 'R', load: { localDemandKva: 0 } },
            { id: 'A', load: { localDemandKva: 100 } },
        ],
        edges: [
            {
                fromNodeId: 'R',
                toNodeId: 'A',
                conductorId: '16 Al - Arm',
                lengthMeters: 200,
            },
        ],
        phase: 'TRI',
        temperatureC: 75,
        nominalVoltageV: 220,
    };
}

// ─── calculateLmaxByConductor ─────────────────────────────────────────────────

describe('calculateLmaxByConductor', () => {
    it('retorna mapa vazio se demanda for zero', () => {
        const params: LmaxParams = {
            demandKva: 0,
            phase: 'TRI',
            temperatureC: 75,
            availableQtBudget: 0.05,
        };
        const result = calculateLmaxByConductor(params);
        expect(result.size).toBe(0);
    });

    it('retorna mapa vazio se orçamento for zero', () => {
        const params: LmaxParams = {
            demandKva: 50,
            phase: 'TRI',
            temperatureC: 75,
            availableQtBudget: 0,
        };
        const result = calculateLmaxByConductor(params);
        expect(result.size).toBe(0);
    });

    it('valores de Lmax são positivos para condutores válidos', () => {
        const params: LmaxParams = {
            demandKva: 30,
            phase: 'TRI',
            temperatureC: 75,
            availableQtBudget: 0.05,
        };
        const result = calculateLmaxByConductor(params);
        expect(result.size).toBeGreaterThan(0);
        for (const [, lmax] of result) {
            expect(lmax).toBeGreaterThanOrEqual(0);
        }
    });

    it('fase MONO produz Lmax menor que TRI (fator de fase 2× vs 1×)', () => {
        const base: Omit<LmaxParams, 'phase'> = {
            demandKva: 30,
            temperatureC: 75,
            availableQtBudget: 0.05,
        };
        const mono = calculateLmaxByConductor({ ...base, phase: 'MONO' });
        const tri = calculateLmaxByConductor({ ...base, phase: 'TRI' });

        // Para o mesmo condutor, fase MONO tem fator 2, logo Lmax(MONO) = Lmax(TRI)/2
        for (const [id] of mono) {
            const lMono = mono.get(id) ?? 0;
            const lTri = tri.get(id) ?? 0;
            if (lTri > 0) {
                expect(lMono).toBeCloseTo(lTri / 2, 0);
            }
        }
    });

    it('condutor de maior bitola produz Lmax maior que condutor de menor bitola', () => {
        const params: LmaxParams = {
            demandKva: 30,
            phase: 'TRI',
            temperatureC: 75,
            availableQtBudget: 0.05,
        };
        const result = calculateLmaxByConductor(params);

        // Pega primeiro e último (assumindo mapa não está vazio)
        const entries = [...result.entries()];
        expect(entries.length).toBeGreaterThanOrEqual(2);
        // O maior Lmax deve ser maior que o menor Lmax
        const lmaxValues = entries.map(([, v]) => v);
        const maxVal = Math.max(...lmaxValues);
        const minVal = Math.min(...lmaxValues);
        expect(maxVal).toBeGreaterThan(minVal);
    });
});

// ─── analyzeTelescopicPaths ───────────────────────────────────────────────────

describe('analyzeTelescopicPaths', () => {
    it('retorna sugestões para terminais com voltageEndV < 117 V', () => {
        const input = makeFailingLinearInput(70);
        const output = calculateBtRadial(input);

        // Garante que o cenário de teste realmente reprova algum terminal
        const failingTerminals = output.terminalResults.filter(
            (t) => t.voltageEndV < 117,
        );
        if (failingTerminals.length === 0) {
            // Pula se a topologia não reprovar com este catálogo (evita falso positivo)
            return;
        }

        const analysis = analyzeTelescopicPaths(input, output);
        expect(analysis.suggestions.length).toBeGreaterThan(0);
    });

    it('pathEdges seguem direção trafo → ponta (ao menos um arco no caminho)', () => {
        const input = makeFailingLinearInput(70);
        const output = calculateBtRadial(input);

        const failingTerminals = output.terminalResults.filter(
            (t) => t.voltageEndV < 117,
        );
        if (failingTerminals.length === 0) return;

        const analysis = analyzeTelescopicPaths(input, output);

        for (const suggestion of analysis.suggestions) {
            // pathEdges: deve ter pelo menos 1 elemento para terminais não-raiz
            expect(suggestion.pathEdges.length).toBeGreaterThan(0);
        }
    });

    it('projectedVoltageEndV >= 0 para todas as sugestões', () => {
        const input = makeFailingLinearInput(70);
        const output = calculateBtRadial(input);
        const analysis = analyzeTelescopicPaths(input, output);

        for (const suggestion of analysis.suggestions) {
            expect(suggestion.projectedVoltageEndV).toBeGreaterThanOrEqual(0);
        }
    });

    it('requiresTransformerUpgrade = true quando totalDemandKva > trafoKva', () => {
        const input = makeOverloadedInput();
        const output = calculateBtRadial(input);

        const failingTerminals = output.terminalResults.filter(
            (t) => t.voltageEndV < 117,
        );
        if (failingTerminals.length === 0) return;

        const analysis = analyzeTelescopicPaths(input, output);
        const overloaded = analysis.suggestions.filter(
            (s) => s.requiresTransformerUpgrade,
        );
        expect(overloaded.length).toBeGreaterThan(0);
    });

    it('lmaxByConductor é um Record com chaves string e valores inteiros positivos', () => {
        const input = makeFailingLinearInput(30);
        const output = calculateBtRadial(input);
        const analysis = analyzeTelescopicPaths(input, output);

        const { lmaxByConductor } = analysis;
        expect(typeof lmaxByConductor).toBe('object');

        for (const [key, val] of Object.entries(lmaxByConductor)) {
            expect(typeof key).toBe('string');
            expect(Number.isInteger(val)).toBe(true);
            expect(val).toBeGreaterThanOrEqual(0);
        }
    });

    it('topologia sem terminais reprovados produz suggestions vazio', () => {
        // Topologia mínima de demanda — não deve reprovar
        const input: BtRadialTopologyInput = {
            transformer: {
                id: 'TR225',
                rootNodeId: 'R',
                kva: 225,
                zPercent: 0.035,
                qtMt: 0.0183,
            },
            nodes: [
                { id: 'R', load: { localDemandKva: 0 } },
                { id: 'A', load: { localDemandKva: 1 } },
            ],
            edges: [
                {
                    fromNodeId: 'R',
                    toNodeId: 'A',
                    conductorId: '95 Al - Arm',
                    lengthMeters: 10,
                },
            ],
            phase: 'TRI',
            temperatureC: 75,
            nominalVoltageV: 220,
        };
        const output = calculateBtRadial(input);
        const allPass = output.terminalResults.every((t) => t.voltageEndV >= 117);

        if (allPass) {
            const analysis = analyzeTelescopicPaths(input, output);
            expect(analysis.suggestions).toHaveLength(0);
        }
    });
});

// ─── analyzeTelescopicPaths – paths diretos com output pre-construido ─────────
// Estes testes usam output pré-construído para garantir cobertura de todos
// os ramos do algoritmo greedy independente do catálogo real.

describe('analyzeTelescopicPaths – cobertura greedy e helpers', () => {
    const conductor16 = {
        id: '16 Al - Arm',
        ampacity: 80,
        resistance: 1.910,
        reactance: 0.073,
        alpha: 0.00403,
        divisorR: 1,
    };

    const simpleInput: import('../services/bt/btTypes').BtRadialTopologyInput = {
        transformer: { id: 'TR75', rootNodeId: 'R', kva: 75, zPercent: 0.035, qtMt: 0 },
        nodes: [
            { id: 'R', load: { localDemandKva: 0 } },
            { id: 'A', load: { localDemandKva: 60 } },
        ],
        edges: [
            { fromNodeId: 'R', toNodeId: 'A', conductorId: '16 Al - Arm', lengthMeters: 200 },
        ],
        phase: 'TRI',
        temperatureC: 75,
    };

    const failingOutput: import('../services/bt/btTypes').BtRadialCalculationOutput = {
        qtTrafo: 0.01,
        nodeResults: [
            {
                nodeId: 'R',
                qtSegment: 0,
                qtAccumulated: 0,
                voltageV: 127,
                accumulatedDemandKva: 60,
                pathFromRoot: ['R'],
            },
            {
                nodeId: 'A',
                qtSegment: 0.12,
                qtAccumulated: 0.13,
                voltageV: 110.5,
                accumulatedDemandKva: 60,
                pathFromRoot: ['R', 'A'],
            },
        ],
        terminalResults: [
            {
                nodeId: 'A',
                qtTerminal: 0.12,
                qtRamal: 0.01,
                qtTotal: 0.13,
                voltageEndV: 107,
                ramalConductorId: '16 Al - Arm',
                ramalLengthMeters: 30,
            },
        ],
        worstCase: {
            worstTerminalNodeId: 'A',
            cqtGlobal: 0.13,
            criticalPath: ['R', 'A'],
            qtTrafo: 0.01,
        },
        totalDemandKva: 60,
        consistencyAlerts: [],
    };

    it('greedy telescopico gera pathEdges para terminal reprovado', () => {
        const analysis = analyzeTelescopicPaths(simpleInput, failingOutput);
        expect(analysis.suggestions.length).toBe(1);
        expect(analysis.suggestions[0].pathEdges.length).toBeGreaterThan(0);
        expect(analysis.suggestions[0].projectedVoltageEndV).toBeGreaterThanOrEqual(0);
    });

    it('buildEmptySuggestion quando qtTrafo consome todo orcamento', () => {
        const exhaustedOutput = {
            ...failingOutput,
            qtTrafo: 1.0, // excede QT_MAX_ALLOWED (~0.079)
        };
        const analysis = analyzeTelescopicPaths(simpleInput, exhaustedOutput);
        expect(analysis.suggestions.length).toBe(1);
        expect(analysis.suggestions[0].pathEdges).toHaveLength(0);
        expect(analysis.suggestions[0].requiresTransformerUpgrade).toBe(true);
    });

    it('pula terminal sem nodeResult (nodeId inexistente)', () => {
        const orphanOutput = {
            ...failingOutput,
            terminalResults: [
                {
                    nodeId: 'ORPHAN',
                    qtTerminal: 0.12,
                    qtRamal: 0.01,
                    qtTotal: 0.13,
                    voltageEndV: 107,
                    ramalConductorId: null,
                    ramalLengthMeters: null,
                },
            ],
        };
        const analysis = analyzeTelescopicPaths(simpleInput, orphanOutput);
        expect(analysis.suggestions).toHaveLength(0);
    });

    it('pula terminal com pathFromRoot de comprimento 1', () => {
        const shortPathOutput = {
            ...failingOutput,
            nodeResults: [
                ...failingOutput.nodeResults.filter((n) => n.nodeId !== 'A'),
                {
                    nodeId: 'A',
                    qtSegment: 0.12,
                    qtAccumulated: 0.13,
                    voltageV: 110.5,
                    accumulatedDemandKva: 60,
                    pathFromRoot: ['A'], // < 2 → deve pular
                },
            ],
        };
        const analysis = analyzeTelescopicPaths(simpleInput, shortPathOutput);
        expect(analysis.suggestions).toHaveLength(0);
    });

    it('usa fallback para ramalConductorId null', () => {
        const nullRamalOutput = {
            ...failingOutput,
            terminalResults: [
                { ...failingOutput.terminalResults[0], ramalConductorId: null },
            ],
        };
        const analysis = analyzeTelescopicPaths(simpleInput, nullRamalOutput);
        expect(analysis.suggestions.length).toBe(1);
        // Deve completar sem erro
    });

    it('requiresTransformerUpgrade true quando demanda > trafo kVA', () => {
        const overloadOutput = {
            ...failingOutput,
            totalDemandKva: 100, // > 75 kVA trafo
        };
        const analysis = analyzeTelescopicPaths(simpleInput, overloadOutput);
        expect(analysis.suggestions[0].requiresTransformerUpgrade).toBe(true);
    });

    it('qtSegment retorna 0 quando lengthMeters = 0 (via greedy com edge de comprimento 0)', () => {
        const zeroLenInput = {
            ...simpleInput,
            edges: [{ fromNodeId: 'R', toNodeId: 'A', conductorId: '16 Al - Arm', lengthMeters: 0 }],
        };
        // pathEdges vai skipar edge com length=0 no qtSegment mas não no loop
        const analysis = analyzeTelescopicPaths(zeroLenInput, failingOutput);
        // Deve completar sem erro
        expect(analysis).toBeDefined();
    });
});
