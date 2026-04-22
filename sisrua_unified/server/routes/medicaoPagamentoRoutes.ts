/**
 * Rotas T2-65 — Módulo de Medição para Pagamento (EAP/WBS)
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { MedicaoPagamentoService } from "../services/medicaoPagamentoService.js";

const router = Router();

const TipoServicoEnum = z.enum([
  "fornecimento_material",
  "montagem_eletrica",
  "obras_civis",
  "instalacao_equipamentos",
  "comissionamento",
  "ensaios",
  "supervisao",
  "mobilizacao",
  "desmobilizacao",
]);

const CriarMedicaoSchema = z.object({
  tenantId: z.string().min(2),
  titulo: z.string().min(3),
  contratoRef: z.string().min(3),
  periodo: z.string().min(6),          // ex: "2024-03"
  medicaoNumero: z.number().int().positive(),
  concessionaria: z.string().min(2),
  responsavel: z.string().min(3),
  retencaoPercentual: z.number().min(0).max(30).optional(),
});

const AdicionarItemSchema = z.object({
  wbsCode: z.string().min(1),
  descricao: z.string().min(3),
  tipoServico: TipoServicoEnum,
  unidade: z.string().min(1),
  quantidadeContratada: z.number().positive(),
  quantidadeMedida: z.number().nonnegative(),
  valorUnitario: z.number().positive(),
});

const RejeitarSchema = z.object({
  motivo: z.string().min(5),
});

// POST /medicoes
router.post("/medicoes", (req: Request, res: Response) => {
  const parse = CriarMedicaoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    const medicao = MedicaoPagamentoService.criarMedicao(parse.data);
    return res.status(201).json(medicao);
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /medicoes
router.get("/medicoes", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;
  return res.json(MedicaoPagamentoService.listarMedicoes(tenantId));
});

// GET /medicoes/:id
router.get("/medicoes/:id", (req: Request, res: Response) => {
  const medicao = MedicaoPagamentoService.obterMedicao(req.params.id);
  if (!medicao) return res.status(404).json({ error: "Medição não encontrada" });
  return res.json(medicao);
});

// POST /medicoes/:id/itens
router.post("/medicoes/:id/itens", (req: Request, res: Response) => {
  const parse = AdicionarItemSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    const item = MedicaoPagamentoService.adicionarItem(req.params.id, parse.data);
    return res.status(201).json(item);
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /medicoes/:id/calcular
router.post("/medicoes/:id/calcular", (req: Request, res: Response) => {
  try {
    const resultado = MedicaoPagamentoService.calcularMedicao(req.params.id);
    return res.json(resultado);
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /medicoes/:id/submeter
router.post("/medicoes/:id/submeter", (req: Request, res: Response) => {
  try {
    const medicao = MedicaoPagamentoService.submeterMedicao(req.params.id);
    return res.json(medicao);
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /medicoes/:id/aprovar
router.post("/medicoes/:id/aprovar", (req: Request, res: Response) => {
  try {
    const medicao = MedicaoPagamentoService.aprovarMedicao(req.params.id);
    return res.json(medicao);
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /medicoes/:id/rejeitar
router.post("/medicoes/:id/rejeitar", (req: Request, res: Response) => {
  const parse = RejeitarSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  try {
    const medicao = MedicaoPagamentoService.rejeitarMedicao(
      req.params.id,
      parse.data.motivo
    );
    return res.json(medicao);
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// POST /medicoes/:id/homologar
router.post("/medicoes/:id/homologar", (req: Request, res: Response) => {
  try {
    const medicao = MedicaoPagamentoService.homologarMedicao(req.params.id);
    return res.json(medicao);
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

// GET /tipos-servico
router.get("/tipos-servico", (_req: Request, res: Response) => {
  return res.json(MedicaoPagamentoService.listarTiposServico());
});

export default router;
