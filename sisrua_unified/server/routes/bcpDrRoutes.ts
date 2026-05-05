/**
 * bcpDrRoutes.ts — Rotas BCP/DR + Redundância Geográfica (51+52 [T1])
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  BcpDrService,
  RegiaoCloud,
} from "../services/bcpDrService.js";

const router = Router();

const REGIOES = [
  "sa-east-1",
  "us-east-1",
  "us-west-2",
  "eu-west-1",
  "ap-southeast-1",
] as const;
const TIPOS_INCIDENTE = [
  "falha_bd",
  "falha_storage",
  "falha_rede",
  "falha_total",
  "ataque_cyber",
  "desastre_fisico",
] as const;

const CenarioSchema = z.object({
  titulo: z.string().min(1),
  tipoIncidente: z.enum(TIPOS_INCIDENTE),
  rtoMaxHoras: z.number().positive(),
  rpoMaxHoras: z.number().positive(),
  regiaoAtiva: z.enum(REGIOES),
  regiaoFallback: z.enum(REGIOES),
  descricao: z.string().min(1),
});

const AgendarTesteSchema = z.object({
  cenarioId: z.string().min(1),
  agendadoParа: z.string().min(1),
  responsavel: z.string().min(1),
});

const ExecutarTesteSchema = z.object({
  rtoRealHoras: z.number().positive(),
  rpoRealHoras: z.number().positive(),
  evidenciaConteudo: z.string().min(1),
  observacoes: z.string().optional(),
});

const AtualizarRegiaoSchema = z.object({
  saudavel: z.boolean().optional(),
  latenciaMs: z.number().min(0).optional(),
});

const FailoverSchema = z.object({
  regiaoFalha: z.enum(REGIOES),
});

// ─── Cenários ────────────────────────────────────────────────────────────────

router.post("/cenarios", (req: Request, res: Response) => {
  const parse = CenarioSchema.safeParse(req.body);
  if (!parse.success) {
    res
      .status(400)
      .json({ erro: "Payload inválido", detalhes: parse.error.flatten() });
    return;
  }
  const c = BcpDrService.criarCenario(
    parse.data as Parameters<typeof BcpDrService.criarCenario>[0],
  );
  res.status(201).json(c);
});

router.get("/cenarios", (_req: Request, res: Response) => {
  res.json(BcpDrService.listarCenarios());
});

router.get("/cenarios/:id", (req: Request, res: Response) => {
  try {
    res.json(BcpDrService.getCenario(req.params.id));
  } catch (err: unknown) {
    res.status(404).json({ erro: (err as Error).message });
  }
});

// ─── Testes ───────────────────────────────────────────────────────────────────

router.post("/testes", (req: Request, res: Response) => {
  const parse = AgendarTesteSchema.safeParse(req.body);
  if (!parse.success) {
    res
      .status(400)
      .json({ erro: "Payload inválido", detalhes: parse.error.flatten() });
    return;
  }
  try {
    const t = BcpDrService.agendarTeste(
      parse.data as Parameters<typeof BcpDrService.agendarTeste>[0],
    );
    res.status(201).json(t);
  } catch (err: unknown) {
    res.status(404).json({ erro: (err as Error).message });
  }
});

router.post("/testes/:id/executar", (req: Request, res: Response) => {
  const parse = ExecutarTesteSchema.safeParse(req.body);
  if (!parse.success) {
    res
      .status(400)
      .json({ erro: "Payload inválido", detalhes: parse.error.flatten() });
    return;
  }
  try {
    const t = BcpDrService.executarTeste(req.params.id, parse.data);
    res.json(t);
  } catch (err: unknown) {
    res.status(404).json({ erro: (err as Error).message });
  }
});

router.get("/testes", (req: Request, res: Response) => {
  const { cenarioId } = req.query;
  res.json(BcpDrService.listarTestes(cenarioId as string | undefined));
});

// ─── Regiões / Redundância Geográfica ────────────────────────────────────────

router.get("/regioes", (_req: Request, res: Response) => {
  res.json(BcpDrService.listarRegioes());
});

router.patch("/regioes/:regiao", (req: Request, res: Response) => {
  const parse = AtualizarRegiaoSchema.safeParse(req.body);
  if (!parse.success) {
    res
      .status(400)
      .json({ erro: "Payload inválido", detalhes: parse.error.flatten() });
    return;
  }
  try {
    const r = BcpDrService.atualizarStatusRegiao(
      req.params.regiao as RegiaoCloud,
      parse.data,
    );
    res.json(r);
  } catch (err: unknown) {
    res.status(404).json({ erro: (err as Error).message });
  }
});

router.post("/failover", (req: Request, res: Response) => {
  const parse = FailoverSchema.safeParse(req.body);
  if (!parse.success) {
    res
      .status(400)
      .json({ erro: "Payload inválido", detalhes: parse.error.flatten() });
    return;
  }
  const resultado = BcpDrService.simularFailover(
    parse.data.regiaoFalha as RegiaoCloud,
  );
  res.json(resultado);
});

// GET /resumo — dashboard de conformidade BCP/DR
router.get("/resumo", (_req: Request, res: Response) => {
  res.json(BcpDrService.getResumo());
});

export default router;
