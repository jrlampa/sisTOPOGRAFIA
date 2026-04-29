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
import { resolveTrafoFaixa } from "./dgTypes.js";
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
import {
  buildMst,
  mstHasSpanViolation,
  selectConductorForDemand,
  assignTelescopicConductors,
} from "./dgPartitioner.js";
import type { MstEdge } from "./dgPartitioner.js";

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

// ─── Avaliação via Motor Oficial ──────────────────────────────────────────────

function evaluateWithOfficialEngine(trafoId: string, trafoKva: number, poles: DgPoleInput[], mst: MstEdge[], params: DgParams): DgElectricalResult | null {
  try {
    const demandByPole = new Map(poles.map(p => [p.id, p.demandKva]));
    const conductorMap = assignTelescopicConductors(trafoId, mst, demandByPole);

    const input: BtRadialTopologyInput = {
      transformer: { id: trafoId, rootNodeId: trafoId, kva: trafoKva, zPercent: 4.5, qtMt: 0 },
      nodes: [
        { id: trafoId, load: { localDemandKva: 0 } },
        ...poles.map((p) => ({
          id: p.id,
          load: {
            localDemandKva: p.demandKva,
            ramal: params.ramalDefaultLengthM
              ? {
                  conductorId: params.ramalDefaultConductorId ?? "16 Al - Du",
                  lengthMeters: params.ramalDefaultLengthM,
                }
              : undefined,
          },
        })),
      ],
      edges: mst.map(e => ({
        fromNodeId: e.fromId,
        toNodeId: e.toId,
        conductorId:
          conductorMap.get(`${e.fromId}→${e.toId}`) ??
          conductorMap.get(`${e.toId}→${e.fromId}`) ??
          "95 Al - Arm",
        lengthMeters: e.lengthMeters,
      })),
      phase: 'TRI',
      temperatureC: 75,
      nominalVoltageV: 127
    };

    const output = calculateBtRadial(input);
    const totalDemandKva = poles.reduce((s, p) => s + p.demandKva, 0);

    const worstTerminalId = output.worstCase.worstTerminalNodeId;
    const worstTerminal = output.terminalResults.find(t => t.nodeId === worstTerminalId);

    return {
      cqtMaxFraction: output.worstCase.cqtGlobal,
      cqtTerminalFraction: worstTerminal?.qtTerminal ?? output.worstCase.cqtGlobal,
      cqtRamalFraction: worstTerminal?.qtRamal ?? 0,
      worstTerminalNodeId: worstTerminalId,
      trafoUtilizationFraction: totalDemandKva / trafoKva,
      totalCableLengthMeters: mst.reduce((s, e) => s + e.lengthMeters, 0),
      feasible:
        output.worstCase.cqtGlobal <= (params.cqtLimitFraction ?? 0.08) &&
        totalDemandKva / trafoKva <= (params.trafoMaxUtilization ?? 0.95),
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
  const mst = buildMst(trafoId, polesUtm, candidate.positionUtm, exclusionPolygons, roadCorridors);
  const spanViolation = mstHasSpanViolation(mst, params.maxSpanMeters);
  if (spanViolation) return createFailedScenario(candidate, [{ code: "MAX_SPAN_EXCEEDED", detail: spanViolation }]);

  const kvaFaixa = transformer ? [transformer.kva] : resolveTrafoFaixa(params);
  const totalDemandKva = poles.reduce((s, p) => s + p.demandKva, 0);
  let bestResult: DgElectricalResult | null = null;
  let selectedKva = 0;

  for (const kva of kvaFaixa) {
    if (checkTrafoOverload(totalDemandKva, kva, params.trafoMaxUtilization).length > 0) continue;
    const electrical = evaluateWithOfficialEngine(trafoId, kva, poles, mst, params);
    if (electrical && electrical.feasible) {
      bestResult = electrical;
      selectedKva = kva;
      break;
    }
  }

  if (!bestResult) return createFailedScenario(candidate, [{ code: "TRAFO_OVERLOAD", detail: "Nenhum kVA viável ou erro de topologia." }]);

  const conductorMap = assignTelescopicConductors(trafoId, mst, new Map(poles.map(p => [p.id, p.demandKva])));
  const edges: DgScenarioEdge[] = mst.map(e => ({
    fromPoleId: e.fromId,
    toPoleId: e.toId,
    lengthMeters: e.lengthMeters,
    conductorId:
      conductorMap.get(`${e.fromId}→${e.toId}`) ??
      conductorMap.get(`${e.toId}→${e.fromId}`) ??
      "95 Al - Arm",
  }));
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
    electricalResult: {
      cqtMaxFraction: 1,
      cqtTerminalFraction: 1,
      cqtRamalFraction: 0,
      worstTerminalNodeId: "",
      trafoUtilizationFraction: 1,
      totalCableLengthMeters: 0,
      feasible: false,
    },
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
