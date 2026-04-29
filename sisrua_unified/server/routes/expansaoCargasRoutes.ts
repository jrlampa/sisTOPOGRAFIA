import { Router, Request, Response } from "express";
import { z } from "zod";
import { ExpansaoCargasService, type TipoCarga } from "../services/expansaoCargasService.js";

const router = Router();

// ─── Schemas de validação ────────────────────────────────────────────────────

const criarSchema = z.object({
  nome: z.string().min(2),
  tenantId: z.string().min(2),
  projetoId: z.string().optional(),
  transformadorKva: z.number().positive(),
  observacoes: z.string().optional(),
});

const cargaExistenteSchema = z.object({
  descricao: z.string().min(2),
  potenciaKva: z.number().positive(),
  fatorDemanda: z.number().min(0).max(1).optional(),
});

const novaCargaSchema = z.object({
  descricao: z.string().min(2),
  tipoCarga: z.enum([
    "residencial_padrao",
    "residencial_alto_padrao",
    "comercial_pequeno",
    "comercial_medio",
    "industrial_pequeno",
    "carregador_ve",
    "outro",
  ]),
  potenciaKva: z.number().positive(),
  quantidade: z.number().int().positive(),
  fatorCoincidencia: z.number().min(0).max(1).optional(),
});

// ─── Rotas ────────────────────────────────────────────────────────────────────

// POST /api/expansao-cargas/simulacoes
router.post("/simulacoes", (req: Request, res: Response) => {
  const parse = criarSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: parse.error.issues });
    return;
  }
  const resultado = ExpansaoCargasService.criarSimulacao(parse.data);
  if ("erro" in resultado) {
    res.status(422).json(resultado);
    return;
  }
  res.status(201).json(resultado);
});

// GET /api/expansao-cargas/simulacoes?tenantId=
router.get("/simulacoes", (req: Request, res: Response) => {
  const tenantId = req.query["tenantId"] as string | undefined;
  if (!tenantId) {
    res.status(400).json({ erro: "Parâmetro tenantId é obrigatório" });
    return;
  }
  res.json(ExpansaoCargasService.listarSimulacoes(tenantId));
});

// GET /api/expansao-cargas/simulacoes/:id
router.get("/simulacoes/:id", (req: Request, res: Response) => {
  const sim = ExpansaoCargasService.obterSimulacao(req.params["id"]!);
  if (!sim) {
    res.status(404).json({ erro: "Simulação não encontrada" });
    return;
  }
  res.json(sim);
});

// POST /api/expansao-cargas/simulacoes/:id/cargas-existentes
router.post("/simulacoes/:id/cargas-existentes", (req: Request, res: Response) => {
  const parse = cargaExistenteSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: parse.error.issues });
    return;
  }
  const sim = ExpansaoCargasService.adicionarCargaExistente(req.params["id"]!, parse.data);
  if (!sim) {
    res.status(404).json({ erro: "Simulação não encontrada" });
    return;
  }
  res.status(201).json(sim);
});

// POST /api/expansao-cargas/simulacoes/:id/novas-cargas
router.post("/simulacoes/:id/novas-cargas", (req: Request, res: Response) => {
  const parse = novaCargaSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: parse.error.issues });
    return;
  }
  const sim = ExpansaoCargasService.adicionarNovaCarga(req.params["id"]!, parse.data);
  if (!sim) {
    res.status(404).json({ erro: "Simulação não encontrada" });
    return;
  }
  res.status(201).json(sim);
});

// POST /api/expansao-cargas/simulacoes/:id/simular
router.post("/simulacoes/:id/simular", (req: Request, res: Response) => {
  const resultado = ExpansaoCargasService.simular(req.params["id"]!);
  if ("erro" in resultado) {
    res.status(422).json(resultado);
    return;
  }
  res.json(resultado);
});

// POST /api/expansao-cargas/simulacoes/:id/aprovar
router.post("/simulacoes/:id/aprovar", (req: Request, res: Response) => {
  const resultado = ExpansaoCargasService.aprovarSimulacao(req.params["id"]!);
  if ("erro" in resultado) {
    res.status(422).json(resultado);
    return;
  }
  res.json(resultado);
});

export default router;
