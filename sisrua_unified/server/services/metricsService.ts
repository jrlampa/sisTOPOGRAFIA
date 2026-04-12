/**
 * Prometheus metrics service.
 *
 * Exposes:
 *   - Default Node.js runtime metrics (event loop lag, heap, GC, file descriptors)
 *   - HTTP request counter + duration histogram (via requestMetrics middleware)
 *   - DXF generation outcome counter (cache_hit | generated | failed)
 *   - DXF cache operation counter (hit | miss | set | delete)
 *   - DXF cache current size gauge
 */
import client from 'prom-client';
import { config } from '../config.js';

const prefix = `${config.METRICS_PREFIX}_`;

// Use a separate registry so we never pollute the global default registry
// and can cleanly expose only our metrics.
const registry = new client.Registry();

// Built-in Node.js runtime metrics (memory, CPU, event loop, libuv handles, etc.)
client.collectDefaultMetrics({ register: registry, prefix });

// ── HTTP ─────────────────────────────────────────────────────────────────────

const httpRequestsTotal = new client.Counter({
    name: `${prefix}http_requests_total`,
    help: 'Total number of HTTP requests processed',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [registry],
});

const httpRequestDurationSeconds = new client.Histogram({
    name: `${prefix}http_request_duration_seconds`,
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
});

// ── DXF generation ────────────────────────────────────────────────────────────

const dxfRequestsTotal = new client.Counter({
    name: `${prefix}dxf_requests_total`,
    help: 'Total DXF generation requests by outcome',
    labelNames: ['result'] as const, // cache_hit | generated | failed
    registers: [registry],
});

const dxfQueuePendingGauge = new client.Gauge({
    name: `${prefix}dxf_queue_pending_tasks`,
    help: 'Current number of pending DXF tasks in queue',
    registers: [registry],
});

const dxfQueueProcessingGauge = new client.Gauge({
    name: `${prefix}dxf_queue_processing_tasks`,
    help: 'Current number of DXF tasks being processed',
    registers: [registry],
});

const dxfQueueWorkerBusyGauge = new client.Gauge({
    name: `${prefix}dxf_queue_worker_busy`,
    help: 'DXF queue worker busy state (1 busy, 0 idle)',
    registers: [registry],
});

// ── In-memory cache ───────────────────────────────────────────────────────────

const cacheOperationsTotal = new client.Counter({
    name: `${prefix}cache_operations_total`,
    help: 'DXF in-memory cache operations',
    labelNames: ['operation'] as const, // hit | miss | set | delete
    registers: [registry],
});

const cacheSizeGauge = new client.Gauge({
    name: `${prefix}cache_size_entries`,
    help: 'Current number of entries in DXF in-memory cache',
    registers: [registry],
});

// ── Public API ────────────────────────────────────────────────────────────────

export const metricsService = {
    recordHttpRequest(
        method: string,
        route: string,
        statusCode: number,
        durationSec: number
    ): void {
        httpRequestsTotal.inc({ method, route, status_code: String(statusCode) });
        httpRequestDurationSeconds.observe({ method, route }, durationSec);
    },

    recordDxfRequest(result: 'cache_hit' | 'generated' | 'failed'): void {
        dxfRequestsTotal.inc({ result });
    },

    recordDxfQueueState(state: { pendingTasks: number; processingTasks: number; workerBusy: boolean }): void {
        dxfQueuePendingGauge.set(state.pendingTasks);
        dxfQueueProcessingGauge.set(state.processingTasks);
        dxfQueueWorkerBusyGauge.set(state.workerBusy ? 1 : 0);
    },

    recordCacheOperation(
        operation: 'hit' | 'miss' | 'set' | 'delete'
    ): void {
        cacheOperationsTotal.inc({ operation });
    },

    recordCacheSize(size: number): void {
        cacheSizeGauge.set(size);
    },

    async getMetrics(): Promise<string> {
        return registry.metrics();
    },

    /** Content-Type header value for Prometheus text format */
    contentType: client.Registry.PROMETHEUS_CONTENT_TYPE,
} as const;
