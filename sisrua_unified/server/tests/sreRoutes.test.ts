/**
 * sreRoutes.test.ts — Testes para Rotas SRE/SLO/Runbooks (Item 17 [T1]).
 */
import request from "supertest";
import express from "express";
import sreRoutes from "../routes/sreRoutes";
import * as sloService from "../services/sloService";

jest.mock("../services/sloService", () => ({
  getSLOStatus: jest.fn(),
  getAllSLOStatuses: jest.fn(),
  getAlertingSLOs: jest.fn(),
  recordObservation: jest.fn(),
  registerSLO: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use("/api/sre", sreRoutes);

const mockStatus = {
  sloId: "dxf_export_availability",
  currentCompliance: 0.999,
  errorBudgetRemaining: 0.9,
  onTrack: true,
  alerting: false,
  observationCount: 100,
};

describe("GET /api/sre/slos", () => {
  it("retorna lista de SLOs com totais", async () => {
    (sloService.getAllSLOStatuses as jest.Mock).mockReturnValue([mockStatus]);
    const res = await request(app).get("/api/sre/slos");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("total", 1);
    expect(res.body).toHaveProperty("alertando", 0);
    expect(res.body.slos).toHaveLength(1);
    expect(res.body.slos[0].sloId).toBe("dxf_export_availability");
  });

  it("conta corretamente SLOs alertando", async () => {
    const alerting = { ...mockStatus, alerting: true };
    (sloService.getAllSLOStatuses as jest.Mock).mockReturnValue([
      mockStatus,
      alerting,
    ]);
    const res = await request(app).get("/api/sre/slos");
    expect(res.status).toBe(200);
    expect(res.body.alertando).toBe(1);
  });
});

describe("GET /api/sre/slos/:sloId", () => {
  it("retorna status de SLO existente", async () => {
    (sloService.getSLOStatus as jest.Mock).mockReturnValue(mockStatus);
    const res = await request(app).get("/api/sre/slos/dxf_export_availability");
    expect(res.status).toBe(200);
    expect(res.body.sloId).toBe("dxf_export_availability");
    expect(res.body.onTrack).toBe(true);
  });

  it("retorna 404 para SLO inexistente", async () => {
    (sloService.getSLOStatus as jest.Mock).mockReturnValue(null);
    const res = await request(app).get("/api/sre/slos/inexistente");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("erro");
  });
});

describe("POST /api/sre/slos/:sloId/observacoes", () => {
  it("registra observação met=true com sucesso", async () => {
    (sloService.getSLOStatus as jest.Mock)
      .mockReturnValueOnce(mockStatus)
      .mockReturnValueOnce({ ...mockStatus, observationCount: 101 });
    const res = await request(app)
      .post("/api/sre/slos/dxf_export_availability/observacoes")
      .send({ met: true });
    expect(res.status).toBe(201);
    expect(res.body.observacaoRegistrada).toBe(true);
    expect(sloService.recordObservation).toHaveBeenCalledWith(
      "dxf_export_availability",
      true,
      expect.any(Date),
    );
  });

  it("registra observação met=false", async () => {
    (sloService.getSLOStatus as jest.Mock).mockReturnValue(mockStatus);
    const res = await request(app)
      .post("/api/sre/slos/dxf_export_availability/observacoes")
      .send({ met: false, timestamp: "2026-04-20T10:00:00.000Z" });
    expect(res.status).toBe(201);
    expect(sloService.recordObservation).toHaveBeenCalledWith(
      "dxf_export_availability",
      false,
      expect.any(Date),
    );
  });

  it("rejeita body inválido (met não é boolean)", async () => {
    const res = await request(app)
      .post("/api/sre/slos/dxf_export_availability/observacoes")
      .send({ met: "sim" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("erro");
  });

  it("retorna 404 para SLO inexistente", async () => {
    (sloService.getSLOStatus as jest.Mock).mockReturnValue(null);
    const res = await request(app)
      .post("/api/sre/slos/inexistente/observacoes")
      .send({ met: true });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/sre/slos", () => {
  it("registra novo SLO válido", async () => {
    const novaSlo = {
      id: "api_latency_p95",
      name: "API Latency P95",
      description: "P95 latency of all API endpoints",
      indicator: "latency",
      target: 0.95,
      windowDays: 7,
      alertThreshold: 0.9,
    };
    const res = await request(app).post("/api/sre/slos").send(novaSlo);
    expect(res.status).toBe(201);
    expect(res.body.registrado).toBe(true);
    expect(sloService.registerSLO).toHaveBeenCalledWith(novaSlo);
  });

  it("rejeita SLO com indicator inválido", async () => {
    const res = await request(app).post("/api/sre/slos").send({
      id: "test",
      name: "Test",
      description: "Test SLO",
      indicator: "invalido",
      target: 0.99,
      windowDays: 30,
      alertThreshold: 0.95,
    });
    expect(res.status).toBe(400);
  });

  it("rejeita SLO com target > 1", async () => {
    const res = await request(app).post("/api/sre/slos").send({
      id: "test",
      name: "Test",
      description: "desc",
      indicator: "availability",
      target: 1.5,
      windowDays: 30,
      alertThreshold: 0.95,
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/sre/alertas", () => {
  it("retorna lista de SLOs alertando", async () => {
    const alerting = { ...mockStatus, alerting: true };
    (sloService.getAlertingSLOs as jest.Mock).mockReturnValue([alerting]);
    const res = await request(app).get("/api/sre/alertas");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.alertas[0].alerting).toBe(true);
    expect(res.body).toHaveProperty("timestamp");
  });

  it("retorna lista vazia quando nenhum SLO alerta", async () => {
    (sloService.getAlertingSLOs as jest.Mock).mockReturnValue([]);
    const res = await request(app).get("/api/sre/alertas");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });
});

describe("GET /api/sre/runbooks", () => {
  it("retorna catálogo resumido de runbooks", async () => {
    const res = await request(app).get("/api/sre/runbooks");
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(5);
    expect(Array.isArray(res.body.runbooks)).toBe(true);
    const rb = res.body.runbooks[0];
    expect(rb).toHaveProperty("id");
    expect(rb).toHaveProperty("titulo");
    expect(rb).toHaveProperty("severidade");
    expect(rb).not.toHaveProperty("passos"); // resumo não inclui passos
  });
});

describe("GET /api/sre/runbooks/:id", () => {
  it("retorna runbook completo com passos", async () => {
    const res = await request(app).get("/api/sre/runbooks/RB-001");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("RB-001");
    expect(Array.isArray(res.body.passos)).toBe(true);
    expect(res.body.passos.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty("escalacao");
    expect(res.body).toHaveProperty("tempoResolucaoAlvoMin");
  });

  it("retorna 404 para runbook inexistente", async () => {
    const res = await request(app).get("/api/sre/runbooks/RB-999");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("erro");
  });

  it("cobre todos os runbooks cadastrados", async () => {
    const lista = await request(app).get("/api/sre/runbooks");
    for (const rb of lista.body.runbooks) {
      const detalhe = await request(app).get(`/api/sre/runbooks/${rb.id}`);
      expect(detalhe.status).toBe(200);
    }
  });
});
