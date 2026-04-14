/**
 * topodataService.test.ts
 * Tests for pure-logic methods of TopodataService (no real network/disk I/O)
 */

import fs from 'fs';
import { TopodataService } from '../services/topodataService';

jest.mock('fs');
jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

// Suppress cache-dir creation in module-level code
(fs.existsSync as jest.Mock).mockReturnValue(true);
(fs.mkdirSync as jest.Mock).mockImplementation(() => {});

describe('TopodataService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (fs.existsSync as jest.Mock).mockReturnValue(true);
    });

    describe('isWithinBrazil', () => {
        it('should confirm São Paulo is within Brazil', () => {
            expect(TopodataService.isWithinBrazil(-23.55, -46.63)).toBe(true);
        });

        it('should confirm Rio de Janeiro is within Brazil', () => {
            expect(TopodataService.isWithinBrazil(-22.9, -43.17)).toBe(true);
        });

        it('should reject coordinates in Australia', () => {
            expect(TopodataService.isWithinBrazil(-25.27, 133.77)).toBe(false);
        });

        it('should reject coordinates in Portugal', () => {
            expect(TopodataService.isWithinBrazil(38.71, -9.14)).toBe(false);
        });

        it('should reject coordinates north of Brazil (5°N+)', () => {
            expect(TopodataService.isWithinBrazil(10.0, -55.0)).toBe(false);
        });
    });

    describe('clearCache', () => {
        it('should delete all cached tiles when dir exists', () => {
            (fs.readdirSync as jest.Mock).mockReturnValue(['tile1.tif', 'tile2.tif']);
            (fs.unlinkSync as jest.Mock).mockImplementation(() => {});

            TopodataService.clearCache();

            expect(fs.unlinkSync).toHaveBeenCalledTimes(2);
        });

        it('should not throw if cache dir does not exist', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            expect(() => TopodataService.clearCache()).not.toThrow();
        });
    });

    describe('getCacheStats', () => {
        it('should return zero stats when cache dir is missing', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            const stats = TopodataService.getCacheStats();
            expect(stats.files).toBe(0);
            expect(stats.totalSizeMB).toBe(0);
            expect(stats.tiles).toHaveLength(0);
        });

        it('should return file count and size when tiles exist', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readdirSync as jest.Mock).mockReturnValue(['tile1.tif', 'readme.txt']);
            (fs.statSync as jest.Mock).mockImplementation((p: string) => ({
                size: p.endsWith('.tif') ? 1024 * 1024 * 10 : 1024 // 10MB for tif
            }));

            const stats = TopodataService.getCacheStats();

            expect(stats.files).toBe(2);
            expect(stats.totalSizeMB).toBeGreaterThan(0);
            expect(stats.tiles).toContain('tile1.tif');
            expect(stats.tiles).not.toContain('readme.txt');
        });
    });
});
