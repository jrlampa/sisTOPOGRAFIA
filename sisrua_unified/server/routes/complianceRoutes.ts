/**
 * complianceRoutes.ts — Items 97+98 [T1] + Items 45+46+60+61+107 [T2]
 * eMAG 3.1 Certification + ANEEL Provenance Dossier + Auto NBR 9050 + Environmental + Vegetation + Land Management
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { EmagCertService } from "../services/emagCertService.js";
import { AneelProvenanceService } from "../services/aneelProvenanceService.js";
import { Nbr9050Service } from "../services/nbr9050Service.js";
import { EsgAmbientalService } from "../services/esgAmbientalService.js";
import { VegetacaoInventarioService } from "../services/vegetacaoInventarioService.js";
import { LandManagementService } from "../services/landManagementService.js";
import { logger } from "../utils/logger.js";

const router = Router();

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Erro desconhecido";
}

// ─── eMAG 3.1 Certification (Item 97) ────────────────────────────────────────

router.get("/emag/requisitos", (req: Request, res: Response) => {
  const { secao } = req.query;
  const reqs = secao
    ? EmagCertService.listarRequisitos().filter((r) => r.secao === secao)
    : EmagCertService.listarRequisitos();
  return res.json(reqs);
});

router.post("/emag/inspecoes", (req: Request, res: Response) => {
  const { titulo, versaoSistema, responsavel } = req.body;
  if (!titulo || !versaoSistema || !responsavel) return res.status(400).json({ error: "Campos obrigatórios ausentes" });
  const insp = EmagCertService.criarInspecao({ titulo, versaoSistema, responsavel });
  return res.status(201).json(insp);
});

router.get("/emag/inspecoes", (req: Request, res: Response) => {
  return res.json(EmagCertService.listarInspecoes());
});

router.post("/emag/inspecoes/:id/evidencias", (req: Request, res: Response) => {
  const { id } = req.params;
  const { requisitoId, status, descricao, responsavel, artefato } = req.body;
  try {
    const ev = EmagCertService.registrarEvidencia(id, { requisitoId, status, descricao, responsavel, artefato });
    return res.status(201).json(ev);
  } catch (err: unknown) {
    return res.status(404).json({ error: getErrorMessage(err) });
  }
});

router.post("/emag/inspecoes/:id/concluir", (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const insp = EmagCertService.concluirInspecao(id);
    return res.json(insp);
  } catch (err: unknown) {
    return res.status(400).json({ error: getErrorMessage(err) });
  }
});

// ─── ANEEL Provenance Dossier (Item 98) ──────────────────────────────────────

router.post("/aneel/dossies", (req: Request, res: Response) => {
  const { titulo, projetoId, tenantId, responsavelTecnico, creaResponsavel } = req.body;
  if (!titulo || !projetoId || !tenantId || !responsavelTecnico) return res.status(400).json({ error: "Campos obrigatórios" });
  const d = AneelProvenanceService.criarDossie({ titulo, projetoId, tenantId, responsavelTecnico, creaResponsavel });
  return res.status(201).json(d);
});

router.get("/aneel/dossies", (req: Request, res: Response) => {
  const { tenantId } = req.query;
  return res.json(AneelProvenanceService.listarDossies(tenantId as string));
});

router.post("/aneel/dossies/:id/artefatos", (req: Request, res: Response) => {
  const { id } = req.params;
  const { tipo, nomeArquivo, conteudo, responsavelTecnico, versaoSistema, descricao } = req.body;
  try {
    const art = AneelProvenanceService.adicionarArtefato(id, { tipo, nomeArquivo, conteudo, responsavelTecnico, versaoSistema, descricao });
    return res.status(201).json(art);
  } catch (err: unknown) {
    return res.status(404).json({ error: getErrorMessage(err) });
  }
});

router.post("/aneel/dossies/:id/aprovar", (req: Request, res: Response) => {
  const { id } = req.params;
  const { conformidadeBdgd, conformidadeProdist } = req.body;
  try {
    const d = AneelProvenanceService.aprovarDossie(id, { conformidadeBdgd, conformidadeProdist });
    return res.json(d);
  } catch (err: unknown) {
    return res.status(400).json({ error: getErrorMessage(err) });
  }
});

router.post("/aneel/dossies/:id/submeter", (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const d = AneelProvenanceService.submeterAneel(id);
    return res.json(d);
  } catch (err: unknown) {
    return res.status(400).json({ error: getErrorMessage(err) });
  }
});

router.get("/aneel/dossies/:id/integridade", (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = AneelProvenanceService.verificarIntegridade(id);
    return res.json(result);
  } catch (err: unknown) {
    return res.status(404).json({ error: getErrorMessage(err) });
  }
});

// ─── Automatic Compliance (T2-45/46/60/61/107) ──────────────────────────────

const TopologySchema = z.object({
  poles: z.array(z.object({
    id: z.string(),
    lat: z.number(),
    lng: z.number()
  })),
  transformers: z.array(z.any()),
  edges: z.array(z.any())
});

/**
 * POST /api/compliance/nbr9050/auto
 */
router.post("/nbr9050/auto", async (req: Request, res: Response) => {
  try {
    const parsed = TopologySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Topologia inválida.", details: parsed.error.format() });
    const topologyInput = parsed.data as Parameters<typeof Nbr9050Service.analisarAcessibilidadeAutomatica>[0];
    const results = Nbr9050Service.analisarAcessibilidadeAutomatica(topologyInput);
    const score = results.length > 0 ? Math.round((results.filter(r => r.conforme).length / results.length) * 100) : 100;
    res.json({ timestamp: new Date().toISOString(), score, results });
  } catch (err: unknown) {
    logger.error("Erro na análise automática NBR 9050", { error: getErrorMessage(err) });
    res.status(500).json({ error: "Falha ao processar análise de acessibilidade." });
  }
});

/**
 * POST /api/compliance/environmental/auto
 */
router.post("/environmental/auto", async (req: Request, res: Response) => {
  try {
    const parsed = TopologySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Topologia inválida.", details: parsed.error.format() });
    const topologyInput = parsed.data as Parameters<typeof EsgAmbientalService.detectarInterferencias>[0];
    const interferencias = EsgAmbientalService.detectarInterferencias(topologyInput);
    res.json({ timestamp: new Date().toISOString(), riskLevel: interferencias.length > 0 ? "ALTO" : "BAIXO", totalInterferencias: interferencias.length, interferencias });
  } catch (err: unknown) {
    logger.error("Erro na detecção de interferências ambientais", { error: getErrorMessage(err) });
    res.status(500).json({ error: "Falha ao processar análise ambiental." });
  }
});

/**
 * POST /api/compliance/vegetation/auto
 */
router.post("/vegetation/auto", async (req: Request, res: Response) => {
  try {
    const topology = req.body.topology;
    const osmData = req.body.osmData || [];
    const parsed = TopologySchema.safeParse(topology);
    if (!parsed.success) return res.status(400).json({ error: "Topologia inválida.", details: parsed.error.format() });
    const topologyInput = parsed.data as Parameters<typeof VegetacaoInventarioService.estimarInventarioSimulado>[0];
    const result = VegetacaoInventarioService.estimarInventarioSimulado(topologyInput, osmData);
    res.json({ timestamp: new Date().toISOString(), ...result });
  } catch (err: unknown) {
    logger.error("Erro no inventário simulado de vegetação", { error: getErrorMessage(err) });
    res.status(500).json({ error: "Falha ao processar inventário de vegetação." });
  }
});

/**
 * POST /api/compliance/land/auto-detect
 * Escaneia a topologia em busca de conflitos fundiários (T2-107).
 */
router.post("/land/auto-detect", async (req: Request, res: Response) => {
  try {
    const parsed = TopologySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Topologia inválida.", details: parsed.error.format() });
    const topologyInput = parsed.data as Parameters<typeof LandManagementService.detectEasementConflicts>[0];
    const conflicts = LandManagementService.detectEasementConflicts(topologyInput);
    res.json({ timestamp: new Date().toISOString(), totalConflitos: conflicts.length, conflicts });
  } catch (err: unknown) {
    logger.error("Erro na detecção de conflitos fundiários", { error: getErrorMessage(err) });
    res.status(500).json({ error: "Falha ao processar análise fundiária." });
  }
});

/**
 * POST /api/compliance/land/processos/auto
 * Cria processo de servidão automático para os conflitos detectados.
 */
router.post("/land/processos/auto", async (req: Request, res: Response) => {
  try {
    const { tenantId, projetoId, topology } = req.body;
    if (!tenantId || !projetoId || !topology) return res.status(400).json({ error: "Campos obrigatórios ausentes." });
    const result = LandManagementService.createProcessFromConflicts(tenantId, projetoId, topology);
    res.status(201).json(result);
  } catch (err: unknown) {
    logger.error("Erro na criação de processo fundiário", { error: getErrorMessage(err) });
    res.status(500).json({ error: "Falha ao criar processo de servidão." });
  }
});

export default router;
