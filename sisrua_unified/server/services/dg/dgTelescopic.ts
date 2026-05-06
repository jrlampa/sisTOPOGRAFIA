/**
 * Design Generativo — Condutores Telescópicos
 */

import type { MstEdge } from "./dgMst.js";

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

/**
 * Para cada aresta MST, atribui o condutor correto baseado na demanda
 * acumulada da sub-rede "downstream" daquela aresta (rede telescópica).
 */
export function assignTelescopicConductors(
  trafoId: string,
  mst: MstEdge[],
  demandByPole: Map<string, number>,
): Map<string, string> {
  // Monta adjacência
  const adj = new Map<string, string[]>();
  for (const e of mst) {
    if (!adj.has(e.fromId)) adj.set(e.fromId, []);
    if (!adj.has(e.toId)) adj.set(e.toId, []);
    adj.get(e.fromId)!.push(e.toId);
    adj.get(e.toId)!.push(e.fromId);
  }
  // DFS: computa demanda de cada subtree
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

  // Para cada aresta, o "child" é o nó cujo subtree é menor
  // (resultado do DFS: o nó visitado após o pai)
  const conductorByEdgeKey = new Map<string, string>();
  for (const e of mst) {
    // child = nó com menor subtree (downstream)
    const dA = subtreeDemand.get(e.fromId) ?? 0;
    const dB = subtreeDemand.get(e.toId) ?? 0;
    const childDemand = Math.min(dA, dB);
    const key = `${e.fromId}→${e.toId}`;
    conductorByEdgeKey.set(key, selectConductorForDemand(childDemand));
  }
  return conductorByEdgeKey;
}
