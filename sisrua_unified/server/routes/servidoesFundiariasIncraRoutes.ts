/**
 * Rotas T2-107 — Servidões Fundiárias SIRGAS 2000 (INCRA/SIGEF)
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { ServidoesFundiariasIncraService } from "../services/servidoesFundiariasIncraService.js";

const router = Router();

const TipoServidaoEnum = z.enum([
  "passagem", "eletrica", "ductos", "acesso_producao",
  "hidrica", "servidao_ambiental", "faixa_dominio", "reserva_legal",
]);

const ClassePrecisaoEnum = z.enum(["A", "B", "C"]);

const MetodoLevantamentoEnum = z.enum([
  "GNSS_PPP", "GNSS_RTK", "GPS_Convencional", "Total_Station",
]);

const LadoEnum = z.enum([
  "norte", "sul", "leste", "oeste",
  "nordeste", "noroeste", "sudeste", "sudoeste",
]);

const CriarProcessoSchema = z.object({
  tenantId: z.string().min(2),
  titulo: z.string().min(3),
  tipoServidao: TipoServidaoEnum,
  matriculaImovelServiente: z.string().min(3),
  municipio: z.string().min(2),
  uf: z.string().length(2),
  classePrecisaoExigida: ClassePrecisaoEnum.optional(),
  responsavelTecnico: z.string().min(3),
  creaResponsavel: z.string().optional(),
});

const AdicionarVerticeSchema = z.object({
  codigo: z.string().min(2),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  altitudeM: z.number().optional(),
  descricaoLocalizacao: z.string().min(3),
  precisaoM: z.number().positive(),
  metodoLevantamento: MetodoLevantamentoEnum,
});

const AdicionarConfrontanteSchema = z.object({
  nome: z.string().min(3),
  cpfCnpj: z.string().min(11),
  lado: LadoEnum,
  matriculaImovel: z.string().optional(),
});

// POST /processos
router.post("/processos", (req: Request, res: Response) => {
  const parse = CriarProcessoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    const processo = ServidoesFundiariasIncraService.criarProcesso(parse.data);
    return res.status(201).json(processo);
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /processos
router.get("/processos", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;
  return res.json(ServidoesFundiariasIncraService.listarProcessos(tenantId));
});

// GET /processos/:id
router.get("/processos/:id", (req: Request, res: Response) => {
  const processo = ServidoesFundiariasIncraService.obterProcesso(req.params.id);
  if (!processo) return res.status(404).json({ error: "Processo não encontrado" });
  return res.json(processo);
});

// POST /processos/:id/vertices
router.post("/processos/:id/vertices", (req: Request, res: Response) => {
  const parse = AdicionarVerticeSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    const vertice = ServidoesFundiariasIncraService.adicionarVertice(
      req.params.id,
      parse.data
    );
    return res.status(201).json(vertice);
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /processos/:id/confrontantes
router.post("/processos/:id/confrontantes", (req: Request, res: Response) => {
  const parse = AdicionarConfrontanteSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    const confrontante = ServidoesFundiariasIncraService.adicionarConfrontante(
      req.params.id,
      parse.data
    );
    return res.status(201).json(confrontante);
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /processos/:id/calcular
router.post("/processos/:id/calcular", (req: Request, res: Response) => {
  try {
    const resultado = ServidoesFundiariasIncraService.calcularAreaPerimetro(req.params.id);
    return res.json(resultado);
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /processos/:id/certificar
router.post("/processos/:id/certificar", (req: Request, res: Response) => {
  try {
    const processo = ServidoesFundiariasIncraService.certificarProcesso(req.params.id);
    return res.json(processo);
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /tipos-servidao
router.get("/tipos-servidao", (_req: Request, res: Response) => {
  return res.json(ServidoesFundiariasIncraService.listarTiposServidao());
});

export default router;
