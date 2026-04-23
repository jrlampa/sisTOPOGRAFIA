/**
 * Rotas T2-83 — Tele-Engenharia com Desenho AR
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { TeleEngenhariaArService } from "../services/teleEngenhariaArService.js";

const router = Router();

const CriarSessaoSchema = z.object({
  tenantId: z.string().min(2),
  projetoId: z.string().min(2),
  nomeProjeto: z.string().min(3),
  engenheiroResponsavel: z.string().min(3),
});

const EntrarSessaoSchema = z.object({
  usuarioId: z.string().min(2),
  nomeUsuario: z.string().min(3),
  papel: z.enum(["operador", "revisor", "fiscal"]),
});

const RegistrarAnotacaoSchema = z.object({
  participanteId: z.string().min(2),
  tipoAnotacao: z.enum(["marcador", "linha", "poligono", "texto", "risco"]),
  geometria: z.record(z.unknown()),
  observacao: z.string().optional(),
});

const AtualizarSincroniaSchema = z.object({
  estadoSincronia: z.enum(["online", "offline", "degradado"]),
});

router.post("/sessoes", (req: Request, res: Response) => {
  const parse = CriarSessaoSchema.safeParse(req.body);
  if (!parse.success)
    return res.status(400).json({ errors: parse.error.issues });
  try {
    return res
      .status(201)
      .json(TeleEngenhariaArService.criarSessao(parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.get("/sessoes", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;
  return res.json(TeleEngenhariaArService.listarSessoes(tenantId));
});

router.get("/sessoes/:id", (req: Request, res: Response) => {
  const sessao = TeleEngenhariaArService.obterSessao(req.params.id);
  if (!sessao) return res.status(404).json({ error: "Sessão não encontrada" });
  return res.json(sessao);
});

router.post("/sessoes/:id/iniciar", (req: Request, res: Response) => {
  try {
    return res.json(TeleEngenhariaArService.iniciarSessao(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.post("/sessoes/:id/participantes", (req: Request, res: Response) => {
  const parse = EntrarSessaoSchema.safeParse(req.body);
  if (!parse.success)
    return res.status(400).json({ errors: parse.error.issues });
  try {
    return res
      .status(201)
      .json(TeleEngenhariaArService.entrarSessao(req.params.id, parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.post("/sessoes/:id/anotacoes", (req: Request, res: Response) => {
  const parse = RegistrarAnotacaoSchema.safeParse(req.body);
  if (!parse.success)
    return res.status(400).json({ errors: parse.error.issues });
  try {
    return res
      .status(201)
      .json(
        TeleEngenhariaArService.registrarAnotacao(req.params.id, parse.data),
      );
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.patch("/sessoes/:id/sincronia", (req: Request, res: Response) => {
  const parse = AtualizarSincroniaSchema.safeParse(req.body);
  if (!parse.success)
    return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.json(
      TeleEngenhariaArService.atualizarSincronia(
        req.params.id,
        parse.data.estadoSincronia,
      ),
    );
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.post("/sessoes/:id/encerrar", (req: Request, res: Response) => {
  try {
    return res.json(TeleEngenhariaArService.encerrarSessao(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.get("/tipos-anotacao", (_req: Request, res: Response) => {
  return res.json(TeleEngenhariaArService.listarTiposAnotacao());
});

export default router;
