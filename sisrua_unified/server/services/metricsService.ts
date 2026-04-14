/**
 * Prometheus metrics service.
 *
 * Exposes:
 *   - Default Node.js runtime metrics (event loop lag, heap, GC, file descriptors)
 *   - HTTP request counter + duration histogram (via requestMetrics middleware)
 *   - DXF generation outcome counter (cache_hit | generated | failed)
 *   - DXF cache operation counter (hit | miss | set | delete)
 *   - DXF cache current size gauge
 *
 * Roadmap Item 17 – SRE/Operação 24x7 com SLOs:
 *   - SLO compliance gauges (1 = dentro do objetivo, 0 = violado)
 *   - Error budget remaining percentage per flow
 *   - SLI observation helpers (latency, availability)
 *
 * SLOs definidos por fluxo crítico:
 *   | Fluxo              | Objetivo        | Métrica            |
 *   |--------------------|-----------------|---------------------|
 *   | DXF Generation     | p95 < 30s       | Latência geração   |
 *   | HTTP API           | p99 < 2s        | Latência endpoint  |
 *   | DXF Availability   | ≥ 99.5%/30d     | Taxa de sucesso    |
 *   | Job Queue          | p99 wait < 60s  | Tempo fila         |
 */
import client from "prom-client";
import { config } from "../config.js";

const prefix = `${config.METRICS_PREFIX}_`;

// Use a separate registry so we never pollute the global default registry
// and can cleanly expose only our metrics.
const registry = new client.Registry();

// Built-in Node.js runtime metrics (memory, CPU, event loop, libuv handles, etc.)
client.collectDefaultMetrics({ register: registry, prefix });

// ── HTTP ─────────────────────────────────────────────────────────────────────

const httpRequestsTotal = new client.Counter({
  name: `${prefix}http_requests_total`,
  help: "Total number of HTTP requests processed",
  labelNames: ["method", "route", "status_code"] as const,
  registers: [registry],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: `${prefix}http_request_duration_seconds`,
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

// ── DXF generation ────────────────────────────────────────────────────────────

const dxfRequestsTotal = new client.Counter({
  name: `${prefix}dxf_requests_total`,
  help: "Total DXF generation requests by outcome",
  labelNames: ["result"] as const, // cache_hit | generated | failed
  registers: [registry],
});

const dxfQueuePendingGauge = new client.Gauge({
  name: `${prefix}dxf_queue_pending_tasks`,
  help: "Current number of pending DXF tasks in queue",
  registers: [registry],
});

const dxfQueueProcessingGauge = new client.Gauge({
  name: `${prefix}dxf_queue_processing_tasks`,
  help: "Current number of DXF tasks being processed",
  registers: [registry],
});

const dxfQueueWorkerBusyGauge = new client.Gauge({
  name: `${prefix}dxf_queue_worker_busy`,
  help: "DXF queue worker busy state (1 busy, 0 idle)",
  registers: [registry],
});

// ── In-memory cache ───────────────────────────────────────────────────────────

const cacheOperationsTotal = new client.Counter({
  name: `${prefix}cache_operations_total`,
  help: "DXF in-memory cache operations",
  labelNames: ["operation"] as const, // hit | miss | set | delete
  registers: [registry],
});

const cacheSizeGauge = new client.Gauge({
  name: `${prefix}cache_size_entries`,
  help: "Current number of entries in DXF in-memory cache",
  registers: [registry],
});

// ── SLO / SRE (Roadmap Item 17) ──────────────────────────────────────────────

/**
 * SLO targets – fonte única de verdade.
 * Alterar aqui propaga para gauges, alertas e runbooks.
 */
export const SLO_TARGETS = {
  /** DXF generation p95 latency (seconds) */
  dxfGenerationP95Secs: 30,
  /** HTTP API p99 latency (seconds) */
  apiP99Secs: 2,
  /** DXF success rate over 30-day window (0–1) */
  dxfAvailabilityRate: 0.995,
  /** Job queue p99 wait before processing (seconds) */
  jobQueueWaitP99Secs: 60,
} as const;

// SLO compliance: 1 = dentro do objetivo, 0 = violado
const sloComplianceGauge = new client.Gauge({
  name: `${prefix}slo_compliance`,
  help: "SLO compliance: 1 = within objective, 0 = violated",
  labelNames: ["slo_name"] as const,
  registers: [registry],
});

// Error budget remaining (0–100 %)
const errorBudgetRemainingPctGauge = new client.Gauge({
  name: `${prefix}slo_error_budget_remaining_pct`,
  help: "Error budget remaining percentage (0–100) per SLO",
  labelNames: ["slo_name"] as const,
  registers: [registry],
});

// DXF generation end-to-end latency (Python engine included)
const dxfGenerationDurationSeconds = new client.Histogram({
  name: `${prefix}dxf_generation_duration_seconds`,
  help: "DXF end-to-end generation duration including Python engine",
  buckets: [1, 2.5, 5, 10, 15, 20, 25, 30, 45, 60, 90, 120],
  registers: [registry],
});

// Job queue wait time
const jobQueueWaitSeconds = new client.Histogram({
  name: `${prefix}job_queue_wait_seconds`,
  help: "Time a DXF job waits in queue before processing starts",
  buckets: [1, 5, 10, 20, 30, 45, 60, 90, 120],
  registers: [registry],
});

// SLI counters for availability rate calculation
const sliRequestsTotal = new client.Counter({
  name: `${prefix}sli_requests_total`,
  help: "SLI-tracked requests per flow and outcome",
  labelNames: ["flow", "outcome"] as const, // outcome: success | error
  registers: [registry],
});

// Inicializa gauges em estado "compliant" (1 = OK, 100 % budget)
(
  [
    "dxf_generation_p95",
    "api_p99",
    "dxf_availability",
    "job_queue_wait_p99",
  ] as const
).forEach((slo) => {
  sloComplianceGauge.labels({ slo_name: slo }).set(1);
  errorBudgetRemainingPctGauge.labels({ slo_name: slo }).set(100);
});

// ── Public API ────────────────────────────────────────────────────────────────

export const metricsService = {
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSec: number,
  ): void {
    httpRequestsTotal.inc({ method, route, status_code: String(statusCode) });
    httpRequestDurationSeconds.observe({ method, route }, durationSec);
    // SLO: API p99 – atualiza compliance se latência excede target
    if (durationSec > SLO_TARGETS.apiP99Secs) {
      sloComplianceGauge.labels({ slo_name: "api_p99" }).set(0);
    }
  },

  recordDxfRequest(result: "cache_hit" | "generated" | "failed"): void {
    dxfRequestsTotal.inc({ result });
    // SLI tracking para DXF availability
    const outcome = result === "failed" ? "error" : "success";
    sliRequestsTotal.inc({ flow: "dxf_generation", outcome });
  },

  /** Registra duração completa de geração DXF (Python engine + overhead). */
  recordDxfGenerationDuration(durationSec: number): void {
    dxfGenerationDurationSeconds.observe(durationSec);
    // SLO: DXF p95 – violação pontual
    if (durationSec > SLO_TARGETS.dxfGenerationP95Secs) {
      sloComplianceGauge.labels({ slo_name: "dxf_generation_p95" }).set(0);
    }
  },

  /** Registra tempo de espera na fila antes de iniciar o processamento. */
  recordJobQueueWait(waitSec: number): void {
    jobQueueWaitSeconds.observe(waitSec);
    if (waitSec > SLO_TARGETS.jobQueueWaitP99Secs) {
      sloComplianceGauge.labels({ slo_name: "job_queue_wait_p99" }).set(0);
    }
  },

  /**
   * Atualiza o error budget restante para um SLO específico.
   * Chamado por job de análise periódica com base nos contadores SLI.
   */
  updateErrorBudget(sloName: string, remainingPct: number): void {
    const clamped = Math.max(0, Math.min(100, remainingPct));
    errorBudgetRemainingPctGauge.labels({ slo_name: sloName }).set(clamped);
    sloComplianceGauge.labels({ slo_name: sloName }).set(clamped > 0 ? 1 : 0);
  },

  recordDxfQueueState(state: {
    pendingTasks: number;
    processingTasks: number;
    workerBusy: boolean;
  }): void {
    dxfQueuePendingGauge.set(state.pendingTasks);
    dxfQueueProcessingGauge.set(state.processingTasks);
    dxfQueueWorkerBusyGauge.set(state.workerBusy ? 1 : 0);
  },

  recordCacheOperation(operation: "hit" | "miss" | "set" | "delete"): void {
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
