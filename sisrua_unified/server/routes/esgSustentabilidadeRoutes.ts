/**
 * Rotas T2-109 — Relatório ESG & Sustentabilidade Local
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { EsgSustentabilidadeService, DIMENSAO_INDICADOR } from "../services/esgSustentabilidadeService.js";

const router = Router();

const TipoIndicadorEnum = z.enum([
  "emissoes_co2_tco2e",
  "consumo_energia_kwh",
  "residuos_gerados_t",
  "area_supressao_vegetal_ha",
  "agua_consumida_m3",
  "biodiversidade_impactada_ha",
  "empregos_gerados",
  "empregos_locais_percentual",
  "comunidades_beneficiadas",
  "populacao_acesso_energia",
  "horas_formacao_profissional",
  "conformidade_regulatoria_percentual",
  "transparencia_publica_score",
  "licencas_obtidas",
  "auditorias_realizadas",
  "reclamacoes_resolvidas_percentual",
]);

const CriarRelatorioSchema = z.object({
  tenantId: z.string().min(2),
  titulo: z.string().min(3),
  exercicio: z.number().int().min(2000).max(2100),
  concessionaria: z.string().min(2),
  municipio: z.string().min(2),
  uf: z.string().length(2),
  responsavel: z.string().min(3),
});

const RegistrarIndicadorSchema = z.object({
  tipo: TipoIndicadorEnum,
  valor: z.number().nonnegative(),
  unidade: z.string().min(1),
  metaReferencia: z.number().positive().optional(),
  fonteColeta: z.string().min(3),
  periodoApuracao: z.string().min(4),
  observacao: z.string().optional(),
});

// POST /relatorios
router.post("/relatorios", (req: Request, res: Response) => {
  const parse = CriarRelatorioSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    const relatorio = EsgSustentabilidadeService.criarRelatorio(parse.data);
    return res.status(201).json(relatorio);
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /relatorios
router.get("/relatorios", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;
  return res.json(EsgSustentabilidadeService.listarRelatorios(tenantId));
});

// GET /relatorios/:id
router.get("/relatorios/:id", (req: Request, res: Response) => {
  const relatorio = EsgSustentabilidadeService.obterRelatorio(req.params.id);
  if (!relatorio) return res.status(404).json({ error: "Relatório não encontrado" });
  return res.json(relatorio);
});

// POST /relatorios/:id/indicadores
router.post("/relatorios/:id/indicadores", (req: Request, res: Response) => {
  const parse = RegistrarIndicadorSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    const indicador = EsgSustentabilidadeService.registrarIndicador(
      req.params.id,
      parse.data
    );
    return res.status(201).json(indicador);
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /relatorios/:id/calcular
router.post("/relatorios/:id/calcular", (req: Request, res: Response) => {
  try {
    const resultado = EsgSustentabilidadeService.calcularIndiceESG(req.params.id);
    return res.json(resultado);
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /relatorios/:id/publicar
router.post("/relatorios/:id/publicar", (req: Request, res: Response) => {
  try {
    const relatorio = EsgSustentabilidadeService.publicarRelatorio(req.params.id);
    return res.json(relatorio);
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /indicadores
router.get("/indicadores", (_req: Request, res: Response) => {
  return res.json(EsgSustentabilidadeService.listarIndicadores());
});

export default router;
