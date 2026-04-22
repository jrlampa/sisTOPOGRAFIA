/**
 * Rotas T2-69 — Dashboard de Produtividade Territorial
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { ProdutividadeTerritorialService } from "../services/produtividadeTerritorialService.js";

const router = Router();

const IndicadorCampoEnum = z.enum([
  "km_rede_projetada",
  "km_rede_executada",
  "postes_projetados",
  "postes_instalados",
  "transformadores_instalados",
  "ligacoes_novas",
  "vistorias_realizadas",
  "ocorrencias_registradas",
]);

const SetorGeograficoEnum = z.enum([
  "distrito", "bairro", "municipio", "regional", "estado",
]);

const PeriodoApuracaoEnum = z.enum([
  "diario", "semanal", "mensal", "trimestral", "anual",
]);

const CriarPainelSchema = z.object({
  tenantId: z.string().min(2),
  titulo: z.string().min(3),
  periodo: PeriodoApuracaoEnum,
  dataInicio: z.string().min(8),
  dataFim: z.string().min(8),
  concessionaria: z.string().min(2),
  responsavel: z.string().min(3),
});

const RegistrarMetricaSchema = z.object({
  equipeId: z.string().min(2),
  equipeName: z.string().min(3),
  setor: z.string().min(2),
  setorTipo: SetorGeograficoEnum,
  indicador: IndicadorCampoEnum,
  valorPlanejado: z.number().nonnegative(),
  valorExecutado: z.number().nonnegative(),
  dataReferencia: z.string().min(8),
  observacao: z.string().optional(),
});

// POST /paineis
router.post("/paineis", (req: Request, res: Response) => {
  const parse = CriarPainelSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    const painel = ProdutividadeTerritorialService.criarPainel(parse.data);
    return res.status(201).json(painel);
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /paineis
router.get("/paineis", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;
  return res.json(ProdutividadeTerritorialService.listarPaineis(tenantId));
});

// GET /paineis/:id
router.get("/paineis/:id", (req: Request, res: Response) => {
  const painel = ProdutividadeTerritorialService.obterPainel(req.params.id);
  if (!painel) return res.status(404).json({ error: "Painel não encontrado" });
  return res.json(painel);
});

// POST /paineis/:id/metricas
router.post("/paineis/:id/metricas", (req: Request, res: Response) => {
  const parse = RegistrarMetricaSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    const metrica = ProdutividadeTerritorialService.registrarMetrica(
      req.params.id,
      parse.data
    );
    return res.status(201).json(metrica);
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /paineis/:id/calcular
router.post("/paineis/:id/calcular", (req: Request, res: Response) => {
  try {
    const resultado = ProdutividadeTerritorialService.calcularProdutividade(req.params.id);
    return res.json(resultado);
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /paineis/:id/publicar
router.post("/paineis/:id/publicar", (req: Request, res: Response) => {
  try {
    const painel = ProdutividadeTerritorialService.publicarPainel(req.params.id);
    return res.json(painel);
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /indicadores
router.get("/indicadores", (_req: Request, res: Response) => {
  return res.json(ProdutividadeTerritorialService.listarIndicadores());
});

export default router;
