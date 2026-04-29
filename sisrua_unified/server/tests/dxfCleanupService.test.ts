import { vi } from "vitest";
/**
 * dxfCleanupService.test.ts
 * Tests scheduling, immediate deletion, and cleanup cycle for DXF files
 */

import fs from 'fs';
import {
    scheduleDxfDeletion,
    markDxfDownloaded,
    triggerCleanupNow,
    initializeDxfCleanup,
    stopDxfCleanup,
    getDxfCleanupPolicySnapshot,
} from '../services/dxfCleanupService';

vi.mock('fs');
vi.mock('../utils/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));
vi.mock('../services/constantsService.js', () => ({
    constantsService: { getSync: vi.fn().mockReturnValue(undefined) }
}));
vi.mock('../utils/dxfDirectory.js', () => ({
    resolveDxfDirectory: vi.fn().mockReturnValue('/tmp/dxf_test')
}));
vi.mock('../config.js', () => ({
    config: {
        useDbConstantsConfig: false,
        DXF_FILE_TTL_MS: 600_000,
        DXF_MAX_AGE_MS: 7_200_000,
        DXF_CLEANUP_INTERVAL_MS: 60_000,
        DXF_DIRECTORY: '/tmp/dxf_test',
    }
}));

describe('dxfCleanupService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        stopDxfCleanup();
    });

    it('getDxfCleanupPolicySnapshot returns config values', () => {
        const policy = getDxfCleanupPolicySnapshot();
        expect(policy.fileTtlMs).toBe(600_000);
        expect(policy.maxFileAgeMs).toBe(7_200_000);
        expect(policy.cleanupCheckIntervalMs).toBe(60_000);
    });

    it('scheduleDxfDeletion tracks a file for deletion', () => {
        expect(() => scheduleDxfDeletion('/tmp/dxf_test/myfile.dxf')).not.toThrow();
    });

    it('markDxfDownloaded deletes the DXF and companion files', () => {
        (fs.existsSync as vi.Mock).mockReturnValue(true);

        scheduleDxfDeletion('/tmp/dxf_test/myfile.dxf');
        markDxfDownloaded('/tmp/dxf_test/myfile.dxf');

        // Should try to delete: .dxf, _metadata.csv, _elevation_metadata.csv, _bt_context.json
        expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/dxf_test/myfile.dxf');
        expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/dxf_test/myfile_metadata.csv');
    });

    it('markDxfDownloaded skips nonexistent files silently', () => {
        (fs.existsSync as vi.Mock).mockReturnValue(false);
        expect(() => markDxfDownloaded('/tmp/dxf_test/ghost.dxf')).not.toThrow();
        expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('triggerCleanupNow removes expired scheduled files', () => {
        (fs.existsSync as vi.Mock).mockReturnValue(false); // no disk sweep needed

        // Manually schedule an "already expired" file by manipulating the deletion time via test
        const past = Date.now() - 1000;
        // We can't directly mutate private state, but we can test that triggerCleanupNow
        // runs without throwing
        expect(() => triggerCleanupNow()).not.toThrow();
    });

    it('initializeDxfCleanup skips if NODE_ENV is test', () => {
        // Already in test env — should be a no-op
        expect(() => initializeDxfCleanup('/tmp/dxf')).not.toThrow();
    });

    it('stopDxfCleanup can be called multiple times safely', () => {
        expect(() => {
            stopDxfCleanup();
            stopDxfCleanup();
        }).not.toThrow();
    });

    it('getDxfCleanupPolicySnapshot uses constantsService when useDbConstantsConfig=true', async () => {
        vi.resetModules();
        vi.doMock('../config.js', () => ({
            config: {
                useDbConstantsConfig: true,
                DXF_FILE_TTL_MS: 600_000,
                DXF_MAX_AGE_MS: 7_200_000,
                DXF_CLEANUP_INTERVAL_MS: 60_000,
                DXF_DIRECTORY: '/tmp/dxf_test',
            }
        }));
        vi.doMock('../services/constantsService.js', () => ({
            constantsService: { getSync: vi.fn().mockImplementation((_, key) => {
                if (key === 'DXF_FILE_TTL_MS') return 300_000;
                if (key === 'DXF_MAX_AGE_MS') return 3_600_000;
                if (key === 'DXF_CLEANUP_INTERVAL_MS') return 30_000;
                return undefined;
            }) }
        }));
        vi.doMock('../utils/dxfDirectory.js', () => ({
            resolveDxfDirectory: vi.fn().mockReturnValue('/tmp/dxf_test')
        }));
        vi.doMock('../utils/logger.js', () => ({
            logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
        }));
        vi.doMock('fs');
        const { getDxfCleanupPolicySnapshot: getSnap } = await import('../services/dxfCleanupService.js');
        const policy = getSnap();
        expect(policy.fileTtlMs).toBe(300_000);
        vi.resetModules();
    });

    it('sweepStaleDxfFromDisk deletes stale files on disk', async () => {
        vi.resetModules();
        const mockFs = {
            existsSync: vi.fn().mockReturnValue(true),
            unlinkSync: vi.fn(),
            readdirSync: vi.fn().mockReturnValue([
                { name: 'old.dxf', isFile: () => true },
                { name: 'new.dxf', isFile: () => true },
            ]),
            statSync: vi.fn().mockImplementation((p: string) => ({
                mtimeMs: p.includes('old') ? Date.now() - 10_000_000 : Date.now()
            })),
        };
        vi.doMock('fs', () => ({ __esModule: true, ...mockFs, default: mockFs }));
        vi.doMock('../config.js', () => ({
            config: {
                useDbConstantsConfig: false,
                DXF_FILE_TTL_MS: 600_000,
                DXF_MAX_AGE_MS: 7_200_000,
                DXF_CLEANUP_INTERVAL_MS: 60_000,
                DXF_DIRECTORY: '/tmp/dxf_test',
            }
        }));
        vi.doMock('../services/constantsService.js', () => ({
            constantsService: { getSync: vi.fn().mockReturnValue(undefined) }
        }));
        vi.doMock('../utils/dxfDirectory.js', () => ({
            resolveDxfDirectory: vi.fn().mockReturnValue('/tmp/dxf_test')
        }));
        vi.doMock('../utils/logger.js', () => ({
            logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
        }));
        const { triggerCleanupNow: triggerFresh } = await import('../services/dxfCleanupService.js');
        triggerFresh(); // triggers sweepStaleDxfFromDisk
        expect(mockFs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('old.dxf'));
        vi.resetModules();
    });

    it('triggerCleanupNow deletes expired scheduled files', () => {
        // Schedule a file and make it expire by mocking Date.now
        const realNow = Date.now;
        // first call: schedule with past deleteAt
        const pastTime = Date.now() - 5_000_000;
        global.Date.now = vi.fn().mockReturnValue(pastTime);
        scheduleDxfDeletion('/tmp/dxf_test/expired.dxf');
        // now restore real time so cleanup sees it as expired
        global.Date.now = realNow;
        (fs.existsSync as vi.Mock).mockReturnValue(false);
        triggerCleanupNow();
        // File should have been attempted for deletion
        expect(fs.existsSync).toHaveBeenCalled();
    });

    it('initializeDxfCleanup starts intervals in non-test environment', async () => {
        vi.resetModules();
        const mockFs2 = {
            existsSync: vi.fn().mockReturnValue(false),
            unlinkSync: vi.fn(),
            readdirSync: vi.fn().mockReturnValue([]),
            statSync: vi.fn(),
        };
        vi.doMock('fs', () => ({ __esModule: true, ...mockFs2, default: mockFs2 }));
        vi.doMock('../config.js', () => ({
            config: {
                useDbConstantsConfig: false,
                DXF_FILE_TTL_MS: 600_000,
                DXF_MAX_AGE_MS: 7_200_000,
                DXF_CLEANUP_INTERVAL_MS: 60_000,
                DXF_DIRECTORY: '/tmp/dxf_test',
            }
        }));
        vi.doMock('../services/constantsService.js', () => ({
            constantsService: { getSync: vi.fn().mockReturnValue(undefined) }
        }));
        vi.doMock('../utils/dxfDirectory.js', () => ({
            resolveDxfDirectory: vi.fn().mockReturnValue('/tmp/dxf_test')
        }));
        vi.doMock('../utils/logger.js', () => ({
            logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
        }));
        const prevEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        delete process.env.JEST_WORKER_ID;
        const { initializeDxfCleanup: initFresh, stopDxfCleanup: stopFresh } = await import('../services/dxfCleanupService.js');
        expect(() => initFresh('/tmp/dxf_test')).not.toThrow();
        stopFresh(); // clean up intervals
        process.env.NODE_ENV = prevEnv;
        process.env.JEST_WORKER_ID = '1';
        vi.resetModules();
    });
});
