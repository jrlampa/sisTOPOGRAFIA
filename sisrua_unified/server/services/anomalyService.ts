/**
 * Item 18 – Detecção Preditiva de Anomalias (Observabilidade)
 *
 * Algoritmo Z-score para detecção de outliers em séries de métricas.
 * Registra alertas como contadores Prometheus e no logger.
 */

import client from "prom-client";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

// ── Prometheus ────────────────────────────────────────────────────────────────

const prefix = `${config.METRICS_PREFIX}_`;

// Reutiliza o registro global para não duplicar métricas se o módulo for carregado mais de uma vez
let anomalyAlertsTotal: client.Counter<"metric_name" | "direction">;

try {
  anomalyAlertsTotal = new client.Counter({
    name: `${prefix}anomaly_alerts_total`,
    help: "Total de alertas de anomalia detectados por Z-score",
    labelNames: ["metric_name", "direction"] as const, // direction: above | below
  });
} catch {
  // Contador já registrado (hot-reload em desenvolvimento)
  anomalyAlertsTotal = client.register.getSingleMetric(
    `${prefix}anomaly_alerts_total`,
  ) as client.Counter<"metric_name" | "direction">;
}

export { anomalyAlertsTotal };

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface AnomalyResult {
  anomalyDetected: boolean;
  zScore: number;
  mean: number;
  stdDev: number;
  value: number;
  direction: "above" | "below" | "none";
}

export interface AnomalyAlert {
  id: string;
  metricName: string;
  value: number;
  zScore: number;
  direction: "above" | "below";
  detectedAt: Date;
}

// ── Configuração de detecção ──────────────────────────────────────────────────

/** Limiar padrão de Z-score para considerar anomalia (valor absoluto) */
const DEFAULT_Z_THRESHOLD = 2.5;

/** Mínimo de amostras necessárias para calcular Z-score confiável */
const MIN_SAMPLES = 5;

// ── Armazenamento de alertas em memória ──────────────────────────────────────

const alertHistory: AnomalyAlert[] = [];
const MAX_ALERT_HISTORY = 500;

// ── Algoritmo Z-score ─────────────────────────────────────────────────────────

/**
 * Calcula a média aritmética de um array de números.
 */
function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calcula o desvio padrão amostral de um array de números.
 */
function stdDev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Detecta anomalia em uma série de valores usando Z-score.
 *
 * O último valor da série é analisado em relação ao histórico anterior.
 *
 * @param metricName - Nome da métrica para fins de log
 * @param values     - Série de valores (mínimo MIN_SAMPLES elementos)
 * @param threshold  - Limiar de Z-score (padrão: 2.5)
 */
function detectAnomaly(
  metricName: string,
  values: number[],
  threshold = DEFAULT_Z_THRESHOLD,
): AnomalyResult {
  if (values.length < MIN_SAMPLES) {
    logger.debug("Amostras insuficientes para detecção de anomalia", {
      metricName,
      sampleCount: values.length,
      minRequired: MIN_SAMPLES,
    });
    return {
      anomalyDetected: false,
      zScore: 0,
      mean: values.length > 0 ? mean(values) : 0,
      stdDev: 0,
      value: values[values.length - 1] ?? 0,
      direction: "none",
    };
  }

  // Analisa o último valor em relação ao resto da série
  const current = values[values.length - 1];
  const history = values.slice(0, -1);

  const avg = mean(history);
  const std = stdDev(history, avg);

  // Desvio padrão zero → todos os valores são iguais, não há anomalia
  if (std === 0) {
    return {
      anomalyDetected: current !== avg,
      zScore: current !== avg ? Infinity : 0,
      mean: avg,
      stdDev: 0,
      value: current,
      direction: current > avg ? "above" : current < avg ? "below" : "none",
    };
  }

  const zScore = (current - avg) / std;
  const absZ = Math.abs(zScore);
  const anomalyDetected = absZ > threshold;
  const direction: "above" | "below" | "none" =
    zScore > 0 ? "above" : zScore < 0 ? "below" : "none";

  if (anomalyDetected) {
    logger.warn("Anomalia detectada por Z-score", {
      metricName,
      value: current,
      zScore: zScore.toFixed(3),
      mean: avg.toFixed(3),
      stdDev: std.toFixed(3),
      threshold,
      direction,
    });
  }

  return { anomalyDetected, zScore, mean: avg, stdDev: std, value: current, direction };
}

/**
 * Registra um alerta de anomalia no histórico e no contador Prometheus.
 */
function recordAnomalyAlert(
  metricName: string,
  value: number,
  zScore: number,
): AnomalyAlert {
  const direction: "above" | "below" = zScore >= 0 ? "above" : "below";

  const alert: AnomalyAlert = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    metricName,
    value,
    zScore,
    direction,
    detectedAt: new Date(),
  };

  // Registra no contador Prometheus
  anomalyAlertsTotal.inc({ metric_name: metricName, direction });

  // Mantém histórico com limite de tamanho
  alertHistory.push(alert);
  if (alertHistory.length > MAX_ALERT_HISTORY) {
    alertHistory.shift();
  }

  logger.warn("Alerta de anomalia registrado", {
    alertId: alert.id,
    metricName,
    value,
    zScore: zScore.toFixed(3),
    direction,
  });

  return alert;
}

/**
 * Retorna o histórico de alertas (mais recentes primeiro).
 */
function getAlertHistory(limit = 50): AnomalyAlert[] {
  return alertHistory.slice(-limit).reverse();
}

/**
 * Analisa e registra anomalia automaticamente se detectada.
 * Combina detectAnomaly + recordAnomalyAlert em um único passo.
 */
function analyzeAndRecord(
  metricName: string,
  values: number[],
  threshold?: number,
): AnomalyResult & { alert?: AnomalyAlert } {
  const result = detectAnomaly(metricName, values, threshold);

  if (result.anomalyDetected && result.direction !== "none") {
    const alert = recordAnomalyAlert(metricName, result.value, result.zScore);
    return { ...result, alert };
  }

  return result;
}

// ── Exportação do serviço ─────────────────────────────────────────────────────

export const anomalyService = {
  detectAnomaly,
  recordAnomalyAlert,
  getAlertHistory,
  analyzeAndRecord,
} as const;
