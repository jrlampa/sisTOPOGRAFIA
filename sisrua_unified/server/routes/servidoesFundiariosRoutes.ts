/**
 * servidoesFundiariosRoutes.ts — Rotas para Gestão de Servidões Fundiárias (T2-55).
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { ServidoesFundiariosService } from "../services/servidoesFundiariosService.js";

const router = Router();

const coordGeoSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  ordemPonto: z.number().int().optional(),
});

const criarProcessoSchema = z.object({
  nome: z.string().min(2),
  tenantId: z.string().min(1),
  projetoId: z.string().optional(),
  concessionaria: z.string().optional(),
  tensaoKv: z.number().positive().optional(),
});

const adicionarImovelSchema = z.object({
  matricula: z.string().min(1),
  proprietario: z.string().min(2),
  municipio: z.string().min(2),
  uf: z.string().length(2),
  cartorioRegistro: z.string().optional(),
  areaAfetadaM2: z.number().positive(),
  larguraFaixaM: z.number().positive(),
  comprimentoM: z.number().positive().optional(),
  coordenadas: z.array(coordGeoSchema).optional(),
  observacoes: z.string().optional(),
});

// ─── POST /processos ──────────────────────────────────────────────────────────
router.post("/processos", (req: Request, res: Response) => {
  const parse = criarProcessoSchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ erro: "Dados inválidos", detalhes: parse.error.flatten() });
  }
  const processo = ServidoesFundiariosService.criarProcesso(parse.data);
  return res.status(201).json(processo);
});

// ─── GET /processos?tenantId= ─────────────────────────────────────────────────
router.get("/processos", (req: Request, res: Response) => {
  const tenantId = req.query["tenantId"] as string | undefined;
  if (!tenantId) {
    return res.status(400).json({ erro: "Parâmetro tenantId obrigatório" });
  }
  return res.json(ServidoesFundiariosService.listarProcessos(tenantId));
});

// ─── GET /processos/:id ───────────────────────────────────────────────────────
router.get("/processos/:id", (req: Request, res: Response) => {
  const proc = ServidoesFundiariosService.obterProcesso(req.params["id"]!);
  if (!proc) return res.status(404).json({ erro: "Processo não encontrado" });
  return res.json(proc);
});

// ─── POST /processos/:id/imoveis ──────────────────────────────────────────────
router.post("/processos/:id/imoveis", (req: Request, res: Response) => {
  const parse = adicionarImovelSchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ erro: "Dados inválidos", detalhes: parse.error.flatten() });
  }
  const proc = ServidoesFundiariosService.adicionarImovel(
    req.params["id"]!,
    parse.data,
  );
  if (!proc) return res.status(404).json({ erro: "Processo não encontrado" });
  return res.status(201).json(proc);
});

// ─── POST /processos/:id/memorial ────────────────────────────────────────────
router.post("/processos/:id/memorial", (req: Request, res: Response) => {
  const resultado = ServidoesFundiariosService.gerarMemorial(req.params["id"]!);
  if ("erro" in resultado) {
    return res.status(422).json(resultado);
  }
  return res.json(resultado);
});

// ─── POST /processos/:id/cartas-anuencia ─────────────────────────────────────
router.post("/processos/:id/cartas-anuencia", (req: Request, res: Response) => {
  const resultado = ServidoesFundiariosService.emitirCartasAnuencia(
    req.params["id"]!,
  );
  if ("erro" in resultado) {
    return res.status(422).json(resultado);
  }
  return res.json(resultado);
});

// ─── POST /processos/:id/aprovar ──────────────────────────────────────────────
router.post("/processos/:id/aprovar", (req: Request, res: Response) => {
  const proc = ServidoesFundiariosService.aprovarProcesso(req.params["id"]!);
  if (!proc) {
    return res
      .status(422)
      .json({ erro: "Processo não encontrado ou em rascunho sem memorial" });
  }
  return res.json(proc);
});

export default router;
