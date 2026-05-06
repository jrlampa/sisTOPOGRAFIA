/**
 * Rotas T2-66 — Rastreabilidade QR Code Industrial
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { QrRastreabilidadeService } from "../services/qrRastreabilidadeService.js";

const router = Router();

const TipoAssetEnum = z.enum([
  "poste",
  "transformador",
  "medicao",
  "chave",
  "religador",
  "cabo",
  "subestacao",
  "outro",
]);

const TipoEventoEnum = z.enum([
  "criacao",
  "impressao",
  "instalacao",
  "inspecao",
  "manutencao",
  "substituicao",
  "desativacao",
]);

const CriarAtivoSchema = z.object({
  tenantId: z.string().min(2),
  codigoAsset: z.string().min(2),
  nomeAsset: z.string().min(3),
  tipoAsset: TipoAssetEnum,
  enderecoInstalacao: z.string().min(5),
  municipio: z.string().min(2),
  uf: z.string().length(2),
  localizacaoLat: z.number().min(-90).max(90).optional(),
  localizacaoLon: z.number().min(-180).max(180).optional(),
});

const RegistrarEventoSchema = z.object({
  tipoEvento: TipoEventoEnum,
  descricao: z.string().min(5),
  tecnicoResponsavel: z.string().min(3),
  dataEvento: z.string().min(8),
  localizacaoLat: z.number().min(-90).max(90).optional(),
  localizacaoLon: z.number().min(-180).max(180).optional(),
});

const InstalarAtivoSchema = z.object({
  dataInstalacao: z.string().min(8),
  tecnicoResponsavel: z.string().min(3),
  localizacaoLat: z.number().min(-90).max(90).optional(),
  localizacaoLon: z.number().min(-180).max(180).optional(),
});

// POST /ativos
router.post("/ativos", (req: Request, res: Response) => {
  const parse = CriarAtivoSchema.safeParse(req.body);
  if (!parse.success)
    return res.status(400).json({ errors: parse.error.issues });
  try {
    return res
      .status(201)
      .json(QrRastreabilidadeService.criarAtivo(parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /ativos
router.get("/ativos", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;
  return res.json(QrRastreabilidadeService.listarAtivos(tenantId));
});

// GET /ativos/qr/:qrCode — deve vir antes de /ativos/:id
router.get("/ativos/qr/:qrCode", (req: Request, res: Response) => {
  const ativo = QrRastreabilidadeService.obterAtivoPorQr(req.params.qrCode);
  if (!ativo) return res.status(404).json({ error: "QR Code não encontrado" });
  return res.json(ativo);
});

// GET /ativos/:id
router.get("/ativos/:id", (req: Request, res: Response) => {
  const ativo = QrRastreabilidadeService.obterAtivo(req.params.id);
  if (!ativo) return res.status(404).json({ error: "Ativo não encontrado" });
  return res.json(ativo);
});

// POST /ativos/:id/eventos
router.post("/ativos/:id/eventos", (req: Request, res: Response) => {
  const parse = RegistrarEventoSchema.safeParse(req.body);
  if (!parse.success)
    return res.status(400).json({ errors: parse.error.issues });
  try {
    return res
      .status(201)
      .json(
        QrRastreabilidadeService.registrarEvento(req.params.id, parse.data),
      );
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /ativos/:id/instalar
router.post("/ativos/:id/instalar", (req: Request, res: Response) => {
  const parse = InstalarAtivoSchema.safeParse(req.body);
  if (!parse.success)
    return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.json(
      QrRastreabilidadeService.instalarAtivo(req.params.id, parse.data),
    );
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /tipos-asset
router.get("/tipos-asset", (_req: Request, res: Response) => {
  return res.json(QrRastreabilidadeService.listarTiposAsset());
});

export default router;
