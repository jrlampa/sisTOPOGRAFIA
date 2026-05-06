import { BtTopology, BtProjectType } from "../types";
import { haversineDistanceMeters } from "../../shared/geodesic";
import { getTransformerDemandKva } from "./btTransformerCalculations";
import { calculateClandestinoDemandKvaByAreaAndClients } from "./btClandestinoCalculations";

const CLANDESTINO_RAMAL_TYPE = "Clandestino";

export interface BtPoleAccumulatedDemand {
  poleId: string;
  localClients: number;
  accumulatedClients: number;
  localTrechoDemandKva: number;
  accumulatedDemandKva: number;
  // CQT fields are added by the service/enricher.
  voltageV?: number;
  dvAccumPercent?: number;
  cqtStatus?: string;
  worstRamalVoltageV?: number;
  worstRamalDvPercent?: number;
  worstRamalStatus?: string;
}

export interface BtAccumulatedKvaInput {
  projectType: BtProjectType;
  clandestinoAreaM2: number;
  accumulatedClients: number;
  downstreamAccumulatedKva: number;
  totalTrechoKva: number;
}

export interface BtTransformerEstimatedDemand {
  transformerId: string;
  assignedClients: number;
  estimatedDemandKva: number;
  /** @deprecated Use estimatedDemandKva. */
  estimatedDemandKw: number;
}

export interface BtSectioningImpact {
  unservedPoleIds: string[];
  unservedClients: number;
  estimatedDemandKva: number;
  /** @deprecated Use estimatedDemandKva. */
  estimatedDemandKw: number;
  loadCenter: { lat: number; lng: number } | null;
  suggestedPoleId: string | null;
}

const RAMAL_WEIGHT_BY_TYPE_ATUAL = new Map<string, number>([
  ["5 CC", 66],
  ["8 CC", 88],
  ["13 CC", 116],
  ["21 CC", 151],
  ["33 CC", 205],
  ["53 CC", 272],
  ["67 CC", 313],
  ["85 CC", 366],
  ["107 CC", 418],
  ["127 CC", 466],
  ["253 CC", 710],
  ["13 DX 6 AWG", 78],
  ["13 TX 6 AWG", 80],
  ["13 QX 6 AWG", 72],
  ["21 QX 4 AWG", 95],
  ["53 QX 1/0", 165],
  ["85 QX 3/0", 220],
  ["107 QX 4/0", 254],
  ["70 MMX", 227],
  ["185 MMX", 423],
]);

const getRamalWeightByType = (ramalType?: string): number | null => {
  if (!ramalType || typeof ramalType !== "string") {
    return null;
  }

  const normalized = ramalType.trim().toUpperCase();
  for (const [type, weight] of RAMAL_WEIGHT_BY_TYPE_ATUAL.entries()) {
    if (type.toUpperCase() === normalized) {
      return weight;
    }
  }

  return null;
};

const getPoleClientsByProjectType = (
  projectType: BtProjectType,
  topology: BtTopology,
  poleId: string,
): number => {
  const pole = topology.poles.find((item) => item.id === poleId);
  if (!pole) {
    return 0;
  }

  const ramais = pole.ramais ?? [];
  if (projectType === "clandestino") {
    return ramais
      .filter((ramal) => ramal.ramalType === CLANDESTINO_RAMAL_TYPE)
      .reduce((sum, ramal) => sum + ramal.quantity, 0);
  }

  return ramais
    .filter((ramal) => ramal.ramalType !== CLANDESTINO_RAMAL_TYPE)
    .reduce((sum, ramal) => sum + ramal.quantity, 0);
};

export const calculateTransformerOwnershipData = (
  topology: BtTopology,
  projectType: BtProjectType,
) => {
  const allPoleIds = new Set(topology.poles.map((pole) => pole.id));
  const circuitBreakPoleIds = new Set(
    topology.poles
      .filter((pole) => pole.circuitBreakPoint)
      .map((pole) => pole.id),
  );

  const localClientByPole = new Map<string, number>();
  for (const pole of topology.poles) {
    localClientByPole.set(
      pole.id,
      getPoleClientsByProjectType(projectType, topology, pole.id),
    );
  }

  const adjacentPoles = new Map<string, string[]>();
  for (const poleId of allPoleIds) {
    adjacentPoles.set(poleId, []);
  }

  const activeEdges = topology.edges.filter((edge) => {
    const edgeFlag =
      edge.edgeChangeFlag ?? (edge.removeOnExecution ? "remove" : "existing");
    return edgeFlag !== "remove";
  });

  for (const edge of activeEdges) {
    adjacentPoles.get(edge.fromPoleId)?.push(edge.toPoleId);
    adjacentPoles.get(edge.toPoleId)?.push(edge.fromPoleId);
  }

  const transformerPoleEntries = topology.transformers
    .filter(
      (transformer) => transformer.poleId && allPoleIds.has(transformer.poleId),
    )
    .map((transformer) => ({
      transformerId: transformer.id,
      poleId: transformer.poleId as string,
    }));

  const distanceToTransformer = new Map<string, number>();
  const ownerTransformerByPole = new Map<string, string>();
  for (const poleId of allPoleIds) {
    distanceToTransformer.set(poleId, Number.POSITIVE_INFINITY);
  }

  const queue: Array<{ poleId: string; transformerId: string }> = [];
  for (const entry of transformerPoleEntries) {
    const knownDistance =
      distanceToTransformer.get(entry.poleId) ?? Number.POSITIVE_INFINITY;
    const knownOwner = ownerTransformerByPole.get(entry.poleId);
    if (
      knownDistance > 0 ||
      (knownDistance === 0 && (!knownOwner || entry.transformerId < knownOwner))
    ) {
      distanceToTransformer.set(entry.poleId, 0);
      ownerTransformerByPole.set(entry.poleId, entry.transformerId);
    }
    queue.push({ poleId: entry.poleId, transformerId: entry.transformerId });
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const currentDistance =
      distanceToTransformer.get(current.poleId) ?? Number.POSITIVE_INFINITY;
    const owner = ownerTransformerByPole.get(current.poleId);
    if (!owner || owner !== current.transformerId) {
      continue;
    }

    if (circuitBreakPoleIds.has(current.poleId)) {
      continue;
    }

    const neighbors = adjacentPoles.get(current.poleId) ?? [];
    for (const neighborId of neighbors) {
      const knownDistance =
        distanceToTransformer.get(neighborId) ?? Number.POSITIVE_INFINITY;
      const knownOwner = ownerTransformerByPole.get(neighborId);
      const nextDistance = currentDistance + 1;

      if (
        nextDistance < knownDistance ||
        (nextDistance === knownDistance && (!knownOwner || owner < knownOwner))
      ) {
        distanceToTransformer.set(neighborId, nextDistance);
        ownerTransformerByPole.set(neighborId, owner);
        queue.push({ poleId: neighborId, transformerId: owner });
      }
    }
  }

  return {
    localClientByPole,
    ownerTransformerByPole,
  };
};

export const calculateAccumulatedDemandByPole = (
  topology: BtTopology,
  projectType: BtProjectType,
  clandestinoAreaM2: number,
): BtPoleAccumulatedDemand[] => {
  const activeEdges = topology.edges.filter((edge) => {
    const edgeFlag =
      edge.edgeChangeFlag ?? (edge.removeOnExecution ? "remove" : "existing");
    return edgeFlag !== "remove";
  });

  const allPoleIds = new Set(topology.poles.map((pole) => pole.id));
  for (const edge of activeEdges) {
    allPoleIds.add(edge.fromPoleId);
    allPoleIds.add(edge.toPoleId);
  }

  const adjacentPoles = new Map<string, string[]>();
  const localClientByPole = new Map<string, number>();

  for (const pole of topology.poles) {
    const localClients = getPoleClientsByProjectType(
      projectType,
      topology,
      pole.id,
    );
    localClientByPole.set(pole.id, localClients);
  }

  for (const poleId of allPoleIds) {
    adjacentPoles.set(poleId, []);
  }

  for (const edge of activeEdges) {
    adjacentPoles.get(edge.fromPoleId)?.push(edge.toPoleId);
    adjacentPoles.get(edge.toPoleId)?.push(edge.fromPoleId);
  }

  const circuitBreakPoleIds = new Set(
    topology.poles
      .filter((pole) => pole.circuitBreakPoint)
      .map((pole) => pole.id),
  );

  const transformerPoleIds = new Set(
    topology.transformers
      .map((transformer) => transformer.poleId)
      .filter(
        (poleId): poleId is string =>
          poleId !== undefined && allPoleIds.has(poleId),
      ),
  );

  const distanceToTransformer = new Map<string, number>();
  const parentByPole = new Map<string, string>();
  for (const poleId of allPoleIds) {
    distanceToTransformer.set(poleId, Number.POSITIVE_INFINITY);
  }

  const queue: string[] = [];
  for (const poleId of transformerPoleIds) {
    distanceToTransformer.set(poleId, 0);
    queue.push(poleId);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (circuitBreakPoleIds.has(current)) {
      continue;
    }

    const currentDistance =
      distanceToTransformer.get(current) ?? Number.POSITIVE_INFINITY;
    const neighbors = adjacentPoles.get(current) ?? [];
    for (const neighbor of neighbors) {
      const knownDistance =
        distanceToTransformer.get(neighbor) ?? Number.POSITIVE_INFINITY;
      if (knownDistance > currentDistance + 1) {
        distanceToTransformer.set(neighbor, currentDistance + 1);
        parentByPole.set(neighbor, current);
        queue.push(neighbor);
      }
    }
  }

  const totalClients = Array.from(localClientByPole.values()).reduce(
    (sum, value) => sum + value,
    0,
  );
  const transformerDemandKva = topology.transformers.reduce(
    (sum, transformer) => sum + getTransformerDemandKva(transformer),
    0,
  );

  const localWeightedRamalByPole = new Map<string, number>();
  let hasUnknownRamalWeight = false;
  for (const pole of topology.poles) {
    const ramais = pole.ramais ?? [];
    const localWeighted = ramais.reduce((sum, ramal) => {
      const isClandestino =
        (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE;
      if (projectType === "clandestino" ? !isClandestino : isClandestino) {
        return sum;
      }

      const quantity = Number.isFinite(ramal.quantity) ? ramal.quantity : 0;
      if (quantity <= 0) {
        return sum;
      }

      const weight = getRamalWeightByType(ramal.ramalType);
      if (weight === null) {
        hasUnknownRamalWeight = true;
        return sum;
      }

      return sum + quantity * weight;
    }, 0);

    localWeightedRamalByPole.set(pole.id, localWeighted);
  }

  const totalWeightedRamal = Array.from(
    localWeightedRamalByPole.values(),
  ).reduce((sum, value) => sum + value, 0);
  const useWorkbookWeightedDemand =
    projectType !== "clandestino" &&
    !hasUnknownRamalWeight &&
    totalWeightedRamal > 0 &&
    Number.isFinite(transformerDemandKva) &&
    transformerDemandKva > 0;

  const avgDemandPerClientRaw =
    projectType === "clandestino"
      ? 0
      : Number.isFinite(transformerDemandKva) &&
          Number.isFinite(totalClients) &&
          totalClients > 0
        ? transformerDemandKva / totalClients
        : 0;

  const memo = new Map<string, BtPoleAccumulatedDemand>();

  const visit = (
    poleId: string,
    activePath: Set<string>,
  ): BtPoleAccumulatedDemand => {
    const cached = memo.get(poleId);
    if (cached) {
      return cached;
    }

    if (activePath.has(poleId)) {
      const cycleFallback: BtPoleAccumulatedDemand = {
        poleId,
        localClients: localClientByPole.get(poleId) ?? 0,
        accumulatedClients: localClientByPole.get(poleId) ?? 0,
        localTrechoDemandKva: 0,
        accumulatedDemandKva: 0,
      };
      memo.set(poleId, cycleFallback);
      return cycleFallback;
    }

    const nextPath = new Set(activePath);
    nextPath.add(poleId);

    const localClients = localClientByPole.get(poleId) ?? 0;
    const isCircuitBreakPole = circuitBreakPoleIds.has(poleId);

    const children = isCircuitBreakPole
      ? []
      : (adjacentPoles.get(poleId) ?? []).filter(
          (neighborId) => parentByPole.get(neighborId) === poleId,
        );

    const childrenResults = children.map((childPoleId) =>
      visit(childPoleId, nextPath),
    );
    const downstreamClients = childrenResults.reduce(
      (sum, child) => sum + child.accumulatedClients,
      0,
    );
    const accumulatedClients = localClients + downstreamClients;

    const localTrechoDemandKva =
      projectType === "clandestino"
        ? calculateClandestinoDemandKvaByAreaAndClients(
            clandestinoAreaM2,
            localClients,
          )
        : useWorkbookWeightedDemand
          ? transformerDemandKva *
            ((localWeightedRamalByPole.get(poleId) ?? 0) / totalWeightedRamal)
          : localClients * avgDemandPerClientRaw;

    const downstreamAccumulatedKva = childrenResults.reduce(
      (sum, child) => sum + child.accumulatedDemandKva,
      0,
    );

    // Equivalent logic to the original calculateAccumulatedDemandKva
    const accumulatedDemandKva =
      projectType === "clandestino"
        ? calculateClandestinoDemandKvaByAreaAndClients(
            clandestinoAreaM2,
            accumulatedClients,
          )
        : downstreamAccumulatedKva + localTrechoDemandKva;

    const result: BtPoleAccumulatedDemand = {
      poleId,
      localClients,
      accumulatedClients,
      localTrechoDemandKva,
      accumulatedDemandKva,
    };

    memo.set(poleId, result);
    return result;
  };

  const results = Array.from(allPoleIds).map((poleId) =>
    visit(poleId, new Set()),
  );
  return results
    .sort((a, b) => b.accumulatedDemandKva - a.accumulatedDemandKva)
    .map((item) => ({
      ...item,
      localTrechoDemandKva: Number(item.localTrechoDemandKva.toFixed(2)),
      accumulatedDemandKva: Number(item.accumulatedDemandKva.toFixed(2)),
    }));
};

export const calculateAccumulatedDemandKva = ({
  projectType,
  clandestinoAreaM2,
  accumulatedClients,
  downstreamAccumulatedKva,
  totalTrechoKva,
}: BtAccumulatedKvaInput): number => {
  if (projectType === "clandestino") {
    return calculateClandestinoDemandKvaByAreaAndClients(
      clandestinoAreaM2,
      accumulatedClients,
    );
  }
  return Number((downstreamAccumulatedKva + totalTrechoKva).toFixed(2));
};

export const calculateEstimatedDemandByTransformer = (
  topology: BtTopology,
  projectType: BtProjectType,
  clandestinoAreaM2: number,
): BtTransformerEstimatedDemand[] => {
  if (topology.transformers.length === 0 || topology.poles.length === 0) {
    return [];
  }

  const { localClientByPole, ownerTransformerByPole } =
    calculateTransformerOwnershipData(topology, projectType);

  const accumulatedByTransformer = new Map<
    string,
    { clients: number; kva: number }
  >();
  for (const transformer of topology.transformers) {
    accumulatedByTransformer.set(transformer.id, { clients: 0, kva: 0 });
  }

  const accumulatedDemandByPole = calculateAccumulatedDemandByPole(
    topology,
    projectType,
    clandestinoAreaM2,
  );

  const localDemandByPole = new Map<string, number>();
  for (const item of accumulatedDemandByPole) {
    localDemandByPole.set(item.poleId, item.localTrechoDemandKva);
  }

  for (const [poleId, transformerId] of ownerTransformerByPole.entries()) {
    const stats = accumulatedByTransformer.get(transformerId);
    if (stats) {
      stats.clients += localClientByPole.get(poleId) ?? 0;
      stats.kva += localDemandByPole.get(poleId) ?? 0;
    }
  }

  return topology.transformers.map((transformer) => {
    const stats = accumulatedByTransformer.get(transformer.id) ?? {
      clients: 0,
      kva: 0,
    };
    return {
      transformerId: transformer.id,
      assignedClients: stats.clients,
      estimatedDemandKva: Number(stats.kva.toFixed(2)),
      estimatedDemandKw: Number(stats.kva.toFixed(2)),
    };
  });
};

export const calculateBtSummary = (topology: BtTopology) => {
  const totalLengthMeters = topology.edges.reduce(
    (acc, edge) => acc + (edge.lengthMeters || 0),
    0,
  );
  const transformerDemandKva = topology.transformers.reduce(
    (acc, transformer) => acc + getTransformerDemandKva(transformer),
    0,
  );

  return {
    poles: topology.poles.length,
    transformers: topology.transformers.length,
    edges: topology.edges.length,
    totalLengthMeters,
    transformerDemandKva,
    /** @deprecated */
    transformerDemandKw: transformerDemandKva,
  };
};

/** @deprecated Use haversineDistanceMeters directly. */
export const distanceMetersBetween = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number => {
  return haversineDistanceMeters(a, b);
};

export const calculateSectioningImpact = (
  topology: BtTopology,
  projectType: BtProjectType,
  clandestinoAreaM2: number,
): BtSectioningImpact => {
  if (topology.poles.length === 0) {
    return {
      unservedPoleIds: [],
      unservedClients: 0,
      estimatedDemandKva: 0,
      estimatedDemandKw: 0,
      loadCenter: null,
      suggestedPoleId: null,
    };
  }

  const { localClientByPole, ownerTransformerByPole } =
    calculateTransformerOwnershipData(topology, projectType);
  const unservedPoles = topology.poles.filter(
    (pole) => !ownerTransformerByPole.has(pole.id),
  );
  const unservedPoleIds = unservedPoles.map((pole) => pole.id);

  const unservedClients = unservedPoles.reduce(
    (sum, pole) => sum + (localClientByPole.get(pole.id) ?? 0),
    0,
  );

  const accumulatedDemandByPole = calculateAccumulatedDemandByPole(
    topology,
    projectType,
    clandestinoAreaM2,
  );

  const localDemandByPole = new Map<string, number>();
  for (const item of accumulatedDemandByPole) {
    localDemandByPole.set(item.poleId, item.localTrechoDemandKva);
  }

  const estimatedDemandKva = unservedPoles.reduce(
    (sum, pole) => sum + (localDemandByPole.get(pole.id) ?? 0),
    0,
  );

  if (unservedPoles.length === 0) {
    return {
      unservedPoleIds,
      unservedClients,
      estimatedDemandKva,
      estimatedDemandKw: estimatedDemandKva,
      loadCenter: null,
      suggestedPoleId: null,
    };
  }

  const weighted = unservedPoles.map((pole) => {
    const clients = localClientByPole.get(pole.id) ?? 0;
    return {
      pole,
      weight: clients > 0 ? clients : 1,
    };
  });

  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  const loadCenter = {
    lat:
      weighted.reduce((sum, item) => sum + item.pole.lat * item.weight, 0) /
      (totalWeight || 1),
    lng:
      weighted.reduce((sum, item) => sum + item.pole.lng * item.weight, 0) /
      (totalWeight || 1),
  };

  let suggestedPoleId: string | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const pole of unservedPoles) {
    const currentDistance = distanceMetersBetween(loadCenter, {
      lat: pole.lat,
      lng: pole.lng,
    });
    if (currentDistance < nearestDistance) {
      nearestDistance = currentDistance;
      suggestedPoleId = pole.id;
    }
  }

  return {
    unservedPoleIds,
    unservedClients,
    estimatedDemandKva: Number(estimatedDemandKva.toFixed(2)),
    estimatedDemandKw: Number(estimatedDemandKva.toFixed(2)),
    loadCenter,
    suggestedPoleId,
  };
};
