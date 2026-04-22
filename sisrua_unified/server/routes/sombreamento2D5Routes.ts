/**
 * Rotas T2-61 — Análise de Sombreamento 2.5D
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { Sombreamento2D5Service } from "../services/sombreamento2D5Service.js";

const router = Router();

const TipoAtivoEnum = z.enum([
  "poste", "transformador", "painel_solar", "medicao", "subestacao", "edificacao", "outro",
]);

const CriarAnaliseSchema = z.object({
  tenantId: z.string().min(2),
  projetoId: z.string().min(2),
  nomeAtivo: z.string().min(3),
  tipoAtivo: TipoAtivoEnum,
  coordenadas: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  alturaAtivo: z.number().positive(),
  alturaObstrucao: z.number().nonnegative(),
  distanciaObstrucaoM: z.number().nonnegative(),
  orientacaoGraus: z.number().min(0).max(360).optional(),
  dataAnalise: z.string().min(8),
});

// POST /analises
router.post("/analises", (req: Request, res: Response) => {
  const parse = CriarAnaliseSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(Sombreamento2D5Service.criarAnalise(parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /analises
router.get("/analises", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;
  return res.json(Sombreamento2D5Service.listarAnalises(tenantId));
});

// GET /analises/:id
router.get("/analises/:id", (req: Request, res: Response) => {
  const analise = Sombreamento2D5Service.obterAnalise(req.params.id);
  if (!analise) return res.status(404).json({ error: "Análise de sombreamento não encontrada" });
  return res.json(analise);
});

// POST /analises/:id/calcular
router.post("/analises/:id/calcular", (req: Request, res: Response) => {
  try {
    return res.json(Sombreamento2D5Service.calcularSombreamento(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /analises/:id/aprovar
router.post("/analises/:id/aprovar", (req: Request, res: Response) => {
  try {
    return res.json(Sombreamento2D5Service.aprovarAnalise(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /tipos-ativo
router.get("/tipos-ativo", (_req: Request, res: Response) => {
  return res.json(Sombreamento2D5Service.listarTiposAtivo());
});

export default router;
