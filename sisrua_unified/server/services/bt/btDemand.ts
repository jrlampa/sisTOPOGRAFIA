/**
 * BT Radial – demand module (E5-H1)
 *
 * Bottom-up demand aggregation: post-order traversal summing
 * localDemandKva from all leaves to the root.
 */

import { type TreeNode } from './btTypes.js';

/**
 * Accumulate demand for each node (post-order).
 * Populates `demandByNode` in-place and returns the root's total.
 */
export function accumulateDemand(
    tree: TreeNode,
    demandByNode: Map<string, number>,
): number {
    let total = tree.load.localDemandKva;
    for (const { treeNode } of tree.children) {
        total += accumulateDemand(treeNode, demandByNode);
    }
    demandByNode.set(tree.id, total);
    return total;
}
