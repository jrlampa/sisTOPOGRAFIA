/**
 * Design Generativo — Particionamento de Rede
 *
 * Passo 3: Avaliação de Limites (capacidade trafo / CQT)
 * Passo 4: Heurística de Corte 50/50 + Filtro Anti-Isolamento
 * Passo 5: Baricentro Elétrico (Fermat-Weber) + Regra Excentricidade 200m
 */

import { randomUUID } from "crypto";
import type {
  DgPoleInput,
  DgParams,
  DgScenarioEdge,
  DgElectricalResult,
  DgPartition,
  DgPartitionedResult,
} from "./dgTypes.js";
import { resolveTrafoFaixa } from "./dgTypes.js";
import {
  euclideanDistanceM,
  latLonToUtm,
  utmToLatLon,
  fermatWeberCenter,
} from "./dgCandidates.js";
import { calculateBtRadial } from "../btRadialCalculationService.js";
import type { BtRadialTopologyInput } from "../bt/btTypes.js";
import { logger } from "../../utils/logger.js";

// ─── Tipos internos ──────────────────────────────────────────────────────────

export interface MstEdge {
  fromId: string;
  toId: string;
  lengthMeters: number;
}

interface EdgeCut {
  edge: MstEdge;
  /** Nó no lado "downstream" (afastado da raiz) */
  childId: string;
  /** Demanda acumulada no subtree do filho */
  subtreeDemandKva: number;
}

// ─── Seleção telescópica de condutor ────────────────────────────────────────

const TELESCOPIC_TABLE: Array<{ maxKva: number; id: string }> = [
  { maxKva: 36, id: "25 Al - Arm" },
  { maxKva: 57, id: "50 Al - Arm" },
  { maxKva: 91, id: "95 Al - Arm" },
  { maxKva: 115, id: "150 Al - Arm" },
  { maxKva: Infinity, id: "240 Al - Arm" },
];

export function selectConductorForDemand(subtreeDemandKva: number): string {
  return TELESCOPIC_TABLE.find((t) => subtreeDemandKva <= t.maxKva)!.id;
}

// ─── MST via Kruskal ─────────────────────────────────────────────────────────

class UnionFind {
  private parent: Map<string, string>;
  constructor(ids: string[]) {
    this.parent = new Map(ids.map((id) => [id, id]));
  }
  find(x: string): string {
    if (this.parent.get(x) !== x)
      this.parent.set(x, this.find(this.parent.get(x)!));
    return this.parent.get(x)!;
  }
  union(a: string, b: string): boolean {
    const ra = this.find(a),
      rb = this.find(b);
    if (ra === rb) return false;
    this.parent.set(ra, rb);
    return true;
  }
}

export function buildMst(
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
        lengthMeters: Math.max(
          0.001,
          euclideanDistanceM(allNodes[i].positionUtm, allNodes[j].positionUtm),
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

export function mstHasSpanViolation(
  mst: MstEdge[],
  maxSpanMeters: number,
): string | null {
  for (const edge of mst) {
    if (edge.lengthMeters > maxSpanMeters)
      return `Trecho ${edge.fromId}→${edge.toId} tem ${edge.lengthMeters.toFixed(1)} m > ${maxSpanMeters} m`;
  }
  return null;
}

// ─── Condutor telescópico por subtree demand ─────────────────────────────────

/**
 * Para cada aresta MST, atribui o condutor correto baseado na demanda
 * acumulada da sub-rede "downstream" (rede telescópica).
 */
export function assignTelescopicConductors(
  trafoId: string,
  mst: MstEdge[],
  demandByPole: Map<string, number>,
): Map<string, string> {
  const adj = new Map<string, string[]>();
  for (const e of mst) {
    if (!adj.has(e.fromId)) adj.set(e.fromId, []);
    if (!adj.has(e.toId)) adj.set(e.toId, []);
    adj.get(e.fromId)!.push(e.toId);
    adj.get(e.toId)!.push(e.fromId);
  }

  const subtreeDemand = new Map<string, number>();
  const visited = new Set<string>();

  function dfs(nodeId: string, parentId: string | null): number {
    visited.add(nodeId);
    let demand = demandByPole.get(nodeId) ?? 0;
    for (const neighbor of adj.get(nodeId) ?? []) {
      if (neighbor === parentId || visited.has(neighbor)) continue;
      demand += dfs(neighbor, nodeId);
    }
    subtreeDemand.set(nodeId, demand);
    return demand;
  }
  dfs(trafoId, null);

  const conductorByEdgeKey = new Map<string, string>();
  for (const e of mst) {
    const dA = subtreeDemand.get(e.fromId) ?? 0;
    const dB = subtreeDemand.get(e.toId) ?? 0;
    const childDemand = Math.min(dA, dB);
    conductorByEdgeKey.set(
      `${e.fromId}→${e.toId}`,
      selectConductorForDemand(childDemand),
    );
  }
  return conductorByEdgeKey;
}

// ─── Passo 3: Acumula demandas por subtree para corte ───────────────────────

function computeEdgeCuts(
  trafoId: string,
  mst: MstEdge[],
  demandByPole: Map<string, number>,
): EdgeCut[] {
  const adj = new Map<string, Array<{ neighbor: string; edge: MstEdge }>>();
  for (const e of mst) {
    if (!adj.has(e.fromId)) adj.set(e.fromId, []);
    if (!adj.has(e.toId)) adj.set(e.toId, []);
    adj.get(e.fromId)!.push({ neighbor: e.toId, edge: e });
    adj.get(e.toId)!.push({ neighbor: e.fromId, edge: e });
  }

  const subtreeDemand = new Map<string, number>();
  const parentEdge = new Map<string, { edge: MstEdge; childId: string }>();
  const visited = new Set<string>();

  function dfs(nodeId: string, parentId: string | null): number {
    visited.add(nodeId);
    let demand = demandByPole.get(nodeId) ?? 0;
    for (const { neighbor, edge } of adj.get(nodeId) ?? []) {
      if (neighbor === parentId || visited.has(neighbor)) continue;
      parentEdge.set(neighbor, { edge, childId: neighbor });
      demand += dfs(neighbor, nodeId);
    }
    subtreeDemand.set(nodeId, demand);
    return demand;
  }
  dfs(trafoId, null);

  const cuts: EdgeCut[] = [];
  for (const [childId, { edge }] of parentEdge) {
    cuts.push({
      edge,
      childId,
      subtreeDemandKva: subtreeDemand.get(childId) ?? 0,
    });
  }
  return cuts;
}

// ─── Passo 4: Heurística 50/50 + Filtro anti-isolamento ─────────────────────

const MIN_LOAD_FRACTION = 0.15; // 15% mínimo por cluster (anti-isolamento)
const MIN_POLES_PER_PARTITION = 3;

/**
 * Encontra a aresta cujo corte produz a divisão mais próxima de 50/50.
 * Aplica filtro anti-isolamento: rejeita cortes onde algum lado tem
 * < 15% da demanda total ou < MIN_POLES_PER_PARTITION postes.
 */
export function findBestCutEdge(
  trafoId: string,
  mst: MstEdge[],
  poles: DgPoleInput[],
  demandByPole: Map<string, number>,
  totalDemandKva: number,
): EdgeCut | null {
  if (mst.length < MIN_POLES_PER_PARTITION) return null;

  const cuts = computeEdgeCuts(trafoId, mst, demandByPole);
  const minLoadKva = totalDemandKva * MIN_LOAD_FRACTION;
  const poleIds = new Set(poles.map((p) => p.id));

  const valid: Array<{ cut: EdgeCut; imbalance: number }> = [];

  for (const cut of cuts) {
    const below = cut.subtreeDemandKva;
    const above = totalDemandKva - below;
    if (below < minLoadKva || above < minLoadKva) continue;

    const downstreamPoles = collectSubtreeNodes(cut.childId, cut.edge, mst).filter(
      (id) => poleIds.has(id),
    ).length;
    const upstreamPoles = poles.length - downstreamPoles;
    if (
      downstreamPoles < MIN_POLES_PER_PARTITION ||
      upstreamPoles < MIN_POLES_PER_PARTITION
    )
      continue;

    valid.push({ cut, imbalance: Math.abs(2 * below - totalDemandKva) });
  }

  if (valid.length === 0) return null;
  valid.sort((a, b) => a.imbalance - b.imbalance);
  return valid[0].cut;
}

/** Retorna IDs dos nós no subtree do childId (exclui a aresta de corte). */
function collectSubtreeNodes(
  childId: string,
  cutEdge: MstEdge,
  mst: MstEdge[],
): string[] {
  const adj = new Map<string, string[]>();
  for (const e of mst) {
    const isCut =
      (e.fromId === cutEdge.fromId && e.toId === cutEdge.toId) ||
      (e.fromId === cutEdge.toId && e.toId === cutEdge.fromId);
    if (isCut) continue;
    if (!adj.has(e.fromId)) adj.set(e.fromId, []);
    if (!adj.has(e.toId)) adj.set(e.toId, []);
    adj.get(e.fromId)!.push(e.toId);
    adj.get(e.toId)!.push(e.fromId);
  }
  const visited = new Set<string>();
  const queue = [childId];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const neighbor of adj.get(node) ?? []) queue.push(neighbor);
  }
  return [...visited];
}

function splitPolesAtCut(
  poles: DgPoleInput[],
  cutEdge: MstEdge,
  mst: MstEdge[],
  cutChildId: string,
): { downstream: DgPoleInput[]; upstream: DgPoleInput[] } {
  const downstreamIds = new Set(collectSubtreeNodes(cutChildId, cutEdge, mst));
  return {
    downstream: poles.filter((p) => downstreamIds.has(p.id)),
    upstream: poles.filter((p) => !downstreamIds.has(p.id)),
  };
}

// ─── Passo 5: Excentricidade 200m ───────────────────────────────────────────

export interface EccentricityResult {
  position: { x: number; y: number };
  adjusted: boolean;
  maxDistM: number;
}

/**
 * Se o trafo em `centroid` tiver algum poste a mais de `maxDistM`,
 * arrasta-o para o poste existente que minimiza a excentricidade máxima.
 */
export function applyEccentricityDrag(
  centroid: { x: number; y: number },
  polesUtm: Array<{ id: string; positionUtm: { x: number; y: number } }>,
  maxDistM = 200,
): EccentricityResult {
  const computeMaxDist = (pos: { x: number; y: number }) =>
    Math.max(...polesUtm.map((p) => euclideanDistanceM(pos, p.positionUtm)));

  let maxDist = computeMaxDist(centroid);
  if (maxDist <= maxDistM)
    return { position: centroid, adjusted: false, maxDistM: maxDist };

  const farthest = polesUtm.reduce((acc, p) =>
    euclideanDistanceM(centroid, p.positionUtm) >
    euclideanDistanceM(centroid, acc.positionUtm)
      ? p
      : acc,
  );
  const dx = farthest.positionUtm.x - centroid.x;
  const dy = farthest.positionUtm.y - centroid.y;

  const scored = polesUtm
    .map((p) => ({
      p,
      score:
        (p.positionUtm.x - centroid.x) * dx +
        (p.positionUtm.y - centroid.y) * dy,
    }))
    .sort((a, b) => b.score - a.score);

  for (const { p } of scored.slice(0, 3)) {
    const newMaxDist = computeMaxDist(p.positionUtm);
    if (newMaxDist <= maxDistM)
      return { position: p.positionUtm, adjusted: true, maxDistM: newMaxDist };
  }

  // Fallback: poste que minimiza a excentricidade máxima globalmente
  const best = polesUtm.reduce(
    (acc, p) => {
      const d = computeMaxDist(p.positionUtm);
      return d < acc.maxDist ? { p, maxDist: d } : acc;
    },
    { p: polesUtm[0], maxDist: computeMaxDist(polesUtm[0].positionUtm) },
  );
  return { position: best.p.positionUtm, adjusted: true, maxDistM: best.maxDist };
}

// ─── Avaliação elétrica de uma partição ─────────────────────────────────────

function evaluatePartitionElectrical(
  trafoId: string,
  trafoKva: number,
  poles: DgPoleInput[],
  mst: MstEdge[],
  demandByPole: Map<string, number>,
): DgElectricalResult | null {
  try {
    const conductorMap = assignTelescopicConductors(trafoId, mst, demandByPole);

    const input: BtRadialTopologyInput = {
      transformer: {
        id: trafoId,
        rootNodeId: trafoId,
        kva: trafoKva,
        zPercent: 4.5,
        qtMt: 0,
      },
      nodes: [
        { id: trafoId, load: { localDemandKva: 0 } },
        ...poles.map((p) => ({ id: p.id, load: { localDemandKva: p.demandKva } })),
      ],
      edges: mst.map((e) => ({
        fromNodeId: e.fromId,
        toNodeId: e.toId,
        conductorId:
          conductorMap.get(`${e.fromId}→${e.toId}`) ??
          conductorMap.get(`${e.toId}→${e.fromId}`) ??
          "95 Al - Arm",
        lengthMeters: e.lengthMeters,
      })),
      phase: "TRI",
      temperatureC: 75,
      nominalVoltageV: 127,
    };

    const output = calculateBtRadial(input);
    const totalDemandKva = poles.reduce((s, p) => s + p.demandKva, 0);

    return {
      cqtMaxFraction: output.worstCase.cqtGlobal,
      worstTerminalNodeId: output.worstCase.worstTerminalNodeId,
      trafoUtilizationFraction: totalDemandKva / trafoKva,
      totalCableLengthMeters: mst.reduce((s, e) => s + e.lengthMeters, 0),
      feasible:
        output.worstCase.cqtGlobal <= 0.08 &&
        totalDemandKva / trafoKva <= 0.95,
    };
  } catch (err) {
    logger.debug("DG Partitioner: falha na avaliação elétrica", {
      error: (err as Error).message,
    });
    return null;
  }
}

// ─── Construção de uma DgPartition ──────────────────────────────────────────

function buildPartition(
  partitionId: string,
  poles: DgPoleInput[],
  params: DgParams,
): DgPartition | null {
  if (poles.length < MIN_POLES_PER_PARTITION) return null;

  const polesUtm = poles.map((p) => ({
    id: p.id,
    positionUtm: latLonToUtm(p.position.lat, p.position.lon),
  }));

  // Passo 5a: Baricentro elétrico (Fermat-Weber)
  const centroid = fermatWeberCenter(
    poles.map((p, i) => ({ positionUtm: polesUtm[i].positionUtm, demandKva: p.demandKva })),
  );

  // Passo 5b: Regra de excentricidade 200m
  const eccentricity = applyEccentricityDrag(centroid, polesUtm);
  const trafoUtm = eccentricity.position;
  const trafoLatLon = utmToLatLon(trafoUtm.x, trafoUtm.y);

  const trafoId = `trafo-part-${partitionId}`;
  const mst = buildMst(trafoId, polesUtm, trafoUtm);

  const demandByPole = new Map(poles.map((p) => [p.id, p.demandKva]));
  const totalDemandKva = poles.reduce((s, p) => s + p.demandKva, 0);

  // Passo 3b: Seleciona menor kVA viável usando catálogo resolvido
  const faixa = resolveTrafoFaixa(params);
  let bestResult: DgElectricalResult | null = null;
  let selectedKva = 0;

  for (const kva of faixa) {
    if (totalDemandKva / kva > (params.trafoMaxUtilization ?? 0.95)) continue;
    const result = evaluatePartitionElectrical(trafoId, kva, poles, mst, demandByPole);
    if (result?.feasible) {
      bestResult = result;
      selectedKva = kva;
      break;
    }
  }

  const conductorMap = assignTelescopicConductors(trafoId, mst, demandByPole);
  const edges: DgScenarioEdge[] = mst.map((e) => ({
    fromPoleId: e.fromId,
    toPoleId: e.toId,
    lengthMeters: e.lengthMeters,
    conductorId:
      conductorMap.get(`${e.fromId}→${e.toId}`) ??
      conductorMap.get(`${e.toId}→${e.fromId}`) ??
      "95 Al - Arm",
  }));

  return {
    partitionId,
    poles,
    trafoPositionLatLon: trafoLatLon,
    trafoPositionUtm: trafoUtm,
    selectedKva,
    edges,
    electricalResult: bestResult ?? {
      cqtMaxFraction: 1,
      worstTerminalNodeId: "",
      trafoUtilizationFraction: totalDemandKva / Math.max(selectedKva, 1),
      totalCableLengthMeters: mst.reduce((s, e) => s + e.lengthMeters, 0),
      feasible: false,
    },
    totalDemandKva,
    eccentricityAdjusted: eccentricity.adjusted,
    maxNodeDistanceM: eccentricity.maxDistM,
    centroid,
  };
}

// ─── Passo 3-4: Particionamento recursivo ───────────────────────────────────

const MAX_DEPTH = 2; // máximo 3 sub-redes (depth 0→1→2)
const MAX_PARTITIONS = 4;

function partitionRecursive(
  poles: DgPoleInput[],
  params: DgParams,
  depth: number,
  cutEdgeIds: string[],
): DgPartition[] {
  if (poles.length < MIN_POLES_PER_PARTITION || depth > MAX_DEPTH) {
    const partition = buildPartition(
      `${depth}-${randomUUID().slice(0, 8)}`,
      poles,
      params,
    );
    return partition ? [partition] : [];
  }

  const totalDemandKva = poles.reduce((s, p) => s + p.demandKva, 0);
  const maxKva = Math.max(...resolveTrafoFaixa(params));
  const maxUtilization = params.trafoMaxUtilization ?? 0.95;

  // Se cabe num único trafo, não particiona mais
  if (totalDemandKva <= maxKva * maxUtilization) {
    const partition = buildPartition(
      `${depth}-${randomUUID().slice(0, 8)}`,
      poles,
      params,
    );
    return partition ? [partition] : [];
  }

  const polesUtm = poles.map((p) => ({
    id: p.id,
    positionUtm: latLonToUtm(p.position.lat, p.position.lon),
  }));

  const centroid = fermatWeberCenter(
    poles.map((p, i) => ({ positionUtm: polesUtm[i].positionUtm, demandKva: p.demandKva })),
  );
  const tempTrafoId = `temp-trafo-${depth}`;
  const mst = buildMst(tempTrafoId, polesUtm, centroid);
  const demandByPole = new Map(poles.map((p) => [p.id, p.demandKva]));

  const bestCut = findBestCutEdge(tempTrafoId, mst, poles, demandByPole, totalDemandKva);
  if (!bestCut) {
    logger.warn(
      "DG Partitioner: nenhum corte válido encontrado — aceitando partição única",
      { poles: poles.length, totalDemandKva, depth },
    );
    const partition = buildPartition(
      `${depth}-${randomUUID().slice(0, 8)}`,
      poles,
      params,
    );
    return partition ? [partition] : [];
  }

  cutEdgeIds.push(`${bestCut.edge.fromId}→${bestCut.edge.toId}`);

  const { downstream, upstream } = splitPolesAtCut(
    poles,
    bestCut.edge,
    mst,
    bestCut.childId,
  );

  logger.debug("DG Partitioner: corte aplicado", {
    depth,
    upstreamPoles: upstream.length,
    downstreamPoles: downstream.length,
    upstreamDemand: totalDemandKva - bestCut.subtreeDemandKva,
    downstreamDemand: bestCut.subtreeDemandKva,
    balanceRatio:
      1 -
      Math.abs(2 * bestCut.subtreeDemandKva - totalDemandKva) / totalDemandKva,
  });

  const upstreamPartitions = partitionRecursive(upstream, params, depth + 1, cutEdgeIds);
  const downstreamPartitions = partitionRecursive(downstream, params, depth + 1, cutEdgeIds);

  return [...upstreamPartitions, ...downstreamPartitions].slice(0, MAX_PARTITIONS);
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Ponto de entrada do particionador DG.
 * Retorna `DgPartitionedResult` com todas as partições, cada uma com:
 *   - trafo posicionado (Fermat-Weber + excentricidade 200m)
 *   - arestas com condutores telescópicos
 *   - resultado elétrico avaliado pelo motor oficial
 */
export function partitionNetwork(
  poles: DgPoleInput[],
  params: DgParams,
): DgPartitionedResult {
  const totalDemandKva = poles.reduce((s, p) => s + p.demandKva, 0);
  const cutEdgeIds: string[] = [];

  const partitions = partitionRecursive(poles, params, 0, cutEdgeIds);

  let avgBalanceRatio = 1;
  if (cutEdgeIds.length > 0 && partitions.length >= 2) {
    const demands = partitions.map((p) => p.totalDemandKva);
    const total = demands.reduce((s, d) => s + d, 0);
    const idealPerPartition = total / partitions.length;
    const avgImbalance =
      demands.reduce((s, d) => s + Math.abs(d - idealPerPartition), 0) /
      partitions.length;
    avgBalanceRatio = Math.max(0, 1 - avgImbalance / idealPerPartition);
  }

  return {
    partitions,
    totalPartitions: partitions.length,
    cutEdgeIds,
    avgBalanceRatio,
    infeasiblePartitions: partitions.filter((p) => !p.electricalResult.feasible)
      .length,
    totalDemandKva,
  };
}
