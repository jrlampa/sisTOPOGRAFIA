import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  SpeedDraftService,
  type CodConcessionaria,
  type TipoRede,
  type StatusTemplate,
} from "../services/speedDraftService.js";

const router = Router();

// ─── Schemas de validação ────────────────────────────────────────────────────

const tiposPoste = ["concreto", "madeira", "ferro", "fibra_vidro"] as const;
const tiposCondutor = [
  "aluminio_multiplexado",
  "aluminio_nu",
  "cobre_nu",
  "cobre_isolado",
] as const;
const regioesGeograficas = [
  "sudeste", "sul", "nordeste", "norte", "centro_oeste",
] as const;
const tiposRede = ["bt", "mt", "bt_mt"] as const;
const statusTemplateEnum = ["ativo", "obsoleto", "em_revisao"] as const;

const materialSchema = z.object({
  componente: z.string().min(2),
  especificacao: z.string().min(2),
  unidade: z.string().min(1),
  codigoAneel: z.string().optional(),
});

const criarTemplateSchema = z.object({
  nome: z.string().min(2),
  concessionaria: z.string().min(2),
  tipoRede: z.enum(tiposRede),
  regiaoGeografica: z.enum(regioesGeograficas),
  tensaoNominalKv: z.number().positive(),
  tipoPoste: z.enum(tiposPoste),
  alturaPostePadrao: z.number().positive(),
  vaoMaximoM: z.number().positive().max(40),
  tipoCondutor: z.enum(tiposCondutor),
  secaoMinimaCondutorMm2: z.number().positive(),
  secaoMaximaCondutorMm2: z.number().positive(),
  capacidadeTransformadorKva: z.number().positive().optional(),
  fatorDemanda: z.number().min(0).max(1),
  fatorCoincidencia: z.number().min(0).max(1),
  materiaisPadrao: z.array(materialSchema),
  versaoNorma: z.string().min(2),
  anoVigencia: z.number().int().min(1990),
  observacoes: z.string().optional(),
});

// ─── Rotas ────────────────────────────────────────────────────────────────────

// GET /api/speed-draft/templates
router.get("/templates", (req: Request, res: Response) => {
  const { concessionaria, tipoRede, tenantId, status } = req.query;
  const lista = SpeedDraftService.listarTemplates({
    concessionaria: concessionaria as CodConcessionaria | undefined,
    tipoRede: tipoRede as TipoRede | undefined,
    tenantId: tenantId as string | undefined,
    status: status as StatusTemplate | undefined,
  });
  res.json(lista);
});

// GET /api/speed-draft/templates/:id
router.get("/templates/:id", (req: Request, res: Response) => {
  const tpl = SpeedDraftService.obterTemplate(req.params["id"]!);
  if (!tpl) {
    res.status(404).json({ erro: "Template não encontrado" });
    return;
  }
  res.json(tpl);
});

// POST /api/speed-draft/templates
router.post("/templates", (req: Request, res: Response) => {
  const tenantId = req.body?.tenantId;
  if (!tenantId) {
    res.status(400).json({ erro: "Parâmetro tenantId é obrigatório" });
    return;
  }
  const parse = criarTemplateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: parse.error.errors });
    return;
  }
  const resultado = SpeedDraftService.criarTemplate(tenantId, parse.data as Parameters<typeof SpeedDraftService.criarTemplate>[1]);
  if ("erro" in resultado) {
    res.status(422).json(resultado);
    return;
  }
  res.status(201).json(resultado);
});

// PATCH /api/speed-draft/templates/:id/status
router.patch("/templates/:id/status", (req: Request, res: Response) => {
  const parse = z.object({ status: z.enum(statusTemplateEnum) }).safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Status inválido" });
    return;
  }
  const tpl = SpeedDraftService.atualizarStatus(req.params["id"]!, parse.data.status);
  if (!tpl) {
    res.status(404).json({ erro: "Template não encontrado" });
    return;
  }
  res.json(tpl);
});

// GET /api/speed-draft/concessionarias
router.get("/concessionarias", (_req: Request, res: Response) => {
  res.json(SpeedDraftService.listarConcessionarias());
});

export default router;
