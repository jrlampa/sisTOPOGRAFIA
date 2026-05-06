/**
 * zeroTrustRoutes.ts — Rotas Zero Trust Inter-service (22 [T1])
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { ZeroTrustService } from "../services/zeroTrustService.js";

const router = Router();

const RegistrarServicoSchema = z.object({
  serviceId: z.string().min(1),
  nome: z.string().min(1),
  certFingerprint: z.string().min(10),
  secret: z.string().min(16),
});

const PoliticaSchema = z.object({
  emissor: z.string().min(1),
  receptor: z.string().min(1),
  permissoes: z.array(z.string()).min(1),
});

const ValidarTokenSchema = z.object({
  emissorId: z.string().min(1),
  receptorId: z.string().min(1),
  token: z.string().min(1),
  nonce: z.string().min(1),
  timestamp: z.string().min(1),
  secret: z.string().min(1),
});

// POST /servicos — registra identidade de serviço
router.post("/servicos", (req: Request, res: Response) => {
  const parse = RegistrarServicoSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.flatten() });
    return;
  }
  try {
    const svc = ZeroTrustService.registrarServico(parse.data);
    res.status(201).json(svc);
  } catch (err: unknown) {
    res.status(409).json({ erro: (err as Error).message });
  }
});

// DELETE /servicos/:serviceId — revoga serviço
router.delete("/servicos/:serviceId", (req: Request, res: Response) => {
  try {
    ZeroTrustService.revogarServico(req.params.serviceId);
    res.json({ ok: true, serviceId: req.params.serviceId, status: "revogado" });
  } catch (err: unknown) {
    res.status(404).json({ erro: (err as Error).message });
  }
});

// GET /servicos — lista identidades
router.get("/servicos", (_req: Request, res: Response) => {
  res.json(ZeroTrustService.listarServicos());
});

// POST /politicas — define política de autorização
router.post("/politicas", (req: Request, res: Response) => {
  const parse = PoliticaSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.flatten() });
    return;
  }
  const pol = ZeroTrustService.definirPolitica(parse.data);
  res.status(201).json(pol);
});

// GET /politicas — lista políticas
router.get("/politicas", (_req: Request, res: Response) => {
  res.json(ZeroTrustService.listarPoliticas());
});

// POST /validar — valida token inter-service
router.post("/validar", (req: Request, res: Response) => {
  const parse = ValidarTokenSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.flatten() });
    return;
  }
  const resultado = ZeroTrustService.validarToken(parse.data);
  res.status(resultado.valido ? 200 : 401).json(resultado);
});

// GET /access-log — log de tentativas de acesso
router.get("/access-log", (_req: Request, res: Response) => {
  res.json(ZeroTrustService.getAccessLog());
});

export default router;
