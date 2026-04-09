import { z } from 'zod';

/**
 * BT (Baixa Tensão / Low Voltage) domain schemas.
 * These schemas define the stable API contracts for BT topology calculations.
 * Version: v1
 */

// ── Consumer ──────────────────────────────────────────────────────────────────

export const btConsumerTypeSchema = z.enum([
    'residential',
    'commercial',
    'industrial',
    'clandestine',
]);

export const btReadingModeSchema = z.enum([
    'auto',      // smart meter automatic reading
    'manual',    // inspector manual reading
    'estimated', // statistical estimation
]);

export const btConsumerSchema = z.object({
    id: z.string().min(1).max(100),
    label: z.string().min(1).max(200),
    powerKw: z.number().nonnegative().max(1000),
    type: btConsumerTypeSchema,
    readingMode: btReadingModeSchema,
    readingKwh: z.number().nonnegative().optional(), // monthly meter reading
});

// ── Pole ──────────────────────────────────────────────────────────────────────

export const btPoleSchema = z.object({
    id: z.string().min(1).max(100),
    label: z.string().min(1).max(200),
    distanceFromTransformerM: z.number().nonnegative().max(10000),
    consumers: z.array(btConsumerSchema).max(100),
    conductorCrossSectionMm2: z.number().positive().max(1000),
});

// ── Topology ──────────────────────────────────────────────────────────────────

export const btTopologySchema = z.object({
    transformerId: z.string().min(1).max(100),
    nominalVoltageV: z.number().positive().max(1000), // e.g. 220 or 127
    poles: z.array(btPoleSchema).min(1).max(500),
    sectioningPoints: z.array(z.string().min(1).max(100)).max(100).optional(),
});

// ── Settings ──────────────────────────────────────────────────────────────────

export const btSettingsSchema = z.object({
    demandFactor: z.number().min(0).max(1).default(1.0),
    powerFactor: z.number().min(0.1).max(1).default(0.92),
    safetyMargin: z.number().min(0).max(1).default(0.0),
});

// ── Constants ─────────────────────────────────────────────────────────────────

export const btConstantsSchema = z.object({
    conductorResistivityOhmPerKmPerMm2: z.number().positive().max(1000).default(18.1), // copper
    maxVoltageDropPercent: z.number().positive().max(100).default(7.0), // ANEEL PRODIST Mod 8
    transformerRatedKva: z.number().positive().max(10000).default(75.0),
    transformerEfficiency: z.number().min(0.1).max(1).default(0.97),
});

// ── Mode ──────────────────────────────────────────────────────────────────────

export const btCalculationModeSchema = z.enum([
    'standard',     // normal operational mode
    'sectioning',   // sectioning switch impact analysis
    'clandestine',  // include clandestine connections
    'full',         // all modes combined
]);

// ── Request Payload ───────────────────────────────────────────────────────────

export const btCalculationRequestSchema = z.object({
    topology: btTopologySchema,
    settings: btSettingsSchema.default({}),
    constants: btConstantsSchema.default({}),
    mode: btCalculationModeSchema.default('standard'),
}).strict();

// ── Response Types (for documentation; runtime uses TypeScript types) ──────────

export type BtConsumer = z.infer<typeof btConsumerSchema>;
export type BtPole = z.infer<typeof btPoleSchema>;
export type BtTopology = z.infer<typeof btTopologySchema>;
export type BtSettings = z.infer<typeof btSettingsSchema>;
export type BtConstants = z.infer<typeof btConstantsSchema>;
export type BtCalculationMode = z.infer<typeof btCalculationModeSchema>;
export type BtCalculationRequest = z.infer<typeof btCalculationRequestSchema>;

// ── Response Payload ──────────────────────────────────────────────────────────

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
    readingMode: 'auto' | 'manual' | 'estimated';
    dmdi: number; // Demanda Máxima Diária Instantânea (kW)
}

export interface BtCalculationResponse {
    version: string;
    summary: BtSummary;
    accumulatedByPole: BtAccumulatedByPole[];
    estimatedByTransformer: BtEstimatedByTransformer;
    sectioningImpact: BtSectioningImpact[];
    derivedReadings: BtDerivedReading[];
}
