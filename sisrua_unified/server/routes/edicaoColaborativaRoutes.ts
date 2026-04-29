/**
 * Rotas T2-56 — Edição Colaborativa em Tempo Real
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { EdicaoColaborativaService } from "../services/edicaoColaborativaService.js";

const router = Router();

const PapelEnum = z.enum(["editor", "revisor", "observador"]);
const TipoOperacaoEnum = z.enum([
  "adicionar_ponto", "mover_ponto", "remover_ponto",
  "adicionar_trecho", "remover_trecho", "editar_atributo", "comentar",
]);

const CriarSessaoSchema = z.object({
  tenantId: z.string().min(2),
  projetoId: z.string().min(2),
  nomeProjeto: z.string().min(3),
  responsavel: z.string().min(3),
});

const EntrarSessaoSchema = z.object({
  usuarioId: z.string().min(2),
  nomeUsuario: z.string().min(3),
  papel: PapelEnum,
});

const RegistrarOperacaoSchema = z.object({
  participanteId: z.string().min(2),
  tipoOperacao: TipoOperacaoEnum,
  payload: z.record(z.string(), z.unknown()),
  versaoBase: z.number().int().nonnegative(),
});

// POST /sessoes
router.post("/sessoes", (req: Request, res: Response) => {
  const parse = CriarSessaoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(EdicaoColaborativaService.criarSessao(parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /sessoes
router.get("/sessoes", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;
  return res.json(EdicaoColaborativaService.listarSessoes(tenantId));
});

// GET /sessoes/:id
router.get("/sessoes/:id", (req: Request, res: Response) => {
  const sessao = EdicaoColaborativaService.obterSessao(req.params.id);
  if (!sessao) return res.status(404).json({ error: "Sessão não encontrada" });
  return res.json(sessao);
});

// POST /sessoes/:id/participantes
router.post("/sessoes/:id/participantes", (req: Request, res: Response) => {
  const parse = EntrarSessaoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(EdicaoColaborativaService.entrarNaSessao(req.params.id, parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /sessoes/:id/operacoes
router.post("/sessoes/:id/operacoes", (req: Request, res: Response) => {
  const parse = RegistrarOperacaoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(EdicaoColaborativaService.registrarOperacao(req.params.id, parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /sessoes/:id/bloquear
router.post("/sessoes/:id/bloquear", (req: Request, res: Response) => {
  try {
    return res.json(EdicaoColaborativaService.bloquearSessao(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /sessoes/:id/encerrar
router.post("/sessoes/:id/encerrar", (req: Request, res: Response) => {
  try {
    return res.json(EdicaoColaborativaService.encerrarSessao(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /papeis
router.get("/papeis", (_req: Request, res: Response) => {
  return res.json(EdicaoColaborativaService.listarPapeis());
});

export default router;
