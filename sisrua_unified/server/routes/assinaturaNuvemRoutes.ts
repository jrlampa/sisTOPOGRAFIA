/**
 * Rotas T2-104 — Assinatura Digital em Nuvem
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { AssinaturaNuvemService } from "../services/assinaturaNuvemService.js";

const router = Router();

const CriarLoteSchema = z.object({
  tenantId: z.string().min(2),
  projetoId: z.string().min(2),
  provedor: z.enum(["birdid", "safeid"]),
  solicitadoPor: z.string().min(3),
  webhookUrl: z.string().url().optional(),
});

const AdicionarDocumentoSchema = z.object({
  nomeArquivo: z.string().min(3),
  conteudo: z.string().min(1),
});

const RegistrarAssinaturaSchema = z.object({
  documentoId: z.string().min(2),
  status: z.enum(["assinado", "falha"]),
});

router.post("/lotes", (req: Request, res: Response) => {
  const parse = CriarLoteSchema.safeParse(req.body);
  if (!parse.success)
    return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(AssinaturaNuvemService.criarLote(parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.get("/lotes", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;
  return res.json(AssinaturaNuvemService.listarLotes(tenantId));
});

router.get("/lotes/:id", (req: Request, res: Response) => {
  const lote = AssinaturaNuvemService.obterLote(req.params.id);
  if (!lote) return res.status(404).json({ error: "Lote não encontrado" });
  return res.json(lote);
});

router.post("/lotes/:id/documentos", (req: Request, res: Response) => {
  const parse = AdicionarDocumentoSchema.safeParse(req.body);
  if (!parse.success)
    return res.status(400).json({ errors: parse.error.issues });
  try {
    return res
      .status(201)
      .json(
        AssinaturaNuvemService.adicionarDocumento(req.params.id, parse.data),
      );
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.post("/lotes/:id/enviar", (req: Request, res: Response) => {
  try {
    return res.json(AssinaturaNuvemService.enviarLote(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.post(
  "/lotes/:id/registrar-assinatura",
  (req: Request, res: Response) => {
    const parse = RegistrarAssinaturaSchema.safeParse(req.body);
    if (!parse.success)
      return res.status(400).json({ errors: parse.error.issues });
    try {
      return res.json(
        AssinaturaNuvemService.registrarAssinatura(
          req.params.id,
          parse.data.documentoId,
          parse.data.status,
        ),
      );
    } catch (err: unknown) {
      return res.status(422).json({ error: (err as Error).message });
    }
  },
);

router.post("/lotes/:id/cancelar", (req: Request, res: Response) => {
  try {
    return res.json(AssinaturaNuvemService.cancelarLote(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.get("/provedores", (_req: Request, res: Response) => {
  return res.json(AssinaturaNuvemService.listarProvedores());
});

export default router;
