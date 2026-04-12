/**
 * BT Radial – graph module (E1-H1)
 *
 * Topology validation (radial / no-cycle check) and directed-tree construction.
 */

import {
    type BtRadialEdge,
    type BtRadialNode,
    type BtRadialTopologyInput,
    type TreeNode,
    BtRadialValidationError,
} from './btTypes.js';

/**
 * Validate the radial topology and return an undirected adjacency map.
 * Throws BtRadialValidationError for any structural violation.
 */
export function validateRadialTopology(
    input: BtRadialTopologyInput,
): Map<string, BtRadialEdge[]> {
    const { transformer, nodes, edges } = input;

    if (!transformer || !transformer.rootNodeId) {
        throw new BtRadialValidationError(
            'NO_TRANSFORMER',
            'Topology must define a transformer with rootNodeId.',
        );
    }

    const nodeIds = new Set(nodes.map((n) => n.id));

    if (!nodeIds.has(transformer.rootNodeId)) {
        throw new BtRadialValidationError(
            'ROOT_NODE_NOT_FOUND',
            `Transformer rootNodeId "${transformer.rootNodeId}" not found in nodes list.`,
        );
    }

    for (const edge of edges) {
        if (!nodeIds.has(edge.fromNodeId)) {
            throw new BtRadialValidationError(
                'EDGE_NODE_NOT_FOUND',
                `Edge fromNodeId "${edge.fromNodeId}" references an unknown node.`,
            );
        }
        if (!nodeIds.has(edge.toNodeId)) {
            throw new BtRadialValidationError(
                'EDGE_NODE_NOT_FOUND',
                `Edge toNodeId "${edge.toNodeId}" references an unknown node.`,
            );
        }
        if (!edge.conductorId) {
            throw new BtRadialValidationError(
                'EDGE_MISSING_CONDUCTOR',
                `Edge from "${edge.fromNodeId}" to "${edge.toNodeId}" has no conductorId.`,
            );
        }
        if (!(edge.lengthMeters > 0)) {
            throw new BtRadialValidationError(
                'EDGE_INVALID_LENGTH',
                `Edge from "${edge.fromNodeId}" to "${edge.toNodeId}" must have a positive length.`,
            );
        }
    }

    // Build undirected adjacency for DFS cycle detection
    const adj = new Map<string, BtRadialEdge[]>();
    for (const id of nodeIds) {
        adj.set(id, []);
    }
    for (const edge of edges) {
        adj.get(edge.fromNodeId)!.push(edge);
        adj.get(edge.toNodeId)!.push({
            ...edge,
            fromNodeId: edge.toNodeId,
            toNodeId: edge.fromNodeId,
        });
    }

    // DFS cycle detection from root
    const visited = new Set<string>();
    const stack: Array<{ id: string; parentId: string | null }> = [
        { id: transformer.rootNodeId, parentId: null },
    ];
    while (stack.length > 0) {
        const { id, parentId } = stack.pop()!;
        if (visited.has(id)) {
            throw new BtRadialValidationError(
                'CYCLE_DETECTED',
                `Topology contains a cycle at node "${id}". Radial topology required.`,
            );
        }
        visited.add(id);
        for (const edge of adj.get(id) ?? []) {
            if (edge.toNodeId !== parentId) {
                stack.push({ id: edge.toNodeId, parentId: id });
            }
        }
    }

    return adj;
}

/**
 * Build a directed tree rooted at rootId from the undirected adjacency map.
 */
export function buildTree(
    rootId: string,
    adj: Map<string, BtRadialEdge[]>,
    nodeMap: Map<string, BtRadialNode>,
): TreeNode {
    const visited = new Set<string>();

    function buildSubtree(nodeId: string): TreeNode {
        visited.add(nodeId);
        const node = nodeMap.get(nodeId)!;
        const children: TreeNode['children'] = [];
        for (const edge of adj.get(nodeId) ?? []) {
            if (!visited.has(edge.toNodeId)) {
                children.push({ treeNode: buildSubtree(edge.toNodeId), edge });
            }
        }
        return { id: nodeId, load: node.load, children };
    }

    return buildSubtree(rootId);
}
