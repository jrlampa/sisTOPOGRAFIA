import { dxfRequestSchema } from '../schemas/dxfRequest';

describe('dxfRequestSchema', () => {
    beforeEach(() => jest.clearAllMocks());

    const validInput = { lat: -23.5, lon: -46.6, radius: 500, mode: 'circle' as const };

    describe('valid inputs', () => {
        it('parses valid numbers', () => {
            const result = dxfRequestSchema.safeParse(validInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.lat).toBe(-23.5);
                expect(result.data.lon).toBe(-46.6);
                expect(result.data.radius).toBe(500);
                expect(result.data.mode).toBe('circle');
            }
        });
        it('coerces strings to numbers', () => {
            const result = dxfRequestSchema.safeParse({ lat: '-23.5', lon: '-46.6', radius: '500', mode: 'circle' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.lat).toBe(-23.5);
                expect(result.data.lon).toBe(-46.6);
                expect(result.data.radius).toBe(500);
            }
        });
        it('accepts mode "polygon"', () => {
            const result = dxfRequestSchema.safeParse({ ...validInput, mode: 'polygon' });
            expect(result.success).toBe(true);
        });
        it('accepts mode "bbox"', () => {
            const result = dxfRequestSchema.safeParse({ ...validInput, mode: 'bbox' });
            expect(result.success).toBe(true);
        });
        it('accepts mode "circle"', () => {
            const result = dxfRequestSchema.safeParse({ ...validInput, mode: 'circle' });
            expect(result.success).toBe(true);
        });
    });

    describe('lat boundaries', () => {
        it('accepts lat=-90 (min boundary)', () => {
            const result = dxfRequestSchema.safeParse({ ...validInput, lat: -90 });
            expect(result.success).toBe(true);
        });
        it('accepts lat=90 (max boundary)', () => {
            const result = dxfRequestSchema.safeParse({ ...validInput, lat: 90 });
            expect(result.success).toBe(true);
        });
        it('rejects lat < -90', () => {
            const result = dxfRequestSchema.safeParse({ ...validInput, lat: -90.001 });
            expect(result.success).toBe(false);
        });
        it('rejects lat > 90', () => {
            const result = dxfRequestSchema.safeParse({ ...validInput, lat: 90.001 });
            expect(result.success).toBe(false);
        });
    });

    describe('lon boundaries', () => {
        it('accepts lon=-180 (min boundary)', () => {
            const result = dxfRequestSchema.safeParse({ ...validInput, lon: -180 });
            expect(result.success).toBe(true);
        });
        it('accepts lon=180 (max boundary)', () => {
            const result = dxfRequestSchema.safeParse({ ...validInput, lon: 180 });
            expect(result.success).toBe(true);
        });
        it('rejects lon < -180', () => {
            const result = dxfRequestSchema.safeParse({ ...validInput, lon: -180.001 });
            expect(result.success).toBe(false);
        });
        it('rejects lon > 180', () => {
            const result = dxfRequestSchema.safeParse({ ...validInput, lon: 180.001 });
            expect(result.success).toBe(false);
        });
    });

    describe('radius boundaries', () => {
        it('accepts radius=10 (min boundary)', () => {
            const result = dxfRequestSchema.safeParse({ ...validInput, radius: 10 });
            expect(result.success).toBe(true);
        });
        it('accepts radius=5000 (max boundary)', () => {
            const result = dxfRequestSchema.safeParse({ ...validInput, radius: 5000 });
            expect(result.success).toBe(true);
        });
        it('rejects radius < 10', () => {
            const result = dxfRequestSchema.safeParse({ ...validInput, radius: 9 });
            expect(result.success).toBe(false);
        });
        it('rejects radius > 5000', () => {
            const result = dxfRequestSchema.safeParse({ ...validInput, radius: 5001 });
            expect(result.success).toBe(false);
        });
    });

    describe('invalid modes', () => {
        it('rejects unknown mode', () => {
            const result = dxfRequestSchema.safeParse({ ...validInput, mode: 'triangle' });
            expect(result.success).toBe(false);
        });
        it('rejects missing mode', () => {
            const { mode: _mode, ...noMode } = validInput;
            const result = dxfRequestSchema.safeParse(noMode);
            expect(result.success).toBe(false);
        });
    });

    describe('invalid/missing required fields', () => {
        it('rejects missing lat', () => {
            const { lat: _lat, ...noLat } = validInput;
            const result = dxfRequestSchema.safeParse(noLat);
            expect(result.success).toBe(false);
        });
        it('rejects missing lon', () => {
            const { lon: _lon, ...noLon } = validInput;
            const result = dxfRequestSchema.safeParse(noLon);
            expect(result.success).toBe(false);
        });
        it('rejects missing radius', () => {
            const { radius: _radius, ...noRadius } = validInput;
            const result = dxfRequestSchema.safeParse(noRadius);
            expect(result.success).toBe(false);
        });
        it('rejects non-numeric string for lat', () => {
            const result = dxfRequestSchema.safeParse({ ...validInput, lat: 'abc' });
            expect(result.success).toBe(false);
        });
    });
});
