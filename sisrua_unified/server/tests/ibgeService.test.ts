/**
 * ibgeService.test.ts
 * Tests for IBGE API caching, state coordinate lookup, and error handling.
 * Network calls are mocked — zero real HTTP requests.
 */

import { IbgeService } from '../services/ibgeService';

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

const mockOkJson = (data: any) =>
    ({ ok: true, status: 200, json: jest.fn().mockResolvedValue(data) } as any);

const mockErrResponse = (status: number) =>
    ({ ok: false, status, json: jest.fn().mockResolvedValue({}) } as any);

describe('IbgeService', () => {
    beforeEach(() => {
        IbgeService.clearCache();
        global.fetch = jest.fn();
        jest.clearAllMocks();
    });

    describe('getStates', () => {
        it('should return states from API', async () => {
            (global.fetch as jest.Mock).mockResolvedValue(
                mockOkJson([{ id: '33', nome: 'Rio de Janeiro', sigla: 'RJ' }])
            );
            const result = await IbgeService.getStates();
            expect(result).toHaveLength(1);
            expect(result[0].sigla).toBe('RJ');
        });

        it('should use cache on second call', async () => {
            (global.fetch as jest.Mock).mockResolvedValue(
                mockOkJson([{ id: '33', nome: 'Rio de Janeiro', sigla: 'RJ' }])
            );
            await IbgeService.getStates();
            await IbgeService.getStates(); // second call
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('should return empty array on API error', async () => {
            (global.fetch as jest.Mock).mockResolvedValue(mockErrResponse(500));
            const result = await IbgeService.getStates();
            expect(result).toEqual([]);
        });

        it('should return empty array on network failure', async () => {
            (global.fetch as jest.Mock).mockRejectedValue(new Error('ECONNRESET'));
            const result = await IbgeService.getStates();
            expect(result).toEqual([]);
        });
    });

    describe('getMunicipiosByState', () => {
        it('should return municipalities for a state', async () => {
            (global.fetch as jest.Mock).mockResolvedValue(
                mockOkJson([{ id: '3304557', nome: 'Rio de Janeiro' }])
            );
            const result = await IbgeService.getMunicipiosByState('RJ');
            expect(result[0].nome).toBe('Rio de Janeiro');
        });

        it('should return empty array on API error', async () => {
            (global.fetch as jest.Mock).mockResolvedValue(mockErrResponse(503));
            const result = await IbgeService.getMunicipiosByState('SP');
            expect(result).toEqual([]);
        });
    });

    describe('getMunicipalityBoundary', () => {
        it('should return boundary GeoJSON', async () => {
            const geoJson = { type: 'FeatureCollection', features: [] };
            (global.fetch as jest.Mock).mockResolvedValue(mockOkJson(geoJson));
            const result = await IbgeService.getMunicipalityBoundary('3304557');
            expect(result).toEqual(geoJson);
        });

        it('should return null on API error', async () => {
            (global.fetch as jest.Mock).mockResolvedValue(mockErrResponse(404));
            const result = await IbgeService.getMunicipalityBoundary('9999999');
            expect(result).toBeNull();
        });

        it('should use cache on second call', async () => {
            (global.fetch as jest.Mock).mockResolvedValue(mockOkJson({ type: 'FeatureCollection' }));
            await IbgeService.getMunicipalityBoundary('3304557');
            await IbgeService.getMunicipalityBoundary('3304557');
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('findMunicipioByCoordinates (fallback by coordinate ranges)', () => {
        it('should identify São Paulo state via fallback when API fails', async () => {
            // API fails → fallback via identifyStateByCoordinates
            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network fail'));
            const result = await IbgeService.findMunicipioByCoordinates(-23.55, -46.63);
            // Fallback returns state info
            expect(result).not.toBeNull();
            expect(result?.uf).toBe('SP');
            expect(result?.regiao).toBe('Sudeste');
        });

        it('should identify Rio Grande do Sul state', async () => {
            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network fail'));
            const result = await IbgeService.findMunicipioByCoordinates(-30.03, -51.23);
            expect(result?.uf).toBe('RS');
        });

        it('should return null for coordinates outside Brazil', async () => {
            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network fail'));
            const result = await IbgeService.findMunicipioByCoordinates(48.85, 2.35); // Paris
            expect(result).toBeNull();
        });
    });

    describe('clearCache', () => {
        it('should invalidate cached entries', async () => {
            (global.fetch as jest.Mock).mockResolvedValue(
                mockOkJson([{ id: '33', nome: 'RJ', sigla: 'RJ' }])
            );
            await IbgeService.getStates();
            IbgeService.clearCache();
            await IbgeService.getStates(); // should hit API again
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('getStateBoundary', () => {
        it('should return state GeoJSON boundary', async () => {
            (global.fetch as jest.Mock).mockResolvedValue(mockOkJson({ type: 'FeatureCollection' }));
            const result = await IbgeService.getStateBoundary('33');
            expect(result).not.toBeNull();
        });

        it('should return null on API error', async () => {
            (global.fetch as jest.Mock).mockResolvedValue(mockErrResponse(500));
            const result = await IbgeService.getStateBoundary('33');
            expect(result).toBeNull();
        });
    });
});
