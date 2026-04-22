/**
 * Rotas T2-67 — Ciclo As-Built Mobile
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { AsBuiltMobileService } from "../services/asBuiltMobileService.js";

const router = Router();

const TipoDesvioEnum = z.enum([
  "posicao", "altura", "tipo_equipamento", "numeracao", "circuito", "carga", "outro",
]);
const ImpactoEnum = z.enum(["baixo", "medio", "alto", "critico"]);

const CriarRegistroSchema = z.object({
  tenantId: z.string().min(2),
  projetoId: z.string().min(2),
  nomeProjeto: z.string().min(3),
  responsavelCampo: z.string().min(3),
  data: z.string().min(8),
  observacoesCampo: z.string().optional(),
});

const AdicionarDesvioSchema = z.object({
  assetId: z.string().min(2),
  tipoDesvio: TipoDesvioEnum,
  descricao: z.string().min(5),
  valorOriginal: z.string().optional(),
  valorExecutado: z.string().min(1),
  coordenadasCampo: z
    .object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })
    .optional(),
  impacto: ImpactoEnum,
});

const AprovarSchema = z.object({ aprovadoPor: z.string().min(3) });
const RejeitarSchema = z.object({ motivo: z.string().min(5) });

// POST /registros
router.post("/registros", (req: Request, res: Response) => {
  const parse = CriarRegistroSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(AsBuiltMobileService.criarRegistro(parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /registros
router.get("/registros", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;
  return res.json(AsBuiltMobileService.listarRegistros(tenantId));
});

// GET /registros/:id
router.get("/registros/:id", (req: Request, res: Response) => {
  const registro = AsBuiltMobileService.obterRegistro(req.params.id);
  if (!registro) return res.status(404).json({ error: "Registro As-Built não encontrado" });
  return res.json(registro);
});

// POST /registros/:id/desvios
router.post("/registros/:id/desvios", (req: Request, res: Response) => {
  const parse = AdicionarDesvioSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(AsBuiltMobileService.adicionarDesvio(req.params.id, parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /registros/:id/sincronizar
router.post("/registros/:id/sincronizar", (req: Request, res: Response) => {
  try {
    return res.json(AsBuiltMobileService.sincronizarRegistro(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /registros/:id/aprovar
router.post("/registros/:id/aprovar", (req: Request, res: Response) => {
  const parse = AprovarSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.json(AsBuiltMobileService.aprovarRegistro(req.params.id, parse.data.aprovadoPor));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /registros/:id/rejeitar
router.post("/registros/:id/rejeitar", (req: Request, res: Response) => {
  const parse = RejeitarSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.json(AsBuiltMobileService.rejeitarRegistro(req.params.id, parse.data.motivo));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /tipos-desvio
router.get("/tipos-desvio", (_req: Request, res: Response) => {
  return res.json(AsBuiltMobileService.listarTiposDesvio());
});

export default router;
