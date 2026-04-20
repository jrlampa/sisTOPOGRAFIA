import type {
  BtEdge,
  BtPoleNode,
  BtTopology,
  BtTransformer,
  MtEdge,
  MtPoleNode,
  MtTopology,
} from "../types";
import type {
  CanonicalNetworkEdge,
  CanonicalNetworkTopology,
  CanonicalPoleNode,
} from "../types.canonical";

export interface LegacyTopologyPair {
  btTopology: BtTopology;
  mtTopology: MtTopology;
}

function preferTitle(primary?: string, secondary?: string): string {
  return (primary && primary.trim().length > 0 ? primary : secondary) ?? "";
}

export function buildCanonicalTopologyFromLegacy(
  btTopology: BtTopology,
  mtTopology: MtTopology,
): CanonicalNetworkTopology {
  const polesById = new Map<string, CanonicalPoleNode>();

  for (const pole of btTopology.poles) {
    polesById.set(pole.id, {
      id: pole.id,
      lat: pole.lat,
      lng: pole.lng,
      title: pole.title,
      hasBt: true,
      hasMt: false,
      btStructures: pole.btStructures,
      ramais: pole.ramais,
      poleSpec: pole.poleSpec,
      conditionStatus: pole.conditionStatus,
      equipmentNotes: pole.equipmentNotes,
      generalNotes: pole.generalNotes,
      circuitBreakPoint: pole.circuitBreakPoint,
      verified: pole.verified,
      nodeChangeFlag: pole.nodeChangeFlag,
    });
  }

  for (const pole of mtTopology.poles) {
    const existing = polesById.get(pole.id);
    if (existing) {
      polesById.set(pole.id, {
        ...existing,
        title: preferTitle(existing.title, pole.title),
        lat: existing.lat ?? pole.lat,
        lng: existing.lng ?? pole.lng,
        hasMt: true,
        mtStructures: pole.mtStructures,
        verified: existing.verified ?? pole.verified,
        nodeChangeFlag: existing.nodeChangeFlag ?? pole.nodeChangeFlag,
      });
      continue;
    }

    polesById.set(pole.id, {
      id: pole.id,
      lat: pole.lat,
      lng: pole.lng,
      title: pole.title,
      hasBt: false,
      hasMt: true,
      mtStructures: pole.mtStructures,
      verified: pole.verified,
      nodeChangeFlag: pole.nodeChangeFlag,
    });
  }

  const btEdges: CanonicalNetworkEdge[] = btTopology.edges.map((edge) => ({
    id: edge.id,
    fromPoleId: edge.fromPoleId,
    toPoleId: edge.toPoleId,
    lengthMeters: edge.lengthMeters,
    cqtLengthMeters: edge.cqtLengthMeters,
    btConductors: edge.conductors,
    btReplacementConductors: edge.replacementFromConductors,
    removeOnExecution: edge.removeOnExecution,
    verified: edge.verified,
    edgeChangeFlag: edge.edgeChangeFlag,
  }));

  const mtEdges: CanonicalNetworkEdge[] = mtTopology.edges.map((edge) => ({
    id: edge.id,
    fromPoleId: edge.fromPoleId,
    toPoleId: edge.toPoleId,
    lengthMeters: edge.lengthMeters,
    verified: edge.verified,
    edgeChangeFlag: edge.edgeChangeFlag,
  }));

  return {
    poles: Array.from(polesById.values()),
    edges: [...btEdges, ...mtEdges],
  };
}

function toBtPoleNode(pole: CanonicalPoleNode): BtPoleNode {
  return {
    id: pole.id,
    lat: pole.lat,
    lng: pole.lng,
    title: pole.title,
    ramais: pole.ramais,
    poleSpec: pole.poleSpec,
    conditionStatus: pole.conditionStatus,
    equipmentNotes: pole.equipmentNotes,
    generalNotes: pole.generalNotes,
    verified: pole.verified,
    btStructures: pole.btStructures,
    nodeChangeFlag: pole.nodeChangeFlag,
    circuitBreakPoint: pole.circuitBreakPoint,
  };
}

function toMtPoleNode(pole: CanonicalPoleNode): MtPoleNode {
  return {
    id: pole.id,
    lat: pole.lat,
    lng: pole.lng,
    title: pole.title,
    mtStructures: pole.mtStructures,
    verified: pole.verified,
    nodeChangeFlag: pole.nodeChangeFlag,
  };
}

function isLikelyBtEdge(
  edge: CanonicalNetworkEdge,
  polesById: Map<string, CanonicalPoleNode>,
): boolean {
  if (
    edge.btConductors !== undefined ||
    edge.btReplacementConductors !== undefined ||
    edge.cqtLengthMeters !== undefined ||
    edge.removeOnExecution !== undefined
  ) {
    return true;
  }

  const fromPole = polesById.get(edge.fromPoleId);
  const toPole = polesById.get(edge.toPoleId);
  return Boolean(fromPole?.hasBt && toPole?.hasBt && !(fromPole?.hasMt && toPole?.hasMt));
}

function toBtEdge(edge: CanonicalNetworkEdge): BtEdge {
  return {
    id: edge.id,
    fromPoleId: edge.fromPoleId,
    toPoleId: edge.toPoleId,
    lengthMeters: edge.lengthMeters,
    cqtLengthMeters: edge.cqtLengthMeters,
    conductors: edge.btConductors ?? [],
    replacementFromConductors: edge.btReplacementConductors,
    verified: edge.verified,
    removeOnExecution: edge.removeOnExecution,
    edgeChangeFlag: edge.edgeChangeFlag,
  };
}

function toMtEdge(edge: CanonicalNetworkEdge): MtEdge {
  return {
    id: edge.id,
    fromPoleId: edge.fromPoleId,
    toPoleId: edge.toPoleId,
    lengthMeters: edge.lengthMeters,
    verified: edge.verified,
    edgeChangeFlag: edge.edgeChangeFlag,
  };
}

export function deriveLegacyTopologiesFromCanonical(
  canonicalTopology: CanonicalNetworkTopology,
  transformers: BtTransformer[] = [],
): LegacyTopologyPair {
  const polesById = new Map(
    canonicalTopology.poles.map((pole) => [pole.id, pole] as const),
  );

  return {
    btTopology: {
      poles: canonicalTopology.poles.filter((pole) => pole.hasBt).map(toBtPoleNode),
      transformers,
      edges: canonicalTopology.edges
        .filter((edge) => isLikelyBtEdge(edge, polesById))
        .map(toBtEdge),
    },
    mtTopology: {
      poles: canonicalTopology.poles.filter((pole) => pole.hasMt).map(toMtPoleNode),
      edges: canonicalTopology.edges
        .filter((edge) => !isLikelyBtEdge(edge, polesById))
        .map(toMtEdge),
    },
  };
}

export function collectCanonicalDivergenceWarnings(
  btTopology: BtTopology,
  mtTopology: MtTopology,
  canonicalTopology: CanonicalNetworkTopology,
): string[] {
  const warnings: string[] = [];
  const legacyPoleIds = new Set<string>([
    ...btTopology.poles.map((pole) => pole.id),
    ...mtTopology.poles.map((pole) => pole.id),
  ]);

  if (legacyPoleIds.size !== canonicalTopology.poles.length) {
    warnings.push(
      `Pole count mismatch: legacy=${legacyPoleIds.size}, canonical=${canonicalTopology.poles.length}`,
    );
  }

  const legacyEdgeCount = btTopology.edges.length + mtTopology.edges.length;
  if (legacyEdgeCount !== canonicalTopology.edges.length) {
    warnings.push(
      `Edge count mismatch: legacy=${legacyEdgeCount}, canonical=${canonicalTopology.edges.length}`,
    );
  }

  for (const pole of canonicalTopology.poles) {
    const hasLegacyBt = btTopology.poles.some((item) => item.id === pole.id);
    const hasLegacyMt = mtTopology.poles.some((item) => item.id === pole.id);
    if (pole.hasBt !== hasLegacyBt || pole.hasMt !== hasLegacyMt) {
      warnings.push(
        `Technology divergence at pole ${pole.id}: canonical(bt=${pole.hasBt},mt=${pole.hasMt}) vs legacy(bt=${hasLegacyBt},mt=${hasLegacyMt})`,
      );
    }
  }

  return warnings;
}
