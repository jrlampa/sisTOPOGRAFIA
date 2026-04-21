/**
 * releaseCabService.ts — Release Governance & CAB Simplificado (111 [T1])
 *                        Gestão de Mudança e Janelas de Manutenção (118 [T1])
 *
 * Responsabilidades:
 * - 111: Calendário de releases, changelog executivo, aprovação formal de CAB.
 * - 118: Criação e aprovação de Requisições de Mudança (RDM), janelas de manutenção,
 *         proteção de janelas proibidas (congelamento de mudanças).
 */

import { logger } from "../utils/logger.js";

// ─── Tipos exportados ────────────────────────────────────────────────────────

export type ReleaseType = "major" | "minor" | "patch" | "hotfix" | "rollback";
export type ReleaseStatus =
  | "planejado"
  | "aprovado"
  | "em_execucao"
  | "concluido"
  | "cancelado"
  | "revertido";

export interface ReleaseRecord {
  id: string;
  version: string;
  type: ReleaseType;
  title: string;
  description: string;
  status: ReleaseStatus;
  proposer: string;
  /** Aprovações formais dos membros do CAB. */
  approvals: string[];
  scheduledAt: string | null;
  executedAt: string | null;
  gitCommit: string | null;
  /** Janela de manutenção associada (ISO 8601 interval ou null). */
  maintenanceWindowUtc: string | null;
  rollbackPlan: string;
  changelogEntry: string;
  createdAt: string;
}

export type ChangeType =
  | "normal"
  | "emergencial"
  | "padrao"
  | "rollback";
export type ChangeStatus =
  | "rascunho"
  | "pendente_aprovacao"
  | "aprovado"
  | "em_execucao"
  | "concluido"
  | "cancelado"
  | "rejeitado";
export type ChangePriority = "critica" | "alta" | "media" | "baixa";

export interface ChangeRequest {
  id: string;
  title: string;
  description: string;
  type: ChangeType;
  priority: ChangePriority;
  status: ChangeStatus;
  proposer: string;
  impactedSystems: string[];
  rollbackPlan: string;
  testingEvidence: string;
  windowStartUtc: string | null;
  windowEndUtc: string | null;
  approvers: string[];
  approvedAt: string | null;
  createdAt: string;
}

// ─── Dados em memória (catálogo pré-semeado) ─────────────────────────────────

const releases: ReleaseRecord[] = [
  {
    id: "rel-0.9.0",
    version: "0.9.0",
    type: "minor",
    title: "DG Sprint 3 + Governança Ollama + Integridade de Release",
    description:
      "Design Generativo frente 3 (frontend), governança de runtime Ollama zero-custo (14A+14B), assinatura SHA-256 de artefatos de release (16).",
    status: "concluido",
    proposer: "tech-lead",
    approvals: ["tech-lead", "devops-qa"],
    scheduledAt: "2026-04-21T00:00:00.000Z",
    executedAt: "2026-04-21T22:00:00.000Z",
    gitCommit: "a289150",
    maintenanceWindowUtc: "2026-04-21T22:00/2026-04-21T23:00",
    rollbackPlan: "git revert a289150; npm run build; restart server",
    changelogEntry:
      "Adicionadas sobreposição DG, governança Ollama zero-custo e integridade de release com HMAC-SHA-256.",
    createdAt: "2026-04-20T10:00:00.000Z",
  },
];

const changeRequests: ChangeRequest[] = [];

/** Períodos de congelamento: nenhuma mudança não-emergencial permitida. */
const FROZEN_WINDOWS_UTC: { start: string; end: string; reason: string }[] = [
  {
    start: "2026-12-24T00:00:00.000Z",
    end: "2027-01-03T00:00:00.000Z",
    reason: "Congelamento de fim de ano — recesso natalino.",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function isInFrozenWindow(dateIso: string): { frozen: boolean; reason: string } {
  const d = new Date(dateIso);
  for (const w of FROZEN_WINDOWS_UTC) {
    if (d >= new Date(w.start) && d <= new Date(w.end)) {
      return { frozen: true, reason: w.reason };
    }
  }
  return { frozen: false, reason: "" };
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class ReleaseCabService {
  // ── 111: Releases ──────────────────────────────────────────────────────────

  /** Lista todos os registros de release, ordem decrescente de criação. */
  static getReleases(): ReleaseRecord[] {
    return [...releases].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /** Retorna um release por ID ou null. */
  static getReleaseById(id: string): ReleaseRecord | null {
    return releases.find((r) => r.id === id) ?? null;
  }

  /**
   * Registra um novo release no calendário.
   * Se a janela proposta está em período de congelamento e não é emergencial,
   * lança erro de governança.
   */
  static registerRelease(
    data: Omit<
      ReleaseRecord,
      "id" | "status" | "approvals" | "executedAt" | "createdAt"
    >,
  ): ReleaseRecord {
    if (data.scheduledAt) {
      const frozen = isInFrozenWindow(data.scheduledAt);
      if (frozen.frozen && data.type !== "hotfix") {
        throw new Error(
          `Mudança bloqueada por período de congelamento: ${frozen.reason}`,
        );
      }
    }

    const record: ReleaseRecord = {
      ...data,
      id: generateId("rel"),
      status: "planejado",
      approvals: [],
      executedAt: null,
      createdAt: new Date().toISOString(),
    };

    releases.push(record);
    logger.info("[CAB] Novo release registrado", {
      id: record.id,
      version: record.version,
    });
    return record;
  }

  /**
   * Aprova um release formalmente.
   * Requer ao menos 2 aprovadores distintos para tipo não-hotfix.
   */
  static approveRelease(id: string, approver: string): ReleaseRecord {
    const record = releases.find((r) => r.id === id);
    if (!record) {
      throw new Error(`Release '${id}' não encontrado.`);
    }
    if (record.status !== "planejado") {
      throw new Error(
        `Release '${id}' não está em estado 'planejado' (status: ${record.status}).`,
      );
    }
    if (!record.approvals.includes(approver)) {
      record.approvals.push(approver);
    }

    const requiredApprovals = record.type === "hotfix" ? 1 : 2;
    if (record.approvals.length >= requiredApprovals) {
      record.status = "aprovado";
      logger.info("[CAB] Release aprovado pelo CAB", {
        id,
        version: record.version,
        approvals: record.approvals,
      });
    }
    return record;
  }

  /** Gera changelog executivo dos últimos N releases concluídos. */
  static getExecutiveChangelog(limit = 10): {
    version: string;
    date: string;
    title: string;
    entry: string;
  }[] {
    return releases
      .filter((r) => r.status === "concluido")
      .sort(
        (a, b) =>
          new Date(b.executedAt ?? b.createdAt).getTime() -
          new Date(a.executedAt ?? a.createdAt).getTime(),
      )
      .slice(0, limit)
      .map((r) => ({
        version: r.version,
        date: r.executedAt ?? r.scheduledAt ?? r.createdAt,
        title: r.title,
        entry: r.changelogEntry,
      }));
  }

  // ── 118: Change Management ────────────────────────────────────────────────

  /** Retorna todas as requisições de mudança. */
  static getChangeRequests(
    status?: ChangeStatus,
  ): ChangeRequest[] {
    const all = [...changeRequests].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return status ? all.filter((r) => r.status === status) : all;
  }

  /** Cria nova Requisição de Mudança (RDM). */
  static createChangeRequest(
    data: Omit<
      ChangeRequest,
      "id" | "status" | "approvers" | "approvedAt" | "createdAt"
    >,
  ): ChangeRequest {
    if (data.windowStartUtc && data.type !== "emergencial") {
      const frozen = isInFrozenWindow(data.windowStartUtc);
      if (frozen.frozen) {
        throw new Error(
          `RDM bloqueada por período de congelamento: ${frozen.reason}`,
        );
      }
    }

    const rdm: ChangeRequest = {
      ...data,
      id: generateId("rdm"),
      status: "pendente_aprovacao",
      approvers: [],
      approvedAt: null,
      createdAt: new Date().toISOString(),
    };

    changeRequests.push(rdm);
    logger.info("[CAB] Nova RDM criada", {
      id: rdm.id,
      title: rdm.title,
      priority: rdm.priority,
    });
    return rdm;
  }

  /** Aprova uma RDM. RDMs críticas exigem 2 aprovadores. */
  static approveChangeRequest(
    id: string,
    approver: string,
  ): ChangeRequest {
    const rdm = changeRequests.find((r) => r.id === id);
    if (!rdm) {
      throw new Error(`RDM '${id}' não encontrada.`);
    }
    if (rdm.status !== "pendente_aprovacao") {
      throw new Error(`RDM '${id}' não está pendente (status: ${rdm.status}).`);
    }

    if (!rdm.approvers.includes(approver)) {
      rdm.approvers.push(approver);
    }

    const requiredApprovers =
      rdm.priority === "critica" || rdm.type === "emergencial" ? 2 : 1;
    if (rdm.approvers.length >= requiredApprovers) {
      rdm.status = "aprovado";
      rdm.approvedAt = new Date().toISOString();
      logger.info("[CAB] RDM aprovada", { id, approvers: rdm.approvers });
    }
    return rdm;
  }

  /** Retorna períodos de congelamento configurados. */
  static getFrozenWindows(): typeof FROZEN_WINDOWS_UTC {
    return [...FROZEN_WINDOWS_UTC];
  }
}
