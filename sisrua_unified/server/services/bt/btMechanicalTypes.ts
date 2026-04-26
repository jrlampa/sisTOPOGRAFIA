/**
 * BT Mechanical Calculation Types & Constants (Light Standards)
 */

export interface BtMechanicalNode {
    id: string;
    lat: number;
    lng: number;
    title?: string;
    nominalCapacityDaN?: number; // e.g., 300, 600, 1000 daN
}

export interface BtMechanicalConductor {
    conductorName: string;
    quantity: number;
}

export interface BtMechanicalEdge {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    conductors: BtMechanicalConductor[];
}

export interface BtMechanicalInput {
    nodes: BtMechanicalNode[];
    edges: BtMechanicalEdge[];
    windPressurePa?: number; // Pressure in Pascal (Light standard defaults to 0.60 or similar)
    safetyFactor?: number;   // Standard safety factor (usually 1.5 to 2.0)
}

export interface BtMechanicalNodeResult {
    nodeId: string;
    resultantForceDaN: number;
    resultantAngleDegrees: number;
    overloaded: boolean;
    incidentVectors: {
        toNodeId: string;
        forceDaN: number;
        angleDegrees: number;
    }[];
}

export interface BtMechanicalOutput {
    nodeResults: BtMechanicalNodeResult[];
}

/**
 * Mechanical data for common Light conductors.
 * Values are representative of typical LV multiplexed cables.
 * Traction (daN) represents the design tension under worst-case loading (EDS or Max Load).
 */
export const LIGHT_CONDUCTOR_MECHANICAL_DATA: Record<string, { weightDaNm: number; designTractionDaN: number }> = {
    "70 Al - MX": { weightDaNm: 0.85, designTractionDaN: 200 },
    "35 Al - MX": { weightDaNm: 0.45, designTractionDaN: 110 },
    "120 Al - MX": { weightDaNm: 1.45, designTractionDaN: 350 },
    "185 Al - MX": { weightDaNm: 2.20, designTractionDaN: 520 },
    "DEFAULT": { weightDaNm: 0.85, designTractionDaN: 200 }
};

export class BtMechanicalValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BtMechanicalValidationError';
    }
}
