/**
 * BT Accessibility & Manual Dragging Types (Light Standards)
 */

export interface EquipmentWeight {
    name: string;
    weightKg: number;
}

export const LIGHT_EQUIPMENT_WEIGHTS: Record<string, number> = {
    // Transformers (kVA -> kg)
    "TR-15": 150,
    "TR-30": 250,
    "TR-45": 350,
    "TR-75": 500,
    "TR-112.5": 650,
    "TR-150": 800,
    
    // Poles (daN -> kg approx)
    "POSTE-300": 700,
    "POSTE-600": 1100,
    "POSTE-1000": 1600,
    
    "DEFAULT_POLE": 700,
    "DEFAULT_TRANSFORMER": 350
};

/**
 * Manual Dragging Cost (Baremo)
 * Typical factor for Light: Cost per kg per meter.
 * This is a simplified representative value.
 */
export const MANUAL_DRAG_COST_PER_KG_METER = 0.005; // Example: R$ 0.005 / kg / m

export interface BtAccessibilityNodeInfo {
    id: string;
    hasVehicleAccess: boolean;
    manualDragDistanceMeters?: number;
    equipmentType?: string; // e.g., 'TR-75', 'POSTE-600'
}

export interface DraggingCostResult {
    nodeId: string;
    equipmentWeightKg: number;
    distanceMeters: number;
    totalCost: number;
}

export interface BtAccessibilityOutput {
    draggingCosts: DraggingCostResult[];
    totalAccessibilityCost: number;
}
