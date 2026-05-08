/**
 * Design Generativo — MT Router (Grafo Viário + Menor Caminho)
 *
 * Implementa a lógica de roteamento de média tensão seguindo a malha urbana,
 * com suporte a snap de postes existentes e geração de rascunho inteligente.
 */

import { latLonToUtm } from "./dgCandidates.js";
import type {
  DgMtRouterInput,
  DgMtRouterResult,
  DgMtRouterEdge,
  DgMtTopologyDraft,
  DgMtPoleDiagnostic,
  DgMtCqtReadiness,
} from "./dgTypes.js";

/** Threshold padrão de fusão de nós adjacentes (0.5 m em UTM). */
const DEFAULT_NODE_MERGE_THRESHOLD_M = 0.5;
const DEFAULT_MT_MAX_SPAN_M = 40;
const DEFAULT_MT_NOMINAL_POLE_LOAD_DAN = 600;
const DEFAULT_MT_BASE_CONDUCTOR_TENSION_DAN = 700;
const PASS_THROUGH_ANGLE_LIMIT_DEG = 5;
const ANCHOR_ANGLE_LIMIT_DEG = 30;

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

interface MtDraftBundle {
  draft: DgMtTopologyDraft;
  poleDiagnostics: DgMtPoleDiagnostic[];
  engineeringWarnings: string[];
  mtCqtReadiness: DgMtCqtReadiness;
}

function mtDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
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

function interpolateLatLon(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  ratio: number,
): { lat: number; lon: number } {
  return {
    lat: from.lat + (to.lat - from.lat) * ratio,
    lon: from.lon + (to.lon - from.lon) * ratio,
  };
}

const DEFAULT_MT_VOLTAGE_KV = 13.2;
const DEFAULT_MT_CQT_LIMIT_FRACTION = 0.0182;

function buildMtCqtReadiness(
  conductorId?: string,
  mtCqtParams?: { voltageKv: number; cqtLimitFraction: number },
): DgMtCqtReadiness {
  const voltageKv = mtCqtParams?.voltageKv ?? DEFAULT_MT_VOLTAGE_KV;
  const limitPct =
    (mtCqtParams?.cqtLimitFraction ?? DEFAULT_MT_CQT_LIMIT_FRACTION) * 100;

  // Tensão e limite configurados → único input pendente é a demanda por terminal
  const pendingInputs = ["terminalDemandKva", "powerFactorProfile"];

  return {
    ready: false,
    conductorId,
    pendingInputs,
    note: `Smart-Draft MT configurado: ${voltageKv} kV / CQT ≤ ${limitPct.toFixed(2)}%. O cálculo de queda de tensão Tier 2/3 fica habilitado quando a rota receber demanda por terminal e fator de potência.`,
  };
}

function getStructureFamily(structureType?: string): string {
  const match = (structureType ?? "").trim().match(/^[A-Za-z]+/);
  return (match?.[0] ?? "N").toUpperCase();
}

function createSupportStructureType(
  family: string,
  degree: number,
  deflectionAngleDegrees: number,
): string {
  if (degree <= 1) {
    return `${family}3`;
  }
  if (degree > 2) {
    return `${family}4`;
  }
  if (deflectionAngleDegrees <= PASS_THROUGH_ANGLE_LIMIT_DEG) {
    return `${family}1`;
  }
  if (deflectionAngleDegrees <= ANCHOR_ANGLE_LIMIT_DEG) {
    return `${family}2`;
  }
  return `${family}3`;
}

function roundToEngineeringLoad(loadDan: number): number {
  return Math.ceil(loadDan / 50) * 50;
}

function splitEdgeBySpanLimit(
  edge: DgMtRouterEdge,
  nodes: Map<string, MtGraphNode>,
  maxSpanMeters: number,
): DgMtRouterEdge[] {
  if (edge.lengthMeters <= maxSpanMeters) {
    return [edge];
  }

  const fromLatLon = edge.fromLatLon ?? parseNodeId(edge.fromNodeId);
  const toLatLon = edge.toLatLon ?? parseNodeId(edge.toNodeId);
  const fromNode = nodes.get(edge.fromNodeId);
  const toNode = nodes.get(edge.toNodeId);

  if (!fromLatLon || !toLatLon || !fromNode || !toNode) {
    return [edge];
  }

  const segmentCount = Math.ceil(edge.lengthMeters / maxSpanMeters);
  const segments: DgMtRouterEdge[] = [];
  let currentNodeId = edge.fromNodeId;
  let currentLatLon = fromLatLon;
  let currentNode = fromNode;

  for (let index = 1; index <= segmentCount; index++) {
    const isLast = index === segmentCount;
    let nextNodeId = edge.toNodeId;
    let nextLatLon = toLatLon;
    let nextNode = toNode;

    if (!isLast) {
      const ratio = index / segmentCount;
      nextLatLon = interpolateLatLon(fromLatLon, toLatLon, ratio);
      nextNodeId = `${edge.fromNodeId}::span::${index}`;
      nextNode = {
        id: nextNodeId,
        point: latLonToUtm(nextLatLon.lat, nextLatLon.lon),
      };
      nodes.set(nextNodeId, nextNode);
    }

    segments.push({
      ...edge,
      fromNodeId: currentNodeId,
      toNodeId: nextNodeId,
      fromLatLon: currentLatLon,
      toLatLon: nextLatLon,
      lengthMeters: mtDistance(currentNode.point, nextNode.point),
      spanLimited: true,
      segmentIndex: index,
      segmentCount,
      isExistingPoleFrom: nodes.get(currentNodeId)?.isExistingPole,
      isExistingPoleTo: nodes.get(nextNodeId)?.isExistingPole,
    });

    currentNodeId = nextNodeId;
    currentLatLon = nextLatLon;
    currentNode = nextNode;
  }

  return segments;
}

function buildMtSmartDraft(
  edges: DgMtRouterEdge[],
  nodes: Map<string, MtGraphNode>,
  sourceNodeId: string,
  terminalNodeIds: Set<string>,
  networkProfile?: DgMtRouterInput["networkProfile"],
  mtCqtParams?: DgMtRouterInput["mtCqtParams"],
): MtDraftBundle {
  const structureFamily = getStructureFamily(networkProfile?.structureType);
  const poleMap = new Map<string, DgMtTopologyDraft["poles"][number]>();
  const neighborMap = new Map<string, Set<string>>();

  for (const edge of edges) {
    const fromNeighbors = neighborMap.get(edge.fromNodeId) ?? new Set<string>();
    fromNeighbors.add(edge.toNodeId);
    neighborMap.set(edge.fromNodeId, fromNeighbors);

    const toNeighbors = neighborMap.get(edge.toNodeId) ?? new Set<string>();
    toNeighbors.add(edge.fromNodeId);
    neighborMap.set(edge.toNodeId, toNeighbors);
  }

  const diagnostics: DgMtPoleDiagnostic[] = [];
  const warnings: string[] = [];

  for (const [nodeId, neighbors] of neighborMap.entries()) {
    const node = nodes.get(nodeId);
    const parsed = parseNodeId(nodeId);
    if (!node || !parsed) {
      continue;
    }

    const vectors = [...neighbors]
      .map((neighborId) => {
        const neighbor = nodes.get(neighborId);
        if (!neighbor) {
          return null;
        }
        const dx = neighbor.point.x - node.point.x;
        const dy = neighbor.point.y - node.point.y;
        const norm = Math.hypot(dx, dy);
        if (norm <= 0) {
          return null;
        }
        return { x: dx / norm, y: dy / norm };
      })
      .filter((vector): vector is { x: number; y: number } => vector !== null);

    const degree = vectors.length;
    let deflectionAngleDegrees = 0;
    if (degree === 2) {
      const dot = Math.max(
        -1,
        Math.min(1, vectors[0].x * vectors[1].x + vectors[0].y * vectors[1].y),
      );
      const includedAngle = (Math.acos(dot) * 180) / Math.PI;
      deflectionAngleDegrees = Math.abs(180 - includedAngle);
    } else if (degree > 2) {
      deflectionAngleDegrees = 45;
    }

    const supportStructureType = createSupportStructureType(
      structureFamily,
      degree,
      deflectionAngleDegrees,
    );
    const hasTransformerMount = terminalNodeIds.has(nodeId);
    const forceVector = vectors.reduce(
      (acc, vector) => ({
        x: acc.x + vector.x * DEFAULT_MT_BASE_CONDUCTOR_TENSION_DAN,
        y: acc.y + vector.y * DEFAULT_MT_BASE_CONDUCTOR_TENSION_DAN,
      }),
      { x: 0, y: 0 },
    );
    const resultantLoadDan = Math.hypot(forceVector.x, forceVector.y);
    const severity: DgMtPoleDiagnostic["severity"] =
      resultantLoadDan > 900
        ? "critical"
        : resultantLoadDan > DEFAULT_MT_NOMINAL_POLE_LOAD_DAN
          ? "warning"
          : "normal";
    const poleId = node.existingPoleId ?? `mt-rtr-${nodeId}`;
    const title = node.isExistingPole
      ? (node.existingPoleId ?? "Poste existente")
      : `MT-${nodeId.slice(0, 12)}`;
    const roundedLoadDan = roundToEngineeringLoad(resultantLoadDan);
    const mtStructures = hasTransformerMount
      ? { n1: "H1", n2: supportStructureType }
      : { n1: supportStructureType };

    poleMap.set(nodeId, {
      id: poleId,
      lat: parsed.lat,
      lng: parsed.lon,
      title,
      structureType: hasTransformerMount ? "H1" : supportStructureType,
      mtStructures,
      nodeChangeFlag: node.isExistingPole ? "existing" : "new",
    });

    const requiresReinforcement = severity !== "normal";
    const message = requiresReinforcement
      ? `Poste ${title} requer reforço (${roundedLoadDan} daN) ou estaiamento devido ao ângulo de ${deflectionAngleDegrees.toFixed(0)}°. `
      : undefined;

    diagnostics.push({
      poleId,
      nodeId,
      lat: parsed.lat,
      lng: parsed.lon,
      title,
      degree,
      deflectionAngleDegrees,
      resultantLoadDan,
      nominalLoadDan: DEFAULT_MT_NOMINAL_POLE_LOAD_DAN,
      severity,
      supportStructureType,
      hasTransformerMount,
      requiresReinforcement,
      message,
    });

    if (message) {
      warnings.push(message.trim());
    }
  }

  const draftEdges = edges.map((edge, index) => ({
    id: `mt-rtr-edge-${index}`,
    fromPoleId:
      nodes.get(edge.fromNodeId)?.existingPoleId ?? `mt-rtr-${edge.fromNodeId}`,
    toPoleId:
      nodes.get(edge.toNodeId)?.existingPoleId ?? `mt-rtr-${edge.toNodeId}`,
    lengthMeters: edge.lengthMeters,
    conductorId: edge.conductorId,
    structureType: edge.structureType,
  }));

  return {
    draft: { poles: [...poleMap.values()], edges: draftEdges },
    poleDiagnostics: diagnostics.sort(
      (left, right) => right.resultantLoadDan - left.resultantLoadDan,
    ),
    engineeringWarnings: warnings,
    mtCqtReadiness: buildMtCqtReadiness(
      networkProfile?.conductorId,
      mtCqtParams,
    ),
  };
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

  for (const corridor of input.roadCorridors) {
    if (corridor.centerPoints.length < 2) continue;
    let previous: string | null = null;
    for (const point of corridor.centerPoints) {
      const current = addNode(point.lat, point.lon);
      if (previous) addEdge(previous, current);
      previous = current;
    }
  }

  for (const pole of input.existingPoles ?? []) {
    const utm = latLonToUtm(pole.position.lat, pole.position.lon);
    const nearby = findNearbyNode(utm);
    if (nearby) {
      const node = nodes.get(nearby);
      if (node && !node.isExistingPole) {
        node.isExistingPole = true;
        node.existingPoleId = pole.id;
      }
    } else {
      const id = mtNodeId(pole.position.lat, pole.position.lon);
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
export function planMtRouter(input: DgMtRouterInput): DgMtRouterResult {
  const maxSnapDistanceMeters = input.maxSnapDistanceMeters ?? 150;
  const mergeThreshold =
    input.nodeMergeThresholdMeters ?? DEFAULT_NODE_MERGE_THRESHOLD_M;
  const conductorId = input.networkProfile?.conductorId;
  const structureType = input.networkProfile?.structureType;
  const maxSpanMeters = DEFAULT_MT_MAX_SPAN_M;
  const mtCqtReadiness = buildMtCqtReadiness(conductorId, input.mtCqtParams);

  if (!input.terminals.length) {
    return {
      feasible: false,
      reason: "É necessário informar ao menos um terminal (trafo).",
      connectedTerminals: 0,
      totalLengthMeters: 0,
      edges: [],
      paths: [],
      unreachableTerminals: [],
      poleDiagnostics: [],
      engineeringWarnings: [],
      mtCqtReadiness,
    };
  }

  const { nodes, adjacency } = buildRoadGraph(input, mergeThreshold);
  if (nodes.size === 0) {
    return {
      feasible: false,
      reason:
        "Grafo viário vazio. Forneça roadCorridors com ao menos 2 pontos por corredor.",
      connectedTerminals: 0,
      totalLengthMeters: 0,
      edges: [],
      paths: [],
      unreachableTerminals: input.terminals.map((terminal) => terminal.id),
      poleDiagnostics: [],
      engineeringWarnings: [],
      mtCqtReadiness,
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
      unreachableTerminals: input.terminals.map((terminal) => terminal.id),
      poleDiagnostics: [],
      engineeringWarnings: [],
      mtCqtReadiness,
    };
  }

  const uniqueEdges = new Map<string, DgMtRouterEdge>();
  const paths: DgMtRouterResult["paths"] = [];
  const reachableTerminalIds = new Set<string>();
  const terminalNodeIds = new Set<string>();

  for (const terminal of input.terminals) {
    const terminalSnap = findClosestNode(
      nodes,
      terminal.position.lat,
      terminal.position.lon,
    );
    if (!terminalSnap || terminalSnap.distanceMeters > maxSnapDistanceMeters) {
      continue;
    }

    const route = shortestPath(
      adjacency,
      sourceSnap.nodeId,
      terminalSnap.nodeId,
    );
    if (!route) continue;

    paths.push({
      terminalId: terminal.id,
      lengthMeters: route.lengthMeters,
      nodeIds: route.nodeIds,
    });
    reachableTerminalIds.add(terminal.id);
    terminalNodeIds.add(route.nodeIds[route.nodeIds.length - 1]);

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

  const edges = [...uniqueEdges.values()].flatMap((edge) =>
    splitEdgeBySpanLimit(edge, nodes, maxSpanMeters),
  );
  const totalLengthMeters = edges.reduce(
    (sum, edge) => sum + edge.lengthMeters,
    0,
  );
  const spanWarnings = [...uniqueEdges.values()]
    .filter((edge) => edge.lengthMeters > maxSpanMeters)
    .map(
      (edge) =>
        `Trecho ${edge.fromNodeId} → ${edge.toNodeId} excedia ${maxSpanMeters} m e recebeu poste intermediário automático.`,
    );
  const smartDraft =
    edges.length > 0
      ? buildMtSmartDraft(
          edges,
          nodes,
          sourceSnap.nodeId,
          terminalNodeIds,
          input.networkProfile,
          input.mtCqtParams,
        )
      : undefined;
  const unreachableTerminals = input.terminals
    .filter((terminal) => !reachableTerminalIds.has(terminal.id))
    .map((terminal) => terminal.id);

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
    unreachableTerminals,
    poleDiagnostics: smartDraft?.poleDiagnostics ?? [],
    engineeringWarnings: [
      ...spanWarnings,
      ...(smartDraft?.engineeringWarnings ?? []),
    ],
    mtCqtReadiness: smartDraft?.mtCqtReadiness ?? mtCqtReadiness,
    mtTopologyDraft: smartDraft?.draft,
  };
}
