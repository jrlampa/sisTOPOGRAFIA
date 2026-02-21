/**
 * server/tests/apiSchemas.test.ts
 * Testes unitários para os schemas de validação Zod da API.
 * Garante que inputs maliciosos/inválidos são rejeitados antes de atingir o backend.
 */
import {
    searchSchema,
    elevationProfileSchema,
    analyzePadSchema,
    analysisSchema,
    batchRowSchema,
    dxfRequestExtendedSchema,
} from '../schemas/apiSchemas';

describe('apiSchemas — searchSchema', () => {
    it('deve aceitar query válida', () => {
        const result = searchSchema.safeParse({ query: 'Nova Friburgo, RJ' });
        expect(result.success).toBe(true);
    });

    it('deve rejeitar query vazia', () => {
        const result = searchSchema.safeParse({ query: '' });
        expect(result.success).toBe(false);
    });

    it('deve rejeitar query muito longa (> 500 chars)', () => {
        const result = searchSchema.safeParse({ query: 'a'.repeat(501) });
        expect(result.success).toBe(false);
    });

    it('deve aceitar coordenadas decimais como query', () => {
        const result = searchSchema.safeParse({ query: '-22.15018, -42.92185' });
        expect(result.success).toBe(true);
    });
});

describe('apiSchemas — elevationProfileSchema', () => {
    const validPayload = {
        start: { lat: -22.15018, lng: -42.92185 },
        end:   { lat: -22.16,    lng: -42.93    },
        steps: 25,
    };

    it('deve aceitar payload válido', () => {
        const result = elevationProfileSchema.safeParse(validPayload);
        expect(result.success).toBe(true);
    });

    it('deve rejeitar latitude fora do intervalo', () => {
        const result = elevationProfileSchema.safeParse({ ...validPayload, start: { lat: 91, lng: 0 } });
        expect(result.success).toBe(false);
    });

    it('deve rejeitar longitude fora do intervalo', () => {
        const result = elevationProfileSchema.safeParse({ ...validPayload, end: { lat: 0, lng: 181 } });
        expect(result.success).toBe(false);
    });

    it('deve usar default de 25 steps se omitido', () => {
        const result = elevationProfileSchema.safeParse({
            start: validPayload.start,
            end: validPayload.end,
        });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.steps).toBe(25);
    });

    it('deve rejeitar steps > 100', () => {
        const result = elevationProfileSchema.safeParse({ ...validPayload, steps: 101 });
        expect(result.success).toBe(false);
    });
});

describe('apiSchemas — analyzePadSchema', () => {
    const validPayload = {
        polygon: '[[-22.15,  -42.92], [-22.16, -42.93], [-22.15, -42.93]]',
        target_z: '850',
    };

    it('deve aceitar payload válido com target_z como string coercível', () => {
        const result = analyzePadSchema.safeParse(validPayload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.target_z).toBe(850);
            expect(typeof result.data.target_z).toBe('number');
        }
    });

    it('deve aceitar target_z como número direto', () => {
        const result = analyzePadSchema.safeParse({ polygon: validPayload.polygon, target_z: 100 });
        expect(result.success).toBe(true);
    });

    it('deve rejeitar polygon vazio', () => {
        const result = analyzePadSchema.safeParse({ polygon: '', target_z: '500' });
        expect(result.success).toBe(false);
    });

    it('deve rejeitar polygon ausente', () => {
        const result = analyzePadSchema.safeParse({ target_z: '500' });
        expect(result.success).toBe(false);
    });

    it('deve rejeitar target_z ausente', () => {
        const result = analyzePadSchema.safeParse({ polygon: validPayload.polygon });
        expect(result.success).toBe(false);
    });

    it('deve rejeitar target_z abaixo de -500m', () => {
        const result = analyzePadSchema.safeParse({ polygon: validPayload.polygon, target_z: '-501' });
        expect(result.success).toBe(false);
    });

    it('deve rejeitar target_z acima de 9000m', () => {
        const result = analyzePadSchema.safeParse({ polygon: validPayload.polygon, target_z: '9001' });
        expect(result.success).toBe(false);
    });

    it('deve rejeitar target_z não numérico', () => {
        const result = analyzePadSchema.safeParse({ polygon: validPayload.polygon, target_z: 'abc' });
        expect(result.success).toBe(false);
    });

    it('deve rejeitar polygon acima do limite de 50.000 caracteres', () => {
        const bigPolygon = 'x'.repeat(50001);
        const result = analyzePadSchema.safeParse({ polygon: bigPolygon, target_z: '500' });
        expect(result.success).toBe(false);
    });

    it('deve aceitar target_z negativo dentro do intervalo válido (ex: -200)', () => {
        const result = analyzePadSchema.safeParse({ polygon: validPayload.polygon, target_z: '-200' });
        expect(result.success).toBe(true);
    });
});

describe('apiSchemas — analysisSchema', () => {
    it('deve aceitar stats básicos', () => {
        const result = analysisSchema.safeParse({
            stats: { buildings: 5, roads: 10 },
            locationName: 'Nova Friburgo',
        });
        expect(result.success).toBe(true);
    });

    it('deve aceitar stats sem locationName', () => {
        const result = analysisSchema.safeParse({ stats: { buildings: 0 } });
        expect(result.success).toBe(true);
    });

    it('deve rejeitar buildings negativo', () => {
        const result = analysisSchema.safeParse({ stats: { buildings: -1 } });
        expect(result.success).toBe(false);
    });
});

describe('apiSchemas — batchRowSchema', () => {
    const validRow = { name: 'Local1', lat: '-22.15', lon: '-42.92', radius: '500', mode: 'circle' };

    it('deve aceitar linha CSV válida', () => {
        const result = batchRowSchema.safeParse(validRow);
        expect(result.success).toBe(true);
    });

    it('deve rejeitar nome com caracteres especiais', () => {
        const result = batchRowSchema.safeParse({ ...validRow, name: 'Lo cal!' });
        expect(result.success).toBe(false);
    });

    it('deve rejeitar raio acima de 5000', () => {
        const result = batchRowSchema.safeParse({ ...validRow, radius: '5001' });
        expect(result.success).toBe(false);
    });

    it('deve usar modo circle como default', () => {
        const { mode: _m, ...withoutMode } = validRow;
        const result = batchRowSchema.safeParse(withoutMode);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.mode).toBe('circle');
    });
});

describe('apiSchemas — dxfRequestExtendedSchema', () => {
    const validDxf = { lat: -22.15018, lon: -42.92185, radius: 500, mode: 'circle' };

    it('deve aceitar request DXF válido', () => {
        const result = dxfRequestExtendedSchema.safeParse(validDxf);
        expect(result.success).toBe(true);
    });

    it('deve rejeitar raio acima de 5000', () => {
        const result = dxfRequestExtendedSchema.safeParse({ ...validDxf, radius: 5001 });
        expect(result.success).toBe(false);
    });

    it('deve rejeitar modo inválido', () => {
        const result = dxfRequestExtendedSchema.safeParse({ ...validDxf, mode: 'invalid' });
        expect(result.success).toBe(false);
    });

    it('deve coercionar lat/lon de string para number', () => {
        const result = dxfRequestExtendedSchema.safeParse({ lat: '-22.15', lon: '-42.92', radius: '500', mode: 'circle' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(typeof result.data.lat).toBe('number');
            expect(typeof result.data.lon).toBe('number');
        }
    });
});
