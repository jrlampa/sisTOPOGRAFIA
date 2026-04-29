/**
 * Rotas T2-94 — LCC por Família de Equipamentos
 * Prefixo: /api/lcc-familia
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { LccFamiliaService } from "../services/lccFamiliaService.js";

const router = Router();

const familiaEnum = z.enum([
  "poste_concreto",
  "poste_madeira",
  "poste_ferro",
  "transformador_monofasico",
  "transformador_trifasico",
  "cabo_multiplexado",
  "cabo_nu",
  "chave_fusivel",
  "religador",
  "medidor",
]);

// POST /analises — criar análise LCC
router.post("/analises", (req: Request, res: Response): void => {
  const schema = z.object({
    tenantId: z.string().min(2),
    titulo: z.string().min(3),
    descricao: z.string().min(3),
    responsavel: z.string().min(2),
    horizonte: z.number().int().min(1).max(50).optional(),
    taxaDesconto: z.number().min(0.001).max(0.5).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: parsed.error.issues });
    return;
  }

  const { tenantId, titulo, descricao, responsavel, horizonte, taxaDesconto } = parsed.data;
  const analise = LccFamiliaService.criarAnalise(
    tenantId, titulo, descricao, responsavel, horizonte, taxaDesconto
  );
  res.status(201).json(analise);
});

// GET /analises — listar análises
router.get("/analises", (req: Request, res: Response): void => {
  const tenantId = req.query["tenantId"] as string | undefined;
  res.json(LccFamiliaService.listarAnalises(tenantId));
});

// GET /analises/:id
router.get("/analises/:id", (req: Request, res: Response): void => {
  const analise = LccFamiliaService.obterAnalise(req.params["id"]!);
  if (!analise) { res.status(404).json({ erro: "Análise não encontrada" }); return; }
  res.json(analise);
});

// POST /analises/:id/equipamentos — adicionar equipamento
router.post("/analises/:id/equipamentos", (req: Request, res: Response): void => {
  const schema = z.object({
    familia: familiaEnum,
    descricao: z.string().min(3),
    quantidade: z.number().int().min(1),
    custoAquisicaoUnitario: z.number().min(0),
    custoInstalacaoUnitario: z.number().min(0),
    custoManutencaoAnual: z.number().min(0),
    custoSubstituicao: z.number().min(0),
    custoDescarte: z.number().min(0),
    vidaUtilAnos: z.number().int().min(1).max(100).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: parsed.error.issues });
    return;
  }

  const d = parsed.data;
  try {
    const eq = LccFamiliaService.adicionarEquipamento(
      req.params["id"]!,
      d.familia,
      d.descricao,
      d.quantidade,
      d.custoAquisicaoUnitario,
      d.custoInstalacaoUnitario,
      d.custoManutencaoAnual,
      d.custoSubstituicao,
      d.custoDescarte,
      d.vidaUtilAnos
    );
    res.status(201).json(eq);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    res.status(422).json({ erro: msg });
  }
});

// POST /analises/:id/calcular
router.post("/analises/:id/calcular", (req: Request, res: Response): void => {
  try {
    const resultado = LccFamiliaService.calcularLCC(req.params["id"]!);
    res.json(resultado);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    res.status(422).json({ erro: msg });
  }
});

// POST /analises/:id/publicar
router.post("/analises/:id/publicar", (req: Request, res: Response): void => {
  try {
    const analise = LccFamiliaService.publicarAnalise(req.params["id"]!);
    res.json(analise);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    res.status(422).json({ erro: msg });
  }
});

// GET /familias
router.get("/familias", (_req: Request, res: Response): void => {
  res.json(LccFamiliaService.listarFamilias());
});

export default router;
