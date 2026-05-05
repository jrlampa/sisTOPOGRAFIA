/**
 * chaosRoutes.ts — Plataforma de Chaos Engineering (T2.19)
 *
 * Endpoints:
 *   POST   /api/chaos/experiments           — criar experimento
 *   GET    /api/chaos/experiments           — listar experimentos
 *   GET    /api/chaos/experiments/:id       — buscar experimento
 *   POST   /api/chaos/experiments/:id/run  — executar experimento
 *   POST   /api/chaos/experiments/:id/cancel — cancelar experimento
 *   GET    /api/chaos/results/:id           — resultado de execução
 *   GET    /api/chaos/report               — relatório de resiliência
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { logger } from "../utils/logger.js";
import {
  createChaosExperiment,
  listChaosExperiments,
  getChaosExperiment,
  runChaosExperiment,
  cancelChaosExperiment,
  getChaosResult,
  getChaosResilienceReport,
} from "../services/chaosEngineeringService.js";

const router = Router();

// ─── Schemas Zod ──────────────────────────────────────────────────────────────

const targetTypeSchema = z.enum([
  "api_endpoint",
  "database",
  "external_service",
  "worker_python",
  "cache",
  "queue",
]);

const faultConfigSchema = z.discriminatedUnion("faultType", [
  z.object({
    faultType: z.literal("latency"),
    delayMs: z.number().int().min(1).max(30_000),
    jitterMs: z.number().int().min(0).optional(),
    affectedPercent: z.number().min(0).max(100).optional(),
  }),
  z.object({
    faultType: z.literal("error_rate"),
    errorPercent: z.number().min(0).max(100),
    statusCode: z.number().int().min(400).max(599).optional(),
  }),
  z.object({
    faultType: z.literal("resource_exhaustion"),
    resource: z.enum(["memory", "cpu", "file_descriptors"]),
    consumePercent: z.number().min(1).max(100),
  }),
  z.object({
    faultType: z.literal("network_partition"),
    targetServices: z.array(z.string().min(1)).min(1),
    packetLossPercent: z.number().min(0).max(100).optional(),
  }),
  z.object({
    faultType: z.literal("payload_corruption"),
    targetField: z.string().min(1),
    corruptionType: z.enum(["null", "wrong_type", "oversized", "missing"]),
  }),
  z.object({
    faultType: z.literal("timeout"),
    timeoutMs: z.number().int().min(100).max(120_000),
  }),
]);

const createExperimentSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().default(""),
  targetType: targetTypeSchema,
  targetId: z.string().min(1).max(200),
  faultConfig: faultConfigSchema,
  durationSeconds: z.number().int().min(5).max(3_600),
  sloThresholdPercent: z.number().min(0).max(100).optional(),
  createdBy: z.string().min(1).max(100),
  scheduledAt: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
});

// ─── Rotas ────────────────────────────────────────────────────────────────────

/** POST /api/chaos/experiments — criar experimento */
router.post("/experiments", (req: Request, res: Response): void => {
  const parsed = createExperimentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Payload inválido", details: parsed.error.format() });
    return;
  }

  const experiment = createChaosExperiment(parsed.data);
  logger.info(`[chaos] Experimento criado: ${experiment.id} (${experiment.name})`);
  res.status(201).json(experiment);
});

/** GET /api/chaos/experiments — listar experimentos */
router.get("/experiments", (req: Request, res: Response): void => {
  const statusRaw = req.query["status"] as string | undefined;
  const targetTypeRaw = req.query["targetType"] as string | undefined;
  const tagRaw = req.query["tag"] as string | undefined;

  const experiments = listChaosExperiments({
    status: statusRaw as Parameters<typeof listChaosExperiments>[0]["status"],
    targetType: targetTypeRaw as Parameters<typeof listChaosExperiments>[0]["targetType"],
    tag: tagRaw,
  });
  res.json(experiments);
});

/** GET /api/chaos/experiments/:id — buscar experimento */
router.get("/experiments/:id", (req: Request, res: Response): void => {
  const experiment = getChaosExperiment(req.params["id"] ?? "");
  if (!experiment) {
    res.status(404).json({ error: "Experimento não encontrado" });
    return;
  }
  res.json(experiment);
});

/** POST /api/chaos/experiments/:id/run — executar experimento */
router.post("/experiments/:id/run", (req: Request, res: Response): void => {
  const id = req.params["id"] ?? "";
  const experiment = getChaosExperiment(id);
  if (!experiment) {
    res.status(404).json({ error: "Experimento não encontrado" });
    return;
  }
  if (experiment.status === "running") {
    res.status(409).json({ error: "Experimento já em execução" });
    return;
  }

  logger.info(`[chaos] Iniciando execução: ${id}`);
  const result = runChaosExperiment(id);
  if (!result) {
    res.status(500).json({ error: "Falha ao executar experimento" });
    return;
  }

  res.json({ experiment: getChaosExperiment(id), result });
});

/** POST /api/chaos/experiments/:id/cancel — cancelar experimento */
router.post("/experiments/:id/cancel", (req: Request, res: Response): void => {
  const id = req.params["id"] ?? "";
  const cancelled = cancelChaosExperiment(id);
  if (!cancelled) {
    res.status(409).json({ error: "Não foi possível cancelar (estado inválido ou não encontrado)" });
    return;
  }
  logger.info(`[chaos] Experimento cancelado: ${id}`);
  res.json({ message: "Experimento cancelado com sucesso" });
});

/** GET /api/chaos/results/:id — resultado de execução */
router.get("/results/:id", (req: Request, res: Response): void => {
  const result = getChaosResult(req.params["id"] ?? "");
  if (!result) {
    res.status(404).json({ error: "Resultado não encontrado" });
    return;
  }
  res.json(result);
});

/** GET /api/chaos/report — relatório de resiliência */
router.get("/report", (_req: Request, res: Response): void => {
  const report = getChaosResilienceReport();
  res.json(report);
});

export default router;
