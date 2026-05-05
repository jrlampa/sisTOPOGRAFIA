import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  PerdasNaoTecnicasService,
  type CategoriaPerda,
} from "../services/perdasNaoTecnicasService.js";

const router = Router();

// ─── Schemas de validação ────────────────────────────────────────────────────

const categoriasPerdaValidas: CategoriaPerda[] = [
  "fraude_medicao",
  "ligacao_clandestina",
  "erro_medicao",
  "inadimplencia_corte",
  "nao_identificada",
];

const criarSchema = z.object({
  nome: z.string().min(2),
  tenantId: z.string().min(2),
  projetoId: z.string().optional(),
  subestacaoId: z.string().optional(),
});

const pontoMedicaoSchema = z.object({
  codigo: z.string().min(2),
  descricao: z.string().optional(),
  energiaInjetadaKwh: z.number().positive(),
  energiaFaturadaKwh: z.number().nonnegative(),
  energiaPerdidasTecnicasKwh: z.number().nonnegative().optional(),
  periodoInicio: z.string().min(8),
  periodoFim: z.string().min(8),
  observacoes: z.string().optional(),
});

const ocorrenciaSchema = z.object({
  categoria: z.enum([
    "fraude_medicao",
    "ligacao_clandestina",
    "erro_medicao",
    "inadimplencia_corte",
    "nao_identificada",
  ]),
  kwh: z.number().positive(),
});

// ─── Rotas ────────────────────────────────────────────────────────────────────

// POST /api/perdas-nao-tecnicas/monitoramentos
router.post("/monitoramentos", (req: Request, res: Response) => {
  const parse = criarSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: parse.error.issues });
    return;
  }
  const monitoramento = PerdasNaoTecnicasService.criarMonitoramento(parse.data);
  res.status(201).json(monitoramento);
});

// GET /api/perdas-nao-tecnicas/monitoramentos?tenantId=
router.get("/monitoramentos", (req: Request, res: Response) => {
  const tenantId = req.query["tenantId"] as string | undefined;
  if (!tenantId) {
    res.status(400).json({ erro: "Parâmetro tenantId é obrigatório" });
    return;
  }
  res.json(PerdasNaoTecnicasService.listarMonitoramentos(tenantId));
});

// GET /api/perdas-nao-tecnicas/monitoramentos/:id
router.get("/monitoramentos/:id", (req: Request, res: Response) => {
  const mon = PerdasNaoTecnicasService.obterMonitoramento(req.params["id"]!);
  if (!mon) {
    res.status(404).json({ erro: "Monitoramento não encontrado" });
    return;
  }
  res.json(mon);
});

// POST /api/perdas-nao-tecnicas/monitoramentos/:id/pontos
router.post("/monitoramentos/:id/pontos", (req: Request, res: Response) => {
  const parse = pontoMedicaoSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: parse.error.issues });
    return;
  }
  const mon = PerdasNaoTecnicasService.adicionarPontoMedicao(req.params["id"]!, parse.data);
  if (!mon) {
    res.status(404).json({ erro: "Monitoramento não encontrado" });
    return;
  }
  res.status(201).json(mon);
});

// POST /api/perdas-nao-tecnicas/monitoramentos/:id/ocorrencias
router.post("/monitoramentos/:id/ocorrencias", (req: Request, res: Response) => {
  const parse = ocorrenciaSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: parse.error.issues });
    return;
  }
  const mon = PerdasNaoTecnicasService.registrarOcorrencia(
    req.params["id"]!,
    parse.data.categoria,
    parse.data.kwh
  );
  if (!mon) {
    res.status(404).json({ erro: "Monitoramento não encontrado" });
    return;
  }
  res.status(201).json(mon);
});

// POST /api/perdas-nao-tecnicas/monitoramentos/:id/calcular
router.post("/monitoramentos/:id/calcular", (req: Request, res: Response) => {
  const resultado = PerdasNaoTecnicasService.calcularPerdas(req.params["id"]!);
  if ("erro" in resultado) {
    res.status(422).json(resultado);
    return;
  }
  res.json(resultado);
});

// POST /api/perdas-nao-tecnicas/monitoramentos/:id/encerrar
router.post("/monitoramentos/:id/encerrar", (req: Request, res: Response) => {
  const mon = PerdasNaoTecnicasService.encerrarMonitoramento(req.params["id"]!);
  if (!mon) {
    res.status(404).json({ erro: "Monitoramento não encontrado" });
    return;
  }
  res.json(mon);
});

// GET /api/perdas-nao-tecnicas/categorias
router.get("/categorias", (_req: Request, res: Response) => {
  res.json(categoriasPerdaValidas);
});

export default router;
