import { BtTopology } from "../types";

export interface BtTransformerConflictGroup {
  poleIds: string[];
  transformerIds: string[];
}

export const findTransformerConflictsWithoutSectioning = (
  topology: BtTopology,
): BtTransformerConflictGroup[] => {
  if (topology.transformers.length < 2 || topology.poles.length === 0) {
    return [];
  }

  const poleById = new Map(topology.poles.map((pole) => [pole.id, pole]));
  const circuitBreakPoleIds = new Set(
    topology.poles
      .filter((pole) => pole.circuitBreakPoint)
      .map((pole) => pole.id),
  );

  const adjacentPoles = new Map<string, string[]>();
  for (const pole of topology.poles) {
    adjacentPoles.set(pole.id, []);
  }

  // A pole marked as circuit break should segment electrical islands.
  // Ignore edges touching a break pole when building connectivity groups.
  for (const edge of topology.edges) {
    const edgeFlag =
      edge.edgeChangeFlag ?? (edge.removeOnExecution ? "remove" : "existing");
    if (edgeFlag === "remove") {
      continue;
    }

    if (
      circuitBreakPoleIds.has(edge.fromPoleId) ||
      circuitBreakPoleIds.has(edge.toPoleId)
    ) {
      continue;
    }

    if (
      !adjacentPoles.has(edge.fromPoleId) ||
      !adjacentPoles.has(edge.toPoleId)
    ) {
      continue;
    }

    adjacentPoles.get(edge.fromPoleId)?.push(edge.toPoleId);
    adjacentPoles.get(edge.toPoleId)?.push(edge.fromPoleId);
  }

  const transformersByPoleId = new Map<string, string[]>();
  for (const transformer of topology.transformers) {
    const poleId = transformer.poleId;
    if (!poleId || !poleById.has(poleId)) {
      continue;
    }

    const current = transformersByPoleId.get(poleId) ?? [];
    current.push(transformer.id);
    transformersByPoleId.set(poleId, current);
  }

  const visited = new Set<string>();
  const conflicts: BtTransformerConflictGroup[] = [];

  for (const pole of topology.poles) {
    if (visited.has(pole.id)) {
      continue;
    }

    const stack = [pole.id];
    const componentPoleIds: string[] = [];
    const componentTransformerIds: string[] = [];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || visited.has(current)) {
        continue;
      }

      visited.add(current);
      componentPoleIds.push(current);

      const poleTransformers = transformersByPoleId.get(current) ?? [];
      componentTransformerIds.push(...poleTransformers);

      const neighbors = adjacentPoles.get(current) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }

    if (componentTransformerIds.length >= 2) {
      const uniqueTransformerIds = Array.from(
        new Set(componentTransformerIds),
      ).sort((a, b) => a.localeCompare(b));

      if (uniqueTransformerIds.length >= 2) {
        conflicts.push({
          poleIds: componentPoleIds,
          transformerIds: uniqueTransformerIds,
        });
      }
    }
  }

  return conflicts;
};
