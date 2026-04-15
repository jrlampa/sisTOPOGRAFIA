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
 *   - Anomaly detection (rolling mean/stddev per metric, z-score alerting)
 *   - SLO compliance tracking (sliding-window observation store)
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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AnomalyAlert {
  metric: string;
  currentValue: number;
  mean: number;
  stddev: number;
  zScore: number;
  timestamp: string;
}

interface RollingStat {
  /** Welford online algorithm accumulators */
  count: number;
  mean: number;
  /** Running sum of squared deviations (M2) */
  m2: number;
  lastValue: number;
  lastTimestamp: string;
}

interface SloObservation {
  met: boolean;
  timestamp: number;
}

// ── Internal stores ───────────────────────────────────────────────────────────

const rollingStats = new Map<string, RollingStat>();
const sloStore = new Map<string, SloObservation[]>();

/** Minimum observations required before anomaly detection is meaningful. */
const ANOMALY_MIN_SAMPLES = 10;
/** Z-score threshold for anomaly flagging. */
const ANOMALY_Z_THRESHOLD = 3;
/** Default SLO compliance window: last 60 minutes. */
const DEFAULT_SLO_WINDOW_MS = 60 * 60 * 1000;

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

  // ── Anomaly detection ─────────────────────────────────────────────────────

  /**
   * Record a numeric observation for a named metric and update its rolling
   * statistics using Welford's online algorithm (O(1) memory per metric).
   */
  recordMetricObservation(metricName: string, value: number): void {
    const now = new Date().toISOString();
    if (!rollingStats.has(metricName)) {
      rollingStats.set(metricName, {
        count: 0,
        mean: 0,
        m2: 0,
        lastValue: value,
        lastTimestamp: now,
      });
    }
    const stat = rollingStats.get(metricName)!;
    stat.count++;
    const delta = value - stat.mean;
    stat.mean += delta / stat.count;
    stat.m2 += delta * (value - stat.mean);
    stat.lastValue = value;
    stat.lastTimestamp = now;
  },

  /**
   * Returns anomaly alerts for all metrics where the latest observation
   * deviates more than ANOMALY_Z_THRESHOLD standard deviations from the mean
   * (requires at least ANOMALY_MIN_SAMPLES observations).
   */
  checkAnomalies(): AnomalyAlert[] {
    const alerts: AnomalyAlert[] = [];
    for (const [metric, stat] of rollingStats) {
      if (stat.count < ANOMALY_MIN_SAMPLES) continue;
      const variance = stat.count > 1 ? stat.m2 / (stat.count - 1) : 0;
      const stddev = Math.sqrt(variance);
      if (stddev === 0) continue;
      const zScore = (stat.lastValue - stat.mean) / stddev;
      if (Math.abs(zScore) > ANOMALY_Z_THRESHOLD) {
        alerts.push({
          metric,
          currentValue: stat.lastValue,
          mean: stat.mean,
          stddev,
          zScore,
          timestamp: stat.lastTimestamp,
        });
      }
    }
    return alerts;
  },

  /** Returns the rolling statistics for a named metric (for diagnostics). */
  getMetricStats(
    metricName: string,
  ): { mean: number; stddev: number; count: number } | null {
    const stat = rollingStats.get(metricName);
    if (!stat) return null;
    const variance = stat.count > 1 ? stat.m2 / (stat.count - 1) : 0;
    return { mean: stat.mean, stddev: Math.sqrt(variance), count: stat.count };
  },

  // ── SLO compliance ────────────────────────────────────────────────────────

  /**
   * Record whether a single SLO target was met at the current moment.
   */
  recordSloObservation(sloName: string, met: boolean): void {
    if (!sloStore.has(sloName)) {
      sloStore.set(sloName, []);
    }
    sloStore.get(sloName)!.push({ met, timestamp: Date.now() });
  },

  /**
   * Returns the fraction of SLO observations within the given window that
   * were met (0–1).  Returns 1.0 when no observations are present.
   */
  getSloCompliance(sloName: string, windowMs = DEFAULT_SLO_WINDOW_MS): number {
    const observations = sloStore.get(sloName);
    if (!observations || observations.length === 0) return 1;
    const cutoff = Date.now() - windowMs;
    const recent = observations.filter((o) => o.timestamp >= cutoff);
    if (recent.length === 0) return 1;
    const metCount = recent.filter((o) => o.met).length;
    return metCount / recent.length;
  },

  /** Clears in-memory anomaly and SLO state (useful for testing). */
  _resetObservabilityState(): void {
    rollingStats.clear();
    sloStore.clear();
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
