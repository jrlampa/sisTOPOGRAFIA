/**
 * Rotas T2-84 — Acervo Técnico GED (Padrão CONARQ)
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { AcervoGedService } from "../services/acervoGedService.js";

const router = Router();

const CriarDocumentoSchema = z.object({
  tenantId: z.string().min(2),
  projetoId: z.string().min(2),
  titulo: z.string().min(3),
  tipoDocumento: z.enum([
    "memorial_descritivo",
    "art",
    "planta_baixa",
    "croqui",
    "laudo",
    "relatorio_fotografico",
    "outro",
  ]),
  classificacaoSigilo: z.enum(["publico", "restrito", "confidencial"]),
  retencaoAnos: z.number().int().min(1).max(100),
  conteudo: z.string().min(3),
  criadoPor: z.string().min(3),
});

const RevisaoSchema = z.object({
  revisadoPor: z.string().min(3),
  observacao: z.string().min(3),
});

router.post("/documentos", (req: Request, res: Response) => {
  const parse = CriarDocumentoSchema.safeParse(req.body);
  if (!parse.success)
    return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(AcervoGedService.criarDocumento(parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.get("/documentos", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;
  return res.json(AcervoGedService.listarDocumentos(tenantId));
});

router.get("/documentos/:id", (req: Request, res: Response) => {
  const documento = AcervoGedService.obterDocumento(req.params.id);
  if (!documento)
    return res.status(404).json({ error: "Documento não encontrado" });
  return res.json(documento);
});

router.post("/documentos/:id/enviar-revisao", (req: Request, res: Response) => {
  try {
    return res.json(AcervoGedService.enviarParaRevisao(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.post("/documentos/:id/revisoes", (req: Request, res: Response) => {
  const parse = RevisaoSchema.safeParse(req.body);
  if (!parse.success)
    return res.status(400).json({ errors: parse.error.issues });
  try {
    return res
      .status(201)
      .json(AcervoGedService.registrarRevisao(req.params.id, parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.post("/documentos/:id/aprovar", (req: Request, res: Response) => {
  try {
    return res.json(AcervoGedService.aprovarDocumento(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.post("/documentos/:id/arquivar", (req: Request, res: Response) => {
  try {
    return res.json(AcervoGedService.arquivarDocumento(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.get("/tipos-documento", (_req: Request, res: Response) => {
  return res.json(AcervoGedService.listarTiposDocumento());
});

export default router;
