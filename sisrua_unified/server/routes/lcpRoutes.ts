/**
 * Rotas T2-59 — Motor Least-Cost Path (LCP)
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { LcpService } from "../services/lcpService.js";

const router = Router();

const CoordenadaSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

const TipoTerritorioEnum = z.enum([
  "urbano", "rural", "cruzamento_viario",
  "area_preservacao", "interferencia_subterranea", "travessia_hidrografica",
]);

const CriarProjetoSchema = z.object({
  tenantId: z.string().min(2),
  projetoId: z.string().min(2),
  nomeProjeto: z.string().min(3),
  pontoOrigem: CoordenadaSchema,
  pontoDestino: CoordenadaSchema,
  segmentosEntrada: z
    .array(
      z.object({
        tipoTerritorio: TipoTerritorioEnum,
        comprimentoM: z.number().positive(),
      })
    )
    .min(1),
  configuracao: z
    .object({
      custoUrbanoPorM: z.number().positive().optional(),
      custoRuralPorM: z.number().positive().optional(),
      custoCruzamentoPorUnidade: z.number().positive().optional(),
    })
    .optional(),
});

const AprovarSchema = z.object({ aprovadoPor: z.string().min(3) });

// POST /projetos
router.post("/projetos", (req: Request, res: Response) => {
  const parse = CriarProjetoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(LcpService.criarProjeto(parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /projetos
router.get("/projetos", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;
  return res.json(LcpService.listarProjetos(tenantId));
});

// GET /projetos/:id
router.get("/projetos/:id", (req: Request, res: Response) => {
  const projeto = LcpService.obterProjeto(req.params.id);
  if (!projeto) return res.status(404).json({ error: "Projeto LCP não encontrado" });
  return res.json(projeto);
});

// POST /projetos/:id/calcular
router.post("/projetos/:id/calcular", (req: Request, res: Response) => {
  try {
    return res.json(LcpService.calcularTracado(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /projetos/:id/aprovar
router.post("/projetos/:id/aprovar", (req: Request, res: Response) => {
  const parse = AprovarSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.json(LcpService.aprovarTracado(req.params.id, parse.data.aprovadoPor));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /configuracao-padrao
router.get("/configuracao-padrao", (_req: Request, res: Response) => {
  return res.json(LcpService.obterConfiguracaoPadrao());
});

export default router;
