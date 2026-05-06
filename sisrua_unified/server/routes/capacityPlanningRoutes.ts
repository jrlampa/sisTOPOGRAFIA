/**
 * capacityPlanningRoutes.ts — Rotas de Gestão de Capacidade (Item 126 [T1]).
 *
 * GET  /api/capacidade/status      — status atual
 * GET  /api/capacidade/historico   — histórico de snapshots
 * POST /api/capacidade/snapshots   — registra novo snapshot
 * PUT  /api/capacidade/meta        — define meta de capacidade
 *
 * Auth: METRICS_TOKEN (Bearer)
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import {
  isBearerRequestAuthorized,
  setBearerChallenge,
} from "../utils/bearerAuth.js";
import {
  registrarSnapshot,
  listarHistorico,
  calcularMeta,
  statusCapacidade,
} from "../services/capacityPlanningService.js";

const router = Router();

function isAuthorized(req: Request): boolean {
  return isBearerRequestAuthorized(req, config.METRICS_TOKEN);
}

function unauthorized(res: Response): Response {
  setBearerChallenge(res, "capacidade");
  return res.status(401).json({ erro: "Não autorizado" });
}

const SnapshotSchema = z.object({
  timestamp: z.string().datetime(),
  jobsConcurrentes: z.number().int().min(0),
  latenciaMediaMs: z.number().min(0),
  memoriaUsadaMb: z.number().min(0),
  cpuPct: z.number().min(0).max(100),
  saturationScore: z.number().min(0).max(1),
});

const MetaSchema = z.object({
  maxJobsConcurrentes: z.number().int().positive(),
  latenciaAlvoMs: z.number().positive(),
});

router.get("/status", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  return res.json(statusCapacidade());
});

router.get("/historico", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  const hist = listarHistorico();
  return res.json({ total: hist.length, historico: hist });
});

router.post("/snapshots", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  const parsed = SnapshotSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ erro: "Corpo inválido", detalhes: parsed.error.issues });

  const snapshot = {
    ...parsed.data,
    timestamp: new Date(parsed.data.timestamp),
  };
  registrarSnapshot(snapshot);
  logger.info("[CapacityPlanningRoutes] Snapshot registrado", {
    jobsConcurrentes: snapshot.jobsConcurrentes,
  });
  return res.status(201).json(snapshot);
});

router.put("/meta", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  const parsed = MetaSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ erro: "Corpo inválido", detalhes: parsed.error.issues });

  const meta = calcularMeta(
    parsed.data.maxJobsConcurrentes,
    parsed.data.latenciaAlvoMs,
  );
  logger.info("[CapacityPlanningRoutes] Meta definida", {
    maxJobsConcurrentes: meta.maxJobsConcurrentes,
  });
  return res.json(meta);
});

export default router;
