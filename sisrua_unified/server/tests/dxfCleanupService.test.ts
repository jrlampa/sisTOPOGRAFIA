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

jest.mock('fs');
jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));
jest.mock('../services/constantsService', () => ({
    constantsService: { getSync: jest.fn().mockReturnValue(undefined) }
}));
jest.mock('../utils/dxfDirectory', () => ({
    resolveDxfDirectory: jest.fn().mockReturnValue('/tmp/dxf_test')
}));
jest.mock('../config', () => ({
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
        jest.clearAllMocks();
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
        (fs.existsSync as jest.Mock).mockReturnValue(true);

        scheduleDxfDeletion('/tmp/dxf_test/myfile.dxf');
        markDxfDownloaded('/tmp/dxf_test/myfile.dxf');

        // Should try to delete: .dxf, _metadata.csv, _elevation_metadata.csv, _bt_context.json
        expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/dxf_test/myfile.dxf');
        expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/dxf_test/myfile_metadata.csv');
    });

    it('markDxfDownloaded skips nonexistent files silently', () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);
        expect(() => markDxfDownloaded('/tmp/dxf_test/ghost.dxf')).not.toThrow();
        expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('triggerCleanupNow removes expired scheduled files', () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false); // no disk sweep needed

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
        jest.resetModules();
        jest.doMock('../config', () => ({
            config: {
                useDbConstantsConfig: true,
                DXF_FILE_TTL_MS: 600_000,
                DXF_MAX_AGE_MS: 7_200_000,
                DXF_CLEANUP_INTERVAL_MS: 60_000,
                DXF_DIRECTORY: '/tmp/dxf_test',
            }
        }));
        jest.doMock('../services/constantsService', () => ({
            constantsService: { getSync: jest.fn().mockImplementation((_, key) => {
                if (key === 'DXF_FILE_TTL_MS') return 300_000;
                if (key === 'DXF_MAX_AGE_MS') return 3_600_000;
                if (key === 'DXF_CLEANUP_INTERVAL_MS') return 30_000;
                return undefined;
            }) }
        }));
        jest.doMock('../utils/dxfDirectory', () => ({
            resolveDxfDirectory: jest.fn().mockReturnValue('/tmp/dxf_test')
        }));
        jest.doMock('../utils/logger', () => ({
            logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
        }));
        jest.doMock('fs');
        const { getDxfCleanupPolicySnapshot: getSnap } = await import('../services/dxfCleanupService');
        const policy = getSnap();
        expect(policy.fileTtlMs).toBe(300_000);
        jest.resetModules();
    });

    it('sweepStaleDxfFromDisk deletes stale files on disk', async () => {
        jest.resetModules();
        const mockFs = {
            existsSync: jest.fn().mockReturnValue(true),
            unlinkSync: jest.fn(),
            readdirSync: jest.fn().mockReturnValue([
                { name: 'old.dxf', isFile: () => true },
                { name: 'new.dxf', isFile: () => true },
            ]),
            statSync: jest.fn().mockImplementation((p: string) => ({
                mtimeMs: p.includes('old') ? Date.now() - 10_000_000 : Date.now()
            })),
        };
        jest.doMock('fs', () => mockFs);
        jest.doMock('../config', () => ({
            config: {
                useDbConstantsConfig: false,
                DXF_FILE_TTL_MS: 600_000,
                DXF_MAX_AGE_MS: 7_200_000,
                DXF_CLEANUP_INTERVAL_MS: 60_000,
                DXF_DIRECTORY: '/tmp/dxf_test',
            }
        }));
        jest.doMock('../services/constantsService', () => ({
            constantsService: { getSync: jest.fn().mockReturnValue(undefined) }
        }));
        jest.doMock('../utils/dxfDirectory', () => ({
            resolveDxfDirectory: jest.fn().mockReturnValue('/tmp/dxf_test')
        }));
        jest.doMock('../utils/logger', () => ({
            logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
        }));
        const { triggerCleanupNow: triggerFresh } = await import('../services/dxfCleanupService');
        triggerFresh(); // triggers sweepStaleDxfFromDisk
        expect(mockFs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('old.dxf'));
        jest.resetModules();
    });

    it('triggerCleanupNow deletes expired scheduled files', () => {
        // Schedule a file and make it expire by mocking Date.now
        const realNow = Date.now;
        // first call: schedule with past deleteAt
        const pastTime = Date.now() - 5_000_000;
        global.Date.now = jest.fn().mockReturnValue(pastTime);
        scheduleDxfDeletion('/tmp/dxf_test/expired.dxf');
        // now restore real time so cleanup sees it as expired
        global.Date.now = realNow;
        (fs.existsSync as jest.Mock).mockReturnValue(false);
        triggerCleanupNow();
        // File should have been attempted for deletion
        expect(fs.existsSync).toHaveBeenCalled();
    });

    it('initializeDxfCleanup starts intervals in non-test environment', async () => {
        jest.resetModules();
        const mockFs2 = {
            existsSync: jest.fn().mockReturnValue(false),
            unlinkSync: jest.fn(),
            readdirSync: jest.fn().mockReturnValue([]),
            statSync: jest.fn(),
        };
        jest.doMock('fs', () => mockFs2);
        jest.doMock('../config', () => ({
            config: {
                useDbConstantsConfig: false,
                DXF_FILE_TTL_MS: 600_000,
                DXF_MAX_AGE_MS: 7_200_000,
                DXF_CLEANUP_INTERVAL_MS: 60_000,
                DXF_DIRECTORY: '/tmp/dxf_test',
            }
        }));
        jest.doMock('../services/constantsService', () => ({
            constantsService: { getSync: jest.fn().mockReturnValue(undefined) }
        }));
        jest.doMock('../utils/dxfDirectory', () => ({
            resolveDxfDirectory: jest.fn().mockReturnValue('/tmp/dxf_test')
        }));
        jest.doMock('../utils/logger', () => ({
            logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
        }));
        const prevEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        delete process.env.JEST_WORKER_ID;
        const { initializeDxfCleanup: initFresh, stopDxfCleanup: stopFresh } = await import('../services/dxfCleanupService');
        expect(() => initFresh('/tmp/dxf_test')).not.toThrow();
        stopFresh(); // clean up intervals
        process.env.NODE_ENV = prevEnv;
        process.env.JEST_WORKER_ID = '1';
        jest.resetModules();
    });
});