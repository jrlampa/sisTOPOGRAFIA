/**
 * metricsService.test.ts
 * Tests for all Prometheus metric recording methods
 */

import { metricsService } from '../services/metricsService';

jest.mock('../config', () => ({
    config: { METRICS_PREFIX: 'sisrua_test' }
}));

describe('metricsService', () => {
    it('should record HTTP request without throwing', () => {
        expect(() => {
            metricsService.recordHttpRequest('POST', '/api/dxf', 200, 0.5);
        }).not.toThrow();
    });

    it('should record DXF request — all outcomes', () => {
        expect(() => {
            metricsService.recordDxfRequest('cache_hit');
            metricsService.recordDxfRequest('generated');
            metricsService.recordDxfRequest('failed');
        }).not.toThrow();
    });

    it('should record DXF queue state', () => {
        expect(() => {
            metricsService.recordDxfQueueState({
                pendingTasks: 3,
                processingTasks: 1,
                workerBusy: true
            });
            metricsService.recordDxfQueueState({
                pendingTasks: 0,
                processingTasks: 0,
                workerBusy: false
            });
        }).not.toThrow();
    });

    it('should record all cache operations', () => {
        expect(() => {
            metricsService.recordCacheOperation('hit');
            metricsService.recordCacheOperation('miss');
            metricsService.recordCacheOperation('set');
            metricsService.recordCacheOperation('delete');
        }).not.toThrow();
    });

    it('should record cache size', () => {
        expect(() => metricsService.recordCacheSize(42)).not.toThrow();
    });

    it('should return prometheus-formatted metrics string', async () => {
        const output = await metricsService.getMetrics();
        expect(typeof output).toBe('string');
        expect(output.length).toBeGreaterThan(0);
    });

    it('should expose a valid Prometheus content-type', () => {
        expect(metricsService.contentType).toContain('text/plain');
    });
});
