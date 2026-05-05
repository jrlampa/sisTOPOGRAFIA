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

import { calculateCorrectedResistance } from "../cqtEngine.js";
import { getBtCatalog } from "../btCatalogService.js";
import type { BtConductorEntry } from "../btCatalogService.js";
import type {
  BtRadialTopologyInput,
  BtRadialCalculationOutput,
  BtRadialPhase,
  BtRadialEdge,
} from "./btTypes.js";
import type {
  TelescopicSuggestion,
  TelescopicPathEdge,
  TelescopicAnalysisOutput,
} from "./btTypes.js";

// ─── Constantes elétricas não negociáveis ─────────────────────────────────────

const RAMAL_WORST_CASE_LENGTH_M = 30;
const RAMAL_VOLTAGE_MINIMUM_V = 117;
const PHASE_VOLTAGE_V = 127;

// Queda máxima total permitida (fração da tensão de fase)
const QT_MAX_ALLOWED = 1 - RAMAL_VOLTAGE_MINIMUM_V / PHASE_VOLTAGE_V;

// ─── Parâmetros de cálculo ────────────────────────────────────────────────────

export interface LmaxParams {
  demandKva: number;
  phase: BtRadialPhase;
  temperatureC: number;
  availableQtBudget: number;
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
export function calculateLmaxByConductor(
  params: LmaxParams,
): Map<string, number> {
  const { demandKva, phase, temperatureC, availableQtBudget } = params;
  const result = new Map<string, number>();

  if (demandKva <= 0 || availableQtBudget <= 0) {
    return result;
  }

  const catalog = getBtCatalog();
  const phaseFactor = phase === "MONO" ? 2 : 1;

  for (const conductor of catalog.conductors) {
    const rCorr = calculateCorrectedResistance({
      resistance: conductor.resistance,
      alpha: conductor.alpha,
      divisorR: conductor.divisorR,
      temperatureC,
    });
    const impedancePerKm = Math.sqrt(rCorr ** 2 + conductor.reactance ** 2);

    if (impedancePerKm <= 0) {
      result.set(conductor.id, 0);
      continue;
    }

    // L_max em metros (impedance em Ω/km, então converter: Ω = impedancePerKm × L_km)
    // QT = phaseFactor × P × impedancePerKm × L_m / (1000 × V²)  [L em m → /1000 para km]
    // L_max = QT_budget × V² × 1000 / (phaseFactor × P × impedancePerKm)
    const lMaxMeters =
      (availableQtBudget * PHASE_VOLTAGE_V ** 2 * 1000) /
      (phaseFactor * demandKva * impedancePerKm);

    result.set(conductor.id, Math.max(0, lMaxMeters));
  }

  return result;
}

// ─── Algoritmo telescópico ────────────────────────────────────────────────────

/**
 * Computa a queda QT de um segmento com o condutor especificado.
 * (inline para evitar dependência circular com btVoltage)
 */
function qtSegment(
  demandKva: number,
  conductor: BtConductorEntry,
  temperatureC: number,
  phase: BtRadialPhase,
  lengthMeters: number,
): number {
  if (lengthMeters <= 0 || demandKva <= 0) return 0;
  const rCorr = calculateCorrectedResistance({
    resistance: conductor.resistance,
    alpha: conductor.alpha,
    divisorR: conductor.divisorR,
    temperatureC,
  });
  const impedance = Math.sqrt(rCorr ** 2 + conductor.reactance ** 2);
  const phaseFactor = phase === "MONO" ? 2 : 1;
  return (
    (phaseFactor * demandKva * impedance * lengthMeters) /
    (1000 * PHASE_VOLTAGE_V ** 2)
  );
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
  const trafoKva = input.transformer.kva;

  // Mapas de consulta rápida
  const nodeResultsByNodeId = new Map(
    output.nodeResults.map((nr) => [nr.nodeId, nr]),
  );
  const edgesByKey = buildEdgeMap(input.edges);

  // Catálogo ordenado por ampacity DESC (maior bitola primeiro)
  const catalog = getBtCatalog();
  const conductorsSortedDesc = [...catalog.conductors].sort(
    (a, b) => b.ampacity - a.ampacity,
  );

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
        buildEmptySuggestion(terminal.nodeId, output.qtTrafo, trafoKva),
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
        edge.lengthMeters,
        remainingBudget,
      );

      const qt = qtSegment(
        segmentDemand,
        chosen,
        temperatureC,
        phase,
        edge.lengthMeters,
      );
      accumulatedQt += qt;
      maxAllowedAmpacity = chosen.ampacity;

      pathEdges.push({
        edgeId: edge ? `${fromId}->${toId}` : `${fromId}-${toId}`,
        suggestedConductorId: chosen.id,
        lengthM: edge.lengthMeters,
      });
    }

    // Adiciona queda do ramal worst-case
    const ramalConductorId =
      terminal.ramalConductorId ??
      conductorsSortedDesc[conductorsSortedDesc.length - 1].id;
    const ramalConductor =
      catalog.conductors.find((c) => c.id === ramalConductorId) ??
      conductorsSortedDesc[conductorsSortedDesc.length - 1];
    const qtRamal = qtSegment(
      demandAlongPath[demandAlongPath.length - 1] ?? 0,
      ramalConductor,
      temperatureC,
      phase,
      RAMAL_WORST_CASE_LENGTH_M,
    );

    const qtTotal = accumulatedQt + qtRamal;
    const projectedVoltageEndV = PHASE_VOLTAGE_V * (1 - qtTotal);
    const saturationPct = (output.totalDemandKva / trafoKva) * 100;

    suggestions.push({
      terminalNodeId: terminal.nodeId,
      pathEdges,
      projectedVoltageEndV: Math.max(0, projectedVoltageEndV),
      saturationPct,
      requiresTransformerUpgrade: saturationPct > 100,
    });
  }

  // Lmax com demanda total da rede (pior caso global)
  const totalDemand = output.totalDemandKva;
  const lmaxMap = calculateLmaxByConductor({
    demandKva: totalDemand > 0 ? totalDemand : 1,
    phase,
    temperatureC,
    availableQtBudget: totalBudget(output.qtTrafo),
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

/**
 * Escolhe o melhor condutor (maior ampacity) que cabe no orçamento restante.
 * Se nenhum cabe, retorna o menor disponível (fallback).
 */
function chooseBestConductor(
  candidates: BtConductorEntry[],
  demandKva: number,
  temperatureC: number,
  phase: BtRadialPhase,
  lengthMeters: number,
  remainingBudget: number,
): BtConductorEntry {
  for (const conductor of candidates) {
    const qt = qtSegment(
      demandKva,
      conductor,
      temperatureC,
      phase,
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
  qtTrafo: number,
  _trafoKva: number,
): TelescopicSuggestion {
  return {
    terminalNodeId,
    pathEdges: [],
    projectedVoltageEndV: PHASE_VOLTAGE_V * (1 - qtTrafo),
    saturationPct: 100,
    requiresTransformerUpgrade: true,
  };
}

function totalBudget(qtTrafo: number): number {
  return Math.max(0, QT_MAX_ALLOWED - qtTrafo);
}
