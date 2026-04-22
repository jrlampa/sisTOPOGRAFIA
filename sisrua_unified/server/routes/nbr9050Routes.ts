/**
 * Rotas T2-60 — Verificação NBR 9050 Automática
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { Nbr9050Service } from "../services/nbr9050Service.js";

const router = Router();

const CriterioEnum = z.enum([
  "largura_calcada_minima", "rampa_acesso_deficiente", "piso_tatil_direcional",
  "piso_tatil_atencao", "travessia_pedestre", "sinalizacao_visual",
  "sinalizacao_sonora", "mobiliario_zona_livre", "inclinacao_transversal", "inclinacao_longitudinal",
]);

const CriarAnaliseSchema = z.object({
  tenantId: z.string().min(2),
  projetoId: z.string().min(2),
  logradouro: z.string().min(5),
  municipio: z.string().min(2),
  uf: z.string().length(2),
  analistaTecnico: z.string().min(3),
  dataAnalise: z.string().min(8),
});

const RegistrarItemSchema = z.object({
  criterio: CriterioEnum,
  resultado: z.enum(["conforme", "nao_conforme", "nao_aplicavel"]),
  valorMedido: z.number().optional(),
  observacao: z.string().optional(),
});

const ProcessarSchema = z.object({ parecerTecnico: z.string().optional() });

// POST /analises
router.post("/analises", (req: Request, res: Response) => {
  const parse = CriarAnaliseSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(Nbr9050Service.criarAnalise(parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /analises
router.get("/analises", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;
  return res.json(Nbr9050Service.listarAnalises(tenantId));
});

// GET /analises/:id
router.get("/analises/:id", (req: Request, res: Response) => {
  const analise = Nbr9050Service.obterAnalise(req.params.id);
  if (!analise) return res.status(404).json({ error: "Análise NBR 9050 não encontrada" });
  return res.json(analise);
});

// POST /analises/:id/itens
router.post("/analises/:id/itens", (req: Request, res: Response) => {
  const parse = RegistrarItemSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(Nbr9050Service.registrarItem(req.params.id, parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /analises/:id/processar
router.post("/analises/:id/processar", (req: Request, res: Response) => {
  const parse = ProcessarSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.json(Nbr9050Service.processarAnalise(req.params.id, parse.data.parecerTecnico));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /criterios
router.get("/criterios", (_req: Request, res: Response) => {
  return res.json(Nbr9050Service.listarCriterios());
});

export default router;
