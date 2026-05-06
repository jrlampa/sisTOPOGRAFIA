/**
 * Topological Validator Service (Item 8 – T1)
 *
 * Real-time integrity validation for BT network topology (poles, edges,
 * transformers).  Checks structural correctness: valid references, no
 * duplicates, no self-loops, no parallel edges, connectivity.
 */

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TopologyError {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface TopologyWarning {
  code: string;
  message: string;
  nodeId?: string;
}

export interface TopologyStats {
  nodeCount: number;
  edgeCount: number;
  transformerCount: number;
  isolatedNodes: number;
}

export interface TopologyValidationResult {
  valid: boolean;
  errors: TopologyError[];
  warnings: TopologyWarning[];
  stats: TopologyStats;
}

// ─── Input shape (mirrors BtRadialTopologyInput loosely) ─────────────────────

export interface TopologyInput {
  poles: Array<{ id: string; [key: string]: unknown }>;
  edges: Array<{
    id?: string;
    fromId?: string;
    toId?: string;
    fromPoleId?: string;
    toPoleId?: string;
    removeOnExecution?: boolean;
    edgeChangeFlag?: "existing" | "new" | "remove" | "replace";
    [key: string]: unknown;
  }>;
  transformers: Array<{
    id: string;
    rootNodeId?: string;
    poleId?: string;
    transformerChangeFlag?: "existing" | "new" | "remove" | "replace";
    [key: string]: unknown;
  }>;
}

function isEdgeActive(edge: TopologyInput["edges"][number]): boolean {
  const changeFlag =
    typeof edge.edgeChangeFlag === "string"
      ? edge.edgeChangeFlag
      : edge.removeOnExecution
        ? "remove"
        : "existing";
  return changeFlag !== "remove";
}

function isTransformerActive(
  transformer: TopologyInput["transformers"][number],
): boolean {
  return transformer.transformerChangeFlag !== "remove";
}

function resolveEdgeFromId(edge: TopologyInput["edges"][number]): string {
  return (
    (typeof edge.fromId === "string" && edge.fromId) ||
    (typeof edge.fromPoleId === "string" && edge.fromPoleId) ||
    ""
  );
}

function resolveEdgeToId(edge: TopologyInput["edges"][number]): string {
  return (
    (typeof edge.toId === "string" && edge.toId) ||
    (typeof edge.toPoleId === "string" && edge.toPoleId) ||
    ""
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Canonical edge key for detecting parallel edges (order-independent). */
function edgeKey(a: string, b: string): string {
  return a < b ? `${a}||${b}` : `${b}||${a}`;
}

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Validate the structural/topological integrity of a BT network.
 *
 * Rules checked (errors):
 *   INVALID_EDGE_FROM   – edge.fromId not in node set
 *   INVALID_EDGE_TO     – edge.toId not in node set
 *   SELF_LOOP           – fromId === toId
 *   PARALLEL_EDGE       – duplicate undirected pair
 *   DUPLICATE_NODE_ID   – two poles share the same id
 *   DISCONNECTED_GRAPH  – not all nodes reachable from root
 *
 * Rules checked (warnings):
 *   ORPHAN_NODE         – node not referenced by any edge
 *   NO_TRANSFORMER      – topology has no transformer
 *   MULTIPLE_ROOTS      – more than one transformer supplied
 */
export function validateBtTopology(topology: TopologyInput): TopologyValidationResult {
  const errors: TopologyError[] = [];
  const warnings: TopologyWarning[] = [];

  const { poles, edges, transformers } = topology;
  const activeEdges = edges.filter(isEdgeActive);
  const activeTransformers = transformers.filter(isTransformerActive);
  const hasActiveEdges = activeEdges.length > 0;

  // ── 1. Duplicate node IDs ─────────────────────────────────────────────────
  const nodeIds = new Set<string>();
  const duplicateIds = new Set<string>();
  for (const pole of poles) {
    if (nodeIds.has(pole.id)) {
      duplicateIds.add(pole.id);
    } else {
      nodeIds.add(pole.id);
    }
  }
  for (const dup of duplicateIds) {
    if (hasActiveEdges) {
      errors.push({
        code: 'DUPLICATE_NODE_ID',
        message: `Duplicate node ID: "${dup}"`,
        nodeId: dup,
      });
      continue;
    }

    warnings.push({
      code: 'DUPLICATE_NODE_ID',
      message: `Duplicate node ID tolerated for poles-only topology: "${dup}"`,
      nodeId: dup,
    });
  }

  // Include transformer root nodes in the valid node set so edges can
  // reference the transformer's injection point.
  const allNodeIds = new Set<string>(nodeIds);
  for (const tx of activeTransformers) {
    const txNodeId = tx.rootNodeId ?? tx.poleId;
    if (txNodeId) allNodeIds.add(txNodeId);
  }

  // ── 2. Edge-level checks ──────────────────────────────────────────────────
  const seenEdgeKeys = new Map<string, string>(); // key → first edgeId
  const referencedNodes = new Set<string>();

  for (let i = 0; i < activeEdges.length; i++) {
    const edge = activeEdges[i];
    const edgeId = edge.id ?? `edge[${i}]`;
    const fromId = resolveEdgeFromId(edge);
    const toId = resolveEdgeToId(edge);

    if (!fromId) {
      errors.push({
        code: 'INVALID_EDGE_FROM',
        message: `Edge "${edgeId}" is missing fromId/fromPoleId`,
        edgeId,
      });
    }

    if (!toId) {
      errors.push({
        code: 'INVALID_EDGE_TO',
        message: `Edge "${edgeId}" is missing toId/toPoleId`,
        edgeId,
      });
    }

    // Self-loop
    if (fromId && toId && fromId === toId) {
      errors.push({
        code: 'SELF_LOOP',
        message: `Edge "${edgeId}" has fromId === toId ("${fromId}")`,
        edgeId,
        nodeId: fromId,
      });
    }

    // Invalid fromId
    if (fromId && !allNodeIds.has(fromId)) {
      errors.push({
        code: 'INVALID_EDGE_FROM',
        message: `Edge "${edgeId}" references unknown fromId "${fromId}"`,
        edgeId,
        nodeId: fromId,
      });
    } else if (fromId) {
      referencedNodes.add(fromId);
    }

    // Invalid toId
    if (toId && !allNodeIds.has(toId)) {
      errors.push({
        code: 'INVALID_EDGE_TO',
        message: `Edge "${edgeId}" references unknown toId "${toId}"`,
        edgeId,
        nodeId: toId,
      });
    } else if (toId) {
      referencedNodes.add(toId);
    }

    // Parallel edges (skip self-loops to avoid misleading key)
    if (fromId && toId && fromId !== toId) {
      const key = edgeKey(fromId, toId);
      if (seenEdgeKeys.has(key)) {
        errors.push({
          code: 'PARALLEL_EDGE',
          message: `Parallel edge between "${fromId}" and "${toId}" (also seen in "${seenEdgeKeys.get(key)}")`,
          edgeId,
        });
      } else {
        seenEdgeKeys.set(key, edgeId);
      }
    }
  }

  // ── 3. Orphan nodes (warning only) ───────────────────────────────────────
  let isolatedCount = 0;
  for (const id of nodeIds) {
    if (!referencedNodes.has(id)) {
      isolatedCount++;
      warnings.push({
        code: 'ORPHAN_NODE',
        message: `Node "${id}" is not referenced by any edge`,
        nodeId: id,
      });
    }
  }

  // ── 4. Transformer warnings ───────────────────────────────────────────────
  if (activeTransformers.length === 0) {
    warnings.push({
      code: 'NO_TRANSFORMER',
      message: 'No transformer found in topology',
    });
  } else if (activeTransformers.length > 1) {
    warnings.push({
      code: 'MULTIPLE_ROOTS',
      message: `${activeTransformers.length} transformers found; connectivity check uses the first one`,
    });
  }

  // ── 5. Connectivity (BFS from root) ───────────────────────────────────────
  // Skipped when there are no edges: poles-only export is valid ("somente postes").
  if (nodeIds.size > 0 && hasActiveEdges && activeTransformers.length > 0 && errors.filter(e =>
    e.code === 'INVALID_EDGE_FROM' || e.code === 'INVALID_EDGE_TO'
  ).length === 0) {
    const rootTx = activeTransformers[0];
    const rootId = rootTx.rootNodeId ?? rootTx.poleId ?? rootTx.id;

    // Build adjacency list (undirected, using only valid node IDs)
    const adjacency = new Map<string, Set<string>>();
    for (const id of allNodeIds) adjacency.set(id, new Set());
    for (const edge of activeEdges) {
      const fromId = resolveEdgeFromId(edge);
      const toId = resolveEdgeToId(edge);
      if (fromId && toId && fromId !== toId) {
        adjacency.get(fromId)?.add(toId);
        adjacency.get(toId)?.add(fromId);
      }
    }

    if (allNodeIds.has(rootId)) {
      const visited = new Set<string>();
      const queue: string[] = [rootId];
      visited.add(rootId);
      while (queue.length > 0) {
        const curr = queue.shift()!;
        for (const neighbor of adjacency.get(curr) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      // Check all poles (not transformer-only nodes) are reachable
      for (const id of nodeIds) {
        if (!visited.has(id)) {
          errors.push({
            code: 'DISCONNECTED_GRAPH',
            message: `Node "${id}" is not reachable from transformer root "${rootId}"`,
            nodeId: id,
          });
        }
      }
    }
  }

  // ── 6. Stats ──────────────────────────────────────────────────────────────
  const stats: TopologyStats = {
    nodeCount: nodeIds.size,
    edgeCount: activeEdges.length,
    transformerCount: activeTransformers.length,
    isolatedNodes: isolatedCount,
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats,
  };
}
