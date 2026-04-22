/**
 * Rotas T2-101 — Dossiê de Remuneração Regulatória (MCPSE/ANEEL)
 * Prefixo: /api/remuneracao-regulatoria
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { RemuneracaoRegulatoriaService } from "../services/remuneracaoRegulatoriaService.js";

const router = Router();

const tipoAtivoEnum = z.enum([
  "rede_bt",
  "rede_mt",
  "rede_at",
  "transformador_distribuicao",
  "religador",
  "banco_capacitor",
  "sistema_medicao",
  "subestacao_mt_bt",
  "poste_estrutura",
]);

// POST /dossies
router.post("/dossies", (req: Request, res: Response): void => {
  const schema = z.object({
    tenantId: z.string().min(2),
    titulo: z.string().min(3),
    concessionaria: z.string().min(2),
    cicloTarifario: z.string().min(2),
    anoReferencia: z.number().int().min(2000).max(2100),
    responsavel: z.string().min(2),
    waccRegulatorio: z.number().min(0.001).max(0.5).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: parsed.error.errors });
    return;
  }

  const d = parsed.data;
  const dossie = RemuneracaoRegulatoriaService.criarDossie(
    d.tenantId, d.titulo, d.concessionaria, d.cicloTarifario,
    d.anoReferencia, d.responsavel, d.waccRegulatorio
  );
  res.status(201).json(dossie);
});

// GET /dossies
router.get("/dossies", (req: Request, res: Response): void => {
  const tenantId = req.query["tenantId"] as string | undefined;
  res.json(RemuneracaoRegulatoriaService.listarDossies(tenantId));
});

// GET /dossies/:id
router.get("/dossies/:id", (req: Request, res: Response): void => {
  const dossie = RemuneracaoRegulatoriaService.obterDossie(req.params["id"]!);
  if (!dossie) { res.status(404).json({ erro: "Dossiê não encontrado" }); return; }
  res.json(dossie);
});

// POST /dossies/:id/ativos
router.post("/dossies/:id/ativos", (req: Request, res: Response): void => {
  const schema = z.object({
    tipoAtivo: tipoAtivoEnum,
    descricao: z.string().min(3),
    quantidade: z.number().int().min(1),
    vnrUnitario: z.number().min(0),
    idadeAnos: z.number().min(0),
    anoInstalacao: z.number().int().min(1900).max(2100),
    vidaUtilRegulatoriaAnos: z.number().int().min(1).max(100).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: parsed.error.errors });
    return;
  }

  const d = parsed.data;
  try {
    const ativo = RemuneracaoRegulatoriaService.adicionarAtivo(
      req.params["id"]!, d.tipoAtivo, d.descricao, d.quantidade,
      d.vnrUnitario, d.idadeAnos, d.anoInstalacao, d.vidaUtilRegulatoriaAnos
    );
    res.status(201).json(ativo);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    res.status(422).json({ erro: msg });
  }
});

// POST /dossies/:id/calcular
router.post("/dossies/:id/calcular", (req: Request, res: Response): void => {
  try {
    const resultado = RemuneracaoRegulatoriaService.calcularRemuneracao(req.params["id"]!);
    res.json(resultado);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    res.status(422).json({ erro: msg });
  }
});

// POST /dossies/:id/publicar
router.post("/dossies/:id/publicar", (req: Request, res: Response): void => {
  try {
    const dossie = RemuneracaoRegulatoriaService.publicarDossie(req.params["id"]!);
    res.json(dossie);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    res.status(422).json({ erro: msg });
  }
});

// POST /dossies/:id/homologar
router.post("/dossies/:id/homologar", (req: Request, res: Response): void => {
  try {
    const dossie = RemuneracaoRegulatoriaService.homologarDossie(req.params["id"]!);
    res.json(dossie);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    res.status(422).json({ erro: msg });
  }
});

// GET /tipos-ativo
router.get("/tipos-ativo", (_req: Request, res: Response): void => {
  res.json(RemuneracaoRegulatoriaService.listarTiposAtivo());
});

export default router;
