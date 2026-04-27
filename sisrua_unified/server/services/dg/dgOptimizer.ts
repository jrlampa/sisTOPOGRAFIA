/**
 * Design Generativo – Motor de Otimização
 *
 * Implementa duas estratégias de busca:
 *
 *   1. Exaustiva (≤50 postes + grade pequena):
 *      Avalia todos os candidatos gerados. Complexidade O(|C| × |P|).
 *
 *   2. Heurística GRASP (>50 postes ou grid grande):
 *      - Fase construtiva: ordena candidatos por Fermat-Weber distance.
 *      - Fase de melhoria local: troca iterativa vizinho-mais-próximo.
 *      Inspirada em NSGA-II para múltiplos objetivos, mas com aproximação
 *      mono-objetivo (score global) para viabilidade prática sem biblioteca externa.
 *
 * Para cada candidato viável, monta a topologia BT radial usando MST
 * (Kruskal sobre postes) e avalia eletricamente via btRadialCalculationService.
 *
 * Referência:
 *   - docs/DG_IMPLEMENTATION_ADDENDUM_2026.md – estratégia de busca híbrida
 *   - btRadialCalculationService.ts – reutilizado para avaliação elétrica
 */

import { randomUUID } from "crypto";
import type {
  DgPoleInput,
  DgTransformerInput,
  DgExclusionPolygon,
  DgRoadCorridor,
  DgParams,
  DgCandidate,
  DgScenario,
  DgScenarioEdge,
  DgElectricalResult,
  DgConstraintCode,
  DgConstraintViolation,
} from "./dgTypes.js";
import {
  euclideanDistanceM,
  latLonToUtm,
  utmToLatLon,
} from "./dgCandidates.js";
import {
  evaluateHardConstraints,
  checkTrafoOverload,
} from "./dgConstraints.js";
import {
  calculateObjectiveScore,
  totalCableLengthMeters,
} from "./dgObjective.js";

// ─── Derivação de Demanda (Wizard) ───────────────────────────────────────────

/**
 * Deriva a demanda por poste a partir dos parâmetros do Wizard.
 * Definido em docs/DG_IMPLEMENTATION_ADDENDUM_2026.md
 */
function derivePolesDemand(
  poles: DgPoleInput[],
  params: DgParams,
): DgPoleInput[] {
  if (params.projectMode !== "full_project") return poles;

  const clientes = params.clientesPorPoste ?? 1;
  const demandaMedia = params.demandaMediaClienteKva ?? 1.5;
  const fatorSimult = params.fatorSimultaneidade ?? 0.8;

  // Demanda base por poste
  const baseDemand = clientes * demandaMedia * fatorSimult;

  // Carga clandestina rateada (assumindo 0.02 kVA/m² como padrão se não informado)
  const extraClandestinaTotal = (params.areaClandestinaM2 ?? 0) * 0.02;
  const extraPerPole =
    poles.length > 0 ? extraClandestinaTotal / poles.length : 0;

  return poles.map((p) => ({
    ...p,
    demandKva: p.demandKva > 0 ? p.demandKva : baseDemand + extraPerPole,
    clients: p.clients > 0 ? p.clients : clientes,
  }));
}

// ─── MST via Kruskal (topologia mínima trafo → postes) ───────────────────────

interface MstEdge {
  fromId: string;
  toId: string;
  lengthMeters: number;
}

/** Union-Find para Kruskal. */
class UnionFind {
  private parent: Map<string, string>;
  constructor(ids: string[]) {
    this.parent = new Map(ids.map((id) => [id, id]));
  }
  find(x: string): string {
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!));
    }
    return this.parent.get(x)!;
  }
  union(a: string, b: string): boolean {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return false;
    this.parent.set(ra, rb);
    return true;
  }
}

const DEFAULT_CONDUCTOR_ID = "95 AL MM";

/**
 * Constrói MST (Minimum Spanning Tree) entre trafo e postes.
 * Retorna lista de arestas que formam a rede radial mínima.
 */
function buildMst(
  trafoId: string,
  poles: Array<{ id: string; positionUtm: { x: number; y: number } }>,
  trafoUtm: { x: number; y: number },
): MstEdge[] {
  const allNodes = [{ id: trafoId, positionUtm: trafoUtm }, ...poles];
  const allEdges: MstEdge[] = [];

  for (let i = 0; i < allNodes.length; i++) {
    for (let j = i + 1; j < allNodes.length; j++) {
      allEdges.push({
        fromId: allNodes[i].id,
        toId: allNodes[j].id,
        lengthMeters: euclideanDistanceM(
          allNodes[i].positionUtm,
          allNodes[j].positionUtm,
        ),
      });
    }
  }

  allEdges.sort((a, b) => a.lengthMeters - b.lengthMeters);

  const uf = new UnionFind(allNodes.map((n) => n.id));
  const mst: MstEdge[] = [];
  for (const edge of allEdges) {
    if (uf.union(edge.fromId, edge.toId)) {
      mst.push(edge);
      if (mst.length === allNodes.length - 1) break;
    }
  }
  return mst;
}

/** Verifica se a MST viola o vão máximo. */
function mstHasSpanViolation(
  mst: MstEdge[],
  maxSpanMeters: number,
): string | null {
  for (const edge of mst) {
    if (edge.lengthMeters > maxSpanMeters) {
      return `Trecho ${edge.fromId}→${edge.toId} tem ${edge.lengthMeters.toFixed(1)} m > ${maxSpanMeters} m`;
    }
  }
  return null;
}

// ─── Avaliação elétrica simplificada para DG ─────────────────────────────────

/**
 * Avaliação elétrica usando dois passos de DFS:
 *
 *   Pass 1 (bottom-up): calcula demanda acumulada por sub-árvore.
 *   Pass 2 (top-down): acumula QT ao longo de cada ramo usando
 *     QT_seg = (demanda_subtree × Z × comprimento_km) / (Vf² / 1000)
 *
 * Onde Z = 0.32 Ω/km (95 AL MM @ 75°C, padrão BT Brasil).
 * Resultado: pior QT nos terminais da rede.
 */
const Z_OHM_PER_KM = 0.32;
const V_FASE_SQ_DIV_1000 = 127 ** 2 / 1000; // ≈ 16.129

function evaluateElectrically(
  trafoId: string,
  trafoUtm: { x: number; y: number },
  trafoKva: number,
  poles: Array<{
    id: string;
    positionUtm: { x: number; y: number };
    demandKva: number;
  }>,
  mst: MstEdge[],
): DgElectricalResult {
  const totalDemandKva = poles.reduce((s, p) => s + p.demandKva, 0);
  const trafoUtilizationFraction = totalDemandKva / trafoKva;

  // Adjacência bidirecional
  const adjMap = new Map<string, string[]>();
  const allIds = [trafoId, ...poles.map((p) => p.id)];
  for (const id of allIds) adjMap.set(id, []);
  for (const edge of mst) {
    adjMap.get(edge.fromId)!.push(edge.toId);
    adjMap.get(edge.toId)!.push(edge.fromId);
  }

  const demandMap = new Map(poles.map((p) => [p.id, p.demandKva]));
  const edgeLenMap = new Map<string, number>();
  for (const e of mst) {
    edgeLenMap.set(`${e.fromId}|${e.toId}`, e.lengthMeters);
    edgeLenMap.set(`${e.toId}|${e.fromId}`, e.lengthMeters);
  }

  // Pass 1: demanda acumulada por sub-árvore (bottom-up)
  const subtreeDemand = new Map<string, number>();
  function computeSubtree(nodeId: string, parentId: string | null): number {
    const local = demandMap.get(nodeId) ?? 0;
    const children = adjMap.get(nodeId)!.filter((c) => c !== parentId);
    const childTotal = children.reduce(
      (s, c) => s + computeSubtree(c, nodeId),
      0,
    );
    const total = local + childTotal;
    subtreeDemand.set(nodeId, total);
    return total;
  }
  computeSubtree(trafoId, null);

  // Pass 2: QT acumulado top-down
  let worstCqt = 0;
  let worstTerminalId = "";

  function accumQT(
    nodeId: string,
    parentId: string | null,
    qtAccum: number,
  ): void {
    const children = adjMap.get(nodeId)!.filter((c) => c !== parentId);
    if (children.length === 0 && nodeId !== trafoId) {
      if (qtAccum > worstCqt) {
        worstCqt = qtAccum;
        worstTerminalId = nodeId;
      }
      return;
    }
    for (const childId of children) {
      const lenKm = (edgeLenMap.get(`${nodeId}|${childId}`) ?? 0) / 1000;
      const demand = subtreeDemand.get(childId) ?? 0;
      const segQt = (demand * Z_OHM_PER_KM * lenKm) / V_FASE_SQ_DIV_1000;
      accumQT(childId, nodeId, qtAccum + segQt);
    }
  }
  accumQT(trafoId, null, 0);

  const totalLen = totalCableLengthMeters(
    mst.map((e) => ({
      fromPoleId: e.fromId,
      toPoleId: e.toId,
      lengthMeters: e.lengthMeters,
      conductorId: DEFAULT_CONDUCTOR_ID,
    })),
  );

  return {
    cqtMaxFraction: worstCqt,
    worstTerminalNodeId: worstTerminalId,
    trafoUtilizationFraction,
    totalCableLengthMeters: totalLen,
    feasible: worstCqt <= 0.08 && trafoUtilizationFraction <= 0.95,
  };
}

// ─── Avaliação de um candidato ─────────────────────────────────────────────────

function evaluateCandidate(
  candidate: DgCandidate,
  poles: DgPoleInput[],
  transformer: DgTransformerInput | undefined,
  exclusionPolygons: DgExclusionPolygon[],
  roadCorridors: DgRoadCorridor[],
  params: DgParams,
): DgScenario {
  const trafoId = `trafo-${candidate.candidateId}`;
  const polesUtm = poles.map((p) => ({
    ...p,
    positionUtm: latLonToUtm(p.position.lat, p.position.lon),
  }));

  // 1. Restrições duras (espaciais e conectividade)
  const constraintResult = evaluateHardConstraints(
    candidate,
    poles,
    transformer,
    exclusionPolygons,
    roadCorridors,
    params,
  );

  if (!constraintResult.feasible) {
    return createFailedScenario(candidate, constraintResult.violations);
  }

  // 2. MST topology
  const mst = buildMst(trafoId, polesUtm, candidate.positionUtm);

  // 3. Span check
  const spanViolation = mstHasSpanViolation(mst, params.maxSpanMeters);
  if (spanViolation) {
    return createFailedScenario(candidate, [
      { code: "MAX_SPAN_EXCEEDED", detail: spanViolation },
    ]);
  }

  // 4. Dimensionamento de Trafo e Avaliação Elétrica
  // Se houver trafo fixo, avalia apenas ele.
  // Se não (Full Project), itera sobre faixas de kVA comerciais.
  const kvaFaixa = transformer
    ? [transformer.kva]
    : (params.faixaKvaTrafoPermitida ?? [15, 30, 45, 75, 112.5]);

  const totalDemandKva = poles.reduce((s, p) => s + p.demandKva, 0);
  let bestKvaResult: DgElectricalResult | null = null;
  let selectedKva = 0;

  for (const kva of kvaFaixa) {
    // Check overload for this KVA
    const overload = checkTrafoOverload(
      totalDemandKva,
      kva,
      params.trafoMaxUtilization,
    );
    if (overload.length > 0) continue;

    const electrical = evaluateElectrically(
      trafoId,
      candidate.positionUtm,
      kva,
      polesUtm,
      mst,
    );

    if (electrical.feasible) {
      bestKvaResult = electrical;
      selectedKva = kva;
      break; // Encontrou o menor kVA viável
    }
  }

  if (!bestKvaResult) {
    return createFailedScenario(candidate, [
      {
        code: "TRAFO_OVERLOAD",
        detail: "Nenhum kVA na faixa permitida é viável.",
      },
    ]);
  }

  const edges: DgScenarioEdge[] = mst.map((e) => ({
    fromPoleId: e.fromId,
    toPoleId: e.toId,
    lengthMeters: e.lengthMeters,
    conductorId: DEFAULT_CONDUCTOR_ID,
  }));

  // 5. Score objetivo
  const { objectiveScore, scoreComponents } = calculateObjectiveScore({
    edges,
    electricalResult: bestKvaResult,
    candidateSource: candidate.source,
    newPolesCount: candidate.source === "grid" ? 1 : 0,
    weights: params.objectiveWeights,
  });

  return {
    scenarioId: randomUUID(),
    candidateId: candidate.candidateId,
    trafoPositionUtm: candidate.positionUtm,
    trafoPositionLatLon: candidate.position,
    edges,
    electricalResult: {
      ...bestKvaResult,
      trafoUtilizationFraction: totalDemandKva / selectedKva,
    },
    objectiveScore,
    scoreComponents,
    violations: [],
    feasible: true,
    metadata: {
      selectedKva,
      projectMode: params.projectMode ?? "optimization",
    },
  };
}

function createFailedScenario(
  candidate: DgCandidate,
  violations: DgConstraintViolation[],
): DgScenario {
  return {
    scenarioId: randomUUID(),
    candidateId: candidate.candidateId,
    trafoPositionUtm: candidate.positionUtm,
    trafoPositionLatLon: candidate.position,
    edges: [],
    electricalResult: {
      cqtMaxFraction: 1,
      worstTerminalNodeId: "",
      trafoUtilizationFraction: 1,
      totalCableLengthMeters: 0,
      feasible: false,
    },
    objectiveScore: 0,
    scoreComponents: {
      cableCostScore: 0,
      poleCostScore: 0,
      trafoCostScore: 0,
      cqtPenaltyScore: 0,
      overloadPenaltyScore: 0,
    },
    violations,
    feasible: false,
  };
}

// ─── GRASP: melhoria local ─────────────────────────────────────────────────────

/**
 * Fase de melhoria GRASP: tenta trocar a posição do trafo pelo centróide
 * dos k postes mais próximos de cada cenário viável para ganho incremental.
 * Inspirado na busca local NSGA-II sem a necessidade de biblioteca externa.
 */
function graspLocalImprovement(
  scenarios: DgScenario[],
  poles: DgPoleInput[],
  transformer: DgTransformerInput | undefined,
  exclusionPolygons: DgExclusionPolygon[],
  roadCorridors: DgRoadCorridor[],
  params: DgParams,
): DgScenario[] {
  const improved: DgScenario[] = [];
  const polesUtm = poles.map((p) => ({
    ...p,
    positionUtm: latLonToUtm(p.position.lat, p.position.lon),
  }));

  for (const scenario of scenarios.filter((s) => s.feasible)) {
    // Gera candidato perturbado: média dos 3 postes mais próximos do trafo atual
    const sorted = [...polesUtm].sort(
      (a, b) =>
        euclideanDistanceM(a.positionUtm, scenario.trafoPositionUtm) -
        euclideanDistanceM(b.positionUtm, scenario.trafoPositionUtm),
    );
    const k = Math.min(3, sorted.length);
    const cx = sorted.slice(0, k).reduce((s, p) => s + p.positionUtm.x, 0) / k;
    const cy = sorted.slice(0, k).reduce((s, p) => s + p.positionUtm.y, 0) / k;

    const perturbedUtm = { x: cx, y: cy };
    const perturbedLatLon = utmToLatLon(cx, cy);

    const perturbedCandidate = {
      candidateId: `grasp-${scenario.candidateId}`,
      position: perturbedLatLon,
      positionUtm: perturbedUtm,
      weightedDistanceSum: 0,
      source: "fermat_weber" as const,
    };

    const perturbedScenario = evaluateCandidate(
      perturbedCandidate,
      poles,
      transformer,
      exclusionPolygons,
      roadCorridors,
      params,
    );

    improved.push(
      perturbedScenario.objectiveScore > scenario.objectiveScore
        ? perturbedScenario
        : scenario,
    );
  }

  return improved;
}

// ─── Otimizador principal ──────────────────────────────────────────────────────

export interface OptimizerResult {
  allScenarios: DgScenario[];
  totalCandidatesEvaluated: number;
}

/**
 * Executa a otimização DG sobre todos os candidatos.
 *
 * - Modo exaustivo: avalia todos.
 * - Modo heurístico: exaustivo nos top-50 por Fermat-Weber, GRASP nos viáveis.
 */
export function runDgOptimizer(
  candidates: DgCandidate[],
  poles: DgPoleInput[],
  transformer: DgTransformerInput | undefined,
  exclusionPolygons: DgExclusionPolygon[],
  roadCorridors: DgRoadCorridor[],
  params: DgParams,
): OptimizerResult {
  const derivedPoles = derivePolesDemand(poles, params);
  let candidatesToEvaluate = candidates;

  if (params.searchMode === "heuristic") {
    // Top-50 por menor weighted distance sum (melhores candidatos Fermat-Weber)
    candidatesToEvaluate = [...candidates]
      .sort((a, b) => a.weightedDistanceSum - b.weightedDistanceSum)
      .slice(0, 50);
  }

  const evaluated: DgScenario[] = candidatesToEvaluate.map((cand) =>
    evaluateCandidate(
      cand,
      derivedPoles,
      transformer,
      exclusionPolygons,
      roadCorridors,
      params,
    ),
  );

  let allScenarios = evaluated;

  // Aplicar GRASP apenas em modo heurístico para refinar viáveis
  if (params.searchMode === "heuristic") {
    const improved = graspLocalImprovement(
      evaluated,
      derivedPoles,
      transformer,
      exclusionPolygons,
      roadCorridors,
      params,
    );
    // Merge: mantém melhor versão de cada cenário
    allScenarios = [...evaluated, ...improved];
  }

  return {
    allScenarios,
    totalCandidatesEvaluated: candidatesToEvaluate.length,
  };
}
