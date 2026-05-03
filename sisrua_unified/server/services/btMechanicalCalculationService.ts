/**
 * BT Mechanical Calculation Service (2.5D MechanicalProcessor)
 * Specialized for Light standards and vector summation of pole forces.
 */

import {
    BtMechanicalInput,
    BtMechanicalNodeResult,
    BtMechanicalValidationError,
    LIGHT_CONDUCTOR_MECHANICAL_DATA
} from './bt/btMechanicalTypes.js';

/**
 * Calculates the initial bearing (azimuth) between two points in degrees.
 * 0 is North, 90 is East, 180 is South, 270 is West.
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    
    const θ = Math.atan2(y, x);
    const bearing = ((θ * 180) / Math.PI + 360) % 360;
    return bearing;
}

/**
 * Performs vector summation of mechanical tractions on each pole.
 */
export interface BtMechanicalEdgeResult {
    edgeId: string;
    totalTractionDaN: number;
    totalWeightDaN: number;
    circuitsCount: number;
}

export interface BtMechanicalOutput {
    nodeResults: BtMechanicalNodeResult[];
    edgeResults: BtMechanicalEdgeResult[];
}

/**
 * Performs vector summation of mechanical tractions on each pole.
 * Now aggregates multiple circuits per span.
 * Optimized for O(N) performance on large topologies.
 */
export function calculateBtMechanical(input: BtMechanicalInput): BtMechanicalOutput {
    const { nodes, edges } = input;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const edgeMap = new Map(edges.map(e => [e.id, e]));
    const nodeResults: BtMechanicalNodeResult[] = [];
    const edgeResults: BtMechanicalEdgeResult[] = [];

    // Group edges by incident nodes (Adjacency List)
    const adj = new Map<string, string[]>();
    
    // Pass 1: Build adjacency and pre-calculate per-edge totals
    for (const edge of edges) {
        if (!adj.has(edge.fromNodeId)) adj.set(edge.fromNodeId, []);
        if (!adj.has(edge.toNodeId)) adj.set(edge.toNodeId, []);
        adj.get(edge.fromNodeId)!.push(edge.id);
        adj.get(edge.toNodeId)!.push(edge.id);

        let edgeTraction = 0;
        let edgeWeight = 0;
        for (const cond of edge.conductors) {
            const data = LIGHT_CONDUCTOR_MECHANICAL_DATA[cond.conductorName] || LIGHT_CONDUCTOR_MECHANICAL_DATA['DEFAULT'];
            edgeTraction += cond.quantity * data.designTractionDaN;
            edgeWeight += cond.quantity * data.weightDaNm;
        }
        edgeResults.push({
            edgeId: edge.id,
            totalTractionDaN: edgeTraction,
            totalWeightDaN: edgeWeight,
            circuitsCount: edge.conductors.length
        });
    }

    // Pass 2: Vector summation for each node
    for (const node of nodes) {
        const incidentEdgeIds = adj.get(node.id) || [];
        let totalX = 0;
        let totalY = 0;
        const incidentVectors: BtMechanicalNodeResult['incidentVectors'] = [];

        for (const edgeId of incidentEdgeIds) {
            const edge = edgeMap.get(edgeId);
            if (!edge) continue;

            const otherNodeId = edge.fromNodeId === node.id ? edge.toNodeId : edge.fromNodeId;
            const otherNode = nodeMap.get(otherNodeId);

            if (!otherNode) {
                throw new BtMechanicalValidationError(`Edge ${edgeId} references unknown node ${otherNodeId}`);
            }

            // Calculate bearing (Azimuth) from current node to neighbor
            const bearing = calculateBearing(node.lat, node.lng, otherNode.lat, otherNode.lng);
            
            let spanTractionDaN = 0;
            for (const cond of edge.conductors) {
                const data = LIGHT_CONDUCTOR_MECHANICAL_DATA[cond.conductorName] || LIGHT_CONDUCTOR_MECHANICAL_DATA['DEFAULT'];
                spanTractionDaN += cond.quantity * data.designTractionDaN;
            }

            // Convert Azimuth (0=North, clockwise) to Cartesian Math Angle (0=East, counter-clockwise)
            // θ_math = 90 - Azimuth
            const angleRad = ((90 - bearing) * Math.PI) / 180;
            totalX += spanTractionDaN * Math.cos(angleRad);
            totalY += spanTractionDaN * Math.sin(angleRad);

            incidentVectors.push({
                toNodeId: otherNodeId,
                forceDaN: spanTractionDaN,
                angleDegrees: bearing
            });
        }

        const resultantForceDaN = Math.sqrt(totalX * totalX + totalY * totalY);
        const resultantAngleRad = Math.atan2(totalY, totalX);
        const resultantAngleDegrees = (90 - (resultantAngleRad * 180) / Math.PI + 360) % 360;

        const nominalCapacity = node.nominalCapacityDaN || 300; 
        const overloaded = resultantForceDaN > nominalCapacity;

        nodeResults.push({
            nodeId: node.id,
            resultantForceDaN: Math.round(resultantForceDaN * 100) / 100,
            resultantAngleDegrees: Math.round(resultantAngleDegrees * 100) / 100,
            overloaded,
            incidentVectors
        });
    }

    return { nodeResults, edgeResults };
}
