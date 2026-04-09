/**
 * BT Catalog Service (E2-H1)
 *
 * Conductor and transformer catalog with:
 *  - Versioning (semantic version + checksum)
 *  - Lookup by ID with controlled fallback
 *  - Checksum that changes when baseline changes
 *
 * Source of truth: workbook DB sheet – CQTsimplificado_BECO DO MATA 7 - PARIDADE_FINAL.xlsx
 */

import { createHash } from 'crypto';
import { CABOS_BASELINE, TRAFOS_Z_BASELINE, type CaboLookupRow } from '../constants/cqtLookupTables.js';

// ─── Catalog types ────────────────────────────────────────────────────────────

export interface BtConductorEntry {
    /** Unique conductor identifier (matches workbook conductor name). */
    id: string;
    /** Ampacity in A (0 = not rated / informational only). */
    ampacity: number;
    /** DC resistance in Ω/km. */
    resistance: number;
    /** Reactance in Ω/km. */
    reactance: number;
    /** Temperature coefficient (1/°C). */
    alpha: number;
    /** Resistance divisor for temperature correction. */
    divisorR: number;
}

export interface BtTransformerEntry {
    /** Unique transformer identifier = kVA rating as string, e.g. "225". */
    id: string;
    /** Nameplate kVA. */
    kva: number;
    /** Short-circuit impedance percentage, e.g. 0.035 for 3.5 %. */
    zPercent: number;
}

export interface BtCatalogVersion {
    /** Human-readable version string. */
    version: string;
    /** SHA-256 checksum of the baseline data (changes when baseline changes). */
    checksum: string;
    /** ISO timestamp of when this baseline was defined. */
    definedAt: string;
}

export interface BtCatalog {
    conductors: BtConductorEntry[];
    transformers: BtTransformerEntry[];
    version: BtCatalogVersion;
}

// ─── Baseline data ────────────────────────────────────────────────────────────

const CATALOG_VERSION = '1.0.0';
const CATALOG_DEFINED_AT = '2026-04-09T00:00:00.000Z';

function buildConductorCatalog(cabos: CaboLookupRow[]): BtConductorEntry[] {
    return cabos.map((row) => ({
        id: row.name,
        ampacity: row.ampacity,
        resistance: row.resistance,
        reactance: row.reactance,
        alpha: row.alpha,
        divisorR: row.divisorR,
    }));
}

function buildTransformerCatalog(): BtTransformerEntry[] {
    return TRAFOS_Z_BASELINE.map((row) => ({
        id: String(row.trafoKva),
        kva: row.trafoKva,
        zPercent: row.qtFactor,
    }));
}

/** Deterministic SHA-256 of the baseline data. */
function computeChecksum(conductors: BtConductorEntry[], transformers: BtTransformerEntry[]): string {
    const payload = JSON.stringify({ conductors, transformers });
    return createHash('sha256').update(payload).digest('hex');
}

function buildCatalog(): BtCatalog {
    const conductors = buildConductorCatalog(CABOS_BASELINE);
    const transformers = buildTransformerCatalog();
    const checksum = computeChecksum(conductors, transformers);

    return {
        conductors,
        transformers,
        version: {
            version: CATALOG_VERSION,
            checksum,
            definedAt: CATALOG_DEFINED_AT,
        },
    };
}

// Singleton – computed once at module load.
const BASELINE_CATALOG: BtCatalog = buildCatalog();

// ─── Public API ───────────────────────────────────────────────────────────────

/** Return the full baseline catalog including versioning info. */
export function getBtCatalog(): BtCatalog {
    return BASELINE_CATALOG;
}

/** Look up a conductor by ID. Returns undefined for unknown IDs (controlled fallback). */
export function lookupConductorById(id: string): BtConductorEntry | undefined {
    return BASELINE_CATALOG.conductors.find((c) => c.id === id);
}

/** Look up a transformer by ID (kVA as string). Returns undefined for unknown IDs. */
export function lookupTransformerById(id: string): BtTransformerEntry | undefined {
    return BASELINE_CATALOG.transformers.find((t) => t.id === id);
}

/** Return the current catalog checksum. */
export function getCatalogChecksum(): string {
    return BASELINE_CATALOG.version.checksum;
}

/** Return the current catalog version. */
export function getCatalogVersion(): BtCatalogVersion {
    return BASELINE_CATALOG.version;
}
