/**
 * predictiveObservabilityRoutes.test.ts — Observabilidade Preditiva (18 [T1])
 */

import request from "supertest";
import app from "../app.js";

describe("Predictive Observability Routes (18)", () => {
  describe("GET /api/predictive-observability/metrics", () => {
    it("deve retornar catálogo de métricas suportadas", async () => {
      const res = await request(app).get("/api/predictive-observability/metrics");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.supportedMetrics)).toBe(true);
      expect(res.body.supportedMetrics).toContain("api_latency_ms");
      expect(res.body.supportedMetrics).toContain("error_rate_pct");
    });
  });

  describe("POST /api/predictive-observability/metrics", () => {
    it("deve ingerir métrica válida", async () => {
      const res = await request(app).post("/api/predictive-observability/metrics").send({
        metric: "api_latency_ms",
        value: 350,
        source: "jest",
      });
      expect(res.status).toBe(201);
      expect(res.body.value).toBe(350);
      expect(res.body.source).toBe("jest");
      expect(res.body).toHaveProperty("ts");
    });

    it("deve retornar 400 para payload inválido", async () => {
      const res = await request(app)
        .post("/api/predictive-observability/metrics")
        .send({ metric: "invalida", value: "x" });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/predictive-observability/metrics/:metric/series", () => {
    it("deve retornar série temporal da métrica", async () => {
      await request(app).post("/api/predictive-observability/metrics").send({
        metric: "queue_depth",
        value: 12,
      });
      await request(app).post("/api/predictive-observability/metrics").send({
        metric: "queue_depth",
        value: 14,
      });

      const res = await request(app).get(
        "/api/predictive-observability/metrics/queue_depth/series?limit=2",
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it("deve retornar 400 para métrica inválida", async () => {
      const res = await request(app).get(
        "/api/predictive-observability/metrics/nao_existe/series",
      );
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/predictive-observability/metrics/:metric/stats", () => {
    it("deve retornar estatísticas com p95 e p99", async () => {
      for (let i = 1; i <= 20; i++) {
        await request(app).post("/api/predictive-observability/metrics").send({
          metric: "bt_calculation_seconds",
          value: i,
        });
      }

      const res = await request(app).get(
        "/api/predictive-observability/metrics/bt_calculation_seconds/stats?windowMinutes=1440",
      );
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("p95");
      expect(res.body).toHaveProperty("p99");
      expect(res.body.samples).toBeGreaterThanOrEqual(20);
    });
  });

  describe("GET /api/predictive-observability/metrics/:metric/anomalies", () => {
    it("deve detectar anomalias por z-score", async () => {
      // baseline estável
      for (let i = 0; i < 40; i++) {
        await request(app).post("/api/predictive-observability/metrics").send({
          metric: "api_latency_ms",
          value: 200 + (i % 5),
        });
      }
      // outlier
      await request(app).post("/api/predictive-observability/metrics").send({
        metric: "api_latency_ms",
        value: 6000,
      });

      const res = await request(app).get(
        "/api/predictive-observability/metrics/api_latency_ms/anomalies?windowMinutes=1440&zThreshold=2.5",
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty("zScore");
      expect(res.body[0]).toHaveProperty("severity");
    });
  });

  describe("GET /api/predictive-observability/metrics/:metric/signal", () => {
    it("deve retornar sinal preditivo com tendência e risco", async () => {
      const now = Date.now();
      // Gera série ascendente com timestamps previsíveis
      for (let i = 0; i < 20; i++) {
        await request(app).post("/api/predictive-observability/metrics").send({
          metric: "error_rate_pct",
          value: 0.5 + i * 0.2,
          ts: new Date(now - (20 - i) * 60 * 1000).toISOString(),
        });
      }

      const res = await request(app).get(
        "/api/predictive-observability/metrics/error_rate_pct/signal?windowMinutes=360",
      );
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("trend");
      expect(res.body).toHaveProperty("projected1h");
      expect(res.body).toHaveProperty("projected6h");
      expect(res.body).toHaveProperty("risk");
      expect(["baixo", "medio", "alto"]).toContain(res.body.risk);
    });
  });

  describe("GET /api/predictive-observability/overview", () => {
    it("deve retornar visão consolidada de observabilidade", async () => {
      const res = await request(app).get("/api/predictive-observability/overview");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("metricsTracked");
      expect(res.body).toHaveProperty("totalSamples");
      expect(res.body).toHaveProperty("anomaliesLast24h");
      expect(Array.isArray(res.body.byMetric)).toBe(true);
      expect(res.body.byMetric.length).toBeGreaterThanOrEqual(5);
      expect(res.body.byMetric[0]).toHaveProperty("stats");
      expect(res.body.byMetric[0]).toHaveProperty("signal");
    });
  });
});
