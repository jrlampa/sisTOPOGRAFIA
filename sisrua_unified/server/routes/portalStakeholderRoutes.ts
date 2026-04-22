/**
 * Rotas T2-110 — Portal Stakeholder (Visualizador Gov.br)
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { PortalStakeholderService } from "../services/portalStakeholderService.js";

const router = Router();

const CriarAcessoSchema = z.object({
  tenantId: z.string().min(2),
  orgao: z.string().min(3),
  nomeResponsavel: z.string().min(3),
  email: z.string().email(),
  perfil: z.enum(["prefeitura", "concessionaria", "fiscalizacao", "orgao_ambiental", "ministerio_publico"]),
  escopos: z.array(z.string().min(2)).min(1),
});

const CriarSolicitacaoSchema = z.object({
  tipoConsulta: z.enum(["mapa", "projeto", "dossie", "relatorio"]),
  justificativa: z.string().min(5),
});

const ResponderSolicitacaoSchema = z.object({
  status: z.enum(["aprovado", "negado", "atendido"]),
  resposta: z.string().optional(),
});

router.post("/acessos", (req: Request, res: Response) => {
  const parse = CriarAcessoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(PortalStakeholderService.criarAcesso(parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.get("/acessos", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;
  return res.json(PortalStakeholderService.listarAcessos(tenantId));
});

router.get("/acessos/:id", (req: Request, res: Response) => {
  const acesso = PortalStakeholderService.obterAcesso(req.params.id);
  if (!acesso) return res.status(404).json({ error: "Acesso não encontrado" });
  return res.json(acesso);
});

router.post("/acessos/:id/ativar", (req: Request, res: Response) => {
  try {
    return res.json(PortalStakeholderService.ativarAcesso(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.post("/acessos/:id/suspender", (req: Request, res: Response) => {
  try {
    return res.json(PortalStakeholderService.suspenderAcesso(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.post("/acessos/:id/revogar", (req: Request, res: Response) => {
  try {
    return res.json(PortalStakeholderService.revogarAcesso(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.post("/acessos/:id/solicitacoes", (req: Request, res: Response) => {
  const parse = CriarSolicitacaoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(PortalStakeholderService.criarSolicitacao(req.params.id, parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.post("/solicitacoes/:id/responder", (req: Request, res: Response) => {
  const parse = ResponderSolicitacaoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.json(PortalStakeholderService.responderSolicitacao(req.params.id, parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.get("/perfis", (_req: Request, res: Response) => {
  return res.json(PortalStakeholderService.listarPerfis());
});

export default router;
