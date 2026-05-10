/**
 * Rotas T2-56 / T3-134 — Edição Colaborativa em Tempo Real
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { EdicaoColaborativaService } from "../services/edicaoColaborativaService.js";

const router = Router();

const TipoOperacaoEnum = z.enum([
  "adicionar_ponto", "mover_ponto", "remover_ponto",
  "adicionar_trecho", "remover_trecho", "editar_atributo", "comentar",
]);

const CriarSessaoSchema = z.object({
  tenantId: z.string().min(1),
  projetoId: z.string().min(1),
  nomeProjeto: z.string().min(3),
  responsavelId: z.string().optional(),
  responsavel: z.string().optional(), // Legado
});

const RegistrarOperacaoSchema = z.object({
  usuarioId: z.string().optional(),
  participanteId: z.string().optional(), // Legado
  tipoOperacao: TipoOperacaoEnum,
  payload: z.record(z.string(), z.unknown()),
  versaoBase: z.number().int().nonnegative(),
});

// POST /sessoes
router.post("/sessoes", async (req: Request, res: Response) => {
  const parse = CriarSessaoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(await EdicaoColaborativaService.criarSessao(parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /sessoes
router.get("/sessoes", async (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;
  return res.json(await EdicaoColaborativaService.listarSessoes(tenantId));
});

// GET /sessoes/:id
router.get("/sessoes/:id", async (req: Request, res: Response) => {
  const sessao = await EdicaoColaborativaService.obterSessao(req.params.id);
  if (!sessao) return res.status(404).json({ error: "Sessão não encontrada" });
  return res.json(sessao);
});

// POST /sessoes/:id/participantes
router.post("/sessoes/:id/participantes", async (req: Request, res: Response) => {
  try {
    const p = await EdicaoColaborativaService.adicionarParticipante(req.params.id, req.body);
    return res.status(201).json(p);
  } catch (err: any) {
    return res.status(422).json({ error: err.message });
  }
});

// POST /sessoes/:id/operacoes
router.post("/sessoes/:id/operacoes", async (req: Request, res: Response) => {
  const parse = RegistrarOperacaoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(await EdicaoColaborativaService.registrarOperacao(req.params.id, parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /sessoes/:id/bloquear
router.post("/sessoes/:id/bloquear", async (req: Request, res: Response) => {
  try {
    return res.json(await EdicaoColaborativaService.bloquearSessao(req.params.id));
  } catch (err: any) {
    return res.status(422).json({ error: err.message });
  }
});

// POST /sessoes/:id/encerrar
router.post("/sessoes/:id/encerrar", async (req: Request, res: Response) => {
  try {
    return res.json(await EdicaoColaborativaService.encerrarSessao(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /papeis
router.get("/papeis", (_req: Request, res: Response) => {
  return res.json(EdicaoColaborativaService.listarPapeis());
});

export default router;
