/**
 * contractualSlaRoutes.ts — Rotas SLO/SLA Contratual (114 [T1])
 */

import { Router } from "express";
import { z } from "zod";
import {
  ContractualSlaService,
  type SlaFlowId,
} from "../services/contractualSlaService.js";

const router = Router();

// GET /api/sla/catalog — catálogo de SLAs
router.get("/catalog", (_req, res) => {
  try {
    res.json(ContractualSlaService.getCatalog());
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao obter catálogo SLA", detail: String(err) });
  }
});

// GET /api/sla/compliance — relatório de todos os fluxos
router.get("/compliance", (req, res) => {
  try {
    const { start, end } = req.query as Record<string, string>;
    res.json(
      ContractualSlaService.getAllComplianceReports(start, end),
    );
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao gerar relatório de compliance", detail: String(err) });
  }
});

// GET /api/sla/violations — fluxos com violação
router.get("/violations", (req, res) => {
  try {
    const { start, end } = req.query as Record<string, string>;
    res.json(ContractualSlaService.getViolations(start, end));
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao obter violações de SLA", detail: String(err) });
  }
});

// GET /api/sla/flows/:flowId — SLA de um fluxo
router.get("/flows/:flowId", (req, res) => {
  try {
    const sla = ContractualSlaService.getSlaByFlow(
      req.params.flowId as SlaFlowId,
    );
    if (!sla) {
      return res
        .status(404)
        .json({ error: `Fluxo '${req.params.flowId}' não encontrado.` });
    }
    res.json(sla);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao obter SLA do fluxo", detail: String(err) });
  }
});

// GET /api/sla/flows/:flowId/compliance — relatório de conformidade do fluxo
router.get("/flows/:flowId/compliance", (req, res) => {
  try {
    const { start, end } = req.query as Record<string, string>;
    const report = ContractualSlaService.getComplianceReport(
      req.params.flowId as SlaFlowId,
      start,
      end,
    );
    res.json(report);
  } catch (err) {
    res
      .status(422)
      .json({ error: "Erro ao gerar relatório de conformidade", detail: String(err) });
  }
});

// GET /api/sla/flows/:flowId/events — eventos brutos do fluxo
router.get("/flows/:flowId/events", (req, res) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const offset = Number(req.query.offset) || 0;
    res.json(
      ContractualSlaService.getEvents(
        req.params.flowId as SlaFlowId,
        limit,
        offset,
      ),
    );
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao listar eventos SLA", detail: String(err) });
  }
});

const RecordEventSchema = z.object({
  flowId: z.enum([
    "exportacao_dxf",
    "calculo_bt",
    "autenticacao",
    "api_geoprocessamento",
    "importacao_shapefile",
    "relatorio_conformidade",
    "backup_db",
    "integracao_aneel",
  ]),
  outcome: z.enum(["success", "failure", "timeout", "degraded"]),
  durationMs: z.number().int().min(0),
  tenantId: z.string().optional(),
  errorCode: z.string().optional(),
});

// POST /api/sla/events — registra evento de SLA
router.post("/events", (req, res) => {
  const parsed = RecordEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Payload inválido", detail: parsed.error.issues });
  }
  try {
    const event = ContractualSlaService.recordEvent(parsed.data);
    res.status(201).json(event);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao registrar evento SLA", detail: String(err) });
  }
});

export default router;
