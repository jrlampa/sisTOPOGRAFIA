/**
 * predictiveObservabilityService.ts — Observabilidade Preditiva (18 [T1])
 *
 * Responsabilidades:
 * - Ingestão de métricas operacionais em buffer circular por métrica.
 * - Estatísticas de latência/erro (avg, p50, p95, p99, min, max).
 * - Detecção de anomalias por Z-score em janela móvel.
 * - Geração de sinais preditivos (tendência e risco de degradação).
 */

import { logger } from "../utils/logger.js";

export type MetricName =
  | "api_latency_ms"
  | "dxf_generation_seconds"
  | "bt_calculation_seconds"
  | "error_rate_pct"
  | "queue_depth";

export interface MetricPoint {
  ts: string;
  value: number;
  source: string | null;
}

export interface MetricStats {
  metric: MetricName;
  samples: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  stdDev: number;
  lastValue: number | null;
  lastTs: string | null;
}

export interface MetricAnomaly {
  id: string;
  metric: MetricName;
  ts: string;
  value: number;
  zScore: number;
  severity: "media" | "alta" | "critica";
  reason: string;
}

export interface PredictiveSignal {
  metric: MetricName;
  trend: "subindo" | "descendo" | "estavel";
  trendSlopePerHour: number;
  projected1h: number | null;
  projected6h: number | null;
  risk: "baixo" | "medio" | "alto";
  riskReason: string;
}

export interface ObservabilityOverview {
  generatedAt: string;
  metricsTracked: number;
  totalSamples: number;
  anomaliesLast24h: number;
  byMetric: Array<{
    metric: MetricName;
    stats: MetricStats;
    signal: PredictiveSignal;
    anomaliesLast24h: number;
  }>;
}

const BUFFER_SIZE = 600;
const ZSCORE_ALERT = 2.5;

class RingBuffer<T> {
  private items: T[];
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.items = [];
  }

  push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.capacity) this.items.shift();
  }

  toArray(): T[] {
    return [...this.items];
  }

  size(): number {
    return this.items.length;
  }
}

const METRIC_CATALOG: MetricName[] = [
  "api_latency_ms",
  "dxf_generation_seconds",
  "bt_calculation_seconds",
  "error_rate_pct",
  "queue_depth",
];

const metricBuffers = new Map<MetricName, RingBuffer<MetricPoint>>();
for (const m of METRIC_CATALOG) metricBuffers.set(m, new RingBuffer<MetricPoint>(BUFFER_SIZE));

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))] ?? 0;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mu = mean(values);
  const variance = values.reduce((acc, v) => acc + (v - mu) * (v - mu), 0) / values.length;
  return Math.sqrt(variance);
}

function slopePerHour(points: MetricPoint[]): number {
  if (points.length < 2) return 0;
  const xs = points.map((p) => new Date(p.ts).getTime() / 3600000);
  const ys = points.map((p) => p.value);
  const xBar = mean(xs);
  const yBar = mean(ys);

  let num = 0;
  let den = 0;
  for (let i = 0; i < points.length; i++) {
    const x = xs[i] ?? xBar;
    const y = ys[i] ?? yBar;
    num += (x - xBar) * (y - yBar);
    den += (x - xBar) * (x - xBar);
  }
  if (den === 0) return 0;
  return num / den;
}

function metricRisk(metric: MetricName, stats: MetricStats, signal: PredictiveSignal): { risk: "baixo" | "medio" | "alto"; reason: string } {
  if (stats.samples < 20) return { risk: "medio", reason: "Amostragem ainda pequena para predição robusta" };

  if (metric === "error_rate_pct") {
    if (stats.p95 >= 5 || signal.projected1h !== null && signal.projected1h >= 5) {
      return { risk: "alto", reason: "Taxa de erro elevada ou em tendência de alta" };
    }
    if (stats.p95 >= 2) return { risk: "medio", reason: "Taxa de erro moderada" };
  }

  if (metric === "api_latency_ms") {
    if (stats.p95 >= 2000 || signal.projected1h !== null && signal.projected1h >= 2000) {
      return { risk: "alto", reason: "Latência API em zona de violação de SLO" };
    }
    if (stats.p95 >= 1000) return { risk: "medio", reason: "Latência API em degradação" };
  }

  if (metric === "dxf_generation_seconds") {
    if (stats.p95 >= 120 || signal.projected1h !== null && signal.projected1h >= 120) {
      return { risk: "alto", reason: "Tempo de geração DXF acima do p95 contratual" };
    }
    if (stats.p95 >= 90) return { risk: "medio", reason: "Geração DXF próxima do limite" };
  }

  if (signal.trend === "subindo" && Math.abs(signal.trendSlopePerHour) > 10) {
    return { risk: "medio", reason: "Tendência ascendente acelerada" };
  }

  return { risk: "baixo", reason: "Métricas sob controle" };
}

export class PredictiveObservabilityService {
  static ingest(metric: MetricName, value: number, source: string | null = null, ts: string | null = null): MetricPoint {
    const point: MetricPoint = {
      ts: ts ?? new Date().toISOString(),
      value,
      source,
    };

    const buffer = metricBuffers.get(metric);
    if (!buffer) {
      throw new Error(`Métrica não suportada: ${metric}`);
    }

    buffer.push(point);
    logger.info(`predictiveObs: métrica registrada ${metric}=${value}`);
    return point;
  }

  static getSeries(metric: MetricName, limit = 120): MetricPoint[] {
    const buffer = metricBuffers.get(metric);
    if (!buffer) return [];
    const all = buffer.toArray();
    return all.slice(Math.max(0, all.length - limit));
  }

  static getStats(metric: MetricName, windowMinutes = 1440): MetricStats {
    const now = Date.now();
    const cutoff = now - windowMinutes * 60 * 1000;
    const series = PredictiveObservabilityService.getSeries(metric, BUFFER_SIZE).filter(
      (p) => new Date(p.ts).getTime() >= cutoff,
    );

    const values = series.map((p) => p.value);
    const stats: MetricStats = {
      metric,
      samples: values.length,
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 0,
      avg: values.length ? mean(values) : 0,
      p50: values.length ? percentile(values, 50) : 0,
      p95: values.length ? percentile(values, 95) : 0,
      p99: values.length ? percentile(values, 99) : 0,
      stdDev: values.length ? stdDev(values) : 0,
      lastValue: series.length ? (series[series.length - 1]?.value ?? null) : null,
      lastTs: series.length ? (series[series.length - 1]?.ts ?? null) : null,
    };
    return stats;
  }

  static detectAnomalies(metric: MetricName, windowMinutes = 1440, zThreshold = ZSCORE_ALERT): MetricAnomaly[] {
    const stats = PredictiveObservabilityService.getStats(metric, windowMinutes);
    const series = PredictiveObservabilityService.getSeries(metric, BUFFER_SIZE).filter(
      (p) => {
        const cutoff = Date.now() - windowMinutes * 60 * 1000;
        return new Date(p.ts).getTime() >= cutoff;
      },
    );

    if (series.length < 20 || stats.stdDev === 0) return [];

    const anomalies: MetricAnomaly[] = [];
    for (const point of series) {
      const z = Math.abs((point.value - stats.avg) / stats.stdDev);
      if (z >= zThreshold) {
        const severity: "media" | "alta" | "critica" =
          z >= 4 ? "critica" : z >= 3 ? "alta" : "media";

        anomalies.push({
          id: `anomaly-${metric}-${new Date(point.ts).getTime()}`,
          metric,
          ts: point.ts,
          value: point.value,
          zScore: Number(z.toFixed(2)),
          severity,
          reason: `Desvio estatístico (z-score=${z.toFixed(2)}) acima de ${zThreshold}`,
        });
      }
    }

    return anomalies;
  }

  static getPredictiveSignal(metric: MetricName, windowMinutes = 360): PredictiveSignal {
    const now = Date.now();
    const cutoff = now - windowMinutes * 60 * 1000;
    const series = PredictiveObservabilityService.getSeries(metric, BUFFER_SIZE).filter(
      (p) => new Date(p.ts).getTime() >= cutoff,
    );

    const slope = slopePerHour(series);
    let trend: "subindo" | "descendo" | "estavel" = "estavel";
    if (slope > 0.5) trend = "subindo";
    if (slope < -0.5) trend = "descendo";

    const lastValue = series.length ? (series[series.length - 1]?.value ?? null) : null;
    const projected1h = lastValue === null ? null : Number((lastValue + slope * 1).toFixed(3));
    const projected6h = lastValue === null ? null : Number((lastValue + slope * 6).toFixed(3));

    const stats = PredictiveObservabilityService.getStats(metric, windowMinutes);
    const riskInfo = metricRisk(
      metric,
      stats,
      {
        metric,
        trend,
        trendSlopePerHour: Number(slope.toFixed(4)),
        projected1h,
        projected6h,
        risk: "baixo",
        riskReason: "",
      },
    );

    return {
      metric,
      trend,
      trendSlopePerHour: Number(slope.toFixed(4)),
      projected1h,
      projected6h,
      risk: riskInfo.risk,
      riskReason: riskInfo.reason,
    };
  }

  static getOverview(): ObservabilityOverview {
    const byMetric = METRIC_CATALOG.map((metric) => {
      const stats = PredictiveObservabilityService.getStats(metric, 1440);
      const signal = PredictiveObservabilityService.getPredictiveSignal(metric, 360);
      const anomalies = PredictiveObservabilityService.detectAnomalies(metric, 1440, ZSCORE_ALERT);
      return {
        metric,
        stats,
        signal,
        anomaliesLast24h: anomalies.length,
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      metricsTracked: METRIC_CATALOG.length,
      totalSamples: byMetric.reduce((acc, m) => acc + m.stats.samples, 0),
      anomaliesLast24h: byMetric.reduce((acc, m) => acc + m.anomaliesLast24h, 0),
      byMetric,
    };
  }

  static getSupportedMetrics(): MetricName[] {
    return [...METRIC_CATALOG];
  }
}
