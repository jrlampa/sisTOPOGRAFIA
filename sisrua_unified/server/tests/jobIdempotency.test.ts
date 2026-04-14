/**
 * jobIdempotency.test.ts
 * Tests for Export Job Idempotency (Roadmap Items 3 and 71).
 *
 * Covers:
 *  - computeIdempotencyKey: deterministic SHA-256 hashing
 *  - findOrCreateJob: new job created for a unique key
 *  - findOrCreateJob: existing non-terminal job returned (deduplication)
 *  - findOrCreateJob: new job created when existing one is in terminal state
 */

import {
    createJob,
    completeJob,
    failJob,
    updateJobStatus,
    computeIdempotencyKey,
    findOrCreateJob,
    getJob,
    stopCleanupInterval,
} from '../services/jobStatusService';

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

describe('computeIdempotencyKey', () => {
    it('produces a 64-char hex string (SHA-256)', () => {
        const key = computeIdempotencyKey({ lat: -23.5, lng: -46.6 });
        expect(key).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic for the same input', () => {
        const params = { lat: -23.5, lng: -46.6, zoom: 15 };
        expect(computeIdempotencyKey(params)).toBe(computeIdempotencyKey(params));
    });

    it('produces different keys for different inputs', () => {
        const k1 = computeIdempotencyKey({ lat: -23.5 });
        const k2 = computeIdempotencyKey({ lat: -23.6 });
        expect(k1).not.toBe(k2);
    });

    it('is key-order independent (canonical JSON)', () => {
        const k1 = computeIdempotencyKey({ lat: 1, lng: 2 });
        const k2 = computeIdempotencyKey({ lng: 2, lat: 1 });
        expect(k1).toBe(k2);
    });
});

describe('findOrCreateJob', () => {
    afterEach(() => {
        stopCleanupInterval();
    });

    it('creates a new job when no job with that idempotency key exists', () => {
        const key = computeIdempotencyKey({ lat: 1, lng: 1, ts: Date.now() });
        const job = findOrCreateJob('idempotent-new-1', key);
        expect(job.id).toBe('idempotent-new-1');
        expect(job.status).toBe('queued');
        expect(job.idempotencyKey).toBe(key);
    });

    it('returns the existing job when reusing the same key (queued state)', () => {
        const key = computeIdempotencyKey({ scenario: 'queued-dedup', ts: 42 });
        const first = findOrCreateJob('idempotent-queued-1', key);
        const second = findOrCreateJob('idempotent-queued-2', key);
        // Should return the first job, not create a second
        expect(second.id).toBe(first.id);
    });

    it('returns the existing job when reusing the same key (processing state)', async () => {
        const key = computeIdempotencyKey({ scenario: 'processing-dedup', ts: 43 });
        const first = findOrCreateJob('idempotent-proc-1', key);
        await updateJobStatus(first.id, 'processing', 30);
        const second = findOrCreateJob('idempotent-proc-2', key);
        expect(second.id).toBe(first.id);
        expect(second.status).toBe('processing');
    });

    it('creates a new job when existing job is completed (terminal state)', async () => {
        const key = computeIdempotencyKey({ scenario: 'completed-terminal', ts: 44 });
        const first = findOrCreateJob('idempotent-done-1', key);
        await completeJob(first.id, { url: '/downloads/f.dxf', filename: 'f.dxf' });

        const second = findOrCreateJob('idempotent-done-2', key);
        expect(second.id).toBe('idempotent-done-2');
        expect(second.status).toBe('queued');
    });

    it('creates a new job when existing job is failed (terminal state)', async () => {
        const key = computeIdempotencyKey({ scenario: 'failed-terminal', ts: 45 });
        const first = findOrCreateJob('idempotent-fail-1', key);
        await failJob(first.id, 'engine error');

        const second = findOrCreateJob('idempotent-fail-2', key);
        expect(second.id).toBe('idempotent-fail-2');
        expect(second.status).toBe('queued');
    });

    it('persists idempotency key on the created job record', () => {
        const key = computeIdempotencyKey({ check: 'persist', ts: 46 });
        findOrCreateJob('idempotent-persist-1', key);
        const retrieved = getJob('idempotent-persist-1');
        expect(retrieved?.idempotencyKey).toBe(key);
    });
});
