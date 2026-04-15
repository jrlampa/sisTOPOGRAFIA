/**
 * vulnManagementRoutes.ts — Rotas de Gestão de Vulnerabilidades (Item 127 [T1]).
 *
 * GET   /api/vulns           — lista com filtros opcionais
 * POST  /api/vulns           — registra nova vulnerabilidade
 * PATCH /api/vulns/:id/status — atualiza status
 * GET   /api/vulns/resumo    — resumo por severidade + SLA
 *
 * Auth: METRICS_TOKEN (Bearer)
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { isBearerRequestAuthorized, setBearerChallenge } from "../utils/bearerAuth.js";
import {
  registrarVuln,
  atualizarStatus,
  listarVulns,
  resumoCvss,
  SeveridadeVuln,
  StatusVuln,
} from "../services/vulnManagementService.js";

const router = Router();

const SEVERIDADES: SeveridadeVuln[] = ['critica', 'alta', 'media', 'baixa'];
const STATUS_LIST: StatusVuln[] = ['aberta', 'em_tratamento', 'resolvida', 'aceita'];

function isAuthorized(req: Request): boolean {
  return isBearerRequestAuthorized(req, config.METRICS_TOKEN);
}

function unauthorized(res: Response): Response {
  setBearerChallenge(res, "vulns");
  return res.status(401).json({ erro: "Não autorizado" });
}

const VulnSchema = z.object({
  titulo: z.string().min(1).max(256),
  cvssScore: z.number().min(0).max(10),
  severidade: z.enum(SEVERIDADES as [SeveridadeVuln, ...SeveridadeVuln[]]),
  status: z.enum(STATUS_LIST as [StatusVuln, ...StatusVuln[]]),
  fonte: z.string().min(1).max(256),
  afetado: z.string().min(1).max(256),
});

const StatusUpdateSchema = z.object({
  status: z.enum(STATUS_LIST as [StatusVuln, ...StatusVuln[]]),
  resolvidoEm: z.string().datetime().optional(),
});

const FiltrosSchema = z.object({
  status: z.enum(STATUS_LIST as [StatusVuln, ...StatusVuln[]]).optional(),
  severidade: z.enum(SEVERIDADES as [SeveridadeVuln, ...SeveridadeVuln[]]).optional(),
});

// IMPORTANT: /resumo must be before /:id/status to avoid route conflict
router.get("/resumo", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  return res.json(resumoCvss());
});

router.get("/", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  const q = FiltrosSchema.safeParse(req.query);
  if (!q.success) return res.status(400).json({ erro: "Filtros inválidos", detalhes: q.error.issues });
  const lista = listarVulns(q.data);
  return res.json({ total: lista.length, vulnerabilidades: lista });
});

router.post("/", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  const parsed = VulnSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: "Corpo inválido", detalhes: parsed.error.issues });

  const vuln = registrarVuln(parsed.data);
  logger.info("[VulnManagementRoutes] Vulnerabilidade registrada", { id: vuln.id, severidade: vuln.severidade });
  return res.status(201).json(vuln);
});

router.patch("/:id/status", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  const parsed = StatusUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: "Corpo inválido", detalhes: parsed.error.issues });

  const ok = atualizarStatus(req.params.id, parsed.data.status, parsed.data.resolvidoEm ? new Date(parsed.data.resolvidoEm) : undefined);
  if (!ok) return res.status(404).json({ erro: "Vulnerabilidade não encontrada" });

  return res.json({ sucesso: true });
});

export default router;
