/**
 * Análise Telescópica BT – REDE NOVA Intelligence
 *
 * Calcula o comprimento máximo por tipo de condutor (Lmax) e sugere
 * substituição telescópica de condutores no caminho trafo → ponta para
 * terminais com tensão final < 117 V.
 *
 * Regras elétricas não negociáveis:
 *   - Direção sempre trafo → ponta (nunca inverso).
 *   - Tensão mínima no ramal: 117 V.
 *   - Comprimento de ramal worst-case: 30 m.
 *   - Tensão de fase nominal: 127 V.
 */

import { CABOS_BASELINE, type CaboLookupRow } from '../../constants/cqtLookupTables.js';
import { computeQtSegment } from './btVoltage.js';
import type {
    BtRadialTopologyInput,
    BtRadialCalculationOutput,
    BtRadialPhase,
    BtRadialEdge,
} from './btTypes.js';
import type {
    TelescopicSuggestion,
    TelescopicPathEdge,
    TelescopicAnalysisOutput,
} from './btTypes.js';

// ─── Constantes elétricas não negociáveis ─────────────────────────────────────

const RAMAL_WORST_CASE_LENGTH_M = 30;
const RAMAL_VOLTAGE_MINIMUM_V = 117;
const PHASE_VOLTAGE_V = 127;

// Queda máxima total permitida (fração da tensão de fase)
const QT_MAX_ALLOWED = 1 - RAMAL_VOLTAGE_MINIMUM_V / PHASE_VOLTAGE_V;

// ─── Parâmetros de cálculo ────────────────────────────────────────────────────

export interface LmaxParams {
    demandaAcumuladaKva: number;
    phase: BtRadialPhase;
    temperaturaC: number;
    quedaDisponivel: number;
    tensaoFaseV?: number;
}

// ─── Lmax por condutor ────────────────────────────────────────────────────────

/**
 * Para cada condutor do catálogo, calcula o comprimento máximo de trecho
 * (em metros) que respeita o orçamento de queda de tensão disponível.
 *
 * Fórmula (inversão analítica de computeQtSegment):
 *   QT = phaseFactor × P_kVA × Z_Ω_km × L_m / V_fase²
 *   L_max = QT_budget × V_fase² / (phaseFactor × P_kVA × Z_Ω_km)
 *
 * Retorna Map<conductorId, maxLengthMeters>.
 */
export function calculateLmaxByConductor(params: LmaxParams): Map<string, number> {
    const {
        demandaAcumuladaKva,
        phase,
        temperaturaC,
        quedaDisponivel,
        tensaoFaseV = PHASE_VOLTAGE_V,
    } = params;
    const result = new Map<string, number>();

    if (demandaAcumuladaKva <= 0 || quedaDisponivel <= 0 || tensaoFaseV <= 0) {
        return result;
    }

    const conductors = getBaselineConductorsSortedDesc();
    for (const conductor of conductors) {
        const maxLengthMeters = invertLengthByQtBinarySearch({
            demandKva: demandaAcumuladaKva,
            conductor,
            temperatureC: temperaturaC,
            phase,
            phaseVoltageV: tensaoFaseV,
            targetQt: quedaDisponivel,
        });
        result.set(conductor.id, Math.max(0, maxLengthMeters));
    }

    return result;
}

// ─── Algoritmo telescópico ────────────────────────────────────────────────────

function getBaselineConductorsSortedDesc(): BaselineConductor[] {
    return [...CABOS_BASELINE]
        .map<BaselineConductor>((row) => ({
            id: row.name,
            ampacity: row.ampacity,
            resistance: row.resistance,
            reactance: row.reactance,
            alpha: row.alpha,
            divisorR: row.divisorR,
        }))
        .sort((a, b) => b.ampacity - a.ampacity);
}

function computeQtSegmentForConductor(
    demandKva: number,
    conductor: BaselineConductor,
    temperatureC: number,
    phase: BtRadialPhase,
    phaseVoltageV: number,
    lengthMeters: number,
): number {
    return computeQtSegment(
        demandKva,
        conductor,
        temperatureC,
        phase,
        phaseVoltageV,
        lengthMeters,
    );
}

interface InversionParams {
    demandKva: number;
    conductor: BaselineConductor;
    temperatureC: number;
    phase: BtRadialPhase;
    phaseVoltageV: number;
    targetQt: number;
}

function invertLengthByQtBinarySearch(params: InversionParams): number {
    if (params.demandKva <= 0 || params.targetQt <= 0) {
        return 0;
    }

    let low = 0;
    let high = 1;
    const maxSearchLength = 500_000;

    while (high < maxSearchLength) {
        const qtAtHigh = computeQtSegmentForConductor(
            params.demandKva,
            params.conductor,
            params.temperatureC,
            params.phase,
            params.phaseVoltageV,
            high,
        );
        if (qtAtHigh >= params.targetQt) {
            break;
        }
        high *= 2;
    }

    high = Math.min(high, maxSearchLength);

    for (let i = 0; i < 28; i++) {
        const mid = (low + high) / 2;
        const qtAtMid = computeQtSegmentForConductor(
            params.demandKva,
            params.conductor,
            params.temperatureC,
            params.phase,
            params.phaseVoltageV,
            mid,
        );
        if (qtAtMid <= params.targetQt) {
            low = mid;
        } else {
            high = mid;
        }
    }

    return low;
}

/**
 * Analisa caminhos telescópicos para todos os terminais reprovados (< 117 V).
 *
 * Para cada terminal reprovado:
 *   1. Extrai caminho trafo → terminal via pathFromRoot.
 *   2. Itera do trafo para a ponta (nunca inverso).
 *   3. Atribui condutores telescópicos (maior bitola próxima ao trafo).
 *   4. Simula queda de tensão acumulada com os condutores sugeridos.
 *
 * @param input    Topologia BT de entrada (mesma usada em calculateBtRadial).
 * @param output   Resultado do calculateBtRadial.
 */
export function analyzeTelescopicPaths(
    input: BtRadialTopologyInput,
    output: BtRadialCalculationOutput,
): TelescopicAnalysisOutput {
    const temperatureC = input.temperatureC ?? 75;
    const phase = input.phase;
    const phaseVoltageV = input.nominalVoltageV ?? PHASE_VOLTAGE_V;
    const trafoKva = input.transformer.kva;

    // Mapas de consulta rápida
    const nodeResultsByNodeId = new Map(output.nodeResults.map((nr) => [nr.nodeId, nr]));
    const edgesByKey = buildEdgeMap(input.edges);

    // Catálogo ordenado por ampacity DESC (maior bitola primeiro)
    const conductorsSortedDesc = getBaselineConductorsSortedDesc();

    // Terminais reprovados
    const failingTerminals = output.terminalResults.filter(
        (t) => t.voltageEndV < RAMAL_VOLTAGE_MINIMUM_V,
    );

    const suggestions: TelescopicSuggestion[] = [];

    for (const terminal of failingTerminals) {
        const terminalNodeResult = nodeResultsByNodeId.get(terminal.nodeId);
        if (!terminalNodeResult) continue;

        const pathNodeIds = terminalNodeResult.pathFromRoot;
        if (pathNodeIds.length < 2) continue;

        // Pré-calcula demanda acumulada em cada nó do caminho
        const demandAlongPath = pathNodeIds.map(
            (nid) => nodeResultsByNodeId.get(nid)?.accumulatedDemandKva ?? 0,
        );

        // Orçamento total disponível (subtrai queda do trafo já consumida)
        const totalBudget = QT_MAX_ALLOWED - output.qtTrafo;
        if (totalBudget <= 0) {
            // Orçamento esgotado pelo trafo — nenhuma substituição resolve
            suggestions.push(
                buildEmptySuggestion(
                    terminal.nodeId,
                    terminal.voltageEndV,
                    output.qtTrafo,
                    output.totalDemandKva,
                    trafoKva,
                ),
            );
            continue;
        }

        // Greedy telescópico trafo → ponta
        const pathEdges: TelescopicPathEdge[] = [];
        let accumulatedQt = output.qtTrafo;
        let maxAllowedAmpacity = Infinity; // garante monotonia decrescente

        for (let i = 0; i < pathNodeIds.length - 1; i++) {
            const fromId = pathNodeIds[i];
            const toId = pathNodeIds[i + 1];
            const edgeKey = `${fromId}|${toId}`;
            const edge = edgesByKey.get(edgeKey);
            if (!edge) continue;

            const segmentDemand = demandAlongPath[i + 1] ?? 0;
            const remainingBudget = totalBudget - (accumulatedQt - output.qtTrafo);

            // Filtra: apenas condutores com ampacity ≤ maxAllowedAmpacity (monotonia)
            const candidates = conductorsSortedDesc.filter(
                (c) => c.ampacity <= maxAllowedAmpacity,
            );

            // Escolhe o maior condutor cujo segmento cabe no orçamento restante
            const chosen = chooseBestConductor(
                candidates,
                segmentDemand,
                temperatureC,
                phase,
                phaseVoltageV,
                edge.lengthMeters,
                remainingBudget,
            );

            const qt = computeQtSegmentForConductor(
                segmentDemand,
                chosen,
                temperatureC,
                phase,
                phaseVoltageV,
                edge.lengthMeters,
            );
            accumulatedQt += qt;
            maxAllowedAmpacity = chosen.ampacity;

            pathEdges.push({
                edgeId: edge ? buildEdgeId(fromId, toId, input.edges) : `${fromId}-${toId}`,
                suggestedConductorId: chosen.id,
                lengthM: edge.lengthMeters,
            });
        }

        // Adiciona queda do ramal worst-case
        const ramalConductorId =
            terminal.ramalConductorId ?? conductorsSortedDesc[conductorsSortedDesc.length - 1].id;
        const ramalConductor = conductorsSortedDesc.find((c) => c.id === ramalConductorId)
            ?? conductorsSortedDesc[conductorsSortedDesc.length - 1];
        const qtRamal = computeQtSegmentForConductor(
            demandAlongPath[demandAlongPath.length - 1] ?? 0,
            ramalConductor,
            temperatureC,
            phase,
            phaseVoltageV,
            RAMAL_WORST_CASE_LENGTH_M,
        );

        const qtTotal = accumulatedQt + qtRamal;
        const projectedVoltageEndV = phaseVoltageV * (1 - qtTotal);
        const saturationPct = (output.totalDemandKva / trafoKva) * 100;

        suggestions.push({
            terminalNodeId: terminal.nodeId,
            currentVoltageEndV: terminal.voltageEndV,
            pathEdges,
            projectedVoltageEndV: Math.max(0, projectedVoltageEndV),
            saturationPct,
            requiresTransformerUpgrade: saturationPct > 100,
        });
    }

    // Lmax com demanda total da rede (pior caso global)
    const totalDemand = output.totalDemandKva;
    const lmaxMap = calculateLmaxByConductor({
        demandaAcumuladaKva: totalDemand > 0 ? totalDemand : 1,
        phase,
        temperaturaC: temperatureC,
        quedaDisponivel: totalBudget(output.qtTrafo),
        tensaoFaseV: phaseVoltageV,
    });

    const lmaxByConductor: Record<string, number> = {};
    for (const [id, len] of lmaxMap.entries()) {
        lmaxByConductor[id] = Math.round(len);
    }

    return { suggestions, lmaxByConductor };
}

// ─── Auxiliares ───────────────────────────────────────────────────────────────

function buildEdgeMap(edges: BtRadialEdge[]): Map<string, BtRadialEdge> {
    const map = new Map<string, BtRadialEdge>();
    for (const edge of edges) {
        map.set(`${edge.fromNodeId}|${edge.toNodeId}`, edge);
    }
    return map;
}

function buildEdgeId(from: string, to: string, edges: BtRadialEdge[]): string {
    const edge = edges.find((e) => e.fromNodeId === from && e.toNodeId === to);
    return edge ? `${edge.fromNodeId}->${edge.toNodeId}` : `${from}->${to}`;
}

/**
 * Escolhe o melhor condutor (maior ampacity) que cabe no orçamento restante.
 * Se nenhum cabe, retorna o menor disponível (fallback).
 */
function chooseBestConductor(
    candidates: BaselineConductor[],
    demandKva: number,
    temperatureC: number,
    phase: BtRadialPhase,
    phaseVoltageV: number,
    lengthMeters: number,
    remainingBudget: number,
): BaselineConductor {
    for (const conductor of candidates) {
        const qt = computeQtSegmentForConductor(
            demandKva,
            conductor,
            temperatureC,
            phase,
            phaseVoltageV,
            lengthMeters,
        );
        if (qt <= remainingBudget) {
            return conductor;
        }
    }
    // Fallback: menor condutor disponível (último, menor ampacity)
    return candidates[candidates.length - 1];
}

function buildEmptySuggestion(
    terminalNodeId: string,
    currentVoltageEndV: number,
    qtTrafo: number,
    totalDemandKva: number,
    trafoKva: number,
): TelescopicSuggestion {
    const saturationPct = trafoKva > 0 ? (totalDemandKva / trafoKva) * 100 : 0;
    return {
        terminalNodeId,
        currentVoltageEndV,
        pathEdges: [],
        projectedVoltageEndV: PHASE_VOLTAGE_V * (1 - qtTrafo),
        saturationPct,
        requiresTransformerUpgrade: saturationPct > 100,
    };
}

function totalBudget(qtTrafo: number): number {
    return Math.max(0, QT_MAX_ALLOWED - qtTrafo);
}

type BaselineConductor = CaboLookupRow & { id: string };
