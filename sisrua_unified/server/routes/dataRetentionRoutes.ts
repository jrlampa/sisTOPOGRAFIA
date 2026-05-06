/**
 * dataRetentionRoutes.ts — Rotas de Configuração de Retenção de Dados (Item 37 [T1]).
 *
 * GET  /api/retencao/politicas                — lista todas as políticas
 * GET  /api/retencao/politicas/:resourceType  — obtém política específica
 * POST /api/retencao/politicas                — cria/atualiza política
 * POST /api/retencao/avaliar                  — avalia itens contra política
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
  registerPolicy,
  getPolicy,
  evaluateRetention,
  RetentionPolicy,
} from "../services/dataRetentionService.js";

const router = Router();

// Local registry para listagem (getPolicy only works per resourceType)
const policyRegistry = new Map<string, RetentionPolicy>();

function isAuthorized(req: Request): boolean {
  return isBearerRequestAuthorized(req, config.METRICS_TOKEN);
}

function unauthorized(res: Response): Response {
  setBearerChallenge(res, "retencao");
  return res.status(401).json({ erro: "Não autorizado" });
}

const PolicySchema = z.object({
  id: z.string().min(1).max(128),
  resourceType: z.string().min(1).max(128),
  maxAgeDays: z.number().int().positive(),
  maxCount: z.number().int().positive().optional(),
  archiveOnExpiry: z.boolean(),
  enabled: z.boolean(),
});

const AvaliarSchema = z.object({
  resourceType: z.string().min(1).max(128),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        createdAt: z.string().datetime(),
      }),
    )
    .min(1),
});

// GET /api/retencao/politicas
router.get("/politicas", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  return res.json({ politicas: Array.from(policyRegistry.values()) });
});

// GET /api/retencao/politicas/:resourceType
router.get("/politicas/:resourceType", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  const { resourceType } = req.params;
  const policy = getPolicy(resourceType);
  if (!policy) return res.status(404).json({ erro: "Política não encontrada" });
  return res.json(policy);
});

// POST /api/retencao/politicas
router.post("/politicas", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  const parsed = PolicySchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ erro: "Corpo inválido", detalhes: parsed.error.issues });

  const policy = parsed.data as RetentionPolicy;
  registerPolicy(policy);
  policyRegistry.set(policy.resourceType, policy);

  logger.info("[DataRetentionRoutes] Política registrada", {
    resourceType: policy.resourceType,
  });
  return res.status(201).json(policy);
});

// POST /api/retencao/avaliar
router.post("/avaliar", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  const parsed = AvaliarSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ erro: "Corpo inválido", detalhes: parsed.error.issues });

  const { resourceType, items } = parsed.data;
  const itemsWithDates = items.map((i) => ({
    id: i.id,
    createdAt: new Date(i.createdAt),
  }));
  const result = evaluateRetention(resourceType, itemsWithDates);
  return res.json({ resourceType, ...result });
});

export default router;
