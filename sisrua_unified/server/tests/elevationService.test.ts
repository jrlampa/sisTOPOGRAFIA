import { vi } from "vitest";
/**
 * elevationService.test.ts
 * Tests for ElevationService — haversine distance, profile generation, and fallbacks.
 */

import { ElevationService } from '../services/elevationService';

vi.mock('../utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Mock TopodataService so tests don't hit real network
vi.mock('../services/topodataService', () => ({
    TopodataService: {
        isWithinBrazil: vi.fn().mockReturnValue(false), // Default to non-Brazil
        getElevation: vi.fn().mockResolvedValue(850),
        getElevationProfile: vi.fn().mockResolvedValue([
            { lat: -23.55, lng: -46.63, elevation: 780 },
            { lat: -22.9, lng: -43.17, elevation: 820 }
        ])
    }
}));

import { TopodataService } from '../services/topodataService';

const SP = { lat: -23.55, lng: -46.63 };
const RJ = { lat: -22.9, lng: -43.17 };

describe('ElevationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (TopodataService.isWithinBrazil as vi.Mock).mockReturnValue(false);
    });

    describe('calculateDistance (Haversine formula)', () => {
        it('should return 0 for same coordinates', () => {
            expect(ElevationService.calculateDistance(SP, SP)).toBe(0);
        });

        it('should return approximately 357 km between SP and RJ', () => {
            const dist = ElevationService.calculateDistance(SP, RJ);
            // ~357 km between SP and RJ as-the-crow-flies
            expect(dist).toBeGreaterThan(340_000);
            expect(dist).toBeLessThan(380_000);
        });

        it('should be symmetric (A→B = B→A)', () => {
            const d1 = ElevationService.calculateDistance(SP, RJ);
            const d2 = ElevationService.calculateDistance(RJ, SP);
            expect(d1).toBeCloseTo(d2, 1);
        });
    });

    describe('getElevationProfile (open-elevation fallback)', () => {
        it('should return elevation points from API', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    results: [
                        { latitude: -23.55, longitude: -46.63, elevation: 760 },
                        { latitude: -22.9, longitude: -43.17, elevation: 810 }
                    ]
                })
            }) as any;

            const profile = await ElevationService.getElevationProfile(SP, RJ, 1);
            expect(profile).toHaveLength(2);
            expect(profile[0].elev).toBe(760);
        });

        it('should return flat terrain fallback when API fails', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any;

            const profile = await ElevationService.getElevationProfile(SP, RJ, 4);
            // fallback: steps + 1 points
            expect(profile).toHaveLength(5);
            expect(profile.every(p => p.elev === 0)).toBe(true);
        });

        it('should use TOPODATA when both points are within Brazil', async () => {
            (TopodataService.isWithinBrazil as vi.Mock).mockReturnValue(true);

            const profile = await ElevationService.getElevationProfile(SP, RJ, 1);
            expect(profile).toHaveLength(2);
            expect(TopodataService.getElevationProfile).toHaveBeenCalled();
        });
    });

    describe('getElevationAt', () => {
        it('should return elevation from open-elevation for non-Brazil coords', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ results: [{ elevation: 500 }] })
            }) as any;

            const result = await ElevationService.getElevationAt(40.71, -74.0); // NYC
            expect(result).toBe(500);
        });

        it('should return null when open-elevation API fails', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('timeout')) as any;
            const result = await ElevationService.getElevationAt(40.71, -74.0);
            expect(result).toBeNull();
        });

        it('should call TopodataService.getElevation for Brazilian coords', async () => {
            (TopodataService.isWithinBrazil as vi.Mock).mockReturnValue(true);
            const result = await ElevationService.getElevationAt(-23.55, -46.63);
            expect(TopodataService.getElevation).toHaveBeenCalledWith(-23.55, -46.63);
            expect(result).toBe(850);
        });
    });
});

