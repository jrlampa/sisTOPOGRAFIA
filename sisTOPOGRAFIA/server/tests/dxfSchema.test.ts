/**
 * server/tests/dxfSchema.test.ts
 * Tests for the DXF generation request schema (dxfSchema.ts).
 * Verifies input validation used by DxfController.
 */
import { dxfGenerationRequestSchema } from '../interfaces/schemas/dxfSchema';

describe('dxfGenerationRequestSchema', () => {
    // ── projection field ────────────────────────────────────────────────────

    it('aceita projection "local"', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'circle',
            lat: -22.15018,
            lon: -42.92185,
            radius: 500,
            projection: 'local'
        });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.projection).toBe('local');
    });

    it('aceita projection "utm"', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'circle',
            lat: -22.15018,
            lon: -42.92185,
            radius: 500,
            projection: 'utm'
        });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.projection).toBe('utm');
    });

    it('usa "local" como default quando projection está ausente', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'circle',
            lat: -22.15018,
            lon: -42.92185,
            radius: 500
        });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.projection).toBe('local');
    });

    it('rejeita projection com valor arbitrário', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'circle',
            lat: -22.15018,
            lon: -42.92185,
            radius: 500,
            projection: 'wgs84'
        });
        expect(result.success).toBe(false);
    });

    it('rejeita projection com string vazia', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'circle',
            lat: -22.15018,
            lon: -42.92185,
            radius: 500,
            projection: ''
        });
        expect(result.success).toBe(false);
    });

    // ── layers field ─────────────────────────────────────────────────────────

    it('aceita layers com campos booleanos válidos', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'circle',
            lat: -22.15018,
            lon: -42.92185,
            radius: 500,
            layers: { buildings: true, roads: false }
        });
        expect(result.success).toBe(true);
    });

    it('aceita request sem layers (campo opcional)', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'circle',
            lat: -22.15018,
            lon: -42.92185,
            radius: 500
        });
        expect(result.success).toBe(true);
    });

    it('rejeita layers com campos desconhecidos (strict)', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'circle',
            lat: -22.15018,
            lon: -42.92185,
            radius: 500,
            layers: { buildings: true, unknown_field: true }
        });
        expect(result.success).toBe(false);
    });

    it('rejeita layers com valor não-booleano', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'circle',
            lat: -22.15018,
            lon: -42.92185,
            radius: 500,
            layers: { buildings: 'yes' }
        });
        expect(result.success).toBe(false);
    });

    // ── mode and coordinate validation ────────────────────────────────────────

    it('aceita modo circle com lat/lon', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'circle',
            lat: -22.15018,
            lon: -42.92185,
            radius: 500
        });
        expect(result.success).toBe(true);
    });

    it('rejeita modo circle sem lat/lon', () => {
        const result = dxfGenerationRequestSchema.safeParse({ mode: 'circle', radius: 500 });
        expect(result.success).toBe(false);
    });

    it('aceita modo utm com dados UTM', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'utm',
            utm: { zone: '23K', easting: 788547, northing: 7634925 },
            radius: 100
        });
        expect(result.success).toBe(true);
    });

    it('rejeita modo utm sem dados UTM', () => {
        const result = dxfGenerationRequestSchema.safeParse({ mode: 'utm', radius: 100 });
        expect(result.success).toBe(false);
    });

    it('usa "circle" como modo default quando mode está ausente', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            lat: -22.15018,
            lon: -42.92185,
            radius: 500
        });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.mode).toBe('circle');
    });

    it('rejeita raio abaixo do mínimo (10m)', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'circle',
            lat: -22.15018,
            lon: -42.92185,
            radius: 5
        });
        expect(result.success).toBe(false);
    });

    it('rejeita raio acima do máximo (5000m)', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'circle',
            lat: -22.15018,
            lon: -42.92185,
            radius: 6000
        });
        expect(result.success).toBe(false);
    });
});
