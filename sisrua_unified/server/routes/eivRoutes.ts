/**
 * Rotas T2-95 — Estudo de Impacto de Vizinhança (EIV)
 * Prefixo: /api/eiv
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { EivService } from "../services/eivService.js";

const router = Router();

const dimensaoEnum = z.enum([
  "trafego",
  "ruido",
  "paisagem_urbana",
  "qualidade_ar",
  "infraestrutura",
  "patrimonio_historico",
  "uso_solo",
  "geracao_emprego",
  "valoracao_imobiliaria",
]);

const nivelEnum = z.enum([
  "desprezivel",
  "baixo",
  "moderado",
  "alto",
  "critico",
]);

const zonaEnum = z.enum([
  "zona_residencial",
  "zona_comercial",
  "zona_industrial",
  "zona_mista",
  "zona_especial_interesse_social",
  "zona_protecao_ambiental",
  "area_central",
]);

// POST /estudos
router.post("/estudos", (req: Request, res: Response): void => {
  const schema = z.object({
    tenantId: z.string().min(2),
    titulo: z.string().min(3),
    empreendimento: z.string().min(3),
    municipio: z.string().min(2),
    uf: z.string().length(2),
    zonaUrbana: zonaEnum,
    areaImpactoM2: z.number().min(1),
    populacaoAfetada: z.number().int().min(0),
    responsavel: z.string().min(2),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: parsed.error.errors });
    return;
  }

  const d = parsed.data;
  const estudo = EivService.criarEstudo(
    d.tenantId, d.titulo, d.empreendimento, d.municipio, d.uf,
    d.zonaUrbana, d.areaImpactoM2, d.populacaoAfetada, d.responsavel
  );
  res.status(201).json(estudo);
});

// GET /estudos
router.get("/estudos", (req: Request, res: Response): void => {
  const tenantId = req.query["tenantId"] as string | undefined;
  res.json(EivService.listarEstudos(tenantId));
});

// GET /estudos/:id
router.get("/estudos/:id", (req: Request, res: Response): void => {
  const estudo = EivService.obterEstudo(req.params["id"]!);
  if (!estudo) { res.status(404).json({ erro: "Estudo não encontrado" }); return; }
  res.json(estudo);
});

// POST /estudos/:id/impactos
router.post("/estudos/:id/impactos", (req: Request, res: Response): void => {
  const schema = z.object({
    dimensao: dimensaoEnum,
    nivel: nivelEnum,
    descricao: z.string().min(5),
    medidasMitigadoras: z.array(z.string().min(3)).default([]),
    peso: z.number().min(0).max(1).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: parsed.error.errors });
    return;
  }

  const d = parsed.data;
  try {
    const impacto = EivService.adicionarImpacto(
      req.params["id"]!, d.dimensao, d.nivel, d.descricao,
      d.medidasMitigadoras, d.peso
    );
    res.status(201).json(impacto);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    res.status(422).json({ erro: msg });
  }
});

// POST /estudos/:id/calcular
router.post("/estudos/:id/calcular", (req: Request, res: Response): void => {
  try {
    const resultado = EivService.calcularEIV(req.params["id"]!);
    res.json(resultado);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    res.status(422).json({ erro: msg });
  }
});

// POST /estudos/:id/publicar
router.post("/estudos/:id/publicar", (req: Request, res: Response): void => {
  try {
    const estudo = EivService.publicarEstudo(req.params["id"]!);
    res.json(estudo);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    res.status(422).json({ erro: msg });
  }
});

// GET /dimensoes
router.get("/dimensoes", (_req: Request, res: Response): void => {
  res.json(EivService.listarDimensoes());
});

export default router;
