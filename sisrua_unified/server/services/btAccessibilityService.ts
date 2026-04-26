/**
 * BT Accessibility Service (AccessibilityProcessor)
 * Specialized for manual dragging cost calculation in restricted access areas.
 */

import {
    BtAccessibilityNodeInfo,
    BtAccessibilityOutput,
    DraggingCostResult,
    LIGHT_EQUIPMENT_WEIGHTS,
    MANUAL_DRAG_COST_PER_KG_METER
} from './bt/btAccessibilityTypes.js';

/**
 * Calculates additional labor costs for manually dragging equipment and poles
 * when vehicle access is not available.
 */
export function calculateManualDraggingCosts(nodes: BtAccessibilityNodeInfo[]): BtAccessibilityOutput {
    const draggingCosts: DraggingCostResult[] = [];
    let totalAccessibilityCost = 0;

    for (const node of nodes) {
        // Only calculate for nodes without vehicle access
        if (node.hasVehicleAccess === false) {
            const distance = node.manualDragDistanceMeters || 0;
            
            if (distance > 0) {
                // Determine equipment weight
                const equipmentKey = node.equipmentType || 'DEFAULT_POLE';
                const weight = LIGHT_EQUIPMENT_WEIGHTS[equipmentKey] || LIGHT_EQUIPMENT_WEIGHTS['DEFAULT_POLE'];
                
                // Formula: Cost = Weight(kg) * Distance(m) * BaremoFactor
                const nodeCost = weight * distance * MANUAL_DRAG_COST_PER_KG_METER;
                
                draggingCosts.push({
                    nodeId: node.id,
                    equipmentWeightKg: weight,
                    distanceMeters: distance,
                    totalCost: Math.round(nodeCost * 100) / 100
                });
                
                totalAccessibilityCost += nodeCost;
            }
        }
    }

    return {
        draggingCosts,
        totalAccessibilityCost: Math.round(totalAccessibilityCost * 100) / 100
    };
}
