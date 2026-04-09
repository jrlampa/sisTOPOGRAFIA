import { API_BASE_URL } from '../config/api';

/**
 * BT (Baixa Tensão / Low Voltage) Service Layer.
 *
 * Thin HTTP client that translates frontend BT topology data into backend
 * API calls and returns typed response objects.
 *
 * NO business logic, calculations or normalizations live here.
 * All domain computations are performed by the backend engine.
 */

// ── Domain types mirrored from backend contract (no calculation logic) ─────────

export type BtConsumerType = 'residential' | 'commercial' | 'industrial' | 'clandestine';
export type BtReadingMode = 'auto' | 'manual' | 'estimated';
export type BtCalculationMode = 'standard' | 'sectioning' | 'clandestine' | 'full';

export interface BtConsumer {
    id: string;
    label: string;
    powerKw: number;
    type: BtConsumerType;
    readingMode: BtReadingMode;
    readingKwh?: number;
}

export interface BtPole {
    id: string;
    label: string;
    distanceFromTransformerM: number;
    consumers: BtConsumer[];
    conductorCrossSectionMm2: number;
}

export interface BtTopology {
    transformerId: string;
    nominalVoltageV: number;
    poles: BtPole[];
    sectioningPoints?: string[];
}

export interface BtSettings {
    demandFactor?: number;
    powerFactor?: number;
    safetyMargin?: number;
}

export interface BtConstants {
    conductorResistivityOhmPerKmPerMm2?: number;
    maxVoltageDropPercent?: number;
    transformerRatedKva?: number;
    transformerEfficiency?: number;
}

export interface BtCalculationRequest {
    topology: BtTopology;
    settings?: BtSettings;
    constants?: BtConstants;
    mode?: BtCalculationMode;
}

// ── Response types (read-only contract from backend) ──────────────────────────

export interface BtSummary {
    version: string;
    totalConsumers: number;
    totalClandestine: number;
    totalDemandKw: number;
    totalDemandKva: number;
    maxVoltageDropPercent: number;
    transformerLoadPercent: number;
    withinVoltageDropLimit: boolean;
}

export interface BtAccumulatedByPole {
    poleId: string;
    label: string;
    localDemandKw: number;
    accumulatedDemandKw: number;
    voltageDropPercent: number;
    currentA: number;
    withinLimit: boolean;
}

export interface BtEstimatedByTransformer {
    demandKw: number;
    demandKva: number;
    currentA: number;
    loadPercent: number;
}

export interface BtSectioningImpact {
    sectioningPointId: string;
    demandUpstreamKw: number;
    demandDownstreamKw: number;
    affectedPoleIds: string[];
    affectedConsumers: number;
}

export interface BtDerivedReading {
    consumerId: string;
    poleId: string;
    derivedDemandKw: number;
    readingMode: BtReadingMode;
    dmdi: number;
}

export interface BtCalculationResponse {
    version: string;
    summary: BtSummary;
    accumulatedByPole: BtAccumulatedByPole[];
    estimatedByTransformer: BtEstimatedByTransformer;
    sectioningImpact: BtSectioningImpact[];
    derivedReadings: BtDerivedReading[];
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function parseResponse<T>(response: Response, context: string): Promise<T> {
    const text = await response.text();
    if (!text) throw new Error(`${context}: empty response (HTTP ${response.status})`);
    let data: unknown;
    try { data = JSON.parse(text); } catch {
        throw new Error(`${context}: invalid JSON (HTTP ${response.status})`);
    }
    if (!response.ok) {
        const payload = data as Record<string, unknown>;
        const msg = (payload.details ?? payload.error ?? payload.message) as string | undefined;
        throw new Error(msg ?? `${context} failed (HTTP ${response.status})`);
    }
    return data as T;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Send a BT topology to the backend engine and return the full calculation
 * result. The frontend component must NOT derive any electrical values from
 * this call's arguments — it must only render the response.
 */
export async function calculateBtTopology(
    request: BtCalculationRequest,
): Promise<BtCalculationResponse> {
    const response = await fetch(`${API_BASE_URL}/bt/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });
    return parseResponse<BtCalculationResponse>(response, 'BT topology calculation');
}
