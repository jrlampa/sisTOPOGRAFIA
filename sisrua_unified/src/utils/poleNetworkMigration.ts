/**
 * poleNetworkMigration.ts
 *
 * Utilitários para migração do modelo legado (BtTopology + MtTopology separados)
 * para o modelo Poste-Driven unificado (NetworkTopology).
 *
 * Estratégia: aditiva e não-destrutiva.
 *   - Dados legados NUNCA são apagados durante a migração.
 *   - PoleNode é gerado como superset: preserva todos os campos de BtPoleNode e MtPoleNode.
 *   - NetworkEdge é gerado como superset de BtEdge e MtEdge.
 *   - O campo `network` em GlobalState coexiste com `btTopology`/`mtTopology` durante a transição.
 */

import type {
  BtPoleNode,
  BtEdge,
  BtTopology,
  MtPoleNode,
  MtEdge,
  MtTopology,
  NetworkTopology,
  NetworkEdge,
  PoleNode,
  PoleEquipmentEntry,
} from "../types";

// ─── Constantes ───────────────────────────────────────────────────────────────

export const EMPTY_NETWORK_TOPOLOGY: NetworkTopology = {
  poles: [],
  edges: [],
  transformers: [],
};

// ─── Funções de conversão individual ─────────────────────────────────────────

/** Converte BtPoleNode para PoleNode unificado. */
export function btPoleToUnified(btPole: BtPoleNode): PoleNode {
  const equipments: PoleEquipmentEntry[] = [];

  // Migra equipmentNotes (string livre) para equipments estruturado, se houver
  if (btPole.equipmentNotes?.trim()) {
    equipments.push({
      id: `migrated-${btPole.id}`,
      type: "outro",
      notes: btPole.equipmentNotes.trim(),
    });
  }

  return {
    id: btPole.id,
    lat: btPole.lat,
    lng: btPole.lng,
    title: btPole.title,
    hasBt: true,
    btStructures: btPole.btStructures,
    ramais: btPole.ramais,
    poleSpec: btPole.poleSpec,
    conditionStatus: btPole.conditionStatus,
    equipments: equipments.length > 0 ? equipments : undefined,
    equipmentNotes: btPole.equipmentNotes, // mantido por retrocompatibilidade
    generalNotes: btPole.generalNotes,
    verified: btPole.verified,
    nodeChangeFlag: btPole.nodeChangeFlag,
    circuitBreakPoint: btPole.circuitBreakPoint,
  };
}

/** Mescla dados MT em um PoleNode já existente (compartilhado BT+MT). */
export function mergeMtIntoPoleNode(
  poleNode: PoleNode,
  mtPole: MtPoleNode,
): PoleNode {
  return {
    ...poleNode,
    hasMt: true,
    mtStructures: mtPole.mtStructures,
    // verified: AND entre as duas redes — poste só é verificado se ambos estiverem ok
    verified: poleNode.verified && mtPole.verified,
    // nodeChangeFlag: prioriza o flag mais "impactante"
    nodeChangeFlag: resolveChangeFlag(
      poleNode.nodeChangeFlag,
      mtPole.nodeChangeFlag,
    ),
  };
}

/** Converte MtPoleNode exclusivo de MT para PoleNode. */
export function mtPoleToUnified(mtPole: MtPoleNode): PoleNode {
  return {
    id: mtPole.id,
    lat: mtPole.lat,
    lng: mtPole.lng,
    title: mtPole.title,
    hasMt: true,
    mtStructures: mtPole.mtStructures,
    verified: mtPole.verified,
    nodeChangeFlag: mtPole.nodeChangeFlag,
  };
}

/** Converte BtEdge para NetworkEdge unificada. */
export function btEdgeToNetworkEdge(edge: BtEdge): NetworkEdge {
  return {
    id: edge.id,
    fromPoleId: edge.fromPoleId,
    toPoleId: edge.toPoleId,
    lengthMeters: edge.lengthMeters,
    cqtLengthMeters: edge.cqtLengthMeters,
    btConductors: edge.conductors?.length > 0 ? edge.conductors : undefined,
    mtConductors: edge.mtConductors,
    replacementFromConductors: edge.replacementFromConductors,
    verified: edge.verified,
    removeOnExecution: edge.removeOnExecution,
    edgeChangeFlag: edge.edgeChangeFlag,
  };
}

/** Mescla condutores MT de uma MtEdge em uma NetworkEdge já existente. */
export function mergeMtEdgeIntoNetworkEdge(
  networkEdge: NetworkEdge,
  mtEdge: MtEdge,
): NetworkEdge {
  return {
    ...networkEdge,
    mtConductors: mtEdge.conductors ?? networkEdge.mtConductors,
    verified: networkEdge.verified && mtEdge.verified,
    edgeChangeFlag: resolveChangeFlag(
      networkEdge.edgeChangeFlag,
      mtEdge.edgeChangeFlag,
    ),
  };
}

/** Converte MtEdge exclusiva de MT para NetworkEdge. */
export function mtEdgeToNetworkEdge(edge: MtEdge): NetworkEdge {
  return {
    id: edge.id,
    fromPoleId: edge.fromPoleId,
    toPoleId: edge.toPoleId,
    lengthMeters: edge.lengthMeters,
    mtConductors: edge.conductors,
    verified: edge.verified,
    edgeChangeFlag: edge.edgeChangeFlag,
  };
}

// ─── Migração completa ────────────────────────────────────────────────────────

/**
 * Converte BtTopology + MtTopology legados para NetworkTopology unificada.
 * Postes compartilhados (mesmo ID) são mesclados em um único PoleNode.
 * Arestas com mesmo par fromPoleId/toPoleId são mescladas.
 * Seguro para ser chamado múltiplas vezes (idempotente).
 */
export function migrateLegacyTopology(
  btTopology: BtTopology,
  mtTopology?: MtTopology,
): NetworkTopology {
  // ── 1. Postes ────────────────────────────────────────────────────────────────
  const poleMap = new Map<string, PoleNode>();

  for (const btPole of btTopology.poles) {
    poleMap.set(btPole.id, btPoleToUnified(btPole));
  }

  if (mtTopology) {
    for (const mtPole of mtTopology.poles) {
      const existing = poleMap.get(mtPole.id);
      if (existing) {
        // Poste compartilhado: mescla MT em BT
        poleMap.set(mtPole.id, mergeMtIntoPoleNode(existing, mtPole));
      } else {
        // Poste exclusivo de MT
        poleMap.set(mtPole.id, mtPoleToUnified(mtPole));
      }
    }
  }

  // ── 2. Arestas ───────────────────────────────────────────────────────────────
  const edgeMap = new Map<string, NetworkEdge>();

  for (const btEdge of btTopology.edges) {
    edgeMap.set(btEdge.id, btEdgeToNetworkEdge(btEdge));
  }

  if (mtTopology) {
    for (const mtEdge of mtTopology.edges) {
      const existing = edgeMap.get(mtEdge.id);
      if (existing) {
        edgeMap.set(mtEdge.id, mergeMtEdgeIntoNetworkEdge(existing, mtEdge));
      } else {
        edgeMap.set(mtEdge.id, mtEdgeToNetworkEdge(mtEdge));
      }
    }
  }

  return {
    poles: Array.from(poleMap.values()),
    edges: Array.from(edgeMap.values()),
    transformers: btTopology.transformers,
  };
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

type ChangeFlag = "existing" | "new" | "remove" | "replace" | undefined;

/** Prioridade de flags de mudança: remove > replace > new > existing. */
const FLAG_PRIORITY: Record<NonNullable<ChangeFlag>, number> = {
  remove: 3,
  replace: 2,
  new: 1,
  existing: 0,
};

function resolveChangeFlag(a: ChangeFlag, b: ChangeFlag): ChangeFlag {
  const pa = FLAG_PRIORITY[a ?? "existing"];
  const pb = FLAG_PRIORITY[b ?? "existing"];
  return pa >= pb ? a : b;
}
