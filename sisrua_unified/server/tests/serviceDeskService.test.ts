import { beforeEach, describe, expect, it } from "vitest";
import {
  ServiceDeskService,
  clearServiceDeskState,
} from "../services/serviceDeskService";

describe("ServiceDeskService", () => {
  beforeEach(() => {
    clearServiceDeskState();
  });

  it("cria ticket L1 e recupera por id", () => {
    const t = ServiceDeskService.createTicket({
      title: "Erro DXF",
      description: "Falha na exportacao",
      category: "exportacao_dxf",
      priority: "alta",
      reporter: "user-a",
      tenantId: "tenant-1",
    });

    expect(t.level).toBe("L1");
    expect(t.status).toBe("aberto");
    expect(ServiceDeskService.getTicketById(t.id)?.id).toBe(t.id);
  });

  it("adiciona comentario e muda para em_atendimento por padrao", () => {
    const t = ServiceDeskService.createTicket({
      title: "Erro auth",
      description: "401",
      category: "autenticacao",
      priority: "media",
      reporter: "user-a",
    });

    const updated = ServiceDeskService.addComment(t.id, "analista-l1", "investigando");
    expect(updated.status).toBe("em_atendimento");
    expect(updated.assignee).toBe("analista-l1");
    expect(updated.events.at(-1)?.type).toBe("comentario");
  });

  it("marca resolvido quando status informado no comentario", () => {
    const t = ServiceDeskService.createTicket({
      title: "Falha API",
      description: "timeout",
      category: "integracao",
      priority: "alta",
      reporter: "user-a",
    });

    const resolved = ServiceDeskService.addComment(
      t.id,
      "analista-l2",
      "resolvido",
      "resolvido",
    );

    expect(resolved.status).toBe("resolvido");
    expect(resolved.resolvedAt).toBeTruthy();
  });

  it("escalona L1->L2->L3 e bloqueia alem de L3", () => {
    const t = ServiceDeskService.createTicket({
      title: "Critico",
      description: "indisponivel",
      category: "desempenho",
      priority: "critica",
      reporter: "user-a",
    });

    const l2 = ServiceDeskService.escalateTicket(t.id, "l1", "precisa engenharia");
    expect(l2.level).toBe("L2");

    const l3 = ServiceDeskService.escalateTicket(t.id, "l2", "precisa especialista");
    expect(l3.level).toBe("L3");

    expect(() =>
      ServiceDeskService.escalateTicket(t.id, "l3", "sem proximo"),
    ).toThrow("nível máximo");
  });

  it("fecha ticket e impede comentario apos encerramento", () => {
    const t = ServiceDeskService.createTicket({
      title: "Ajuste",
      description: "ok",
      category: "outro",
      priority: "baixa",
      reporter: "user-a",
    });

    const closed = ServiceDeskService.closeTicket(t.id, "analista", "encerrado");
    expect(closed.status).toBe("encerrado");
    expect(closed.closedAt).toBeTruthy();
    expect(closed.resolvedAt).toBeTruthy();

    expect(() =>
      ServiceDeskService.addComment(t.id, "analista", "novo comentario"),
    ).toThrow("não permite comentários");
  });

  it("calcula alertas e metricas com filtros", () => {
    const old = ServiceDeskService.createTicket({
      title: "SLA estourando",
      description: "demora",
      category: "desempenho",
      priority: "critica",
      reporter: "user-a",
      tenantId: "tenant-a",
    });

    const oldRef = ServiceDeskService.getTicketById(old.id);
    expect(oldRef).not.toBeNull();
    oldRef!.createdAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    oldRef!.slaDeadlineUtc = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const newer = ServiceDeskService.createTicket({
      title: "Novo",
      description: "novo",
      category: "integracao",
      priority: "media",
      reporter: "user-b",
      tenantId: "tenant-b",
    });

    const filtered = ServiceDeskService.getTickets({ tenantId: "tenant-a" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(old.id);

    const alerts = ServiceDeskService.getSlaAlerts();
    expect(alerts.some((a) => a.ticketId === old.id && a.shouldEscalate)).toBe(true);

    ServiceDeskService.addComment(newer.id, "l1", "atendimento", "em_atendimento");
    ServiceDeskService.closeTicket(newer.id, "l1", "ok");

    const metrics = ServiceDeskService.getMetrics();
    expect(metrics.total).toBe(2);
    expect(metrics.violacoesSla).toBeGreaterThanOrEqual(1);
    expect(metrics.encerrados).toBe(1);
  });
});
