/**
 * Rotas T2-106 — GIS Hardening (mTLS & Vault)
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { GisHardeningService } from "../services/gisHardeningService.js";

const router = Router();

const CriarPerfilSchema = z.object({
  tenantId: z.string().min(2),
  ambiente: z.enum(["dev", "homolog", "preprod", "prod"]),
  mtlsObrigatorio: z.boolean(),
  certFingerprint: z.string().min(10),
  provedorSegredo: z.enum(["vault", "local_hsm"]),
  rolesPermitidas: z.array(z.string().min(2)).min(1),
  rotateDays: z.number().int().positive(),
});

const HandshakeSchema = z.object({
  certFingerprintRecebido: z.string().min(10),
});

const RegistrarEventoSchema = z.object({
  tipo: z.enum(["handshake_ok", "handshake_fail", "secret_rotated", "policy_violation", "cert_expired"]),
  severidade: z.enum(["baixa", "media", "alta", "critica"]),
  descricao: z.string().min(3),
});

router.post("/perfis", (req: Request, res: Response) => {
  const parse = CriarPerfilSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(GisHardeningService.criarPerfil(parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.get("/perfis", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;
  return res.json(GisHardeningService.listarPerfis(tenantId));
});

router.get("/perfis/:id", (req: Request, res: Response) => {
  const perfil = GisHardeningService.obterPerfil(req.params.id);
  if (!perfil) return res.status(404).json({ error: "Perfil não encontrado" });
  return res.json(perfil);
});

router.post("/perfis/:id/validar-handshake", (req: Request, res: Response) => {
  const parse = HandshakeSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.json(GisHardeningService.validarHandshake(req.params.id, parse.data.certFingerprintRecebido));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.post("/perfis/:id/eventos", (req: Request, res: Response) => {
  const parse = RegistrarEventoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(GisHardeningService.registrarEvento(req.params.id, parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.get("/perfis/:id/eventos", (req: Request, res: Response) => {
  try {
    return res.json(GisHardeningService.listarEventos(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.post("/perfis/:id/rotacionar-segredo", (req: Request, res: Response) => {
  try {
    return res.json(GisHardeningService.rotacionarSegredo(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.get("/tipos-evento", (_req: Request, res: Response) => {
  return res.json(GisHardeningService.listarTiposEvento());
});

export default router;
