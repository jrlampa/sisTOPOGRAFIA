/**
 * auditRoutes.ts — Endpoints de auditoria e exportação SIEM.
 *
 * Roadmap Item 68: Contexto IP/geo/device em audit_logs (migration 038).
 * Roadmap Item 93: Exportação SIEM via /api/audit/export.
 * Roadmap Item 34: Isolamento de auditoria por tenant.
 *
 * Autenticação:
 *   - Requer Bearer token idêntico ao METRICS_TOKEN (compartilhado com Prometheus).
 *   - Sem token configurado: endpoint servido sem autenticação (apenas dev/internal).
 *
 * Formatos de exportação suportados:
 *   - application/json (padrão)
 *   - application/x-ndjson  (NDJSON — uma linha JSON por evento, ideal para SIEM streaming)
 */
import { Router, Request, Response } from "express";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import postgres from "postgres";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const router = Router();

// ─── Auth helper ─────────────────────────────────────────────────────────────

function isAuditRequestAuthorized(req: Request): boolean {
  if (!config.METRICS_TOKEN) {
    return true; // No token → dev/internal mode
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

// ─── Query schema ─────────────────────────────────────────────────────────────

const ExportQuerySchema = z.object({
  since: z.string().datetime({ offset: true }).optional(),
  until: z.string().datetime({ offset: true }).optional(),
  tenant_id: z.string().uuid().optional(),
  table_name: z.string().max(64).optional(),
  action: z.enum(["INSERT", "UPDATE", "DELETE"]).optional(),
  limit: z.coerce.number().int().min(1).max(10_000).default(1_000),
  format: z.enum(["json", "ndjson"]).default("json"),
});

// ─── Lazy DB connection ───────────────────────────────────────────────────────

let _sql: ReturnType<typeof postgres> | null = null;

function getDb(): ReturnType<typeof postgres> | null {
  if (!config.DATABASE_URL) {
    return null;
  }
  if (!_sql) {
    _sql = postgres(config.DATABASE_URL, {
      ssl: config.NODE_ENV === "production" ? "require" : undefined,
      max: 2,
      connect_timeout: 8,
      idle_timeout: 10,
    });
  }
  return _sql;
}

// ─── GET /api/audit/export — SIEM bulk export ─────────────────────────────────

/**
 * @swagger
 * /api/audit/export:
 *   get:
 *     summary: Exporta logs de auditoria para consumo SIEM (CEF/NDJSON)
 *     tags: [Auditoria]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: since
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filtrar eventos após esta data (ISO 8601)
 *       - in: query
 *         name: until
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: tenant_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: table_name
 *         schema:
 *           type: string
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           enum: [INSERT, UPDATE, DELETE]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 1000
 *           maximum: 10000
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, ndjson]
 *           default: json
 *     responses:
 *       200:
 *         description: Eventos de auditoria exportados
 *       401:
 *         description: Token de autorização inválido ou ausente
 *       503:
 *         description: Banco de dados indisponível
 */
router.get("/export", async (req: Request, res: Response) => {
  if (!isAuditRequestAuthorized(req)) {
    res.set("WWW-Authenticate", 'Bearer realm="audit"');
    return res.status(401).json({ error: "Unauthorized" });
  }

  const parsed = ExportQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Parâmetros inválidos",
      details: parsed.error.issues,
    });
  }

  const { since, until, tenant_id, table_name, action, limit, format } =
    parsed.data;

  const sql = getDb();
  if (!sql) {
    return res.status(503).json({
      error: "Banco de dados não configurado",
      message: "DATABASE_URL ausente — auditoria persistente indisponível.",
    });
  }

  try {
    // Build parameterized conditions (safe against injection)
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (since) {
      conditions.push(`event_time >= $${paramIdx++}`);
      params.push(since);
    }
    if (until) {
      conditions.push(`event_time <= $${paramIdx++}`);
      params.push(until);
    }
    if (tenant_id) {
      conditions.push(`tenant_id = $${paramIdx++}`);
      params.push(tenant_id);
    }
    if (table_name) {
      conditions.push(`resource_type = $${paramIdx++}`);
      params.push(table_name);
    }
    if (action) {
      conditions.push(`event_action = $${paramIdx++}`);
      params.push(action);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit);

    const rows = (await sql.unsafe(
      `SELECT * FROM public.v_audit_siem_export
       ${where}
       ORDER BY event_time DESC
       LIMIT $${paramIdx}`,
      params as string[],
    )) as Record<string, unknown>[];

    logger.info("[AuditRoutes] SIEM export", {
      format,
      rowCount: rows.length,
      filters: { since, until, tenant_id, table_name, action },
    });

    if (format === "ndjson") {
      res.set("Content-Type", "application/x-ndjson");
      return res.send(rows.map((r) => JSON.stringify(r)).join("\n"));
    }

    return res.json({ count: rows.length, events: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[AuditRoutes] Falha na exportação SIEM", { error: message });
    return res
      .status(500)
      .json({ error: "Falha ao exportar logs de auditoria", details: message });
  }
});

// ─── GET /api/audit/health — verifica disponibilidade ────────────────────────

router.get("/health", (_req: Request, res: Response) => {
  const available = !!config.DATABASE_URL;
  return res.json({
    auditPersistence: available ? "enabled" : "disabled",
    exportEndpoint: "/api/audit/export",
  });
});

export default router;
