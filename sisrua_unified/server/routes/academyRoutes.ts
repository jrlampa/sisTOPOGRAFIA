/**
 * Rotas T2-57 — sisTOPOGRAFIA Academy
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { AcademyService } from "../services/academyService.js";

const router = Router();

const NivelEnum = z.enum(["basico", "intermediario", "avancado", "especialista"]);
const TipoConteudoEnum = z.enum(["video", "texto", "quiz", "simulacao", "pratica_guiada"]);

const CriarTrilhaSchema = z.object({
  tenantId: z.string().min(2),
  titulo: z.string().min(3),
  descricao: z.string().min(5),
  nivelDificuldade: NivelEnum,
  categorias: z.array(z.string().min(2)).min(1),
  certificadoNome: z.string().min(5),
});

const AdicionarCursoSchema = z.object({
  titulo: z.string().min(3),
  descricao: z.string().min(5),
  cargaHorariaH: z.number().positive(),
  ordem: z.number().int().positive(),
});

const AdicionarModuloSchema = z.object({
  titulo: z.string().min(3),
  tipoConteudo: TipoConteudoEnum,
  cargaHorariaMin: z.number().int().positive(),
  ordem: z.number().int().positive(),
});

const IniciarProgressoSchema = z.object({
  usuarioId: z.string().min(2),
  trilhaId: z.string().min(2),
});

const ConcluirModuloSchema = z.object({
  moduloId: z.string().min(2),
});

// POST /trilhas
router.post("/trilhas", (req: Request, res: Response) => {
  const parse = CriarTrilhaSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(AcademyService.criarTrilha(parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /trilhas
router.get("/trilhas", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;
  return res.json(AcademyService.listarTrilhas(tenantId));
});

// GET /trilhas/:id
router.get("/trilhas/:id", (req: Request, res: Response) => {
  const trilha = AcademyService.obterTrilha(req.params.id);
  if (!trilha) return res.status(404).json({ error: "Trilha não encontrada" });
  return res.json(trilha);
});

// POST /trilhas/:id/publicar
router.post("/trilhas/:id/publicar", (req: Request, res: Response) => {
  try {
    return res.json(AcademyService.publicarTrilha(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /trilhas/:id/cursos
router.post("/trilhas/:id/cursos", (req: Request, res: Response) => {
  const parse = AdicionarCursoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(AcademyService.adicionarCurso(req.params.id, parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /cursos/:id/modulos
router.post("/cursos/:id/modulos", (req: Request, res: Response) => {
  const parse = AdicionarModuloSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(AcademyService.adicionarModulo(req.params.id, parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /progresso
router.post("/progresso", (req: Request, res: Response) => {
  const parse = IniciarProgressoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(AcademyService.iniciarProgresso(parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// PATCH /progresso/:id/concluir-modulo
router.patch("/progresso/:id/concluir-modulo", (req: Request, res: Response) => {
  const parse = ConcluirModuloSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.json(AcademyService.concluirModulo(req.params.id, parse.data.moduloId));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /progresso/:id/certificar
router.post("/progresso/:id/certificar", (req: Request, res: Response) => {
  try {
    return res.json(AcademyService.emitirCertificado(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /categorias
router.get("/categorias", (_req: Request, res: Response) => {
  return res.json(AcademyService.listarCategorias());
});

export default router;
