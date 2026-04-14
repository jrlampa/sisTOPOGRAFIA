import { constantsService } from "../constantsService.js";
import type {
  BtProjectType,
  BtTopology,
  BtPoleAccumulatedDemand,
  BtTransformerEstimatedDemand,
  BtClandestinoDisplay,
} from "./btDerivedTypes.js";
import {
  CLANDESTINO_RAMAL_TYPE,
  RAMAL_WEIGHT_BY_TYPE_ATUAL,
  toFixed2,
} from "./btDerivedConstants.js";

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
      .filter(
        (ramal) =>
          (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) ===
          CLANDESTINO_RAMAL_TYPE,
      )
      .reduce((sum, ramal) => sum + ramal.quantity, 0);
  }

  return ramais
    .filter(
      (ramal) =>
        (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) !== CLANDESTINO_RAMAL_TYPE,
    )
    .reduce((sum, ramal) => sum + ramal.quantity, 0);
};

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

export const getClandestinoDemandKvaByAreaAndClients = (
  areaM2: number,
  clients: number,
): number => {
  const areaToKva = constantsService.getSync<Record<string, number>>(
    "clandestino",
    "AREA_TO_KVA",
  );
  const clientToDiversifFactor = constantsService.getSync<
    Record<string, number>
  >("clandestino", "CLIENT_TO_DIVERSIF_FACTOR");

  if (!areaToKva || !clientToDiversifFactor) {
    return 0;
  }

  const baseKva = areaToKva[String(Math.round(areaM2))];
  const diversificationFactor =
    clientToDiversifFactor[String(Math.round(clients))];

  if (!Number.isFinite(baseKva) || !Number.isFinite(diversificationFactor)) {
    return 0;
  }

  return toFixed2(baseKva * diversificationFactor);
};

export const calculateRamalDmdiKva = (
  projectType: BtProjectType,
  aa24DemandBase: number,
  sumClientsX: number,
  ab35LookupDmdi: number,
): number => {
  if (projectType === "clandestino") {
    return toFixed2(ab35LookupDmdi);
  }

  if (
    !Number.isFinite(aa24DemandBase) ||
    !Number.isFinite(sumClientsX) ||
    sumClientsX <= 0
  ) {
    return 0;
  }

  return toFixed2(aa24DemandBase / sumClientsX);
};

interface TransformerOwnershipData {
  localClientByPole: Map<string, number>;
  ownerTransformerByPole: Map<string, string>;
}

export const calculateTransformerOwnershipData = (
  topology: BtTopology,
  projectType: BtProjectType,
): TransformerOwnershipData => {
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
      (transformer) =>
        transformer.poleId &&
        allPoleIds.has(transformer.poleId) &&
        (transformer.transformerChangeFlag ?? "existing") !== "remove",
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

  return { localClientByPole, ownerTransformerByPole };
};

export const calculateAccumulatedDemandByPole = (
  topology: BtTopology,
  projectType: BtProjectType,
  clandestinoAreaM2: number,
): BtPoleAccumulatedDemand[] => {
  const allPoleIds = new Set(topology.poles.map((pole) => pole.id));
  for (const edge of topology.edges) {
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

  for (const edge of topology.edges) {
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
      .filter(
        (transformer) =>
          (transformer.transformerChangeFlag ?? "existing") !== "remove",
      )
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
  const transformerDemandKva = topology.transformers
    .filter(
      (transformer) =>
        (transformer.transformerChangeFlag ?? "existing") !== "remove",
    )
    .reduce((sum, transformer) => sum + transformer.demandKw, 0);

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
        ? getClandestinoDemandKvaByAreaAndClients(
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
    const accumulatedDemandKva =
      projectType === "clandestino"
        ? getClandestinoDemandKvaByAreaAndClients(
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
      localTrechoDemandKva: toFixed2(item.localTrechoDemandKva),
      accumulatedDemandKva: toFixed2(item.accumulatedDemandKva),
    }));
};

export const calculateEstimatedDemandByTransformer = (
  topology: BtTopology,
  projectType: BtProjectType,
  clandestinoAreaM2: number,
): BtTransformerEstimatedDemand[] => {
  if (topology.transformers.length === 0 || topology.poles.length === 0) {
    return [];
  }

  const hasLinkedTransformers = topology.transformers.some(
    (transformer) => !!transformer.poleId,
  );
  if (!hasLinkedTransformers) {
    return topology.transformers.map((transformer) => ({
      transformerId: transformer.id,
      assignedClients: 0,
      estimatedDemandKw: 0,
    }));
  }

  const { localClientByPole, ownerTransformerByPole } =
    calculateTransformerOwnershipData(topology, projectType);

  const assignedClientsByTransformer = new Map<string, number>();
  for (const transformer of topology.transformers) {
    assignedClientsByTransformer.set(transformer.id, 0);
  }

  for (const [poleId, localClients] of localClientByPole.entries()) {
    const ownerTransformerId = ownerTransformerByPole.get(poleId);
    if (!ownerTransformerId) {
      continue;
    }

    assignedClientsByTransformer.set(
      ownerTransformerId,
      (assignedClientsByTransformer.get(ownerTransformerId) ?? 0) +
        localClients,
    );
  }

  const totalClients = Array.from(localClientByPole.values()).reduce(
    (sum, value) => sum + value,
    0,
  );
  const measuredDemandKw = topology.transformers.reduce((sum, transformer) => {
    if ((transformer.transformerChangeFlag ?? "existing") === "remove") {
      return sum;
    }
    if (transformer.readings.length === 0) {
      return sum;
    }

    return sum + (transformer.demandKw ?? 0);
  }, 0);
  const demandPerClientKw =
    totalClients > 0 ? measuredDemandKw / totalClients : 0;

  return topology.transformers.map((transformer) => {
    const assignedClients =
      assignedClientsByTransformer.get(transformer.id) ?? 0;
    if (transformer.readings.length > 0) {
      return {
        transformerId: transformer.id,
        assignedClients,
        estimatedDemandKw: toFixed2(transformer.demandKw ?? 0),
      };
    }

    const estimatedDemandKw =
      projectType === "clandestino"
        ? getClandestinoDemandKvaByAreaAndClients(
            clandestinoAreaM2,
            assignedClients,
          )
        : toFixed2(assignedClients * demandPerClientKw);

    return {
      transformerId: transformer.id,
      assignedClients,
      estimatedDemandKw,
    };
  });
};

export const calculateSummary = (topology: BtTopology) => {
  const totalLengthMeters = topology.edges.reduce(
    (acc, edge) => acc + (edge.lengthMeters || 0),
    0,
  );
  const transformerDemandKw = topology.transformers
    .filter(
      (transformer) =>
        (transformer.transformerChangeFlag ?? "existing") !== "remove",
    )
    .reduce((acc, transformer) => acc + (transformer.demandKw || 0), 0);

  return {
    poles: topology.poles.length,
    transformers: topology.transformers.length,
    edges: topology.edges.length,
    totalLengthMeters,
    transformerDemandKw,
  };
};

export const calculateClandestinoDisplay = (
  topology: BtTopology,
  clandestinoAreaM2: number,
): BtClandestinoDisplay => {
  const areaToKva = constantsService.getSync<Record<string, number>>(
    "clandestino",
    "AREA_TO_KVA",
  );
  const clientToDiversifFactor = constantsService.getSync<
    Record<string, number>
  >("clandestino", "CLIENT_TO_DIVERSIF_FACTOR");

  const numericAreaKeys = areaToKva
    ? Object.keys(areaToKva).map(Number).filter(Number.isFinite)
    : [];
  const areaMin = numericAreaKeys.length > 0 ? Math.min(...numericAreaKeys) : 0;
  const areaMax = numericAreaKeys.length > 0 ? Math.max(...numericAreaKeys) : 0;

  const areaKey = String(Math.round(clandestinoAreaM2));
  const demandKva =
    areaToKva && Number.isFinite(areaToKva[areaKey])
      ? areaToKva[areaKey]
      : null;
  const demandKw = demandKva ?? 0;

  const totalClients = topology.poles.reduce(
    (acc, pole) =>
      acc + (pole.ramais ?? []).reduce((sum, ramal) => sum + ramal.quantity, 0),
    0,
  );
  const clientKey = String(Math.round(totalClients));
  const diversificationFactor =
    clientToDiversifFactor && Number.isFinite(clientToDiversifFactor[clientKey])
      ? clientToDiversifFactor[clientKey]
      : null;

  const finalDemandKva =
    demandKva !== null && diversificationFactor !== null
      ? toFixed2(demandKva * diversificationFactor)
      : 0;

  return {
    demandKw,
    areaMin,
    areaMax,
    demandKva,
    diversificationFactor,
    finalDemandKva,
  };
};

export { getPoleClientsByProjectType };
