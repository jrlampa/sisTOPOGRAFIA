/**
 * licitacoesRoutes.ts — API REST para Trilha de Evidências para Licitações (Ponto 120 [T1]).
 *
 * GET  /api/licitacoes              → lista pacotes gerados
 * GET  /api/licitacoes/:id          → detalhe de pacote
 * GET  /api/licitacoes/:id/integridade → verifica hash SHA-256
 * POST /api/licitacoes              → gera novo pacote de evidências
 * POST /api/licitacoes/:id/validar  → promove rascunho → validado
 * POST /api/licitacoes/:id/emitir   → promove validado → emitido
 */

import { Router, Request, Response } from "express";
import {
  gerarPacote,
  listarPacotes,
  obterPacote,
  validarPacote,
  emitirPacote,
  verificarIntegridade,
} from "../services/licitacoesService.js";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.json(listarPacotes());
});

router.get("/:id", (req: Request, res: Response) => {
  const pacote = obterPacote(req.params["id"]!);
  if (!pacote) return res.status(404).json({ error: "Pacote não encontrado" });
  return res.json(pacote);
});

router.get("/:id/integridade", (req: Request, res: Response) => {
  const resultado = verificarIntegridade(req.params["id"]!);
  if (!resultado.hashEsperado)
    return res.status(404).json({ error: "Pacote não encontrado" });
  return res.json(resultado);
});

router.post("/", (req: Request, res: Response) => {
  const { titulo, orgaoEdital, numeroEdital } = req.body as {
    titulo?: string;
    orgaoEdital?: string;
    numeroEdital?: string;
  };
  if (!titulo) return res.status(400).json({ error: "titulo é obrigatório" });
  const pacote = gerarPacote(titulo, orgaoEdital, numeroEdital);
  return res.status(201).json(pacote);
});

router.post("/:id/validar", (req: Request, res: Response) => {
  const pacote = validarPacote(req.params["id"]!);
  if (!pacote) return res.status(404).json({ error: "Pacote não encontrado" });
  return res.json(pacote);
});

router.post("/:id/emitir", (req: Request, res: Response) => {
  const pacote = emitirPacote(req.params["id"]!);
  if (!pacote)
    return res
      .status(422)
      .json({ error: "Pacote deve estar validado antes de emitir" });
  return res.json(pacote);
});

export default router;
