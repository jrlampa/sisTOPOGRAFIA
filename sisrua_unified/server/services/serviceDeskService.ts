/**
 * serviceDeskService.ts — Service Desk L1/L2/L3 Industrial (113 [T1])
 *
 * Responsabilidades:
 * - Modelo de suporte com 3 níveis: L1 (triagem), L2 (engenharia), L3 (especialista).
 * - Fluxo de escalonamento automático baseado em SLA por nível e prioridade.
 * - Registro de tickets com histórico de eventos (auditável).
 */

import { logger } from "../utils/logger.js";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type SupportLevel = "L1" | "L2" | "L3";
export type TicketStatus =
  | "aberto"
  | "em_atendimento"
  | "escalado"
  | "pendente_cliente"
  | "resolvido"
  | "encerrado"
  | "cancelado";
export type TicketPriority = "critica" | "alta" | "media" | "baixa";
export type TicketCategory =
  | "exportacao_dxf"
  | "calculo_bt"
  | "autenticacao"
  | "desempenho"
  | "integracao"
  | "conformidade"
  | "outro";

export interface TicketEvent {
  timestamp: string;
  author: string;
  type: "criacao" | "comentario" | "escalonamento" | "resolucao" | "encerramento";
  message: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  level: SupportLevel;
  reporter: string;
  assignee: string | null;
  tenantId: string | null;
  slaDeadlineUtc: string;
  resolvedAt: string | null;
  closedAt: string | null;
  events: TicketEvent[];
  createdAt: string;
}

// ─── SLA por nível e prioridade (em minutos) ─────────────────────────────────

/**
 * Tempo máximo de resolução por nível e prioridade.
 * L1 → triagem; L2 → resolução técnica; L3 → especialista.
 */
const SLA_MATRIX_MIN: Record<SupportLevel, Record<TicketPriority, number>> = {
  L1: { critica: 30, alta: 60, media: 240, baixa: 1440 },
  L2: { critica: 120, alta: 480, media: 1440, baixa: 4320 },
  L3: { critica: 240, alta: 1440, media: 4320, baixa: 10080 },
};

/** Após quantos % do SLA sem atualização o ticket é auto-escalado. */
const AUTO_ESCALATION_THRESHOLD = 0.8;

// ─── Estado em memória ────────────────────────────────────────────────────────

const tickets: Ticket[] = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `tkt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function calcSlaDeadline(
  createdAt: string,
  level: SupportLevel,
  priority: TicketPriority,
): string {
  const slaMs = SLA_MATRIX_MIN[level][priority] * 60_000;
  return new Date(new Date(createdAt).getTime() + slaMs).toISOString();
}

function nextLevel(current: SupportLevel): SupportLevel | null {
  const map: Record<SupportLevel, SupportLevel | null> = {
    L1: "L2",
    L2: "L3",
    L3: null,
  };
  return map[current];
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class ServiceDeskService {
  /** Cria um novo ticket no nível L1 de triagem. */
  static createTicket(data: {
    title: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
    reporter: string;
    tenantId?: string;
  }): Ticket {
    const now = new Date().toISOString();
    const ticket: Ticket = {
      id: generateId(),
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      status: "aberto",
      level: "L1",
      reporter: data.reporter,
      assignee: null,
      tenantId: data.tenantId ?? null,
      slaDeadlineUtc: calcSlaDeadline(now, "L1", data.priority),
      resolvedAt: null,
      closedAt: null,
      events: [
        {
          timestamp: now,
          author: data.reporter,
          type: "criacao",
          message: `Ticket criado: ${data.title}`,
        },
      ],
      createdAt: now,
    };

    tickets.push(ticket);
    logger.info("[ServiceDesk] Ticket criado", {
      id: ticket.id,
      priority: ticket.priority,
      level: ticket.level,
    });
    return ticket;
  }

  /** Retorna tickets com filtros opcionais. */
  static getTickets(filters?: {
    status?: TicketStatus;
    level?: SupportLevel;
    priority?: TicketPriority;
    tenantId?: string;
  }): Ticket[] {
    let result = [...tickets];
    if (filters?.status) {
      result = result.filter((t) => t.status === filters.status);
    }
    if (filters?.level) {
      result = result.filter((t) => t.level === filters.level);
    }
    if (filters?.priority) {
      result = result.filter((t) => t.priority === filters.priority);
    }
    if (filters?.tenantId) {
      result = result.filter((t) => t.tenantId === filters.tenantId);
    }
    return result.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /** Retorna um ticket por ID. */
  static getTicketById(id: string): Ticket | null {
    return tickets.find((t) => t.id === id) ?? null;
  }

  /**
   * Adiciona comentário e atualiza status.
   * Permite status: em_atendimento, pendente_cliente, resolvido.
   */
  static addComment(
    id: string,
    author: string,
    message: string,
    newStatus?: TicketStatus,
  ): Ticket {
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket) throw new Error(`Ticket '${id}' não encontrado.`);
    if (ticket.status === "encerrado" || ticket.status === "cancelado") {
      throw new Error(`Ticket '${id}' está encerrado — não permite comentários.`);
    }

    const now = new Date().toISOString();
    ticket.events.push({
      timestamp: now,
      author,
      type: "comentario",
      message,
    });

    if (newStatus) {
      ticket.status = newStatus;
      if (newStatus === "resolvido") {
        ticket.resolvedAt = now;
      }
    } else if (ticket.status === "aberto") {
      ticket.status = "em_atendimento";
      ticket.assignee = author;
    }

    return ticket;
  }

  /**
   * Escalona o ticket manualmente para o próximo nível.
   * Recalcula o SLA com base no novo nível.
   */
  static escalateTicket(id: string, author: string, reason: string): Ticket {
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket) throw new Error(`Ticket '${id}' não encontrado.`);

    const next = nextLevel(ticket.level);
    if (!next) {
      throw new Error(
        `Ticket '${id}' já está no nível máximo (L3). Contate a equipe de produto.`,
      );
    }

    const now = new Date().toISOString();
    ticket.level = next;
    ticket.status = "escalado";
    ticket.slaDeadlineUtc = calcSlaDeadline(now, next, ticket.priority);
    ticket.events.push({
      timestamp: now,
      author,
      type: "escalonamento",
      message: `Escalado para ${next}: ${reason}`,
    });

    logger.info("[ServiceDesk] Ticket escalado", {
      id,
      novoNivel: next,
      priority: ticket.priority,
    });
    return ticket;
  }

  /** Encerra um ticket resolvido. */
  static closeTicket(id: string, author: string, resolution: string): Ticket {
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket) throw new Error(`Ticket '${id}' não encontrado.`);

    const now = new Date().toISOString();
    ticket.status = "encerrado";
    ticket.closedAt = now;
    if (!ticket.resolvedAt) ticket.resolvedAt = now;

    ticket.events.push({
      timestamp: now,
      author,
      type: "encerramento",
      message: resolution,
    });
    return ticket;
  }

  /**
   * Verifica tickets com SLA próximo de expirar e retorna alertas.
   * Tickets além do limite de AUTO_ESCALATION_THRESHOLD devem ser escalados.
   */
  static getSlaAlerts(): {
    ticketId: string;
    priority: TicketPriority;
    level: SupportLevel;
    slaDeadlineUtc: string;
    elapsedPct: number;
    shouldEscalate: boolean;
  }[] {
    const now = Date.now();
    return tickets
      .filter(
        (t) =>
          t.status !== "encerrado" &&
          t.status !== "cancelado" &&
          t.status !== "resolvido",
      )
      .map((t) => {
        const slaMs =
          SLA_MATRIX_MIN[t.level][t.priority] * 60_000;
        const createdMs = new Date(t.createdAt).getTime();
        const elapsedMs = now - createdMs;
        const elapsedPct = Math.min(elapsedMs / slaMs, 1);
        return {
          ticketId: t.id,
          priority: t.priority,
          level: t.level,
          slaDeadlineUtc: t.slaDeadlineUtc,
          elapsedPct: Math.round(elapsedPct * 100) / 100,
          shouldEscalate: elapsedPct >= AUTO_ESCALATION_THRESHOLD,
        };
      })
      .filter((a) => a.elapsedPct >= 0.5);
  }

  /** Resumo de métricas do service desk. */
  static getMetrics(): {
    total: number;
    abertos: number;
    emAtendimento: number;
    escalados: number;
    resolvidos: number;
    encerrados: number;
    violacoesSla: number;
    porNivel: Record<SupportLevel, number>;
    porPrioridade: Record<TicketPriority, number>;
  } {
    const now = new Date();
    const violacoes = tickets.filter(
      (t) =>
        t.status !== "encerrado" &&
        t.status !== "cancelado" &&
        new Date(t.slaDeadlineUtc) < now,
    ).length;

    const porNivel: Record<SupportLevel, number> = { L1: 0, L2: 0, L3: 0 };
    const porPrioridade: Record<TicketPriority, number> = {
      critica: 0,
      alta: 0,
      media: 0,
      baixa: 0,
    };
    for (const t of tickets) {
      porNivel[t.level]++;
      porPrioridade[t.priority]++;
    }

    return {
      total: tickets.length,
      abertos: tickets.filter((t) => t.status === "aberto").length,
      emAtendimento: tickets.filter((t) => t.status === "em_atendimento").length,
      escalados: tickets.filter((t) => t.status === "escalado").length,
      resolvidos: tickets.filter((t) => t.status === "resolvido").length,
      encerrados: tickets.filter((t) => t.status === "encerrado").length,
      violacoesSla: violacoes,
      porNivel,
      porPrioridade,
    };
  }
}
