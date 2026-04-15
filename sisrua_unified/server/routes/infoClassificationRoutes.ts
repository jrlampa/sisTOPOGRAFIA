/**
 * infoClassificationRoutes.ts — Rotas de Classificação da Informação (Item 128 [T1]).
 *
 * GET  /api/classificacao/resumo             — distribuição por nível
 * GET  /api/classificacao/recursos/:recursoId — classificação de recurso específico
 * POST /api/classificacao/recursos           — classifica recurso
 * GET  /api/classificacao/nivel/:nivel       — lista por nível
 *
 * Auth: METRICS_TOKEN (Bearer)
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { isBearerRequestAuthorized, setBearerChallenge } from "../utils/bearerAuth.js";
import {
  classificarRecurso,
  obterClassificacao,
  listarPorNivel,
  resumoClassificacoes,
  NivelClassificacao,
} from "../services/infoClassificationService.js";

const router = Router();
const NIVEIS: NivelClassificacao[] = ['publico', 'interno', 'confidencial', 'restrito'];

function isAuthorized(req: Request): boolean {
  return isBearerRequestAuthorized(req, config.METRICS_TOKEN);
}

function unauthorized(res: Response): Response {
  setBearerChallenge(res, "classificacao");
  return res.status(401).json({ erro: "Não autorizado" });
}

const ClassificarSchema = z.object({
  recursoId: z.string().min(1).max(256),
  recursoTipo: z.string().min(1).max(128),
  nivel: z.enum(NIVEIS as [NivelClassificacao, ...NivelClassificacao[]]),
  justificativa: z.string().min(1).max(512),
  classificadoPor: z.string().min(1).max(128),
});

router.get("/resumo", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  return res.json(resumoClassificacoes());
});

router.get("/recursos/:recursoId", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  const c = obterClassificacao(req.params.recursoId);
  if (!c) return res.status(404).json({ erro: "Classificação não encontrada" });
  return res.json(c);
});

router.post("/recursos", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  const parsed = ClassificarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: "Corpo inválido", detalhes: parsed.error.issues });

  const c = classificarRecurso(
    parsed.data.recursoId, parsed.data.recursoTipo, parsed.data.nivel,
    parsed.data.justificativa, parsed.data.classificadoPor
  );
  logger.info("[InfoClassificationRoutes] Recurso classificado", { recursoId: c.recursoId, nivel: c.nivel });
  return res.status(201).json(c);
});

router.get("/nivel/:nivel", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  const nivel = req.params.nivel as NivelClassificacao;
  if (!NIVEIS.includes(nivel)) return res.status(400).json({ erro: "Nível inválido" });
  const lista = listarPorNivel(nivel);
  return res.json({ nivel, total: lista.length, recursos: lista });
});

export default router;
