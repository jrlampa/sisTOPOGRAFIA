/**
 * holdingRoutes.ts — Rotas de Modelo Multiempresa & Holding (Item 129 [T1]).
 *
 * GET  /api/holdings                         — lista holdings
 * POST /api/holdings                         — cria holding
 * POST /api/holdings/:holdingId/tenants      — associa tenant
 * GET  /api/holdings/:holdingId/tenants      — lista tenants da holding
 * GET  /api/holdings/:holdingId/auditoria    — auditoria cruzada
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
  criarHolding,
  associarTenant,
  listarTenantsDaHolding,
  auditoriaCruzada,
  listarHoldings,
  TenantHolding,
} from "../services/holdingService.js";

const router = Router();
const PAPEIS: TenantHolding["papel"][] = [
  "principal",
  "subsidiaria",
  "empreiteira",
];

function isAuthorized(req: Request): boolean {
  return isBearerRequestAuthorized(req, config.METRICS_TOKEN);
}

function unauthorized(res: Response): Response {
  setBearerChallenge(res, "holdings");
  return res.status(401).json({ erro: "Não autorizado" });
}

const HoldingSchema = z.object({
  nome: z.string().min(1).max(256),
  slug: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9-]+$/),
});

const AssociarSchema = z.object({
  tenantId: z.string().min(1).max(128),
  papel: z.enum(
    PAPEIS as [TenantHolding["papel"], ...TenantHolding["papel"][]],
  ),
});

router.get("/", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  const lista = listarHoldings();
  return res.json({ total: lista.length, holdings: lista });
});

router.post("/", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  const parsed = HoldingSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ erro: "Corpo inválido", detalhes: parsed.error.issues });

  const holding = criarHolding(parsed.data.nome, parsed.data.slug);
  logger.info("[HoldingRoutes] Holding criada", {
    id: holding.id,
    nome: holding.nome,
  });
  return res.status(201).json(holding);
});

router.post("/:holdingId/tenants", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  const parsed = AssociarSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ erro: "Corpo inválido", detalhes: parsed.error.issues });

  const th = associarTenant(
    parsed.data.tenantId,
    req.params.holdingId,
    parsed.data.papel,
  );
  logger.info("[HoldingRoutes] Tenant associado", {
    tenantId: th.tenantId,
    holdingId: th.holdingId,
  });
  return res.status(201).json(th);
});

router.get("/:holdingId/tenants", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  const tenants = listarTenantsDaHolding(req.params.holdingId);
  return res.json({
    holdingId: req.params.holdingId,
    total: tenants.length,
    tenants,
  });
});

router.get("/:holdingId/auditoria", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  const auditoria = auditoriaCruzada(req.params.holdingId);
  return res.json(auditoria);
});

export default router;
