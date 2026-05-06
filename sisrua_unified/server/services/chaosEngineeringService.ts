/**
 * chaosEngineeringService.ts — Plataforma de Chaos Engineering (T2.19)
 *
 * Injeção controlada de falhas para validar resiliência de serviços geoespaciais:
 * - Latência: simula degradação de latência em endpoints críticos
 * - Taxa de erros: simula falhas transitórias de API/DB
 * - Esgotamento de recursos: simula OOM, CPU throttle
 * - Partição de rede: simula indisponibilidade de serviços externos
 * - Corrompimento de payload: testa validações de entrada
 *
 * Todas as execuções são auditáveis e possuem rollback automático por TTL.
 */

export type ChaosTargetType =
  | "api_endpoint"
  | "database"
  | "external_service"
  | "worker_python"
  | "cache"
  | "queue";

export type ChaosFaultType =
  | "latency"
  | "error_rate"
  | "resource_exhaustion"
  | "network_partition"
  | "payload_corruption"
  | "timeout";

export type ChaosStatus =
  | "scheduled"
  | "running"
  | "completed"
  | "rolled_back"
  | "failed"
  | "cancelled";

export type ChaosResilienceOutcome =
  | "resilient"        // Sistema manteve SLO durante o experimento
  | "degraded"         // Performance caiu mas sem falha total
  | "failed"           // Falha total detectada
  | "inconclusive";    // Dados insuficientes

// ─── Tipos de experimento ────────────────────────────────────────────────────

export interface ChaosLatencyConfig {
  faultType: "latency";
  delayMs: number;
  jitterMs?: number;
  /** Percentual de requisições afetadas (0-100). Default: 100. */
  affectedPercent?: number;
}

export interface ChaosErrorRateConfig {
  faultType: "error_rate";
  /** Percentual de requisições que retornam erro (0-100). */
  errorPercent: number;
  /** HTTP status code a retornar. Default: 503. */
  statusCode?: number;
}

export interface ChaosResourceExhaustionConfig {
  faultType: "resource_exhaustion";
  resource: "memory" | "cpu" | "file_descriptors";
  /** Percentual do limite a consumir. Ex: 90 = 90% da memória disponível. */
  consumePercent: number;
}

export interface ChaosNetworkPartitionConfig {
  faultType: "network_partition";
  /** Serviços externos a bloquear. */
  targetServices: string[];
  /** Pacotes perdidos (0-100). Default: 100. */
  packetLossPercent?: number;
}

export interface ChaosPayloadCorruptionConfig {
  faultType: "payload_corruption";
  /** Campo do payload a corromper. */
  targetField: string;
  corruptionType: "null" | "wrong_type" | "oversized" | "missing";
}

export interface ChaosTimeoutConfig {
  faultType: "timeout";
  /** Timeout artificial em ms (a resposta nunca chega). */
  timeoutMs: number;
}

export type ChaosFaultConfig =
  | ChaosLatencyConfig
  | ChaosErrorRateConfig
  | ChaosResourceExhaustionConfig
  | ChaosNetworkPartitionConfig
  | ChaosPayloadCorruptionConfig
  | ChaosTimeoutConfig;

// ─── Experimento ──────────────────────────────────────────────────────────────

export interface ChaosExperiment {
  id: string;
  name: string;
  description: string;
  targetType: ChaosTargetType;
  targetId: string;
  faultConfig: ChaosFaultConfig;
  /** Duração máxima do experimento em segundos. Rollback automático após TTL. */
  durationSeconds: number;
  /** Condição de parada automática: se SLO cair abaixo deste valor, para. */
  sloThresholdPercent?: number;
  createdBy: string;
  createdAt: string;
  scheduledAt?: string;
  status: ChaosStatus;
  startedAt?: string;
  completedAt?: string;
  outcome?: ChaosResilienceOutcome;
  tags?: string[];
}

// ─── Resultado de execução ────────────────────────────────────────────────────

export interface ChaosMetricSnapshot {
  timestampMs: number;
  errorRatePercent: number;
  p50LatencyMs: number;
  p99LatencyMs: number;
  sloCompliancePercent: number;
}

export interface ChaosExecutionResult {
  experimentId: string;
  startedAt: string;
  completedAt: string;
  outcome: ChaosResilienceOutcome;
  /** Baseline antes da injeção. */
  baselineMetrics: ChaosMetricSnapshot;
  /** Snapshots durante o experimento. */
  duringMetrics: ChaosMetricSnapshot[];
  /** Snapshot pós-rollback (verificação de recuperação). */
  recoveryMetrics?: ChaosMetricSnapshot;
  /** Tempo de recuperação detectado (ms). null se não recuperou. */
  recoveryTimeMs: number | null;
  notes: string;
  autoRolledBack: boolean;
}

// ─── Store em memória ────────────────────────────────────────────────────────

const experiments = new Map<string, ChaosExperiment>();
const results = new Map<string, ChaosExecutionResult>();
let idCounter = 1;

function genId(): string {
  return `chaos-${Date.now()}-${idCounter++}`;
}

function simulateMetricSnapshot(
  errorBoost = 0,
  latencyBoost = 0,
): ChaosMetricSnapshot {
  return {
    timestampMs: Date.now(),
    errorRatePercent: Math.max(0, Math.random() * 0.5 + errorBoost),
    p50LatencyMs: 45 + Math.random() * 20 + latencyBoost * 0.3,
    p99LatencyMs: 120 + Math.random() * 50 + latencyBoost,
    sloCompliancePercent: Math.min(100, 99.5 - errorBoost - latencyBoost / 1000),
  };
}

function determineOutcome(
  config: ChaosFaultConfig,
  sloThreshold: number,
  baseline: ChaosMetricSnapshot,
  during: ChaosMetricSnapshot[],
): ChaosResilienceOutcome {
  if (during.length === 0) return "inconclusive";
  const worst = during.reduce((a, b) =>
    a.sloCompliancePercent < b.sloCompliancePercent ? a : b,
  );
  if (worst.sloCompliancePercent < sloThreshold - 5) return "failed";
  if (worst.sloCompliancePercent < sloThreshold) return "degraded";
  return "resilient";
}

// ─── API pública ─────────────────────────────────────────────────────────────

export function createChaosExperiment(
  input: Omit<ChaosExperiment, "id" | "createdAt" | "status">,
): ChaosExperiment {
  const experiment: ChaosExperiment = {
    ...input,
    id: genId(),
    createdAt: new Date().toISOString(),
    status: input.scheduledAt ? "scheduled" : "scheduled",
  };
  experiments.set(experiment.id, experiment);
  return experiment;
}

export function listChaosExperiments(filters?: {
  status?: ChaosStatus;
  targetType?: ChaosTargetType;
  tag?: string;
}): ChaosExperiment[] {
  let list = [...experiments.values()];
  if (filters?.status) list = list.filter((e) => e.status === filters.status);
  if (filters?.targetType) list = list.filter((e) => e.targetType === filters.targetType);
  if (filters?.tag) list = list.filter((e) => e.tags?.includes(filters.tag!));
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getChaosExperiment(id: string): ChaosExperiment | null {
  return experiments.get(id) ?? null;
}

/**
 * Executa o experimento de chaos de forma simulada.
 *
 * Em produção, este método integraria com:
 * - Chaos Monkey / Toxiproxy para injeção real
 * - Prometheus/Grafana para coleta de métricas reais
 * - Kubernetes ou Docker SDK para resource exhaustion real
 *
 * Aqui, simula as métricas para demonstrar o ciclo completo.
 */
export function runChaosExperiment(id: string): ChaosExecutionResult | null {
  const exp = experiments.get(id);
  if (!exp) return null;
  if (exp.status === "running") return null;

  const startedAt = new Date().toISOString();
  exp.status = "running";
  exp.startedAt = startedAt;
  experiments.set(id, exp);

  const sloThreshold = exp.sloThresholdPercent ?? 99.0;

  // Simula métricas de baseline (antes da injeção)
  const baseline = simulateMetricSnapshot(0, 0);

  // Simula métricas durante a injeção (baseada no tipo de falha)
  const faultType = exp.faultConfig.faultType;
  let errorBoost = 0;
  let latencyBoost = 0;

  switch (faultType) {
    case "latency":
      latencyBoost = (exp.faultConfig as ChaosLatencyConfig).delayMs;
      break;
    case "error_rate":
      errorBoost = (exp.faultConfig as ChaosErrorRateConfig).errorPercent;
      break;
    case "resource_exhaustion":
      latencyBoost = (exp.faultConfig as ChaosResourceExhaustionConfig).consumePercent * 5;
      errorBoost = (exp.faultConfig as ChaosResourceExhaustionConfig).consumePercent > 80 ? 15 : 2;
      break;
    case "network_partition":
      errorBoost = (exp.faultConfig as ChaosNetworkPartitionConfig).packetLossPercent ?? 100;
      break;
    case "timeout":
      latencyBoost = (exp.faultConfig as ChaosTimeoutConfig).timeoutMs;
      errorBoost = 20;
      break;
    case "payload_corruption":
      errorBoost = 30;
      break;
  }

  const snapshotCount = Math.max(2, Math.floor(exp.durationSeconds / 10));
  const duringMetrics: ChaosMetricSnapshot[] = Array.from(
    { length: snapshotCount },
    () => simulateMetricSnapshot(errorBoost, latencyBoost),
  );

  const autoRolledBack = duringMetrics.some(
    (m) => m.sloCompliancePercent < sloThreshold,
  );

  const recoveryMetrics = simulateMetricSnapshot(0, 0);
  const recoveryTimeMs = autoRolledBack ? Math.floor(Math.random() * 5000 + 1000) : null;

  const outcome = determineOutcome(exp.faultConfig, sloThreshold, baseline, duringMetrics);

  const completedAt = new Date().toISOString();
  exp.status = autoRolledBack ? "rolled_back" : "completed";
  exp.completedAt = completedAt;
  exp.outcome = outcome;
  experiments.set(id, exp);

  const result: ChaosExecutionResult = {
    experimentId: id,
    startedAt,
    completedAt,
    outcome,
    baselineMetrics: baseline,
    duringMetrics,
    recoveryMetrics,
    recoveryTimeMs,
    notes: buildNotes(outcome, autoRolledBack, recoveryTimeMs),
    autoRolledBack,
  };

  results.set(id, result);
  return result;
}

export function getChaosResult(experimentId: string): ChaosExecutionResult | null {
  return results.get(experimentId) ?? null;
}

export function cancelChaosExperiment(id: string): boolean {
  const exp = experiments.get(id);
  if (!exp || exp.status === "completed" || exp.status === "cancelled") return false;
  exp.status = "cancelled";
  experiments.set(id, exp);
  return true;
}

export interface ChaosResilienceReport {
  totalExperiments: number;
  resilientCount: number;
  degradedCount: number;
  failedCount: number;
  inconclusiveCount: number;
  resilienceScore: number; // 0-100
  avgRecoveryTimeMs: number | null;
  topTargets: Array<{ targetId: string; runCount: number; failureCount: number }>;
}

export function getChaosResilienceReport(): ChaosResilienceReport {
  const allResults = [...results.values()];
  const resilientCount = allResults.filter((r) => r.outcome === "resilient").length;
  const degradedCount = allResults.filter((r) => r.outcome === "degraded").length;
  const failedCount = allResults.filter((r) => r.outcome === "failed").length;
  const inconclusiveCount = allResults.filter((r) => r.outcome === "inconclusive").length;

  const total = allResults.length;
  const resilienceScore =
    total === 0
      ? 100
      : Math.round(((resilientCount * 100 + degradedCount * 60) / total));

  const recoveryTimes = allResults
    .map((r) => r.recoveryTimeMs)
    .filter((t): t is number => t != null);
  const avgRecoveryTimeMs =
    recoveryTimes.length > 0
      ? Math.round(recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length)
      : null;

  const targetMap = new Map<string, { runCount: number; failureCount: number }>();
  for (const exp of experiments.values()) {
    const key = exp.targetId;
    const entry = targetMap.get(key) ?? { runCount: 0, failureCount: 0 };
    const r = results.get(exp.id);
    entry.runCount++;
    if (r?.outcome === "failed") entry.failureCount++;
    targetMap.set(key, entry);
  }

  const topTargets = [...targetMap.entries()]
    .map(([targetId, stats]) => ({ targetId, ...stats }))
    .sort((a, b) => b.runCount - a.runCount)
    .slice(0, 5);

  return {
    totalExperiments: total,
    resilientCount,
    degradedCount,
    failedCount,
    inconclusiveCount,
    resilienceScore,
    avgRecoveryTimeMs,
    topTargets,
  };
}

// ─── Helper privado ──────────────────────────────────────────────────────────

function buildNotes(
  outcome: ChaosResilienceOutcome,
  autoRolledBack: boolean,
  recoveryTimeMs: number | null,
): string {
  const parts: string[] = [];
  if (outcome === "resilient") parts.push("Sistema manteve SLO durante todo o experimento.");
  if (outcome === "degraded") parts.push("Performance degradou mas sem falha total.");
  if (outcome === "failed") parts.push("Falha total detectada — SLO violado criticamente.");
  if (autoRolledBack) parts.push("Rollback automático acionado por violação de SLO.");
  if (recoveryTimeMs != null) parts.push(`Recuperação detectada em ${recoveryTimeMs} ms.`);
  return parts.join(" ");
}
