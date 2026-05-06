/**
 * featureFlagRoutes.ts — Rotas de gerenciamento de feature flags por tenant.
 *
 * Roadmap Item 21 [T2]: Feature Flags por Tenant.
 * Permite controle granular de funcionalidades e estágios de roll-out por cliente.
 *
 * Autenticação:
 *   - Operações de escrita (PUT, DELETE) exigem Bearer token via METRICS_TOKEN.
 *   - Leitura (GET) por tenantId é pública (sem token), pois retorna apenas
 *     informação operacional sem impacto de segurança.
 *   - Listagem de todos os tenants exige token de admin.
 *
 * Endpoints:
 *   GET    /api/feature-flags              — lista tenants configurados (admin)
 *   GET    /api/feature-flags/:tenantId    — overrides do tenant
 *   PUT    /api/feature-flags/:tenantId    — define/atualiza overrides (admin)
 *   DELETE /api/feature-flags/:tenantId    — remove overrides do tenant (admin)
 *   DELETE /api/feature-flags/:tenantId/:flag — remove override de flag específico (admin)
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
  setTenantFlagOverrides,
  getTenantFlagOverrides,
  clearTenantFlagOverrides,
  listConfiguredTenants,
  removeTenantFlag,
} from "../services/tenantFeatureFlagService.js";

const router = Router();

// ─── Auth helper ──────────────────────────────────────────────────────────────

function isAdminAuthorized(req: Request): boolean {
  return isBearerRequestAuthorized(req, config.METRICS_TOKEN);
}

// ─── Validação ────────────────────────────────────────────────────────────────

const TenantIdParamSchema = z.object({
  tenantId: z
    .string()
    .min(1)
    .max(128)
    .regex(
      /^[\w.@-]+$/,
      "tenantId deve conter apenas letras, números, hífens, underscores, pontos ou @",
    )
    .refine((v) => !v.includes(".."), {
      message: "tenantId não pode conter sequências de pontos consecutivos",
    }),
});

const FlagNameParamSchema = z.object({
  flag: z
    .string()
    .min(1)
    .max(128)
    .regex(
      /^[\w_]+$/,
      "nome de flag deve conter apenas letras, números e underscores",
    ),
});

const FlagMapBodySchema = z
  .record(z.string(), z.boolean())
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "Corpo deve conter ao menos um par chave:boolean",
  });

// ─── GET /api/feature-flags — lista tenants (admin) ──────────────────────────

/**
 * @swagger
 * /api/feature-flags:
 *   get:
 *     summary: Lista tenants com feature flags configurados
 *     tags: [Feature Flags]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de tenantIds configurados
 *       401:
 *         description: Token de administração ausente ou inválido
 */
router.get("/", (req: Request, res: Response) => {
  if (!isAdminAuthorized(req)) {
    setBearerChallenge(res, "feature-flags-admin");
    return res.status(401).json({ erro: "Não autorizado" });
  }

  const tenants = listConfiguredTenants();
  logger.info("[FeatureFlagRoutes] Listagem de tenants", {
    count: tenants.length,
  });
  return res.json({ tenants });
});

// ─── GET /api/feature-flags/:tenantId — overrides do tenant ──────────────────

/**
 * @swagger
 * /api/feature-flags/{tenantId}:
 *   get:
 *     summary: Retorna os overrides de feature flags para um tenant
 *     tags: [Feature Flags]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Mapa de feature flags do tenant
 *       400:
 *         description: tenantId inválido
 */
router.get("/:tenantId", (req: Request, res: Response) => {
  const parsed = TenantIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({
      erro: "tenantId inválido",
      detalhes: parsed.error.issues,
    });
  }

  const { tenantId } = parsed.data;
  const flags = getTenantFlagOverrides(tenantId);
  return res.json({ tenantId, flags });
});

// ─── PUT /api/feature-flags/:tenantId — definir overrides (admin) ─────────────

/**
 * @swagger
 * /api/feature-flags/{tenantId}:
 *   put:
 *     summary: Define ou atualiza overrides de feature flags para um tenant
 *     tags: [Feature Flags]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties:
 *               type: boolean
 *     responses:
 *       200:
 *         description: Overrides aplicados com sucesso
 *       400:
 *         description: Corpo ou parâmetro inválido
 *       401:
 *         description: Token de administração ausente ou inválido
 */
router.put("/:tenantId", (req: Request, res: Response) => {
  if (!isAdminAuthorized(req)) {
    setBearerChallenge(res, "feature-flags-admin");
    return res.status(401).json({ erro: "Não autorizado" });
  }

  const paramParsed = TenantIdParamSchema.safeParse(req.params);
  if (!paramParsed.success) {
    return res.status(400).json({
      erro: "tenantId inválido",
      detalhes: paramParsed.error.issues,
    });
  }

  const bodyParsed = FlagMapBodySchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json({
      erro: "Corpo inválido — esperado objeto com chaves de feature e valores booleanos",
      detalhes: bodyParsed.error.issues,
    });
  }

  const { tenantId } = paramParsed.data;
  const flags = bodyParsed.data;

  setTenantFlagOverrides(tenantId, flags);

  logger.info("[FeatureFlagRoutes] Overrides de tenant atualizados", {
    tenantId,
    flagCount: Object.keys(flags).length,
    flags,
  });

  return res.json({
    tenantId,
    flags: getTenantFlagOverrides(tenantId),
    mensagem: "Overrides aplicados com sucesso",
  });
});

// ─── DELETE /api/feature-flags/:tenantId/:flag — remove flag específico (admin)

/**
 * @swagger
 * /api/feature-flags/{tenantId}/{flag}:
 *   delete:
 *     summary: Remove o override de um feature flag específico do tenant
 *     tags: [Feature Flags]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *       - in: path
 *         name: flag
 *         required: true
 *     responses:
 *       200:
 *         description: Override removido com sucesso
 *       400:
 *         description: Parâmetro inválido
 *       401:
 *         description: Token de administração ausente ou inválido
 */
router.delete("/:tenantId/:flag", (req: Request, res: Response) => {
  if (!isAdminAuthorized(req)) {
    setBearerChallenge(res, "feature-flags-admin");
    return res.status(401).json({ erro: "Não autorizado" });
  }

  const paramParsed = TenantIdParamSchema.merge(FlagNameParamSchema).safeParse(
    req.params,
  );
  if (!paramParsed.success) {
    return res.status(400).json({
      erro: "Parâmetros inválidos",
      detalhes: paramParsed.error.issues,
    });
  }

  const { tenantId, flag } = paramParsed.data;
  removeTenantFlag(tenantId, flag);

  logger.info("[FeatureFlagRoutes] Override de flag removido", {
    tenantId,
    flag,
  });

  return res.json({
    tenantId,
    flag,
    mensagem: "Override removido com sucesso",
  });
});

// ─── DELETE /api/feature-flags/:tenantId — remove todos os overrides (admin) ──

/**
 * @swagger
 * /api/feature-flags/{tenantId}:
 *   delete:
 *     summary: Remove todos os overrides de feature flags de um tenant
 *     tags: [Feature Flags]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *     responses:
 *       200:
 *         description: Overrides removidos com sucesso
 *       400:
 *         description: tenantId inválido
 *       401:
 *         description: Token de administração ausente ou inválido
 */
router.delete("/:tenantId", (req: Request, res: Response) => {
  if (!isAdminAuthorized(req)) {
    setBearerChallenge(res, "feature-flags-admin");
    return res.status(401).json({ erro: "Não autorizado" });
  }

  const parsed = TenantIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({
      erro: "tenantId inválido",
      detalhes: parsed.error.issues,
    });
  }

  const { tenantId } = parsed.data;
  const existia = clearTenantFlagOverrides(tenantId);

  logger.info("[FeatureFlagRoutes] Overrides de tenant removidos", {
    tenantId,
    existia,
  });

  return res.json({
    tenantId,
    mensagem: existia
      ? "Overrides removidos com sucesso"
      : "Tenant não possuía overrides configurados",
  });
});

export default router;
