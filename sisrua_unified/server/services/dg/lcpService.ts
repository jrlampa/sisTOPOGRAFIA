/**
 * Motor Least-Cost Path (LCP) — Implementação
 *
 * Dijkstra ponderado sobre grafo viário com perfis de custo configuráveis.
 * Suporta: penalidade por classe de via, bônus de reuso de postes existentes,
 * penalidade por área sensível, custo fixo por travessia especial.
 *
 * Referência: T2.59 — docs/STRATEGIC_ROADMAP_2026.md
 */

import { latLonToUtm } from "./dgCandidates.js";
import { logger } from "../../utils/logger.js";
import {
  LCP_COST_PROFILES,
  type LcpCostProfile,
  type LcpEdge,
  type LcpHighwayClass,
  type LcpInput,
  type LcpPath,
  type LcpPathSegment,
  type LcpResult,
  type LcpRoadSegment,
} from "./lcpTypes.js";

// ─── Estruturas internas ─────────────────────────────────────────────────────

interface LcpGraphNode {
  id: string;
  point: { x: number; y: number };
  isExistingPole: boolean;
  existingPoleId?: string;
}

interface LcpGraphEdge {
  from: string;
  to: string;
  lengthMeters: number;
  /** Custo ponderado já calculado. */
  weightedCost: number;
  highwayClass?: LcpHighwayClass;
  isSensitiveArea: boolean;
  fixedPenalty: number;
}

const DEFAULT_MERGE_THRESHOLD_M = 0.5;
const DEFAULT_SNAP_DISTANCE_M = 150;

// ─── Distância euclidiana UTM ────────────────────────────────────────────────

function dist(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function nodeId(lat: number, lon: number): string {
  return `${lat.toFixed(7)},${lon.toFixed(7)}`;
}

function parseNodeId(id: string): { lat: number; lon: number } | null {
  const parts = id.split(",");
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// ─── Cálculo de custo de aresta ──────────────────────────────────────────────

function computeEdgeCost(
  lengthMeters: number,
  profile: LcpCostProfile,
  highwayClass: LcpHighwayClass | undefined,
  isSensitiveArea: boolean,
  fixedPenalty: number,
  hasExistingPole: boolean,
): number {
  const highwayMult =
    highwayClass != null
      ? (profile.highwayMultiplier[highwayClass] ?? 1.0)
      : 1.0;
  const sensitiveMult = isSensitiveArea ? profile.sensitiveCrossing : 1.0;
  const existingBonus = hasExistingPole ? profile.existingPoleBonus : 1.0;
  return (
    lengthMeters * highwayMult * sensitiveMult * existingBonus + fixedPenalty
  );
}

// ─── Construção do grafo ponderado ───────────────────────────────────────────

function buildLcpGraph(
  segments: LcpRoadSegment[],
  existingPoles: LcpInput["existingPoles"],
  profile: LcpCostProfile,
  mergeThreshold: number,
): {
  nodes: Map<string, LcpGraphNode>;
  adjacency: Map<string, LcpGraphEdge[]>;
} {
  const nodes = new Map<string, LcpGraphNode>();
  const adjacency = new Map<string, LcpGraphEdge[]>();

  const findNearby = (utm: { x: number; y: number }): string | null => {
    if (mergeThreshold <= 0) return null;
    for (const n of nodes.values()) {
      if (dist(utm, n.point) <= mergeThreshold) return n.id;
    }
    return null;
  };

  const addNode = (lat: number, lon: number): string => {
    const utm = latLonToUtm(lat, lon);
    const nearby = findNearby(utm);
    if (nearby) return nearby;
    const id = nodeId(lat, lon);
    if (!nodes.has(id)) {
      nodes.set(id, { id, point: utm, isExistingPole: false });
      adjacency.set(id, []);
    }
    return id;
  };

  // Construção a partir dos segmentos viários
  for (const seg of segments) {
    if (seg.centerPoints.length < 2) continue;
    const isSensitive = seg.isSensitiveArea ?? false;
    const fixedPenalty = seg.fixedPenalty ?? 0;
    const highwayClass = (seg.highwayClass ?? seg.highwayClass) as
      | LcpHighwayClass
      | undefined;

    let prev: string | null = null;
    for (const pt of seg.centerPoints) {
      const cur = addNode(pt.lat, pt.lon);
      if (prev && prev !== cur) {
        const fromNode = nodes.get(prev)!;
        const toNode = nodes.get(cur)!;
        const lengthMeters = dist(fromNode.point, toNode.point);
        if (lengthMeters <= 0) {
          prev = cur;
          continue;
        }

        const hasExisting = fromNode.isExistingPole || toNode.isExistingPole;
        const wCost = computeEdgeCost(
          lengthMeters,
          profile,
          highwayClass,
          isSensitive,
          fixedPenalty,
          hasExisting,
        );

        const edge: LcpGraphEdge = {
          from: prev,
          to: cur,
          lengthMeters,
          weightedCost: wCost,
          highwayClass,
          isSensitiveArea: isSensitive,
          fixedPenalty,
        };
        adjacency.get(prev)!.push(edge);
        adjacency.get(cur)!.push({
          ...edge,
          from: cur,
          to: prev,
        });
      }
      prev = cur;
    }
  }

  // Injeta postes existentes e atualiza custos dos vizinhos
  for (const pole of existingPoles ?? []) {
    const utm = latLonToUtm(pole.position.lat, pole.position.lon);
    const nearby = findNearby(utm);
    if (nearby) {
      const n = nodes.get(nearby);
      if (n && !n.isExistingPole) {
        n.isExistingPole = true;
        n.existingPoleId = pole.id;
        // Re-calcula custo das arestas adjacentes com bônus
        const edges = adjacency.get(nearby) ?? [];
        for (const e of edges) {
          e.weightedCost = computeEdgeCost(
            e.lengthMeters,
            profile,
            e.highwayClass,
            e.isSensitiveArea,
            e.fixedPenalty,
            true,
          );
        }
      }
    } else {
      const id = nodeId(pole.position.lat, pole.position.lon);
      nodes.set(id, {
        id,
        point: utm,
        isExistingPole: true,
        existingPoleId: pole.id,
      });
      adjacency.set(id, []);
    }
  }

  return { nodes, adjacency };
}

// ─── Dijkstra ponderado ──────────────────────────────────────────────────────

interface DijkstraResult {
  dist: Map<string, number>;
  prev: Map<string, string>;
  prevEdge: Map<string, LcpGraphEdge>;
}

function dijkstra(
  adjacency: Map<string, LcpGraphEdge[]>,
  source: string,
): DijkstraResult {
  const distMap = new Map<string, number>([[source, 0]]);
  const prev = new Map<string, string>();
  const prevEdge = new Map<string, LcpGraphEdge>();
  const visited = new Set<string>();
  const queue = new Set<string>([source]);

  while (queue.size > 0) {
    let u: string | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const n of queue) {
      const d = distMap.get(n) ?? Number.POSITIVE_INFINITY;
      if (d < best) {
        best = d;
        u = n;
      }
    }
    if (!u) break;
    queue.delete(u);
    if (visited.has(u)) continue;
    visited.add(u);

    for (const edge of adjacency.get(u) ?? []) {
      const alt = (distMap.get(u) ?? Infinity) + edge.weightedCost;
      if (alt < (distMap.get(edge.to) ?? Infinity)) {
        distMap.set(edge.to, alt);
        prev.set(edge.to, u);
        prevEdge.set(edge.to, edge);
        queue.add(edge.to);
      }
    }
  }

  return { dist: distMap, prev, prevEdge };
}

// ─── Reconstrói caminho a partir do resultado Dijkstra ──────────────────────

function reconstructPath(
  target: string,
  nodes: Map<string, LcpGraphNode>,
  dijkstra: DijkstraResult,
): LcpPathSegment[] | null {
  const segments: LcpPathSegment[] = [];
  let current = target;

  while (dijkstra.prev.has(current)) {
    const edge = dijkstra.prevEdge.get(current);
    const from = dijkstra.prev.get(current)!;
    if (!edge) return null;

    const fromNode = nodes.get(from);
    const toNode = nodes.get(current);

    segments.push({
      fromNodeId: from,
      toNodeId: current,
      fromLatLon: parseNodeId(from) ?? undefined,
      toLatLon: parseNodeId(current) ?? undefined,
      lengthMeters: edge.lengthMeters,
      weightedCost: edge.weightedCost,
      highwayClass: edge.highwayClass,
      usesExistingPole:
        fromNode?.isExistingPole || toNode?.isExistingPole || false,
      isSensitiveArea: edge.isSensitiveArea,
    });

    current = from;
  }

  if (segments.length === 0) return null;
  segments.reverse();
  return segments;
}

function findClosest(
  nodes: Map<string, LcpGraphNode>,
  lat: number,
  lon: number,
): { nodeId: string; distanceMeters: number } | null {
  if (nodes.size === 0) return null;
  const pt = latLonToUtm(lat, lon);
  let best: { nodeId: string; distanceMeters: number } | null = null;
  for (const n of nodes.values()) {
    const d = dist(pt, n.point);
    if (!best || d < best.distanceMeters)
      best = { nodeId: n.id, distanceMeters: d };
  }
  return best;
}

// ─── API pública ─────────────────────────────────────────────────────────────

export function computeLcpRoutes(input: LcpInput): LcpResult {
  const profile = input.costProfile ?? LCP_COST_PROFILES["URBAN_STANDARD"]!;
  const maxSnap = input.maxSnapDistanceMeters ?? DEFAULT_SNAP_DISTANCE_M;
  const mergeThreshold =
    input.nodeMergeThresholdMeters ?? DEFAULT_MERGE_THRESHOLD_M;

  if (!input.terminals.length) {
    return {
      feasible: false,
      reason: "É necessário informar ao menos um terminal.",
      runId: input.runId,
      costProfileId: profile.id,
      connectedTerminals: 0,
      totalLengthMeters: 0,
      totalWeightedCost: 0,
      edges: [],
      paths: [],
      unreachableTerminals: [],
      totalExistingPolesReused: 0,
    };
  }

  if (!input.roadSegments.length) {
    return {
      feasible: false,
      reason: "Nenhum corredor viário fornecido. Forneça roadSegments.",
      runId: input.runId,
      costProfileId: profile.id,
      connectedTerminals: 0,
      totalLengthMeters: 0,
      totalWeightedCost: 0,
      edges: [],
      paths: [],
      unreachableTerminals: input.terminals.map((t) => t.id),
      totalExistingPolesReused: 0,
    };
  }

  const { nodes, adjacency } = buildLcpGraph(
    input.roadSegments,
    input.existingPoles,
    profile,
    mergeThreshold,
  );

  if (nodes.size === 0) {
    return {
      feasible: false,
      reason: "Grafo viário vazio após processamento dos corredores.",
      runId: input.runId,
      costProfileId: profile.id,
      connectedTerminals: 0,
      totalLengthMeters: 0,
      totalWeightedCost: 0,
      edges: [],
      paths: [],
      unreachableTerminals: input.terminals.map((t) => t.id),
      totalExistingPolesReused: 0,
    };
  }

  // Snap da origem
  const sourceSnap = findClosest(nodes, input.source.lat, input.source.lon);
  if (!sourceSnap || sourceSnap.distanceMeters > maxSnap) {
    return {
      feasible: false,
      reason: "Origem LCP distante demais da malha viária para snap seguro.",
      runId: input.runId,
      costProfileId: profile.id,
      connectedTerminals: 0,
      totalLengthMeters: 0,
      totalWeightedCost: 0,
      edges: [],
      paths: [],
      unreachableTerminals: input.terminals.map((t) => t.id),
      totalExistingPolesReused: 0,
    };
  }

  // Dijkstra a partir da origem
  const dijk = dijkstra(adjacency, sourceSnap.nodeId);

  const paths: LcpPath[] = [];
  const unreachable: string[] = [];
  const uniqueEdges = new Map<string, LcpEdge>();

  for (const terminal of input.terminals) {
    const termSnap = findClosest(
      nodes,
      terminal.position.lat,
      terminal.position.lon,
    );
    if (!termSnap || termSnap.distanceMeters > maxSnap) {
      unreachable.push(terminal.id);
      continue;
    }

    const totalCost = dijk.dist.get(termSnap.nodeId);
    if (totalCost == null || !Number.isFinite(totalCost)) {
      unreachable.push(terminal.id);
      continue;
    }

    const segments = reconstructPath(termSnap.nodeId, nodes, dijk);
    if (!segments) {
      unreachable.push(terminal.id);
      continue;
    }

    let totalLength = 0;
    let existingPolesReused = 0;
    let sensitiveCrossings = 0;

    for (const seg of segments) {
      totalLength += seg.lengthMeters;
      if (seg.usesExistingPole) existingPolesReused++;
      if (seg.isSensitiveArea) sensitiveCrossings++;

      // Deduplica edges para renderização
      const key = edgeKey(seg.fromNodeId, seg.toNodeId);
      if (!uniqueEdges.has(key)) {
        uniqueEdges.set(key, {
          fromNodeId: seg.fromNodeId,
          toNodeId: seg.toNodeId,
          fromLatLon: seg.fromLatLon,
          toLatLon: seg.toLatLon,
          lengthMeters: seg.lengthMeters,
          weightedCost: seg.weightedCost,
          highwayClass: seg.highwayClass,
          usesExistingPole: seg.usesExistingPole,
          isSensitiveArea: seg.isSensitiveArea,
        });
      }
    }

    const estimatedCostBrl = profile.baseCostPerMeter * totalLength;

    paths.push({
      terminalId: terminal.id,
      totalLengthMeters: totalLength,
      totalWeightedCost: totalCost,
      estimatedCostBrl,
      segments,
      existingPolesReused,
      sensitiveCrossings,
    });
  }

  const edges = [...uniqueEdges.values()];
  const totalLengthMeters = paths.reduce((s, p) => s + p.totalLengthMeters, 0);
  const totalWeightedCost = paths.reduce((s, p) => s + p.totalWeightedCost, 0);
  const estimatedCostBrl = paths.reduce(
    (s, p) => s + (p.estimatedCostBrl ?? 0),
    0,
  );
  const totalExistingPolesReused = paths.reduce(
    (s, p) => s + p.existingPolesReused,
    0,
  );

  logger.info("LCP Motor: rotas calculadas", {
    runId: input.runId,
    costProfile: profile.id,
    terminals: input.terminals.length,
    connected: paths.length,
    unreachable: unreachable.length,
    totalLengthMeters: totalLengthMeters.toFixed(1),
    totalExistingPolesReused,
  });

  return {
    feasible: paths.length > 0,
    reason:
      paths.length === 0
        ? "Nenhum terminal alcançado via motor LCP."
        : undefined,
    runId: input.runId,
    costProfileId: profile.id,
    connectedTerminals: paths.length,
    totalLengthMeters,
    totalWeightedCost,
    estimatedCostBrl,
    edges,
    paths,
    unreachableTerminals: unreachable,
    totalExistingPolesReused,
  };
}
