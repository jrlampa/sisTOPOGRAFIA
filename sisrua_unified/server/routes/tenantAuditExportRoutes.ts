/**
 * tenantAuditExportRoutes.ts — Rotas da Trilha de Auditoria Exportável por Tenant (34 [T1])
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  TenantAuditExportService,
  AuditEventType,
  ExportFormat,
} from "../services/tenantAuditExportService.js";

const router = Router();

const IngestirSchema = z.object({
  tenantId: z.string().min(1),
  tipo: z.enum(["acesso", "operacao", "admin", "exportacao", "falha"]),
  actor: z.string().min(1),
  recurso: z.string().min(1),
  acao: z.string().min(1),
  ip: z.string().optional(),
  dispositivo: z.string().optional(),
  resultado: z.enum(["sucesso", "negado", "erro"]),
  detalhes: z.record(z.string(), z.unknown()).optional(),
});

const ExportarSchema = z.object({
  tenantId: z.string().min(1),
  formato: z.enum(["json", "ndjson", "csv"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  tipo: z.enum(["acesso", "operacao", "admin", "exportacao", "falha"]).optional(),
  actor: z.string().optional(),
});

const ConsultarQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  tipo: z.enum(["acesso", "operacao", "admin", "exportacao", "falha"]).optional(),
  actor: z.string().optional(),
  pagina: z.coerce.number().int().min(1).optional(),
  porPagina: z.coerce.number().int().min(1).max(200).optional(),
});

// POST /logs — ingesta evento de auditoria
router.post("/logs", (req: Request, res: Response) => {
  const parse = IngestirSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.flatten() });
    return;
  }
  const evt = TenantAuditExportService.ingestir(parse.data as Parameters<typeof TenantAuditExportService.ingestir>[0]);
  res.status(201).json(evt);
});

// GET /logs/:tenantId — consulta eventos com filtros
router.get("/logs/:tenantId", (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const parseQ = ConsultarQuerySchema.safeParse(req.query);
  if (!parseQ.success) {
    res.status(400).json({ erro: "Query inválida", detalhes: parseQ.error.flatten() });
    return;
  }
  const eventos = TenantAuditExportService.consultar(tenantId, parseQ.data);
  res.json({ tenantId, total: eventos.length, eventos });
});

// POST /export — exporta logs do tenant em formato selecionado
router.post("/export", (req: Request, res: Response) => {
  const parse = ExportarSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.flatten() });
    return;
  }
  const { tenantId, formato = "json", from, to, tipo, actor } = parse.data;
  const resultado = TenantAuditExportService.exportar(
    tenantId,
    formato as ExportFormat,
    { from, to, tipo: tipo as AuditEventType | undefined, actor }
  );
  res.json(resultado);
});

// GET /stats/:tenantId — estatísticas de auditoria do tenant
router.get("/stats/:tenantId", (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const stats = TenantAuditExportService.getStats(tenantId);
  res.json({ tenantId, ...stats });
});

export default router;
