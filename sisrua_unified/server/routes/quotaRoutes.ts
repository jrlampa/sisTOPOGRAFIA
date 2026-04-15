/**
 * quotaRoutes.ts — Rotas de gerenciamento de quotas e throttling por tenant.
 *
 * Roadmap Item 33 [T2]: Quotas e Throttling Customizado.
 * Limites de processamento e armazenamento segregados por grupo empresarial.
 *
 * Autenticação:
 *   - Operações de escrita (PUT, DELETE) exigem token via METRICS_TOKEN.
 *   - Leitura (GET /:tenantId, GET /:tenantId/uso) é pública (info operacional).
 *   - Listagem de todos os tenants exige token de admin.
 *
 * Endpoints:
 *   GET    /api/tenant-quotas                            — lista tenants (admin)
 *   GET    /api/tenant-quotas/:tenantId                  — quotas configuradas
 *   GET    /api/tenant-quotas/:tenantId/uso              — relatório de uso atual
 *   PUT    /api/tenant-quotas/:tenantId/:tipo            — define/atualiza limite (admin)
 *   POST   /api/tenant-quotas/:tenantId/:tipo/verificar  — verifica e consome quota
 *   DELETE /api/tenant-quotas/:tenantId/:tipo            — remove quota específica (admin)
 *   DELETE /api/tenant-quotas/:tenantId                  — remove todas as quotas (admin)
 */
import { Router, Request, Response } from "express";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import {
  setTenantQuota,
  getTenantQuotas,
  removeTenantQuota,
  clearTenantQuotas,
  listarTenantComQuotas,
  checkAndConsumeQuota,
  getTenantUsageReport,
  TipoQuota,
} from "../services/tenantQuotaService.js";

const router = Router();

// ─── Auth helper ──────────────────────────────────────────────────────────────

function isAdminAuthorized(req: Request): boolean {
  if (!config.METRICS_TOKEN) {
    return true;
  }
  const authHeader = req.headers.authorization ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return false;
  }
  const provided = Buffer.from(authHeader.slice("Bearer ".length), "utf8");
  const expected = Buffer.from(config.METRICS_TOKEN, "utf8");
  if (provided.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(provided, expected);
}

// ─── Schemas de validação ─────────────────────────────────────────────────────

const TIPOS_QUOTA_VALIDOS: TipoQuota[] = [
  "jobs_por_hora",
  "jobs_por_dia",
  "dxf_por_hora",
  "analise_por_hora",
  "armazenamento_mb",
];

const TenantIdParamSchema = z.object({
  tenantId: z
    .string()
    .min(1)
    .max(128)
    .regex(
      /^[\w\-\.@]+$/,
      "tenantId deve conter apenas letras, números, hífens, underscores, pontos ou @",
    )
    .refine((v) => !v.includes(".."), {
      message: "tenantId não pode conter sequências de pontos consecutivos",
    }),
});

const TipoQuotaParamSchema = z.object({
  tipo: z.enum(
    TIPOS_QUOTA_VALIDOS as [TipoQuota, ...TipoQuota[]],
  ),
});

const LimiteBodySchema = z.object({
  limite: z
    .number()
    .int()
    .min(0, "Limite deve ser um inteiro não-negativo")
    .finite(),
});

const VerificarBodySchema = z.object({
  unidades: z.number().int().min(1).max(1_000).default(1),
});

// ─── GET /api/tenant-quotas — lista tenants (admin) ──────────────────────────

/**
 * @swagger
 * /api/tenant-quotas:
 *   get:
 *     summary: Lista tenants com quotas configuradas
 *     tags: [Quotas]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de tenantIds com quotas
 *       401:
 *         description: Token inválido ou ausente
 */
router.get("/", (req: Request, res: Response) => {
  if (!isAdminAuthorized(req)) {
    res.set("WWW-Authenticate", 'Bearer realm="tenant-quotas-admin"');
    return res.status(401).json({ erro: "Não autorizado" });
  }
  const tenants = listarTenantComQuotas();
  logger.info("[QuotaRoutes] Listagem de tenants com quota", {
    count: tenants.length,
  });
  return res.json({ tenants });
});

// ─── GET /api/tenant-quotas/:tenantId — quotas configuradas ──────────────────

/**
 * @swagger
 * /api/tenant-quotas/{tenantId}:
 *   get:
 *     summary: Retorna as quotas configuradas para um tenant
 *     tags: [Quotas]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *     responses:
 *       200:
 *         description: Mapa de quotas do tenant
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
  const quotas = getTenantQuotas(tenantId);
  return res.json({ tenantId, quotas });
});

// ─── GET /api/tenant-quotas/:tenantId/uso — relatório de uso ─────────────────

/**
 * @swagger
 * /api/tenant-quotas/{tenantId}/uso:
 *   get:
 *     summary: Retorna o relatório de uso de quotas do tenant
 *     tags: [Quotas]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *     responses:
 *       200:
 *         description: Relatório de uso do tenant
 *       400:
 *         description: tenantId inválido
 */
router.get("/:tenantId/uso", (req: Request, res: Response) => {
  const parsed = TenantIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({
      erro: "tenantId inválido",
      detalhes: parsed.error.issues,
    });
  }
  const { tenantId } = parsed.data;
  const relatorio = getTenantUsageReport(tenantId);
  return res.json(relatorio);
});

// ─── PUT /api/tenant-quotas/:tenantId/:tipo — definir limite (admin) ──────────

/**
 * @swagger
 * /api/tenant-quotas/{tenantId}/{tipo}:
 *   put:
 *     summary: Define ou atualiza o limite de uma quota específica para um tenant
 *     tags: [Quotas]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *       - in: path
 *         name: tipo
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               limite:
 *                 type: integer
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Quota definida com sucesso
 *       400:
 *         description: Parâmetro ou corpo inválido
 *       401:
 *         description: Token de administração ausente ou inválido
 */
router.put("/:tenantId/:tipo", (req: Request, res: Response) => {
  if (!isAdminAuthorized(req)) {
    res.set("WWW-Authenticate", 'Bearer realm="tenant-quotas-admin"');
    return res.status(401).json({ erro: "Não autorizado" });
  }

  const paramParsed = TenantIdParamSchema.merge(TipoQuotaParamSchema).safeParse(
    req.params,
  );
  if (!paramParsed.success) {
    return res.status(400).json({
      erro: "Parâmetros inválidos",
      detalhes: paramParsed.error.issues,
    });
  }

  const bodyParsed = LimiteBodySchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json({
      erro: "Corpo inválido — esperado { limite: integer >= 0 }",
      detalhes: bodyParsed.error.issues,
    });
  }

  const { tenantId, tipo } = paramParsed.data;
  const { limite } = bodyParsed.data;

  setTenantQuota(tenantId, tipo, limite);

  logger.info("[QuotaRoutes] Quota de tenant definida", {
    tenantId,
    tipo,
    limite,
  });

  return res.json({
    tenantId,
    tipo,
    limite,
    mensagem: "Quota definida com sucesso",
  });
});

// ─── POST /api/tenant-quotas/:tenantId/:tipo/verificar — check+consume ────────

/**
 * @swagger
 * /api/tenant-quotas/{tenantId}/{tipo}/verificar:
 *   post:
 *     summary: Verifica e consome uma quota do tenant (service-to-service)
 *     tags: [Quotas]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *       - in: path
 *         name: tipo
 *         required: true
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               unidades:
 *                 type: integer
 *                 minimum: 1
 *                 default: 1
 *     responses:
 *       200:
 *         description: Quota verificada — `permitido` indica se pode prosseguir
 *       400:
 *         description: Parâmetro inválido
 *       429:
 *         description: Quota esgotada
 */
router.post(
  "/:tenantId/:tipo/verificar",
  (req: Request, res: Response) => {
    const paramParsed = TenantIdParamSchema.merge(
      TipoQuotaParamSchema,
    ).safeParse(req.params);
    if (!paramParsed.success) {
      return res.status(400).json({
        erro: "Parâmetros inválidos",
        detalhes: paramParsed.error.issues,
      });
    }

    const bodyParsed = VerificarBodySchema.safeParse(req.body ?? {});
    if (!bodyParsed.success) {
      return res.status(400).json({
        erro: "Corpo inválido",
        detalhes: bodyParsed.error.issues,
      });
    }

    const { tenantId, tipo } = paramParsed.data;
    const { unidades } = bodyParsed.data;

    const resultado = checkAndConsumeQuota(tenantId, tipo, unidades);

    if (!resultado.permitido) {
      logger.warn("[QuotaRoutes] Quota excedida", { tenantId, tipo, unidades });
      return res.status(429).json({
        erro: "Quota excedida",
        ...resultado,
      });
    }

    return res.json(resultado);
  },
);

// ─── DELETE /api/tenant-quotas/:tenantId/:tipo — remove quota específica ───────

/**
 * @swagger
 * /api/tenant-quotas/{tenantId}/{tipo}:
 *   delete:
 *     summary: Remove a quota de um tipo específico de um tenant
 *     tags: [Quotas]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *       - in: path
 *         name: tipo
 *         required: true
 *     responses:
 *       200:
 *         description: Quota removida com sucesso
 *       400:
 *         description: Parâmetro inválido
 *       401:
 *         description: Token ausente ou inválido
 */
router.delete("/:tenantId/:tipo", (req: Request, res: Response) => {
  if (!isAdminAuthorized(req)) {
    res.set("WWW-Authenticate", 'Bearer realm="tenant-quotas-admin"');
    return res.status(401).json({ erro: "Não autorizado" });
  }

  const paramParsed = TenantIdParamSchema.merge(TipoQuotaParamSchema).safeParse(
    req.params,
  );
  if (!paramParsed.success) {
    return res.status(400).json({
      erro: "Parâmetros inválidos",
      detalhes: paramParsed.error.issues,
    });
  }

  const { tenantId, tipo } = paramParsed.data;
  removeTenantQuota(tenantId, tipo);

  logger.info("[QuotaRoutes] Quota de tenant removida", { tenantId, tipo });

  return res.json({
    tenantId,
    tipo,
    mensagem: "Quota removida com sucesso",
  });
});

// ─── DELETE /api/tenant-quotas/:tenantId — remove todas as quotas (admin) ─────

/**
 * @swagger
 * /api/tenant-quotas/{tenantId}:
 *   delete:
 *     summary: Remove todas as quotas de um tenant
 *     tags: [Quotas]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *     responses:
 *       200:
 *         description: Quotas removidas com sucesso
 *       400:
 *         description: tenantId inválido
 *       401:
 *         description: Token ausente ou inválido
 */
router.delete("/:tenantId", (req: Request, res: Response) => {
  if (!isAdminAuthorized(req)) {
    res.set("WWW-Authenticate", 'Bearer realm="tenant-quotas-admin"');
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
  const existia = clearTenantQuotas(tenantId);

  logger.info("[QuotaRoutes] Quotas de tenant removidas", {
    tenantId,
    existia,
  });

  return res.json({
    tenantId,
    mensagem: existia
      ? "Quotas removidas com sucesso"
      : "Tenant não possuía quotas configuradas",
  });
});

export default router;
