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

    // ── previously-blocked valid production requests ──────────────────────────

    it('aceita coordenadas -22.15018, -42.92185 com qualquer raio válido (ex: 200m)', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'circle',
            lat: -22.15018,
            lon: -42.92185,
            radius: 200
        });
        expect(result.success).toBe(true);
    });

    it('aceita coordenadas -22.15018, -42.92185 com raio 100m', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'circle',
            lat: -22.15018,
            lon: -42.92185,
            radius: 100
        });
        expect(result.success).toBe(true);
    });

    it('aceita UTM 23K 788547 7634925 com raio diferente de 100m (ex: 500m)', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'utm',
            utm: { zone: '23K', easting: 788547, northing: 7634925 },
            radius: 500
        });
        expect(result.success).toBe(true);
    });

    // ── polygon mode validation ────────────────────────────────────────────────

    it('aceita modo polygon com array válido de 3+ pontos', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'polygon',
            radius: 500,
            polygon: [
                { lat: -22.15, lng: -42.92 },
                { lat: -22.16, lng: -42.92 },
                { lat: -22.16, lng: -42.93 }
            ]
        });
        expect(result.success).toBe(true);
    });

    it('aceita modo polygon com JSON string válida de 3+ pontos', () => {
        const poly = JSON.stringify([
            { lat: -22.15, lng: -42.92 },
            { lat: -22.16, lng: -42.92 },
            { lat: -22.16, lng: -42.93 }
        ]);
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'polygon',
            radius: 500,
            polygon: poly
        });
        expect(result.success).toBe(true);
    });

    it('rejeita modo polygon sem campo polygon', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'polygon',
            radius: 500
        });
        expect(result.success).toBe(false);
    });

    it('rejeita modo polygon com array vazio', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'polygon',
            radius: 500,
            polygon: []
        });
        expect(result.success).toBe(false);
    });

    it('rejeita modo polygon com array de menos de 3 pontos', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'polygon',
            radius: 500,
            polygon: [{ lat: -22.15, lng: -42.92 }, { lat: -22.16, lng: -42.92 }]
        });
        expect(result.success).toBe(false);
    });

    it('rejeita modo polygon com JSON string inválida', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'polygon',
            radius: 500,
            polygon: 'NOT_VALID_JSON{'
        });
        expect(result.success).toBe(false);
    });

    it('rejeita modo polygon com JSON string de array vazio', () => {
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'polygon',
            radius: 500,
            polygon: '[]'
        });
        expect(result.success).toBe(false);
    });

    it('rejeita modo polygon com mais de 1000 pontos', () => {
        // Covers line 71 (MAX_POLYGON_POINTS check)
        const bigPolygon = Array.from({ length: 1001 }, (_, i) => ({ lat: -22 + i * 0.001, lng: -42 }));
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'polygon',
            radius: 500,
            polygon: bigPolygon
        });
        expect(result.success).toBe(false);
    });

    it('rejeita modo polygon com coordenadas fora dos limites (lat > 90)', () => {
        // Covers lines 80-88 (per-point coordinate validation)
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'polygon',
            radius: 500,
            polygon: [
                { lat: -22.15, lng: -42.92 },
                { lat: 95.0, lng: -42.92 },  // lat > 90 is invalid
                { lat: -22.16, lng: -42.93 }
            ]
        });
        expect(result.success).toBe(false);
    });

    it('rejeita modo polygon com longitude fora dos limites (lon < -180)', () => {
        // Covers lines 80-88 (per-point coordinate validation, lon < -180 branch)
        const result = dxfGenerationRequestSchema.safeParse({
            mode: 'polygon',
            radius: 500,
            polygon: [
                { lat: -22.15, lng: -42.92 },
                { lat: -22.16, lng: -185.0 },  // lon < -180 is invalid
                { lat: -22.16, lng: -42.93 }
            ]
        });
        expect(result.success).toBe(false);
    });
});
