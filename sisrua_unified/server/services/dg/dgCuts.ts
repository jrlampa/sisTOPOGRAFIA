/**
 * Design Generativo — Cortes de Rede
 */

import type { MstEdge } from "./dgMst.js";
import type { DgPoleInput } from "./dgTypes.js";

export interface EdgeCut {
  edge: MstEdge;
  /** Nó no lado "downstream" (afastado da raiz) */
  childId: string;
  /** Demanda acumulada no subtree do filho */
  subtreeDemandKva: number;
}

const MIN_LOAD_FRACTION = 0.15; // 15% mínimo por cluster (anti-isolamento)
const MIN_POLES_PER_PARTITION = 3;

export function computeEdgeCuts(
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

/** Retorna IDs dos nós no subtree do childId (exclui a aresta de corte). */
export function collectSubtreeNodes(
  childId: string,
  cutEdge: MstEdge,
  mst: MstEdge[],
): string[] {
  // MST sem a aresta de corte
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
  // BFS a partir do childId
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
    // Filtro de demanda mínima
    if (below < minLoadKva || above < minLoadKva) continue;
    // Filtro de contagem mínima de postes
    const downstreamPoles = collectSubtreeNodes(
      cut.childId,
      cut.edge,
      mst,
    ).filter((id) => poleIds.has(id)).length;
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

/** Divide os postes em dois grupos (upstream/downstream) com base no corte. */
export function splitPolesAtCut(
  poles: DgPoleInput[],
  cutEdge: MstEdge,
  mst: MstEdge[],
  cutChildId: string,
): { downstream: DgPoleInput[]; upstream: DgPoleInput[] } {
  const downstreamIds = new Set(collectSubtreeNodes(cutChildId, cutEdge, mst));
  const downstream = poles.filter((p) => downstreamIds.has(p.id));
  const upstream = poles.filter((p) => !downstreamIds.has(p.id));
  return { downstream, upstream };
}
