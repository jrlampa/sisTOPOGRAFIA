import { Router, Request, Response } from "express";
import { z } from "zod";
import { LicencaSocialService, type TipoConsulta } from "../services/licencaSocialService.js";

const router = Router();

// ─── Schemas de validação ────────────────────────────────────────────────────

const tiposConsulta: TipoConsulta[] = [
  "audiencia_publica",
  "consulta_publica",
  "reuniao_comunitaria",
  "pesquisa_percepcao",
  "oficina_participativa",
];

const criarSchema = z.object({
  nome: z.string().min(2),
  tenantId: z.string().min(2),
  projetoId: z.string().optional(),
  municipio: z.string().min(2),
  uf: z.string().length(2),
  tipo: z.enum([
    "audiencia_publica",
    "consulta_publica",
    "reuniao_comunitaria",
    "pesquisa_percepcao",
    "oficina_participativa",
  ]),
  dataInicio: z.string().min(8),
  dataFim: z.string().min(8).optional(),
  localRealizacao: z.string().optional(),
  observacoes: z.string().optional(),
});

const manifestacaoSchema = z.object({
  autor: z.string().min(2),
  segmento: z.enum([
    "comunidade_local",
    "poder_publico",
    "organizacoes_sociedade_civil",
    "setor_privado",
    "academia",
    "imprensa",
    "orgaos_ambientais",
  ]),
  favoravel: z.boolean(),
  descricao: z.string().min(5),
});

// ─── Rotas ────────────────────────────────────────────────────────────────────

// POST /api/licenca-social/consultas
router.post("/consultas", (req: Request, res: Response) => {
  const parse = criarSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: parse.error.issues });
    return;
  }
  const consulta = LicencaSocialService.criarConsulta(parse.data);
  res.status(201).json(consulta);
});

// GET /api/licenca-social/consultas?tenantId=
router.get("/consultas", (req: Request, res: Response) => {
  const tenantId = req.query["tenantId"] as string | undefined;
  if (!tenantId) {
    res.status(400).json({ erro: "Parâmetro tenantId é obrigatório" });
    return;
  }
  res.json(LicencaSocialService.listarConsultas(tenantId));
});

// GET /api/licenca-social/consultas/:id
router.get("/consultas/:id", (req: Request, res: Response) => {
  const c = LicencaSocialService.obterConsulta(req.params["id"]!);
  if (!c) {
    res.status(404).json({ erro: "Consulta não encontrada" });
    return;
  }
  res.json(c);
});

// POST /api/licenca-social/consultas/:id/iniciar
router.post("/consultas/:id/iniciar", (req: Request, res: Response) => {
  const resultado = LicencaSocialService.iniciarConsulta(req.params["id"]!);
  if ("erro" in resultado) {
    res.status(422).json(resultado);
    return;
  }
  res.json(resultado);
});

// POST /api/licenca-social/consultas/:id/manifestacoes
router.post("/consultas/:id/manifestacoes", (req: Request, res: Response) => {
  const parse = manifestacaoSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: parse.error.issues });
    return;
  }
  const resultado = LicencaSocialService.registrarManifestacao(req.params["id"]!, parse.data);
  if ("erro" in resultado) {
    res.status(422).json(resultado);
    return;
  }
  res.status(201).json(resultado);
});

// POST /api/licenca-social/consultas/:id/calcular
router.post("/consultas/:id/calcular", (req: Request, res: Response) => {
  const resultado = LicencaSocialService.calcularResultado(req.params["id"]!);
  if ("erro" in resultado) {
    res.status(422).json(resultado);
    return;
  }
  res.json(resultado);
});

// POST /api/licenca-social/consultas/:id/aprovar
router.post("/consultas/:id/aprovar", (req: Request, res: Response) => {
  const resultado = LicencaSocialService.aprovarConsulta(req.params["id"]!);
  if ("erro" in resultado) {
    res.status(422).json(resultado);
    return;
  }
  res.json(resultado);
});

// GET /api/licenca-social/tipos-consulta
router.get("/tipos-consulta", (_req: Request, res: Response) => {
  res.json(LicencaSocialService.listarTiposConsulta());
});

export default router;
