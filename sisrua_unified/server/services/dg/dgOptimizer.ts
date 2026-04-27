/**
 * Design Generativo – Motor de Otimização
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
} from "./dgObjective.js";
import { calculateBtRadial } from "../btRadialCalculationService.js";
import type { BtRadialTopologyInput } from "../bt/btTypes.js";
import { logger } from "../../utils/logger.js";

const DEFAULT_CONDUCTOR_ID = "95 AL MM";

// ─── Derivação de Demanda (Wizard) ───────────────────────────────────────────

function derivePolesDemand(poles: DgPoleInput[], params: DgParams): DgPoleInput[] {
  if (params.projectMode !== "full_project") return poles;
  const clientes = params.clientesPorPoste ?? 1;
  const demandaMedia = params.demandaMediaClienteKva ?? 1.5;
  const fatorSimult = params.fatorSimultaneidade ?? 0.8;
  const baseDemand = clientes * demandaMedia * fatorSimult;
  const extraClandestinaTotal = (params.areaClandestinaM2 ?? 0) * 0.02;
  const extraPerPole = poles.length > 0 ? extraClandestinaTotal / poles.length : 0;

  return poles.map((p) => ({
    ...p,
    demandKva: p.demandKva > 0 ? p.demandKva : baseDemand + extraPerPole,
    clients: p.clients > 0 ? p.clients : clientes,
  }));
}

// ─── MST via Kruskal ─────────────────────────────────────────────────────────

interface MstEdge { fromId: string; toId: string; lengthMeters: number; }

class UnionFind {
  private parent: Map<string, string>;
  constructor(ids: string[]) { this.parent = new Map(ids.map((id) => [id, id])); }
  find(x: string): string {
    if (this.parent.get(x) !== x) this.parent.set(x, this.find(this.parent.get(x)!));
    return this.parent.get(x)!;
  }
  union(a: string, b: string): boolean {
    const ra = this.find(a), rb = this.find(b);
    if (ra === rb) return false;
    this.parent.set(ra, rb);
    return true;
  }
}

function buildMst(trafoId: string, poles: Array<{ id: string; positionUtm: { x: number; y: number } }>, trafoUtm: { x: number; y: number }): MstEdge[] {
  const allNodes = [{ id: trafoId, positionUtm: trafoUtm }, ...poles];
  const allEdges: MstEdge[] = [];
  for (let i = 0; i < allNodes.length; i++) {
    for (let j = i + 1; j < allNodes.length; j++) {
      const dist = euclideanDistanceM(allNodes[i].positionUtm, allNodes[j].positionUtm);
      allEdges.push({
        fromId: allNodes[i].id,
        toId: allNodes[j].id,
        lengthMeters: Math.max(0.001, dist),
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

function mstHasSpanViolation(mst: MstEdge[], maxSpanMeters: number): string | null {
  for (const edge of mst) {
    if (edge.lengthMeters > maxSpanMeters) return `Trecho ${edge.fromId}→${edge.toId} tem ${edge.lengthMeters.toFixed(1)} m > ${maxSpanMeters} m`;
  }
  return null;
}

// ─── Avaliação via Motor Oficial ──────────────────────────────────────────────

function evaluateWithOfficialEngine(trafoId: string, trafoKva: number, poles: DgPoleInput[], mst: MstEdge[]): DgElectricalResult | null {
  try {
    const input: BtRadialTopologyInput = {
      transformer: { id: trafoId, rootNodeId: trafoId, kva: trafoKva, zPercent: 4.5, qtMt: 0 },
      nodes: [
        { id: trafoId, load: { localDemandKva: 0 } },
        ...poles.map(p => ({ id: p.id, load: { localDemandKva: p.demandKva } }))
      ],
      edges: mst.map(e => ({ fromNodeId: e.fromId, toNodeId: e.toId, conductorId: DEFAULT_CONDUCTOR_ID, lengthMeters: e.lengthMeters })),
      phase: 'TRI',
      temperatureC: 75,
      nominalVoltageV: 127
    };

    const output = calculateBtRadial(input);
    const totalDemandKva = poles.reduce((s, p) => s + p.demandKva, 0);

    return {
      cqtMaxFraction: output.worstCase.cqtGlobal,
      worstTerminalNodeId: output.worstCase.worstTerminalNodeId,
      trafoUtilizationFraction: totalDemandKva / trafoKva,
      totalCableLengthMeters: mst.reduce((s, e) => s + e.lengthMeters, 0),
      feasible: output.worstCase.cqtGlobal <= 0.08 && (totalDemandKva / trafoKva) <= 0.95
    };
  } catch (err) {
    logger.debug("DG: falha na avaliação elétrica oficial", { error: (err as Error).message });
    return null;
  }
}

// ─── Avaliação de um candidato ───────────────────────────────────────────────

function evaluateCandidate(candidate: DgCandidate, poles: DgPoleInput[], transformer: DgTransformerInput | undefined, exclusionPolygons: DgExclusionPolygon[], roadCorridors: DgRoadCorridor[], params: DgParams): DgScenario {
  const trafoId = `trafo-${candidate.candidateId}`;
  const constraintResult = evaluateHardConstraints(candidate, poles, transformer, exclusionPolygons, roadCorridors, params);
  if (!constraintResult.feasible) return createFailedScenario(candidate, constraintResult.violations);

  const polesUtm = poles.map(p => ({ id: p.id, positionUtm: latLonToUtm(p.position.lat, p.position.lon) }));
  const mst = buildMst(trafoId, polesUtm, candidate.positionUtm);
  const spanViolation = mstHasSpanViolation(mst, params.maxSpanMeters);
  if (spanViolation) return createFailedScenario(candidate, [{ code: "MAX_SPAN_EXCEEDED", detail: spanViolation }]);

  const kvaFaixa = transformer ? [transformer.kva] : (params.faixaKvaTrafoPermitida ?? [15, 30, 45, 75, 112.5]);
  const totalDemandKva = poles.reduce((s, p) => s + p.demandKva, 0);
  let bestResult: DgElectricalResult | null = null;
  let selectedKva = 0;

  for (const kva of kvaFaixa) {
    if (checkTrafoOverload(totalDemandKva, kva, params.trafoMaxUtilization).length > 0) continue;
    const electrical = evaluateWithOfficialEngine(trafoId, kva, poles, mst);
    if (electrical && electrical.feasible) {
      bestResult = electrical;
      selectedKva = kva;
      break;
    }
  }

  if (!bestResult) return createFailedScenario(candidate, [{ code: "TRAFO_OVERLOAD", detail: "Nenhum kVA viável ou erro de topologia." }]);

  const edges: DgScenarioEdge[] = mst.map(e => ({ fromPoleId: e.fromId, toPoleId: e.toId, lengthMeters: e.lengthMeters, conductorId: DEFAULT_CONDUCTOR_ID }));
  const { objectiveScore, scoreComponents } = calculateObjectiveScore({ edges, electricalResult: bestResult, candidateSource: candidate.source, weights: params.objectiveWeights });

  return {
    scenarioId: randomUUID(),
    candidateId: candidate.candidateId,
    trafoPositionUtm: candidate.positionUtm,
    trafoPositionLatLon: candidate.position,
    edges,
    electricalResult: bestResult,
    objectiveScore,
    scoreComponents,
    violations: [],
    feasible: true,
    metadata: { selectedKva, projectMode: params.projectMode ?? "optimization" }
  };
}

function createFailedScenario(candidate: DgCandidate, violations: DgConstraintViolation[]): DgScenario {
  return {
    scenarioId: randomUUID(),
    candidateId: candidate.candidateId,
    trafoPositionUtm: candidate.positionUtm,
    trafoPositionLatLon: candidate.position,
    edges: [],
    electricalResult: { cqtMaxFraction: 1, worstTerminalNodeId: "", trafoUtilizationFraction: 1, totalCableLengthMeters: 0, feasible: false },
    objectiveScore: 0,
    scoreComponents: { cableCostScore: 0, poleCostScore: 0, trafoCostScore: 0, cqtPenaltyScore: 0, overloadPenaltyScore: 0 },
    violations,
    feasible: false
  };
}

// ─── Melhoria local ──────────────────────────────────────────────────────────

function graspLocalImprovement(scenarios: DgScenario[], poles: DgPoleInput[], transformer: DgTransformerInput | undefined, exclusionPolygons: DgExclusionPolygon[], roadCorridors: DgRoadCorridor[], params: DgParams): DgScenario[] {
  const improved: DgScenario[] = [];
  const polesUtm = poles.map(p => ({ ...p, positionUtm: latLonToUtm(p.position.lat, p.position.lon) }));
  for (const scenario of scenarios.filter(s => s.feasible)) {
    const sorted = [...polesUtm].sort((a, b) => euclideanDistanceM(a.positionUtm, scenario.trafoPositionUtm) - euclideanDistanceM(b.positionUtm, scenario.trafoPositionUtm));
    const k = Math.min(3, sorted.length);
    const cx = sorted.slice(0, k).reduce((s, p) => s + p.positionUtm.x, 0) / k;
    const cy = sorted.slice(0, k).reduce((s, p) => s + p.positionUtm.y, 0) / k;
    const perturbedCandidate = { candidateId: `grasp-${scenario.candidateId}`, position: utmToLatLon(cx, cy), positionUtm: { x: cx, y: cy }, weightedDistanceSum: 0, source: "fermat_weber" as const };
    const perturbedScenario = evaluateCandidate(perturbedCandidate, poles, transformer, exclusionPolygons, roadCorridors, params);
    improved.push(perturbedScenario.objectiveScore > scenario.objectiveScore ? perturbedScenario : scenario);
  }
  return improved;
}

// ─── Otimizador ─────────────────────────────────────────────────────────────

export interface OptimizerResult { allScenarios: DgScenario[]; totalCandidatesEvaluated: number; }

export function runDgOptimizer(candidates: DgCandidate[], poles: DgPoleInput[], transformer: DgTransformerInput | undefined, exclusionPolygons: DgExclusionPolygon[], roadCorridors: DgRoadCorridor[], params: DgParams): OptimizerResult {
  const derivedPoles = derivePolesDemand(poles, params);
  const maxEval = params.maxCandidatesHeuristic ?? 50; 
  let candidatesToEvaluate = params.searchMode === "heuristic" 
    ? [...candidates].sort((a, b) => a.weightedDistanceSum - b.weightedDistanceSum).slice(0, maxEval)
    : candidates;

  const evaluated = candidatesToEvaluate.map(cand => evaluateCandidate(cand, derivedPoles, transformer, exclusionPolygons, roadCorridors, params));
  let allScenarios = evaluated;
  if (params.searchMode === "heuristic") {
    const improved = graspLocalImprovement(evaluated, derivedPoles, transformer, exclusionPolygons, roadCorridors, params);
    allScenarios = [...evaluated, ...improved];
  }
  return { allScenarios, totalCandidatesEvaluated: candidatesToEvaluate.length };
}
