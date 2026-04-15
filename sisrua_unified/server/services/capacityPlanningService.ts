/**
 * capacityPlanningService.ts — Gestão de Capacidade & Capacity Planning (Item 126 [T1]).
 */
export interface CapacitySnapshot {
  timestamp: Date;
  jobsConcurrentes: number;
  latenciaMediaMs: number;
  memoriaUsadaMb: number;
  cpuPct: number;
  saturationScore: number;
}

export interface CapacityMeta {
  maxJobsConcurrentes: number;
  latenciaAlvoMs: number;
  alertaAtivo: boolean;
  margemSeguranca: number;
}

const MAX_HISTORICO = 1000;
const historico: CapacitySnapshot[] = [];
let metaAtual: CapacityMeta | null = null;

export function registrarSnapshot(s: CapacitySnapshot): void {
  historico.push(s);
  if (historico.length > MAX_HISTORICO) historico.shift();
}

export function listarHistorico(): CapacitySnapshot[] {
  return [...historico];
}

export function calcularMeta(maxJobsConcurrentes: number, latenciaAlvoMs: number): CapacityMeta {
  const ultima = historico[historico.length - 1] ?? null;
  let alertaAtivo = false;
  let margemSeguranca = 1.0;
  if (ultima) {
    alertaAtivo = ultima.jobsConcurrentes > maxJobsConcurrentes * 0.8 || ultima.latenciaMediaMs > latenciaAlvoMs * 0.9;
    margemSeguranca = ultima.jobsConcurrentes > 0
      ? Math.max(0, (maxJobsConcurrentes - ultima.jobsConcurrentes) / maxJobsConcurrentes)
      : 1.0;
  }
  metaAtual = { maxJobsConcurrentes, latenciaAlvoMs, alertaAtivo, margemSeguranca };
  return metaAtual;
}

export function statusCapacidade(): { snapshots: number; ultima: CapacitySnapshot | null; meta: CapacityMeta | null } {
  return {
    snapshots: historico.length,
    ultima: historico[historico.length - 1] ?? null,
    meta: metaAtual,
  };
}

/** Limpa estado (uso em testes) */
export function _resetCapacity(): void {
  historico.length = 0;
  metaAtual = null;
}
