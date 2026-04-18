import { maintenanceService } from '../services/maintenanceService';
import fs from 'fs';

// Mock config FIRST so DATABASE_URL is available when service is imported
jest.mock('../config', () => ({
    config: {
        DATABASE_URL: 'postgres://test:test@localhost:5432/testdb',
        DXF_DIRECTORY: '/tmp/dxf_test',
        DXF_MAX_AGE_MS: 3600000,
        NODE_ENV: 'test',
        maintenanceDbCleanupEnabled: true,
    }
}));

// Mock postgres
const mockSqlResult = jest.fn().mockResolvedValue([]);
jest.mock('postgres', () => {
    return jest.fn().mockImplementation(() => {
        const fn = mockSqlResult as any;
        fn.end = jest.fn().mockResolvedValue(undefined);
        return fn;
    });
});

// Mock fs
jest.mock('fs');

// Mock logger
jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

describe('MaintenanceService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset the sql instance so it picks up the fresh mock
        (maintenanceService as any).sql = null;
    });

    afterEach(async () => {
        await maintenanceService.stop();
    });

    it('should run DB and file cleanup, returning stats', async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readdirSync as jest.Mock).mockReturnValue(['old_file.dxf', '.gitkeep']);
        (fs.statSync as jest.Mock).mockReturnValue({
            mtimeMs: Date.now() - 1000 * 60 * 60 * 4 // 4h ago (older than maxAge 1h)
        });
        (fs.unlinkSync as jest.Mock).mockImplementation(() => {});

        const stats = await maintenanceService.runMaintenance();

        // DB queries ran (mockSqlResult called for audit + jobs cleanup)
        expect(mockSqlResult).toHaveBeenCalled();

        // File cleanup: only old_file.dxf deleted (not .gitkeep)
        expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
        expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('old_file.dxf'));

        expect(stats.filesDeleted).toBe(1);
    });

    it('should return zero counts when DB is unavailable', async () => {
        // Force DB query to fail
        mockSqlResult.mockRejectedValueOnce(new Error('DB Down'));
        (fs.existsSync as jest.Mock).mockReturnValue(false);

        const stats = await maintenanceService.runMaintenance();

        expect(stats.auditLogsDeleted).toBe(0);
        expect(stats.jobsDeleted).toBe(0);
        expect(stats.filesDeleted).toBe(0);
    });

    it('should handle file system errors gracefully', async () => {
        mockSqlResult.mockResolvedValue([]);
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readdirSync as jest.Mock).mockImplementation(() => {
            throw new Error('FS Error: Permission denied');
        });

        const stats = await maintenanceService.runMaintenance();

        expect(stats.filesDeleted).toBe(0);
    });

    it('should not delete .gitkeep files', async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readdirSync as jest.Mock).mockReturnValue(['.gitkeep']);
        (fs.statSync as jest.Mock).mockReturnValue({ mtimeMs: 0 }); // very old

        await maintenanceService.runMaintenance();

        expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should skip DB cleanup when dbRetryAfterMs is in the future', async () => {
        (maintenanceService as any).dbRetryAfterMs = Date.now() + 60_000;
        (fs.existsSync as jest.Mock).mockReturnValue(false);

        const stats = await maintenanceService.runMaintenance();

        expect(mockSqlResult).not.toHaveBeenCalled();
        expect(stats.auditLogsDeleted).toBe(0);
        expect(stats.jobsDeleted).toBe(0);
    });

    it('should set dbRetryAfterMs and close sql on DNS resolution error', async () => {
        mockSqlResult.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND host'));
        (fs.existsSync as jest.Mock).mockReturnValue(false);

        const stats = await maintenanceService.runMaintenance();

        expect(stats.auditLogsDeleted).toBe(0);
        expect((maintenanceService as any).dbRetryAfterMs).toBeGreaterThan(Date.now());
    });

    it('start() should set up interval timer and stop() should clear it', async () => {
        jest.useFakeTimers();
        try {
            maintenanceService.start();
            expect((maintenanceService as any).timer).not.toBeNull();

            // Second call should be a no-op
            maintenanceService.start();

            await maintenanceService.stop();
            expect((maintenanceService as any).timer).toBeNull();
        } finally {
            jest.useRealTimers();
        }
    });

    it('stop() should close sql connection if open', async () => {
        const mockEnd = jest.fn().mockResolvedValue(undefined);
        (maintenanceService as any).sql = { end: mockEnd };

        await maintenanceService.stop();

        expect(mockEnd).toHaveBeenCalled();
        expect((maintenanceService as any).sql).toBeNull();
    });
});
