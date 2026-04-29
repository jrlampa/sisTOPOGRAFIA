/**
 * auditColdStorageRoutes.ts — Rotas de cold storage de logs de auditoria (76 [T1])
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { AuditColdStorageService } from "../services/auditColdStorageService.js";

const router = Router();

const IngestAuditLogSchema = z.object({
  tenantId: z.string().min(1),
  actor: z.string().min(1),
  action: z.string().min(1),
  resource: z.string().min(1),
  ts: z.string().datetime(),
  context: z.record(z.string(), z.unknown()).default({}),
});

const ArchiveSchema = z.object({
  olderThanDays: z.number().int().min(1).max(3650),
});

const QuerySchema = z.object({
  tenantId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10)).optional(),
  offset: z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10)).optional(),
});

router.post("/logs", (req: Request, res: Response) => {
  const parsed = IngestAuditLogSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });

  const created = AuditColdStorageService.ingestHotLog(parsed.data);
  return res.status(201).json(created);
});

router.post("/archive/run", (req: Request, res: Response) => {
  const parsed = ArchiveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });

  return res.json(AuditColdStorageService.archiveOlderThan(parsed.data.olderThanDays));
});

router.get("/logs", (req: Request, res: Response) => {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });

  return res.json(
    AuditColdStorageService.queryCold({
      tenantId: parsed.data.tenantId,
      from: parsed.data.from,
      to: parsed.data.to,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    }),
  );
});

router.get("/stats", (_req: Request, res: Response) => {
  return res.json(AuditColdStorageService.getStats());
});

router.get("/partitions/:month/export", (req: Request, res: Response) => {
  const month = req.params["month"]!;
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: "Parâmetro month inválido. Use YYYY-MM." });
  }
  return res.json(AuditColdStorageService.exportPartition(month));
});

export default router;
