import { sendWebhookAlert } from "../utils/webhookNotifier.js";

export interface SLODefinition {
  id: string;
  name: string;
  description: string;
  indicator: "availability" | "latency" | "error_rate" | "throughput";
  target: number;
  windowDays: number;
  alertThreshold: number;
}

export interface SLOStatus {
  sloId: string;
  currentCompliance: number;
  errorBudgetRemaining: number;
  onTrack: boolean;
  alerting: boolean;
  observationCount: number;
}

interface Observation {
  met: boolean;
  timestamp: Date;
}

const sloDefinitions = new Map<string, SLODefinition>();
const sloObservations = new Map<string, Observation[]>();
/** Rastreia o último estado de alerta por SLO para disparar webhook apenas na transição false→true. */
const sloAlertState = new Map<string, boolean>();

const registerSLO = (definition: SLODefinition): void => {
  sloDefinitions.set(definition.id, definition);
  if (!sloObservations.has(definition.id)) {
    sloObservations.set(definition.id, []);
  }
  sloAlertState.set(definition.id, false);
};

const recordObservation = (
  sloId: string,
  met: boolean,
  timestamp: Date = new Date(),
): void => {
  const obs = sloObservations.get(sloId);
  if (!obs) return;
  obs.push({ met, timestamp });

  // Dispara webhook apenas na transição false → true de alerting
  const prevAlerting = sloAlertState.get(sloId) ?? false;
  const status = getSLOStatus(sloId);
  if (status && status.alerting && !prevAlerting) {
    sloAlertState.set(sloId, true);
    const def = sloDefinitions.get(sloId)!;
    sendWebhookAlert({
      sloId,
      sloName: def.name,
      currentCompliance: status.currentCompliance,
      alertThreshold: def.alertThreshold,
      errorBudgetRemaining: status.errorBudgetRemaining,
      message: `🚨 SLO em alerta: ${def.name} — conformidade ${(status.currentCompliance * 100).toFixed(2)}% abaixo do limiar ${(def.alertThreshold * 100).toFixed(2)}%`,
      timestamp: new Date().toISOString(),
    }).catch(() => {
      /* erros já logados em sendWebhookAlert */
    });
  } else if (status && !status.alerting) {
    sloAlertState.set(sloId, false);
  }
};

const getWindowedObservations = (sloId: string): Observation[] => {
  const def = sloDefinitions.get(sloId);
  const obs = sloObservations.get(sloId);
  if (!def || !obs) return [];
  const cutoff = new Date(Date.now() - def.windowDays * 24 * 60 * 60 * 1000);
  return obs.filter((o) => o.timestamp >= cutoff);
};

const getSLOStatus = (sloId: string): SLOStatus | null => {
  const def = sloDefinitions.get(sloId);
  if (!def) return null;

  const windowed = getWindowedObservations(sloId);
  const total = windowed.length;

  if (total === 0) {
    return {
      sloId,
      currentCompliance: 1,
      errorBudgetRemaining: 1,
      onTrack: true,
      alerting: false,
      observationCount: 0,
    };
  }

  const metCount = windowed.filter((o) => o.met).length;
  const currentCompliance = metCount / total;
  const errorBudget = 1 - def.target;
  const usedBudget = def.target - currentCompliance;
  const errorBudgetRemaining =
    errorBudget > 0
      ? Math.max(0, 1 - usedBudget / errorBudget)
      : currentCompliance >= def.target
        ? 1
        : 0;
  const onTrack = currentCompliance >= def.target;
  const alerting = currentCompliance < def.alertThreshold;

  return {
    sloId,
    currentCompliance,
    errorBudgetRemaining,
    onTrack,
    alerting,
    observationCount: total,
  };
};

const getAllSLOStatuses = (): SLOStatus[] => {
  return Array.from(sloDefinitions.keys())
    .map((id) => getSLOStatus(id))
    .filter((s): s is SLOStatus => s !== null);
};

const getAlertingSLOs = (): SLOStatus[] => {
  return getAllSLOStatuses().filter((s) => s.alerting);
};

const clearSLOs = (): void => {
  sloDefinitions.clear();
  sloObservations.clear();
  sloAlertState.clear();
};

// Pre-register critical SLOs
registerSLO({
  id: "dxf_export_availability",
  name: "DXF Export Availability",
  description: "Availability of the DXF export flow",
  indicator: "availability",
  target: 0.999,
  windowDays: 30,
  alertThreshold: 0.995,
});

registerSLO({
  id: "api_latency_p99",
  name: "API Latency P99",
  description: "P99 latency compliance for API endpoints",
  indicator: "latency",
  target: 0.995,
  windowDays: 7,
  alertThreshold: 0.99,
});

registerSLO({
  id: "bt_calculation_success_rate",
  name: "BT Calculation Success Rate",
  description: "Success rate of BT calculation requests",
  indicator: "availability",
  target: 0.999,
  windowDays: 7,
  alertThreshold: 0.995,
});

export {
  registerSLO,
  recordObservation,
  getSLOStatus,
  getAllSLOStatuses,
  getAlertingSLOs,
  clearSLOs,
};
