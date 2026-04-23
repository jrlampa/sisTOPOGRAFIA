/**
 * Rotas T2-108 — Verificador NBR 9050 — Calçadas
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { NbrCalcadasService } from "../services/nbrCalcadasService.js";

const router = Router();

const TipoViaEnum = z.enum(["local", "coletora", "arterial", "expressa"]);
const TipoObstaculoEnum = z.enum([
  "poste_iluminacao",
  "poste_telefonia",
  "arvore",
  "banca_jornal",
  "lixeira",
  "placa_publicidade",
  "mobiliario_urbano",
  "outros",
]);

const CriarRegistroSchema = z.object({
  tenantId: z.string().min(2),
  logradouro: z.string().min(5),
  municipio: z.string().min(2),
  uf: z.string().length(2),
  tipoVia: TipoViaEnum,
  larguraTotalM: z.number().positive(),
  faixaServicoM: z.number().nonnegative(),
  faixaLivreM: z.number().nonnegative(),
  faixaAcessoM: z.number().nonnegative(),
  tecnicoResponsavel: z.string().min(3),
  dataVistoria: z.string().min(8),
});

const AdicionarObstaculoSchema = z.object({
  tipo: TipoObstaculoEnum,
  posicaoM: z.number().nonnegative(),
  larguraM: z.number().positive(),
});

// POST /registros
router.post("/registros", (req: Request, res: Response) => {
  const parse = CriarRegistroSchema.safeParse(req.body);
  if (!parse.success)
    return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(NbrCalcadasService.criarRegistro(parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /registros
router.get("/registros", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;
  return res.json(NbrCalcadasService.listarRegistros(tenantId));
});

// GET /registros/:id
router.get("/registros/:id", (req: Request, res: Response) => {
  const registro = NbrCalcadasService.obterRegistro(req.params.id);
  if (!registro)
    return res
      .status(404)
      .json({ error: "Registro de calçada não encontrado" });
  return res.json(registro);
});

// POST /registros/:id/obstaculos
router.post("/registros/:id/obstaculos", (req: Request, res: Response) => {
  const parse = AdicionarObstaculoSchema.safeParse(req.body);
  if (!parse.success)
    return res.status(400).json({ errors: parse.error.issues });
  try {
    return res
      .status(201)
      .json(NbrCalcadasService.adicionarObstaculo(req.params.id, parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /registros/:id/analisar
router.post("/registros/:id/analisar", (req: Request, res: Response) => {
  try {
    return res.json(NbrCalcadasService.analisarCalcada(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /tipos-via
router.get("/tipos-via", (_req: Request, res: Response) => {
  return res.json(NbrCalcadasService.listarTiposVia());
});

// GET /larguras-minimas
router.get("/larguras-minimas", (_req: Request, res: Response) => {
  return res.json(NbrCalcadasService.obterLargurasMinimasPorTipoVia());
});

export default router;
