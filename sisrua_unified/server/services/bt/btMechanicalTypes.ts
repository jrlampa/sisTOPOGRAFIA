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
    circuitType?: 'BT' | 'MT' | 'TELECOM' | 'OTHER';
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
    // Baixa Tensão (BT) - Multiplexados
    "70 Al - MX": { weightDaNm: 0.85, designTractionDaN: 200 },
    "35 Al - MX": { weightDaNm: 0.45, designTractionDaN: 110 },
    "120 Al - MX": { weightDaNm: 1.45, designTractionDaN: 350 },
    "185 Al - MX": { weightDaNm: 2.20, designTractionDaN: 520 },

    // Média Tensão (MT) - Alumínio Nu (Exemplos Light)
    "MT-4-AWG-AL": { weightDaNm: 0.15, designTractionDaN: 150 },
    "MT-1/0-AWG-AL": { weightDaNm: 0.35, designTractionDaN: 300 },
    "MT-4/0-AWG-AL": { weightDaNm: 0.65, designTractionDaN: 550 },
    
    // Média Tensão (MT) - Protegidos/Compactos
    "MT-70-PROT": { weightDaNm: 0.90, designTractionDaN: 250 },
    "MT-150-PROT": { weightDaNm: 1.80, designTractionDaN: 450 },

    "DEFAULT": { weightDaNm: 0.85, designTractionDaN: 200 }
};

export class BtMechanicalValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BtMechanicalValidationError';
    }
}
