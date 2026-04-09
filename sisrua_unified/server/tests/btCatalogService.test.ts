/**
 * Tests for btCatalogService (E2-H1)
 */

import {
    getBtCatalog,
    lookupConductorById,
    lookupTransformerById,
    getCatalogChecksum,
    getCatalogVersion,
} from '../services/btCatalogService';

describe('btCatalogService – catalog structure', () => {
    it('returns a catalog with conductors and transformers', () => {
        const catalog = getBtCatalog();
        expect(catalog.conductors.length).toBeGreaterThan(0);
        expect(catalog.transformers.length).toBeGreaterThan(0);
    });

    it('every conductor has required fields', () => {
        const catalog = getBtCatalog();
        for (const c of catalog.conductors) {
            expect(typeof c.id).toBe('string');
            expect(c.id.length).toBeGreaterThan(0);
            expect(typeof c.resistance).toBe('number');
            expect(typeof c.reactance).toBe('number');
            expect(typeof c.alpha).toBe('number');
            expect(typeof c.divisorR).toBe('number');
        }
    });

    it('every transformer has required fields', () => {
        const catalog = getBtCatalog();
        for (const t of catalog.transformers) {
            expect(typeof t.id).toBe('string');
            expect(t.kva).toBeGreaterThan(0);
            expect(t.zPercent).toBeGreaterThan(0);
        }
    });
});

describe('btCatalogService – versioning (E2-H1)', () => {
    it('version has a semver string and checksum', () => {
        const version = getCatalogVersion();
        expect(version.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(version.checksum).toHaveLength(64); // SHA-256 hex
        expect(version.definedAt).toBeTruthy();
    });

    it('checksum is stable across calls', () => {
        expect(getCatalogChecksum()).toBe(getCatalogChecksum());
    });

    it('checksum matches catalog version checksum', () => {
        expect(getCatalogChecksum()).toBe(getCatalogVersion().checksum);
    });
});

describe('btCatalogService – lookup (E2-H1)', () => {
    it('lookupConductorById returns entry for valid id', () => {
        const c = lookupConductorById('95 Al - Arm');
        expect(c).toBeDefined();
        expect(c!.id).toBe('95 Al - Arm');
        expect(c!.resistance).toBeCloseTo(0.4197, 6);
    });

    it('lookupConductorById returns undefined for unknown id', () => {
        const c = lookupConductorById('UNKNOWN_CONDUCTOR_XYZ');
        expect(c).toBeUndefined();
    });

    it('lookupTransformerById returns entry for valid kVA string', () => {
        const t = lookupTransformerById('225');
        expect(t).toBeDefined();
        expect(t!.kva).toBe(225);
        expect(t!.zPercent).toBeCloseTo(0.035, 6);
    });

    it('lookupTransformerById returns undefined for unknown id', () => {
        const t = lookupTransformerById('99999');
        expect(t).toBeUndefined();
    });
});
