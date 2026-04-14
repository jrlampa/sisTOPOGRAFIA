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
  edges: Array<{ id?: string; fromId: string; toId: string; [key: string]: unknown }>;
  transformers: Array<{ id: string; rootNodeId?: string; [key: string]: unknown }>;
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
    errors.push({
      code: 'DUPLICATE_NODE_ID',
      message: `Duplicate node ID: "${dup}"`,
      nodeId: dup,
    });
  }

  // Include transformer root nodes in the valid node set so edges can
  // reference the transformer's injection point.
  const allNodeIds = new Set<string>(nodeIds);
  for (const tx of transformers) {
    if (tx.rootNodeId) allNodeIds.add(tx.rootNodeId);
  }

  // ── 2. Edge-level checks ──────────────────────────────────────────────────
  const seenEdgeKeys = new Map<string, string>(); // key → first edgeId
  const referencedNodes = new Set<string>();

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const edgeId = edge.id ?? `edge[${i}]`;

    // Self-loop
    if (edge.fromId === edge.toId) {
      errors.push({
        code: 'SELF_LOOP',
        message: `Edge "${edgeId}" has fromId === toId ("${edge.fromId}")`,
        edgeId,
        nodeId: edge.fromId,
      });
    }

    // Invalid fromId
    if (!allNodeIds.has(edge.fromId)) {
      errors.push({
        code: 'INVALID_EDGE_FROM',
        message: `Edge "${edgeId}" references unknown fromId "${edge.fromId}"`,
        edgeId,
        nodeId: edge.fromId,
      });
    } else {
      referencedNodes.add(edge.fromId);
    }

    // Invalid toId
    if (!allNodeIds.has(edge.toId)) {
      errors.push({
        code: 'INVALID_EDGE_TO',
        message: `Edge "${edgeId}" references unknown toId "${edge.toId}"`,
        edgeId,
        nodeId: edge.toId,
      });
    } else {
      referencedNodes.add(edge.toId);
    }

    // Parallel edges (skip self-loops to avoid misleading key)
    if (edge.fromId !== edge.toId) {
      const key = edgeKey(edge.fromId, edge.toId);
      if (seenEdgeKeys.has(key)) {
        errors.push({
          code: 'PARALLEL_EDGE',
          message: `Parallel edge between "${edge.fromId}" and "${edge.toId}" (also seen in "${seenEdgeKeys.get(key)}")`,
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
  if (transformers.length === 0) {
    warnings.push({
      code: 'NO_TRANSFORMER',
      message: 'No transformer found in topology',
    });
  } else if (transformers.length > 1) {
    warnings.push({
      code: 'MULTIPLE_ROOTS',
      message: `${transformers.length} transformers found; connectivity check uses the first one`,
    });
  }

  // ── 5. Connectivity (BFS from root) ───────────────────────────────────────
  if (nodeIds.size > 0 && transformers.length > 0 && errors.filter(e =>
    e.code === 'INVALID_EDGE_FROM' || e.code === 'INVALID_EDGE_TO'
  ).length === 0) {
    const rootTx = transformers[0];
    const rootId = rootTx.rootNodeId ?? rootTx.id;

    // Build adjacency list (undirected, using only valid node IDs)
    const adjacency = new Map<string, Set<string>>();
    for (const id of allNodeIds) adjacency.set(id, new Set());
    for (const edge of edges) {
      if (edge.fromId !== edge.toId) {
        adjacency.get(edge.fromId)?.add(edge.toId);
        adjacency.get(edge.toId)?.add(edge.fromId);
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
    edgeCount: edges.length,
    transformerCount: transformers.length,
    isolatedNodes: isolatedCount,
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats,
  };
}
