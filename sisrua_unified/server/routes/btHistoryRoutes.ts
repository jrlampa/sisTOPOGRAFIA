import { Request, Response, Router } from "express";
import {
  btExportHistoryService,
  BtExportHistoryPayload,
  BtExportHistoryIngestPayload,
} from "../services/btExportHistoryService.js";
import { z } from "zod";

const router = Router();

const projectTypeSchema = z.enum(["ramais", "clandestino"]);
const cqtScenarioSchema = z.enum(["atual", "proj1", "proj2"]);

const isSafeBtContextUrl = (value: string): boolean => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }

  // Prefer backend-generated local download URLs.
  if (trimmed.startsWith("/downloads/")) {
    return !trimmed.includes("..");
  }

  try {
    const parsed = new URL(trimmed);
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
};

const listHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  projectType: projectTypeSchema.optional(),
  cqtScenario: cqtScenarioSchema.optional(),
});

const createHistoryPayloadSchema = z.object({
  exportedAt: z.string().datetime({ offset: true }),
  projectType: projectTypeSchema,
  btContextUrl: z
    .string()
    .trim()
    .min(1)
    .refine(isSafeBtContextUrl, "btContextUrl inválido"),
  criticalPoleId: z.string().trim().min(1),
  criticalAccumulatedClients: z.number().min(0),
  criticalAccumulatedDemandKva: z.number().min(0),
  verifiedPoles: z.number().min(0).optional(),
  totalPoles: z.number().min(0).optional(),
  verifiedEdges: z.number().min(0).optional(),
  totalEdges: z.number().min(0).optional(),
  verifiedTransformers: z.number().min(0).optional(),
  totalTransformers: z.number().min(0).optional(),
  cqt: z.unknown().optional(),
});

const ingestHistoryPayloadSchema = z.object({
  projectType: projectTypeSchema,
  btContextUrl: z
    .string()
    .trim()
    .min(1)
    .refine(isSafeBtContextUrl, "btContextUrl inválido"),
  btContext: z.record(z.string(), z.unknown()),
  exportedAt: z.string().datetime({ offset: true }).optional(),
});

const clearHistoryQuerySchema = z.object({
  projectType: projectTypeSchema.optional(),
  cqtScenario: cqtScenarioSchema.optional(),
});

router.get("/", async (req: Request, res: Response) => {
  const validation = listHistoryQuerySchema.safeParse(req.query);
  if (!validation.success) {
    return res
      .status(400)
      .json({
        error: "Parâmetros inválidos",
        details: validation.error.issues,
      });
  }

  const { limit, offset, projectType, cqtScenario } = validation.data;

  const result = await btExportHistoryService.list(limit, offset, {
    projectType,
    cqtScenario,
  });
  return res.json(result);
});

router.post("/", async (req: Request, res: Response) => {
  const validation = createHistoryPayloadSchema.safeParse(req.body);
  if (!validation.success) {
    return res
      .status(400)
      .json({ error: "Payload inválido", details: validation.error.issues });
  }

  const stored = await btExportHistoryService.create(
    validation.data as BtExportHistoryPayload,
  );
  return res.status(201).json({ ok: true, stored });
});

router.post("/ingest", async (req: Request, res: Response) => {
  const validation = ingestHistoryPayloadSchema.safeParse(req.body);
  if (!validation.success) {
    return res
      .status(400)
      .json({ error: "Payload inválido", details: validation.error.issues });
  }

  const result = await btExportHistoryService.ingestFromContext(
    validation.data as BtExportHistoryIngestPayload,
  );
  if (!result.entry) {
    return res
      .status(422)
      .json({
        ok: false,
        error: "Nao foi possivel extrair resumo BT do contexto informado",
      });
  }

  return res.status(201).json({ ok: true, ...result });
});

router.delete("/", async (req: Request, res: Response) => {
  const validation = clearHistoryQuerySchema.safeParse(req.query);
  if (!validation.success) {
    return res
      .status(400)
      .json({
        error: "Parâmetros inválidos",
        details: validation.error.issues,
      });
  }

  const { projectType, cqtScenario } = validation.data;

  const result = await btExportHistoryService.clear({
    projectType,
    cqtScenario,
  });
  return res.json({ ok: true, deletedCount: result.deleted });
});

export default router;
