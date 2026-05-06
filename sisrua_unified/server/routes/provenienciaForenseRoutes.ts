/**
 * Rotas T2-102 — Certificação de Proveniência Forense
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { ProvenienciaForenseService } from "../services/provenienciaForenseService.js";

const router = Router();

const CriarDossieSchema = z.object({
  tenantId: z.string().min(2),
  projetoId: z.string().min(2),
  titulo: z.string().min(3),
});

const AdicionarArtefatoSchema = z.object({
  nomeArquivo: z.string().min(3),
  mimeType: z.string().min(3),
  tamanhoBytes: z.number().int().positive(),
  conteudo: z.string().min(1),
});

const EmitirSeloSchema = z.object({
  provedor: z.enum(["rfc3161_homologado", "rfc3161_interno"]),
});

const AssinarSchema = z.object({
  certificadoSerial: z.string().min(5),
});

router.post("/dossies", (req: Request, res: Response) => {
  const parse = CriarDossieSchema.safeParse(req.body);
  if (!parse.success)
    return res.status(400).json({ errors: parse.error.issues });
  try {
    return res
      .status(201)
      .json(ProvenienciaForenseService.criarDossie(parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.get("/dossies", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;
  return res.json(ProvenienciaForenseService.listarDossies(tenantId));
});

router.get("/dossies/:id", (req: Request, res: Response) => {
  const dossie = ProvenienciaForenseService.obterDossie(req.params.id);
  if (!dossie) return res.status(404).json({ error: "Dossiê não encontrado" });
  return res.json(dossie);
});

router.post("/dossies/:id/artefatos", (req: Request, res: Response) => {
  const parse = AdicionarArtefatoSchema.safeParse(req.body);
  if (!parse.success)
    return res.status(400).json({ errors: parse.error.issues });
  try {
    return res
      .status(201)
      .json(
        ProvenienciaForenseService.adicionarArtefato(req.params.id, parse.data),
      );
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.post("/dossies/:id/selo-temporal", (req: Request, res: Response) => {
  const parse = EmitirSeloSchema.safeParse(req.body);
  if (!parse.success)
    return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.json(
      ProvenienciaForenseService.emitirSeloTemporal(
        req.params.id,
        parse.data.provedor,
      ),
    );
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.post("/dossies/:id/assinar-icp", (req: Request, res: Response) => {
  const parse = AssinarSchema.safeParse(req.body);
  if (!parse.success)
    return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.json(
      ProvenienciaForenseService.assinarIcpBrasil(
        req.params.id,
        parse.data.certificadoSerial,
      ),
    );
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.get(
  "/dossies/:id/verificar-integridade",
  (req: Request, res: Response) => {
    try {
      return res.json(
        ProvenienciaForenseService.verificarIntegridade(req.params.id),
      );
    } catch (err: unknown) {
      return res.status(422).json({ error: (err as Error).message });
    }
  },
);

router.post("/dossies/:id/revogar", (req: Request, res: Response) => {
  try {
    return res.json(ProvenienciaForenseService.revogarDossie(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.get("/provedores-rfc3161", (_req: Request, res: Response) => {
  return res.json(ProvenienciaForenseService.listarProvedoresRFC3161());
});

export default router;
