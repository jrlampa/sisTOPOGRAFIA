/**
 * Rotas T2-105 — Simulador de Impacto Financeiro (TCO/Capex/Opex)
 * Prefixo: /api/tco-capex-opex
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { TcoCapexOpexService } from "../services/tcoCapexOpexService.js";

const router = Router();

const tipoInvestimentoEnum = z.enum([
  "nova_rede",
  "expansao_rede",
  "modernizacao",
  "digitalizacao",
  "automacao",
  "smart_grid",
  "microgeracao",
  "reducao_perdas",
  "outro",
]);

// POST /simulacoes
router.post("/simulacoes", (req: Request, res: Response): void => {
  const schema = z.object({
    tenantId: z.string().min(2),
    titulo: z.string().min(3),
    tipoInvestimento: tipoInvestimentoEnum,
    responsavel: z.string().min(2),
    horizonte: z.number().int().min(1).max(30).optional(),
    taxaDesconto: z.number().min(0.001).max(0.5).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: parsed.error.errors });
    return;
  }

  const d = parsed.data;
  const sim = TcoCapexOpexService.criarSimulacao(
    d.tenantId, d.titulo, d.tipoInvestimento, d.responsavel,
    d.horizonte, d.taxaDesconto
  );
  res.status(201).json(sim);
});

// GET /simulacoes
router.get("/simulacoes", (req: Request, res: Response): void => {
  const tenantId = req.query["tenantId"] as string | undefined;
  res.json(TcoCapexOpexService.listarSimulacoes(tenantId));
});

// GET /simulacoes/:id
router.get("/simulacoes/:id", (req: Request, res: Response): void => {
  const sim = TcoCapexOpexService.obterSimulacao(req.params["id"]!);
  if (!sim) { res.status(404).json({ erro: "Simulação não encontrada" }); return; }
  res.json(sim);
});

// POST /simulacoes/:id/capex
router.post("/simulacoes/:id/capex", (req: Request, res: Response): void => {
  const schema = z.object({
    descricao: z.string().min(3),
    categoria: z.string().min(2),
    anoDesembolso: z.number().int().min(0),
    valorReais: z.number().min(0),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: parsed.error.errors });
    return;
  }

  const d = parsed.data;
  try {
    const item = TcoCapexOpexService.adicionarCapex(
      req.params["id"]!, d.descricao, d.categoria, d.anoDesembolso, d.valorReais
    );
    res.status(201).json(item);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    res.status(422).json({ erro: msg });
  }
});

// POST /simulacoes/:id/opex
router.post("/simulacoes/:id/opex", (req: Request, res: Response): void => {
  const schema = z.object({
    descricao: z.string().min(3),
    categoria: z.string().min(2),
    custoAnual: z.number().min(0),
    anoInicio: z.number().int().min(1),
    anoFim: z.number().int().min(1).nullable().default(null),
    taxaCrescimentoAnual: z.number().min(0).max(0.5).default(0),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: parsed.error.errors });
    return;
  }

  const d = parsed.data;
  try {
    const item = TcoCapexOpexService.adicionarOpex(
      req.params["id"]!, d.descricao, d.categoria, d.custoAnual,
      d.anoInicio, d.anoFim, d.taxaCrescimentoAnual
    );
    res.status(201).json(item);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    res.status(422).json({ erro: msg });
  }
});

// POST /simulacoes/:id/beneficios
router.post("/simulacoes/:id/beneficios", (req: Request, res: Response): void => {
  const schema = z.object({
    beneficiosAnuais: z.record(z.coerce.number(), z.number().min(0)),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: parsed.error.errors });
    return;
  }

  try {
    const sim = TcoCapexOpexService.definirBeneficios(
      req.params["id"]!, parsed.data.beneficiosAnuais
    );
    res.json(sim);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    res.status(422).json({ erro: msg });
  }
});

// POST /simulacoes/:id/calcular
router.post("/simulacoes/:id/calcular", (req: Request, res: Response): void => {
  try {
    const resultado = TcoCapexOpexService.calcularTCO(req.params["id"]!);
    res.json(resultado);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    res.status(422).json({ erro: msg });
  }
});

// POST /simulacoes/:id/aprovar
router.post("/simulacoes/:id/aprovar", (req: Request, res: Response): void => {
  try {
    const sim = TcoCapexOpexService.aprovarSimulacao(req.params["id"]!);
    res.json(sim);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    res.status(422).json({ erro: msg });
  }
});

// GET /tipos-investimento
router.get("/tipos-investimento", (_req: Request, res: Response): void => {
  res.json(TcoCapexOpexService.listarTiposInvestimento());
});

export default router;
