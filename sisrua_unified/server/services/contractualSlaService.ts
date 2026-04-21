/**
 * contractualSlaService.ts — SLO/SLA por Fluxo Crítico Contratual (114 [T1])
 *
 * Responsabilidades:
 * - Catálogo de SLAs contratuais por fluxo crítico do sistema.
 * - Registro de eventos de conformidade (sucessos/falhas por fluxo).
 * - Cálculo de compliance para período (MTTR, MTBF, disponibilidade real vs meta).
 * - Alertas de violação de SLA com penalidades previstas.
 */

import { logger } from "../utils/logger.js";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type SlaFlowId =
  | "exportacao_dxf"
  | "calculo_bt"
  | "autenticacao"
  | "api_geoprocessamento"
  | "importacao_shapefile"
  | "relatorio_conformidade"
  | "backup_db"
  | "integracao_aneel";

export interface ContractualSla {
  flowId: SlaFlowId;
  flowName: string;
  /** Disponibilidade mínima contratual (ex: 0.999 = 99.9%). */
  availabilityTarget: number;
  /** Tempo de resposta p95 máximo em milissegundos. */
  p95ResponseTimeMs: number;
  /** Tempo máximo de resolução de incidente (minutos). */
  mttrTargetMin: number;
  /** Penalidade contratual por violação de SLA (texto descritivo). */
  penaltyClause: string;
  /** Referência do contrato ou cláusula. */
  contractRef: string;
}

export type SlaEventOutcome = "success" | "failure" | "timeout" | "degraded";

export interface SlaEvent {
  id: string;
  flowId: SlaFlowId;
  outcome: SlaEventOutcome;
  durationMs: number;
  tenantId: string | null;
  errorCode: string | null;
  timestamp: string;
}

export interface SlaComplianceReport {
  flowId: SlaFlowId;
  flowName: string;
  period: { start: string; end: string };
  totalEvents: number;
  successRate: number;
  availabilityTarget: number;
  compliant: boolean;
  p95ResponseTimeMs: number;
  p95Target: number;
  p95Compliant: boolean;
  violationCount: number;
  mttrMinActual: number | null;
  mttrMinTarget: number;
}

// ─── Catálogo de SLAs contratuais ─────────────────────────────────────────────

const SLA_CATALOG: ContractualSla[] = [
  {
    flowId: "exportacao_dxf",
    flowName: "Exportação DXF/CAD",
    availabilityTarget: 0.999,
    p95ResponseTimeMs: 30_000,
    mttrTargetMin: 60,
    penaltyClause:
      "Desconto de 0.5% por hora de indisponibilidade acima do SLA, limitado a 10% da mensalidade.",
    contractRef: "Contrato Padrão v2 — Cláusula 8.3.1",
  },
  {
    flowId: "calculo_bt",
    flowName: "Cálculo BT (Elétrico)",
    availabilityTarget: 0.999,
    p95ResponseTimeMs: 15_000,
    mttrTargetMin: 30,
    penaltyClause:
      "Crédito de 1% por hora acima do MTTR contratual, limitado a 5% da mensalidade.",
    contractRef: "Contrato Padrão v2 — Cláusula 8.3.2",
  },
  {
    flowId: "autenticacao",
    flowName: "Autenticação e Sessão",
    availabilityTarget: 0.9999,
    p95ResponseTimeMs: 500,
    mttrTargetMin: 15,
    penaltyClause:
      "Crédito de 2% por evento de autenticação com falha sistêmica.",
    contractRef: "Contrato Padrão v2 — Cláusula 8.3.3",
  },
  {
    flowId: "api_geoprocessamento",
    flowName: "API de Geoprocessamento",
    availabilityTarget: 0.995,
    p95ResponseTimeMs: 5_000,
    mttrTargetMin: 120,
    penaltyClause:
      "Notificação obrigatória em 2h; crédito de 0.25% por hora excedida.",
    contractRef: "Contrato Padrão v2 — Cláusula 8.3.4",
  },
  {
    flowId: "importacao_shapefile",
    flowName: "Importação Shapefile/GeoJSON",
    availabilityTarget: 0.995,
    p95ResponseTimeMs: 60_000,
    mttrTargetMin: 120,
    penaltyClause:
      "Notificação obrigatória em 2h; crédito de 0.25% por hora excedida.",
    contractRef: "Contrato Padrão v2 — Cláusula 8.3.5",
  },
  {
    flowId: "relatorio_conformidade",
    flowName: "Relatório de Conformidade ANEEL",
    availabilityTarget: 0.99,
    p95ResponseTimeMs: 120_000,
    mttrTargetMin: 240,
    penaltyClause:
      "Crédito de 1% por falha em ciclo de emissão regulatório.",
    contractRef: "Contrato Padrão v2 — Cláusula 8.3.6",
  },
  {
    flowId: "backup_db",
    flowName: "Backup de Banco de Dados",
    availabilityTarget: 0.999,
    p95ResponseTimeMs: 600_000,
    mttrTargetMin: 480,
    penaltyClause:
      "Notificação ao DPO em 24h em caso de perda de dados; multa por RPO violado.",
    contractRef: "Contrato Padrão v2 — Cláusula 8.3.7",
  },
  {
    flowId: "integracao_aneel",
    flowName: "Integração ANEEL/BDGD",
    availabilityTarget: 0.99,
    p95ResponseTimeMs: 300_000,
    mttrTargetMin: 720,
    penaltyClause:
      "Relatório de impacto regulatório obrigatório se falha ocorrer em janela de entrega BDGD.",
    contractRef: "Contrato Padrão v2 — Cláusula 8.3.8",
  },
];

// ─── Estado em memória ────────────────────────────────────────────────────────

const slaEvents: SlaEvent[] = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `sla-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class ContractualSlaService {
  /** Retorna catálogo de SLAs contratuais. */
  static getCatalog(): ContractualSla[] {
    return [...SLA_CATALOG];
  }

  /** Retorna SLA de um fluxo específico. */
  static getSlaByFlow(flowId: SlaFlowId): ContractualSla | null {
    return SLA_CATALOG.find((s) => s.flowId === flowId) ?? null;
  }

  /**
   * Registra evento de SLA (resultado de execução de um fluxo crítico).
   * Deve ser chamado por cada serviço crítico ao concluir ou falhar.
   */
  static recordEvent(data: {
    flowId: SlaFlowId;
    outcome: SlaEventOutcome;
    durationMs: number;
    tenantId?: string;
    errorCode?: string;
  }): SlaEvent {
    const event: SlaEvent = {
      id: generateId(),
      flowId: data.flowId,
      outcome: data.outcome,
      durationMs: data.durationMs,
      tenantId: data.tenantId ?? null,
      errorCode: data.errorCode ?? null,
      timestamp: new Date().toISOString(),
    };

    slaEvents.push(event);

    if (data.outcome === "failure" || data.outcome === "timeout") {
      logger.warn("[SLA] Evento de falha registrado", {
        flowId: data.flowId,
        outcome: data.outcome,
        errorCode: data.errorCode,
      });
    }

    return event;
  }

  /**
   * Gera relatório de conformidade para um fluxo em um período.
   * Se start/end não forem fornecidos, usa os últimos 30 dias.
   */
  static getComplianceReport(
    flowId: SlaFlowId,
    startIso?: string,
    endIso?: string,
  ): SlaComplianceReport {
    const sla = SLA_CATALOG.find((s) => s.flowId === flowId);
    if (!sla) throw new Error(`SLA não encontrado para fluxo '${flowId}'.`);

    const end = endIso ? new Date(endIso) : new Date();
    const start = startIso
      ? new Date(startIso)
      : new Date(end.getTime() - 30 * 24 * 60 * 60_000);

    const periodEvents = slaEvents.filter((e) => {
      const t = new Date(e.timestamp);
      return e.flowId === flowId && t >= start && t <= end;
    });

    const total = periodEvents.length;
    const successes = periodEvents.filter(
      (e) => e.outcome === "success",
    ).length;
    const successRate = total > 0 ? successes / total : 1;
    const violations = periodEvents.filter(
      (e) => e.outcome === "failure" || e.outcome === "timeout",
    );

    const durations = periodEvents
      .filter((e) => e.outcome === "success")
      .map((e) => e.durationMs);
    const p95 = percentile(durations, 95);

    // MTTR: média de duração dos eventos de falha (se existirem)
    const failureDurations = violations.map((e) => e.durationMs);
    const mttrActual =
      failureDurations.length > 0
        ? Math.round(
            failureDurations.reduce((a, b) => a + b, 0) /
              failureDurations.length /
              60_000,
          )
        : null;

    return {
      flowId,
      flowName: sla.flowName,
      period: { start: start.toISOString(), end: end.toISOString() },
      totalEvents: total,
      successRate: Math.round(successRate * 10000) / 10000,
      availabilityTarget: sla.availabilityTarget,
      compliant: successRate >= sla.availabilityTarget,
      p95ResponseTimeMs: p95,
      p95Target: sla.p95ResponseTimeMs,
      p95Compliant: p95 <= sla.p95ResponseTimeMs || durations.length === 0,
      violationCount: violations.length,
      mttrMinActual: mttrActual,
      mttrMinTarget: sla.mttrTargetMin,
    };
  }

  /** Relatório de todos os fluxos para o período (padrão: últimos 30 dias). */
  static getAllComplianceReports(
    startIso?: string,
    endIso?: string,
  ): SlaComplianceReport[] {
    return SLA_CATALOG.map((s) =>
      ContractualSlaService.getComplianceReport(s.flowId, startIso, endIso),
    );
  }

  /** Retorna fluxos com violação de SLA no período. */
  static getViolations(
    startIso?: string,
    endIso?: string,
  ): SlaComplianceReport[] {
    return ContractualSlaService.getAllComplianceReports(startIso, endIso).filter(
      (r) => !r.compliant || !r.p95Compliant,
    );
  }

  /** Retorna eventos brutos de um fluxo (paginado). */
  static getEvents(
    flowId: SlaFlowId,
    limit = 100,
    offset = 0,
  ): SlaEvent[] {
    return slaEvents
      .filter((e) => e.flowId === flowId)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(offset, offset + limit);
  }
}
