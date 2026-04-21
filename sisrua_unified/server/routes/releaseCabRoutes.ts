/**
 * releaseCabRoutes.ts — Rotas de Release Governance & CAB (111 + 118 [T1])
 */

import { Router } from "express";
import { z } from "zod";
import { ReleaseCabService } from "../services/releaseCabService.js";

const router = Router();

// GET /api/cab/releases — lista todos os releases
router.get("/releases", (_req, res) => {
  try {
    res.json(ReleaseCabService.getReleases());
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao listar releases", detail: String(err) });
  }
});

// GET /api/cab/releases/changelog — changelog executivo
router.get("/releases/changelog", (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    res.json(ReleaseCabService.getExecutiveChangelog(limit));
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao gerar changelog", detail: String(err) });
  }
});

// GET /api/cab/releases/:id — release por ID
router.get("/releases/:id", (req, res) => {
  try {
    const record = ReleaseCabService.getReleaseById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: "Release não encontrado." });
    }
    res.json(record);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao buscar release", detail: String(err) });
  }
});

const RegisterReleaseSchema = z.object({
  version: z.string().min(1),
  type: z.enum(["major", "minor", "patch", "hotfix", "rollback"]),
  title: z.string().min(1),
  description: z.string().min(1),
  proposer: z.string().min(1),
  scheduledAt: z.string().nullable().optional(),
  gitCommit: z.string().nullable().optional(),
  maintenanceWindowUtc: z.string().nullable().optional(),
  rollbackPlan: z.string().min(1),
  changelogEntry: z.string().min(1),
});

// POST /api/cab/releases — registra novo release
router.post("/releases", (req, res) => {
  const parsed = RegisterReleaseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Payload inválido", detail: parsed.error.issues });
  }
  try {
    const record = ReleaseCabService.registerRelease({
      ...parsed.data,
      scheduledAt: parsed.data.scheduledAt ?? null,
      gitCommit: parsed.data.gitCommit ?? null,
      maintenanceWindowUtc: parsed.data.maintenanceWindowUtc ?? null,
    });
    res.status(201).json(record);
  } catch (err) {
    res
      .status(422)
      .json({ error: "Não foi possível registrar o release.", detail: String(err) });
  }
});

const ApproveSchema = z.object({ approver: z.string().min(1) });

// POST /api/cab/releases/:id/approve — aprova release
router.post("/releases/:id/approve", (req, res) => {
  const parsed = ApproveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Payload inválido", detail: parsed.error.issues });
  }
  try {
    const record = ReleaseCabService.approveRelease(req.params.id, parsed.data.approver);
    res.json(record);
  } catch (err) {
    res
      .status(422)
      .json({ error: "Não foi possível aprovar o release.", detail: String(err) });
  }
});

// ── 118: Change Management ─────────────────────────────────────────────────────

// GET /api/cab/mudancas — lista RDMs
router.get("/mudancas", (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    res.json(ReleaseCabService.getChangeRequests(status as never));
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao listar RDMs", detail: String(err) });
  }
});

// GET /api/cab/frozen-windows — períodos de congelamento
router.get("/frozen-windows", (_req, res) => {
  res.json(ReleaseCabService.getFrozenWindows());
});

const CreateRdmSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(["normal", "emergencial", "padrao", "rollback"]),
  priority: z.enum(["critica", "alta", "media", "baixa"]),
  proposer: z.string().min(1),
  impactedSystems: z.array(z.string()).min(1),
  rollbackPlan: z.string().min(1),
  testingEvidence: z.string().min(1),
  windowStartUtc: z.string().nullable().optional(),
  windowEndUtc: z.string().nullable().optional(),
});

// POST /api/cab/mudancas — cria RDM
router.post("/mudancas", (req, res) => {
  const parsed = CreateRdmSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Payload inválido", detail: parsed.error.issues });
  }
  try {
    const rdm = ReleaseCabService.createChangeRequest({
      ...parsed.data,
      windowStartUtc: parsed.data.windowStartUtc ?? null,
      windowEndUtc: parsed.data.windowEndUtc ?? null,
    });
    res.status(201).json(rdm);
  } catch (err) {
    res
      .status(422)
      .json({ error: "Não foi possível criar a RDM.", detail: String(err) });
  }
});

// POST /api/cab/mudancas/:id/approve — aprova RDM
router.post("/mudancas/:id/approve", (req, res) => {
  const parsed = ApproveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Payload inválido", detail: parsed.error.issues });
  }
  try {
    const rdm = ReleaseCabService.approveChangeRequest(
      req.params.id,
      parsed.data.approver,
    );
    res.json(rdm);
  } catch (err) {
    res
      .status(422)
      .json({ error: "Não foi possível aprovar a RDM.", detail: String(err) });
  }
});

export default router;
