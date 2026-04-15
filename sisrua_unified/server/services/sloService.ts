export interface SLODefinition {
  id: string;
  name: string;
  description: string;
  indicator: 'availability' | 'latency' | 'error_rate' | 'throughput';
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

const registerSLO = (definition: SLODefinition): void => {
  sloDefinitions.set(definition.id, definition);
  if (!sloObservations.has(definition.id)) {
    sloObservations.set(definition.id, []);
  }
};

const recordObservation = (sloId: string, met: boolean, timestamp: Date = new Date()): void => {
  const obs = sloObservations.get(sloId);
  if (!obs) return;
  obs.push({ met, timestamp });
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
      observationCount: 0
    };
  }

  const metCount = windowed.filter((o) => o.met).length;
  const currentCompliance = metCount / total;
  const errorBudget = 1 - def.target;
  const usedBudget = def.target - currentCompliance;
  const errorBudgetRemaining = errorBudget > 0 ? Math.max(0, 1 - usedBudget / errorBudget) : currentCompliance >= def.target ? 1 : 0;
  const onTrack = currentCompliance >= def.target;
  const alerting = currentCompliance < def.alertThreshold;

  return {
    sloId,
    currentCompliance,
    errorBudgetRemaining,
    onTrack,
    alerting,
    observationCount: total
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
};

// Pre-register critical SLOs
registerSLO({
  id: 'dxf_export_availability',
  name: 'DXF Export Availability',
  description: 'Availability of the DXF export flow',
  indicator: 'availability',
  target: 0.999,
  windowDays: 30,
  alertThreshold: 0.995
});

registerSLO({
  id: 'api_latency_p99',
  name: 'API Latency P99',
  description: 'P99 latency compliance for API endpoints',
  indicator: 'latency',
  target: 0.995,
  windowDays: 7,
  alertThreshold: 0.99
});

registerSLO({
  id: 'bt_calculation_success_rate',
  name: 'BT Calculation Success Rate',
  description: 'Success rate of BT calculation requests',
  indicator: 'availability',
  target: 0.999,
  windowDays: 7,
  alertThreshold: 0.995
});

export { registerSLO, recordObservation, getSLOStatus, getAllSLOStatuses, getAlertingSLOs, clearSLOs };
