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
  DgMtRouterInput,
  DgMtRouterResult,
  DgMtRouterEdge,
  DgMtTopologyDraft,
} from "./dgTypes.js";
import {
  latLonToUtm,
  utmToLatLon,
  fermatWeberCenter,
} from "./dgCandidates.js";
import { buildMst, MstEdge } from "./dgMst.js";
import { assignTelescopicConductors } from "./dgTelescopic.js";
import { applyEccentricityDrag } from "./dgEccentricity.js";
import { findBestCutEdge, splitPolesAtCut } from "./dgCuts.js";
import { calculateBtRadial } from "../btRadialCalculationService.js";
import type { BtRadialTopologyInput } from "../bt/btTypes.js";
import { logger } from "../../utils/logger.js";

const MIN_POLES_PER_PARTITION = 1;

// ─── Avaliação elétrica de uma partição ─────────────────────────────────────

function evaluatePartitionElectrical(
  trafoId: string,
  trafoKva: number,
  poles: DgPoleInput[],
  mst: MstEdge[],
  demandByPole: Map<string, number>,
  cqtLimit: number,
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
        ...poles.map((p) => ({
          id: p.id,
          load: { localDemandKva: p.demandKva },
        })),
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
        output.worstCase.cqtGlobal <= cqtLimit &&
        totalDemandKva / trafoKva <= 0.95,
      cqtTerminalFraction: 0, // Fallback for interface
      cqtRamalFraction: 0, // Fallback for interface
    };
  } catch (err) {
    logger.debug("DG Partitioner: falha na avaliação elétrica", {
      error: (err as Error).message,
      trafoId,
      trafoKva,
      poles: poles.length,
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
    poles.map((p, i) => ({
      positionUtm: polesUtm[i].positionUtm,
      demandKva: p.demandKva,
    })),
  );

  // Passo 5b: Regra de excentricidade 200m
  const eccentricity = applyEccentricityDrag(centroid, polesUtm);
  const trafoUtm = eccentricity.position;
  const trafoLatLon = utmToLatLon(trafoUtm.x, trafoUtm.y);

  const trafoId = `trafo-part-${partitionId}`;
  const mst = buildMst(
    trafoId,
    polesUtm,
    trafoUtm,
    [],
    [],
  );

  const demandByPole = new Map(poles.map((p) => [p.id, p.demandKva]));
  const totalDemandKva = poles.reduce((s, p) => s + p.demandKva, 0);

  // Passo 3b: Seleciona menor kVA viável
  const baseFaixa = params.faixaKvaTrafoPermitida ?? [15, 30, 45, 75, 112.5];
  const trafoMaxKva =
    typeof (params as any).trafoMaxKva === "number"
      ? ((params as any).trafoMaxKva as number)
      : null;
  const faixa =
    trafoMaxKva && Number.isFinite(trafoMaxKva) && trafoMaxKva > 0
      ? baseFaixa.filter((kva) => kva <= trafoMaxKva)
      : baseFaixa;
  let bestResult: DgElectricalResult | null = null;
  let selectedKva = 0;

  for (const kva of faixa) {
    if (totalDemandKva / kva > (params.trafoMaxUtilization ?? 0.95)) continue;
    const result = evaluatePartitionElectrical(
      trafoId,
      kva,
      poles,
      mst,
      demandByPole,
      params.cqtLimitFraction ?? 0.08,
    );
    // Guarda o melhor resultado mesmo que infeasível (para CQT real no output)
    if (
      result &&
      (!bestResult || result.cqtMaxFraction < bestResult.cqtMaxFraction)
    ) {
      bestResult = result;
      if (selectedKva === 0) selectedKva = kva;
    }
    if (result?.feasible) {
      selectedKva = kva;
      break;
    }
  }

  // Constrói edges com condutores telescópicos
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
      cqtTerminalFraction: 1,
      cqtRamalFraction: 0,
    },
    totalDemandKva,
    eccentricityAdjusted: eccentricity.adjusted,
    maxNodeDistanceM: eccentricity.maxDistM,
    centroid,
  };
}

// ─── Passo 3-4: Particionamento recursivo ───────────────────────────────────

const MAX_DEPTH = 6; // suporta até 64 sub-redes (redes com 50-500 postes)
const MAX_PARTITIONS = 20; // cap de segurança — não aplicado na recursão

function partitionRecursive(
  poles: DgPoleInput[],
  params: DgParams,
  depth: number,
  cutEdgeIds: string[],
  totalDemandForRatioCalc: number,
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
  const baseFaixa = params.faixaKvaTrafoPermitida ?? [15, 30, 45, 75, 112.5];
  const trafoMaxKva =
    typeof (params as any).trafoMaxKva === "number"
      ? ((params as any).trafoMaxKva as number)
      : null;
  const faixa =
    trafoMaxKva && Number.isFinite(trafoMaxKva) && trafoMaxKva > 0
      ? baseFaixa.filter((kva) => kva <= trafoMaxKva)
      : baseFaixa;
  const maxKva = Math.max(...faixa);
  const maxUtilization = params.trafoMaxUtilization ?? 0.95;

  if (totalDemandKva <= maxKva * maxUtilization) {
    const partition = buildPartition(
      `${depth}-${randomUUID().slice(0, 8)}`,
      poles,
      params,
    );
    if (
      !partition ||
      partition.electricalResult.feasible ||
      depth >= MAX_DEPTH
    ) {
      return partition ? [partition] : [];
    }
    logger.debug(
      "DG Partitioner: CQT acima do limite — continuando particionamento",
      {
        depth,
        poles: poles.length,
        totalDemandKva,
        cqt: partition.electricalResult.cqtMaxFraction,
      },
    );
  }

  const polesUtm = poles.map((p) => ({
    id: p.id,
    positionUtm: latLonToUtm(p.position.lat, p.position.lon),
  }));

  const centroid = fermatWeberCenter(
    poles.map((p, i) => ({
      positionUtm: polesUtm[i].positionUtm,
      demandKva: p.demandKva,
    })),
  );
  const tempTrafoId = `temp-trafo-${depth}`;
  const mst = buildMst(
    tempTrafoId,
    polesUtm,
    centroid,
    [],
    [],
  );
  const demandByPole = new Map(poles.map((p) => [p.id, p.demandKva]));

  const bestCut = findBestCutEdge(
    tempTrafoId,
    mst,
    poles,
    demandByPole,
    totalDemandKva,
  );
  if (!bestCut) {
    logger.warn(
      "DG Partitioner: nenhum corte válido encontrado — aceitando partição única",
      {
        poles: poles.length,
        totalDemandKva,
        depth,
      },
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

  const upstreamPartitions = partitionRecursive(
    upstream,
    params,
    depth + 1,
    cutEdgeIds,
    totalDemandForRatioCalc,
  );
  const downstreamPartitions = partitionRecursive(
    downstream,
    params,
    depth + 1,
    cutEdgeIds,
    totalDemandForRatioCalc,
  );

  return [...upstreamPartitions, ...downstreamPartitions];
}

// ─── API pública ─────────────────────────────────────────────────────────────

export function partitionNetwork(
  poles: DgPoleInput[],
  params: DgParams,
): DgPartitionedResult {
  const totalDemandKva = poles.reduce((s, p) => s + p.demandKva, 0);
  const cutEdgeIds: string[] = [];

  const allPartitions = partitionRecursive(
    poles,
    params,
    0,
    cutEdgeIds,
    totalDemandKva,
  );
  const partitions = allPartitions.slice(0, MAX_PARTITIONS);
  if (allPartitions.length > MAX_PARTITIONS) {
    logger.warn(
      "DG Partitioner: número de partições excede MAX_PARTITIONS, resultado truncado",
      {
        total: allPartitions.length,
        cap: MAX_PARTITIONS,
      },
    );
  }

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

// ─── Skill DG: MT Router (grafo viário + menor caminho) ─────────────────────

/** Threshold padrão de fusão de nós adjacentes (0.5 m em UTM). */
const DEFAULT_NODE_MERGE_THRESHOLD_M = 0.5;

interface MtGraphNode {
  id: string;
  point: { x: number; y: number };
  /** true se o nó foi injetado a partir de um poste existente do projeto. */
  isExistingPole?: boolean;
  /** ID original do poste existente (se aplicável). */
  existingPoleId?: string;
}

interface MtGraphEdge {
  from: string;
  to: string;
  lengthMeters: number;
}

function mtDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function mtNodeId(lat: number, lon: number): string {
  return `${lat.toFixed(7)},${lon.toFixed(7)}`;
}

function parseNodeId(nodeId: string): { lat: number; lon: number } | null {
  const parts = nodeId.split(",");
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function buildRoadGraph(
  input: DgMtRouterInput,
  mergeThresholdMeters: number,
): {
  nodes: Map<string, MtGraphNode>;
  adjacency: Map<string, MtGraphEdge[]>;
} {
  const nodes = new Map<string, MtGraphNode>();
  const adjacency = new Map<string, MtGraphEdge[]>();

  /**
   * Retorna o ID de um nó existente próximo dentro do threshold de fusão,
   * ou null se não houver nenhum. Complexidade O(N) — aceitável para grafos
   * viários de projetos (<= alguns milhares de nós).
   */
  const findNearbyNode = (utm: { x: number; y: number }): string | null => {
    if (mergeThresholdMeters <= 0) return null;
    for (const node of nodes.values()) {
      if (mtDistance(utm, node.point) <= mergeThresholdMeters) {
        return node.id;
      }
    }
    return null;
  };

  const addNode = (lat: number, lon: number): string => {
    const utm = latLonToUtm(lat, lon);
    // Fuzzy snap: reutiliza nó existente se estiver dentro do threshold
    const nearby = findNearbyNode(utm);
    if (nearby) return nearby;
    const id = mtNodeId(lat, lon);
    if (!nodes.has(id)) {
      nodes.set(id, { id, point: utm });
      adjacency.set(id, []);
    }
    return id;
  };

  const addEdge = (from: string, to: string): void => {
    if (from === to) return;
    const fromNode = nodes.get(from);
    const toNode = nodes.get(to);
    if (!fromNode || !toNode) return;
    const lengthMeters = mtDistance(fromNode.point, toNode.point);
    if (lengthMeters <= 0) return;
    adjacency.get(from)?.push({ from, to, lengthMeters });
    adjacency.get(to)?.push({ from: to, to: from, lengthMeters });
  };

  // Corredores viários
  for (const corridor of input.roadCorridors) {
    if (corridor.centerPoints.length < 2) continue;
    let previous: string | null = null;
    for (const point of corridor.centerPoints) {
      const current = addNode(point.lat, point.lon);
      if (previous) addEdge(previous, current);
      previous = current;
    }
  }

  // Postes existentes: injetados como nós prioritários no grafo
  for (const pole of input.existingPoles ?? []) {
    const utm = latLonToUtm(pole.position.lat, pole.position.lon);
    const nearby = findNearbyNode(utm);
    if (nearby) {
      // Promove o nó existente a "existingPole"
      const node = nodes.get(nearby);
      if (node && !node.isExistingPole) {
        node.isExistingPole = true;
        node.existingPoleId = pole.id;
      }
    } else {
      const id = mtNodeId(pole.position.lat, pole.position.lon);
      nodes.set(id, { id, point: utm, isExistingPole: true, existingPoleId: pole.id });
      adjacency.set(id, []);
    }
  }

  return { nodes, adjacency };
}

function findClosestNode(
  nodes: Map<string, MtGraphNode>,
  lat: number,
  lon: number,
): { nodeId: string; distanceMeters: number } | null {
  if (nodes.size === 0) return null;
  const point = latLonToUtm(lat, lon);
  let best: { nodeId: string; distanceMeters: number } | null = null;

  for (const node of nodes.values()) {
    const d = mtDistance(point, node.point);
    if (!best || d < best.distanceMeters) {
      best = { nodeId: node.id, distanceMeters: d };
    }
  }
  return best;
}

function shortestPath(
  adjacency: Map<string, MtGraphEdge[]>,
  source: string,
  target: string,
): { nodeIds: string[]; lengthMeters: number } | null {
  if (source === target) return { nodeIds: [source], lengthMeters: 0 };

  const dist = new Map<string, number>([[source, 0]]);
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  const queue = new Set<string>([source]);

  while (queue.size > 0) {
    let u: string | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const n of queue) {
      const d = dist.get(n) ?? Number.POSITIVE_INFINITY;
      if (d < best) {
        best = d;
        u = n;
      }
    }
    if (!u) break;

    queue.delete(u);
    if (u === target) break;
    if (visited.has(u)) continue;
    visited.add(u);

    for (const edge of adjacency.get(u) ?? []) {
      const alt = (dist.get(u) ?? Number.POSITIVE_INFINITY) + edge.lengthMeters;
      if (alt < (dist.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        dist.set(edge.to, alt);
        prev.set(edge.to, u);
        queue.add(edge.to);
      }
    }
  }

  const lengthMeters = dist.get(target);
  if (lengthMeters == null || !Number.isFinite(lengthMeters)) return null;

  const nodeIds: string[] = [];
  let current: string | undefined = target;
  while (current) {
    nodeIds.push(current);
    if (current === source) break;
    current = prev.get(current);
  }

  if (nodeIds[nodeIds.length - 1] !== source) return null;
  nodeIds.reverse();
  return { nodeIds, lengthMeters };
}

function uniqueEdgeKey(a: string, b: string): string {
  return a < b ? `${a}→${b}` : `${b}→${a}`;
}

/** Constrói o rascunho de topologia MT a partir do conjunto de edges calculados. */
function buildMtTopologyDraft(
  edges: DgMtRouterEdge[],
  nodes: Map<string, MtGraphNode>,
): DgMtTopologyDraft {
  const poleMap = new Map<string, DgMtTopologyDraft["poles"][number]>();

  for (const edge of edges) {
    for (const nodeId of [edge.fromNodeId, edge.toNodeId]) {
      if (poleMap.has(nodeId)) continue;
      const node = nodes.get(nodeId);
      const parsed = parseNodeId(nodeId);
      if (!parsed) continue;
      const isExisting = node?.isExistingPole ?? false;
      const existingId = node?.existingPoleId;
      poleMap.set(nodeId, {
        id: existingId ?? `mt-rtr-${nodeId}`,
        lat: parsed.lat,
        lng: parsed.lon,
        title: isExisting ? (existingId ?? "Poste existente") : `MT-${nodeId.slice(0, 12)}`,
        structureType: edge.structureType,
        nodeChangeFlag: isExisting ? "existing" : "new",
      });
    }
  }

  const draftEdges = edges.map((edge, i) => ({
    id: `mt-rtr-edge-${i}`,
    fromPoleId: nodes.get(edge.fromNodeId)?.existingPoleId ?? `mt-rtr-${edge.fromNodeId}`,
    toPoleId: nodes.get(edge.toNodeId)?.existingPoleId ?? `mt-rtr-${edge.toNodeId}`,
    lengthMeters: edge.lengthMeters,
    conductorId: edge.conductorId,
    structureType: edge.structureType,
  }));

  return { poles: [...poleMap.values()], edges: draftEdges };
}

export function planMtRouter(input: DgMtRouterInput): DgMtRouterResult {
  const maxSnapDistanceMeters = input.maxSnapDistanceMeters ?? 150;
  const mergeThreshold = input.nodeMergeThresholdMeters ?? DEFAULT_NODE_MERGE_THRESHOLD_M;
  const conductorId = input.networkProfile?.conductorId;
  const structureType = input.networkProfile?.structureType;

  if (!input.terminals.length) {
    return {
      feasible: false,
      reason: "É necessário informar ao menos um terminal (trafo).",
      connectedTerminals: 0,
      totalLengthMeters: 0,
      edges: [],
      paths: [],
    };
  }

  const { nodes, adjacency } = buildRoadGraph(input, mergeThreshold);
  if (nodes.size === 0) {
    return {
      feasible: false,
      reason: "Grafo viário vazio. Forneça roadCorridors com ao menos 2 pontos por corredor.",
      connectedTerminals: 0,
      totalLengthMeters: 0,
      edges: [],
      paths: [],
    };
  }

  const sourceSnap = findClosestNode(nodes, input.source.lat, input.source.lon);
  if (!sourceSnap || sourceSnap.distanceMeters > maxSnapDistanceMeters) {
    return {
      feasible: false,
      reason: "Origem MT distante demais da malha viária para snap seguro.",
      connectedTerminals: 0,
      totalLengthMeters: 0,
      edges: [],
      paths: [],
    };
  }

  const uniqueEdges = new Map<string, DgMtRouterEdge>();
  const paths: DgMtRouterResult["paths"] = [];

  for (const terminal of input.terminals) {
    const terminalSnap = findClosestNode(nodes, terminal.position.lat, terminal.position.lon);
    if (!terminalSnap || terminalSnap.distanceMeters > maxSnapDistanceMeters) {
      continue;
    }

    const route = shortestPath(adjacency, sourceSnap.nodeId, terminalSnap.nodeId);
    if (!route) continue;

    paths.push({
      terminalId: terminal.id,
      lengthMeters: route.lengthMeters,
      nodeIds: route.nodeIds,
    });

    for (let i = 0; i < route.nodeIds.length - 1; i++) {
      const fromNodeId = route.nodeIds[i];
      const toNodeId = route.nodeIds[i + 1];
      const fromNode = nodes.get(fromNodeId);
      const toNode = nodes.get(toNodeId);
      if (!fromNode || !toNode) continue;
      const key = uniqueEdgeKey(fromNodeId, toNodeId);
      if (!uniqueEdges.has(key)) {
        const fromLatLon = parseNodeId(fromNodeId) ?? undefined;
        const toLatLon = parseNodeId(toNodeId) ?? undefined;
        uniqueEdges.set(key, {
          fromNodeId,
          toNodeId,
          fromLatLon,
          toLatLon,
          lengthMeters: mtDistance(fromNode.point, toNode.point),
          conductorId,
          structureType,
          isExistingPoleFrom: fromNode.isExistingPole,
          isExistingPoleTo: toNode.isExistingPole,
        });
      }
    }
  }

  const edges = [...uniqueEdges.values()];
  const totalLengthMeters = edges.reduce((sum, edge) => sum + edge.lengthMeters, 0);
  const mtTopologyDraft =
    edges.length > 0 ? buildMtTopologyDraft(edges, nodes) : undefined;

  return {
    feasible: paths.length > 0,
    reason:
      paths.length > 0
        ? undefined
        : "Nenhum terminal foi conectado via grafo viário dentro do raio de snap.",
    sourceNodeId: sourceSnap.nodeId,
    connectedTerminals: paths.length,
    totalLengthMeters,
    edges,
    paths,
    mtTopologyDraft,
  };
}
