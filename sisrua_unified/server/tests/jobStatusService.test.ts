/**
 * jobStatusService.test.ts
 * Tests the full in-memory job lifecycle used when Postgres is unavailable.
 */

import {
    createJob,
    getJob,
    updateJobStatus,
    completeJob,
    failJob,
    shouldProcessJob,
    stopCleanupInterval,
} from '../services/jobStatusService';

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

describe('jobStatusService (in-memory)', () => {
    afterEach(() => {
        stopCleanupInterval();
    });

    it('should create a job with queued status', () => {
        const job = createJob('test-job-1');
        expect(job.id).toBe('test-job-1');
        expect(job.status).toBe('queued');
        expect(job.progress).toBe(0);
    });

    it('should retrieve a created job by ID', () => {
        createJob('test-job-2');
        const retrieved = getJob('test-job-2');
        expect(retrieved).not.toBeNull();
        expect(retrieved?.status).toBe('queued');
    });

    it('should return null for unknown job ID', () => {
        expect(getJob('non-existent')).toBeNull();
    });

    it('should update job status and progress', async () => {
        createJob('test-job-3');
        await updateJobStatus('test-job-3', 'processing', 50);
        const job = getJob('test-job-3');
        expect(job?.status).toBe('processing');
        expect(job?.progress).toBe(50);
    });

    it('should complete a job with result data', async () => {
        createJob('test-job-4');
        await completeJob('test-job-4', {
            url: '/downloads/test.dxf',
            filename: 'test.dxf',
            btContextUrl: '/downloads/test_bt.json'
        });
        const job = getJob('test-job-4');
        expect(job?.status).toBe('completed');
        expect(job?.progress).toBe(100);
        expect(job?.result?.filename).toBe('test.dxf');
    });

    it('should fail a job and record the error', async () => {
        createJob('test-job-5');
        await failJob('test-job-5', 'Python engine crashed');
        const job = getJob('test-job-5');
        expect(job?.status).toBe('failed');
        expect(job?.error).toBe('Python engine crashed');
        expect(job?.attempts).toBe(1);
    });

    it('shouldProcessJob: returns true for new jobs', () => {
        expect(shouldProcessJob('non-existent-2')).toBe(true);
    });

    it('shouldProcessJob: returns false for completed jobs', async () => {
        createJob('test-job-6');
        await completeJob('test-job-6', { url: '/downloads/x.dxf', filename: 'x.dxf' });
        expect(shouldProcessJob('test-job-6')).toBe(false);
    });

    it('shouldProcessJob: returns false for processing jobs', async () => {
        createJob('test-job-7');
        await updateJobStatus('test-job-7', 'processing');
        expect(shouldProcessJob('test-job-7')).toBe(false);
    });

    it('shouldProcessJob: returns false after 3 failed attempts', async () => {
        createJob('test-job-8');
        await failJob('test-job-8', 'Err 1');
        await failJob('test-job-8', 'Err 2');
        await failJob('test-job-8', 'Err 3');
        expect(shouldProcessJob('test-job-8')).toBe(false);
    });
});
