/**
 * complianceRoutes.ts — Rotas eMAG + ANEEL Provenance (97+98 [T1])
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { EmagCertService, SecaoEmag } from "../services/emagCertService.js";
import { AneelProvenanceService } from "../services/aneelProvenanceService.js";

const router = Router();

// ─── eMAG 3.1 ────────────────────────────────────────────────────────────────

const InspecaoSchema = z.object({
  titulo: z.string().min(1),
  versaoSistema: z.string().min(1),
  responsavel: z.string().min(1),
});

const EvidenciaSchema = z.object({
  requisitoId: z.string().min(1),
  status: z.enum(["conforme", "parcialmente_conforme", "nao_conforme", "nao_aplicavel"]),
  descricao: z.string().min(1),
  responsavel: z.string().min(1),
  artefato: z.string().optional(),
});

router.get("/emag/requisitos", (req: Request, res: Response) => {
  const secao = req.query.secao as SecaoEmag | undefined;
  res.json(EmagCertService.listarRequisitos(secao));
});

router.post("/emag/inspecoes", (req: Request, res: Response) => {
  const parse = InspecaoSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.flatten() });
    return;
  }
  const i = EmagCertService.criarInspecao(parse.data);
  res.status(201).json(i);
});

router.post("/emag/inspecoes/:id/evidencias", (req: Request, res: Response) => {
  const parse = EvidenciaSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.flatten() });
    return;
  }
  try {
    const ev = EmagCertService.registrarEvidencia(req.params.id, parse.data as Parameters<typeof EmagCertService.registrarEvidencia>[1]);
    res.status(201).json(ev);
  } catch (err: unknown) {
    res.status(404).json({ erro: (err as Error).message });
  }
});

router.post("/emag/inspecoes/:id/concluir", (req: Request, res: Response) => {
  try {
    const i = EmagCertService.concluirInspecao(req.params.id);
    res.json(i);
  } catch (err: unknown) {
    res.status(404).json({ erro: (err as Error).message });
  }
});

router.get("/emag/inspecoes", (_req: Request, res: Response) => {
  res.json(EmagCertService.listarInspecoes());
});

router.get("/emag/inspecoes/:id", (req: Request, res: Response) => {
  try {
    res.json(EmagCertService.getInspecao(req.params.id));
  } catch (err: unknown) {
    res.status(404).json({ erro: (err as Error).message });
  }
});

// ─── ANEEL Provenance ─────────────────────────────────────────────────────────

const TIPOS_ARTEFATO = ["dxf_projeto", "relatorio_cqt", "snapshot_topologia", "validacao_bdgd", "memorial_descritivo", "art"] as const;

const DossieSchema = z.object({
  titulo: z.string().min(1),
  projetoId: z.string().min(1),
  tenantId: z.string().min(1),
  responsavelTecnico: z.string().min(1),
  creaResponsavel: z.string().optional(),
  observacoes: z.string().optional(),
});

const ArtefatoSchema = z.object({
  tipo: z.enum(TIPOS_ARTEFATO),
  nomeArquivo: z.string().min(1),
  conteudo: z.string().min(1),
  responsavelTecnico: z.string().min(1),
  versaoSistema: z.string().min(1),
  descricao: z.string().optional(),
});

const AprovarSchema = z.object({
  conformidadeBdgd: z.boolean(),
  conformidadeProdist: z.boolean(),
});

router.post("/aneel/dossies", (req: Request, res: Response) => {
  const parse = DossieSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.flatten() });
    return;
  }
  const d = AneelProvenanceService.criarDossie(parse.data);
  res.status(201).json(d);
});

router.post("/aneel/dossies/:id/artefatos", (req: Request, res: Response) => {
  const parse = ArtefatoSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.flatten() });
    return;
  }
  try {
    const a = AneelProvenanceService.adicionarArtefato(req.params.id, parse.data as Parameters<typeof AneelProvenanceService.adicionarArtefato>[1]);
    res.status(201).json(a);
  } catch (err: unknown) {
    res.status(400).json({ erro: (err as Error).message });
  }
});

router.post("/aneel/dossies/:id/aprovar", (req: Request, res: Response) => {
  const parse = AprovarSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.flatten() });
    return;
  }
  try {
    const d = AneelProvenanceService.aprovarDossie(req.params.id, parse.data);
    res.json(d);
  } catch (err: unknown) {
    res.status(400).json({ erro: (err as Error).message });
  }
});

router.post("/aneel/dossies/:id/submeter", (req: Request, res: Response) => {
  try {
    const d = AneelProvenanceService.submeterAneel(req.params.id);
    res.json(d);
  } catch (err: unknown) {
    res.status(400).json({ erro: (err as Error).message });
  }
});

router.get("/aneel/dossies/:id/integridade", (req: Request, res: Response) => {
  try {
    res.json(AneelProvenanceService.verificarIntegridade(req.params.id));
  } catch (err: unknown) {
    res.status(404).json({ erro: (err as Error).message });
  }
});

router.get("/aneel/dossies", (req: Request, res: Response) => {
  const { tenantId } = req.query;
  res.json(AneelProvenanceService.listarDossies(tenantId as string | undefined));
});

router.get("/aneel/dossies/:id", (req: Request, res: Response) => {
  try {
    res.json(AneelProvenanceService.getDossie(req.params.id));
  } catch (err: unknown) {
    res.status(404).json({ erro: (err as Error).message });
  }
});

export default router;
