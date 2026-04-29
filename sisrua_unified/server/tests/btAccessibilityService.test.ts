import { describe, it, expect } from "vitest";
import { calculateManualDraggingCosts } from '../services/btAccessibilityService';
import { BtAccessibilityNodeInfo } from '../services/bt/btAccessibilityTypes';

describe('btAccessibilityService', () => {
    it('calculates zero cost when all nodes have vehicle access', () => {
        const nodes: BtAccessibilityNodeInfo[] = [
            { id: 'P1', hasVehicleAccess: true },
            { id: 'P2', hasVehicleAccess: true }
        ];

        const result = calculateManualDraggingCosts(nodes);
        expect(result.totalAccessibilityCost).toBe(0);
        expect(result.draggingCosts).toHaveLength(0);
    });

    it('calculates dragging cost for a transformer in a restricted area', () => {
        const nodes: BtAccessibilityNodeInfo[] = [
            { 
                id: 'P1', 
                hasVehicleAccess: false, 
                manualDragDistanceMeters: 50,
                equipmentType: 'TR-75' // 500kg
            }
        ];

        // Cost = 500kg * 50m * 0.005 = 125.00
        const result = calculateManualDraggingCosts(nodes);
        expect(result.totalAccessibilityCost).toBe(125);
        expect(result.draggingCosts[0].totalCost).toBe(125);
        expect(result.draggingCosts[0].equipmentWeightKg).toBe(500);
    });

    it('calculates dragging cost for a pole with default values', () => {
        const nodes: BtAccessibilityNodeInfo[] = [
            { 
                id: 'P2', 
                hasVehicleAccess: false, 
                manualDragDistanceMeters: 20 
                // Default pole = 700kg
            }
        ];

        // Cost = 700kg * 20m * 0.005 = 70.00
        const result = calculateManualDraggingCosts(nodes);
        expect(result.totalAccessibilityCost).toBe(70);
        expect(result.draggingCosts[0].totalCost).toBe(70);
    });

    it('sums costs from multiple restricted nodes', () => {
        const nodes: BtAccessibilityNodeInfo[] = [
            { id: 'P1', hasVehicleAccess: false, manualDragDistanceMeters: 10, equipmentType: 'TR-15' }, // 150 * 10 * 0.005 = 7.5
            { id: 'P2', hasVehicleAccess: false, manualDragDistanceMeters: 10, equipmentType: 'POSTE-300' } // 700 * 10 * 0.005 = 35.0
        ];

        const result = calculateManualDraggingCosts(nodes);
        expect(result.totalAccessibilityCost).toBe(42.5);
        expect(result.draggingCosts).toHaveLength(2);
    });

    it('ignores negative or zero distances', () => {
        const nodes: BtAccessibilityNodeInfo[] = [
            { id: 'P1', hasVehicleAccess: false, manualDragDistanceMeters: -10 },
            { id: 'P2', hasVehicleAccess: false, manualDragDistanceMeters: 0 }
        ];

        const result = calculateManualDraggingCosts(nodes);
        expect(result.totalAccessibilityCost).toBe(0);
    });
});

