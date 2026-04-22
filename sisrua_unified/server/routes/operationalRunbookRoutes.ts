import { Router } from "express";
import { z } from "zod";
import {
  OperationalRunbookService,
  type RunbookCategoria,
} from "../services/operationalRunbookService.js";

const router = Router();

// ─── Schemas ────────────────────────────────────────────────────────────────

const CategoriaEnum = z.enum([
  "falha_fila",
  "python_oom",
  "db_conexao",
  "api_externa",
  "seguranca",
  "implantacao",
]);

const PassoSchema = z.object({
  numero: z.number().int().positive(),
  titulo: z.string().min(1),
  descricao: z.string().min(1),
  responsavel: z.enum(["L1", "L2", "L3", "engenharia"]),
  obrigatorio: z.boolean(),
});

const CriarRunbookSchema = z.object({
  titulo: z.string().min(1),
  categoria: CategoriaEnum,
  descricao: z.string().min(1),
  rtoMinutos: z.number().int().positive(),
  status: z.enum(["ativo", "depreciado", "rascunho"]).optional().default("rascunho"),
  versao: z.string().default("1.0"),
  passos: z.array(PassoSchema).min(1),
});

const AtualizarRunbookSchema = z.object({
  titulo: z.string().optional(),
  descricao: z.string().optional(),
  passos: z.array(PassoSchema).optional(),
  rtoMinutos: z.number().int().positive().optional(),
  status: z.enum(["ativo", "depreciado", "rascunho"]).optional(),
});

const IniciarExecucaoSchema = z.object({
  incidenteId: z.string().min(1),
  executor: z.string().min(1),
});

const AvancarPassoSchema = z.object({
  resultado: z.string().min(1),
});

const EncerrarExecucaoSchema = z.object({
  status: z.enum(["concluida", "falhou"]),
});

// ─── Runbook CRUD ────────────────────────────────────────────────────────────

// GET /api/runbooks — listar runbooks
router.get("/", (req, res) => {
  const categoria =
    typeof req.query.categoria === "string" ? (req.query.categoria as RunbookCategoria) : undefined;
  return res.json(OperationalRunbookService.listarRunbooks(categoria));
});

// GET /api/runbooks/:id — obter runbook
router.get("/:id", (req, res) => {
  const rb = OperationalRunbookService.getRunbook(req.params.id);
  if (!rb) return res.status(404).json({ erro: "Runbook não encontrado" });
  return res.json(rb);
});

// POST /api/runbooks — criar runbook
router.post("/", (req, res) => {
  const parsed = CriarRunbookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.issues });
  const rb = OperationalRunbookService.criarRunbook(parsed.data as Parameters<typeof OperationalRunbookService.criarRunbook>[0]);
  return res.status(201).json(rb);
});

// PATCH /api/runbooks/:id — atualizar runbook
router.patch("/:id", (req, res) => {
  const parsed = AtualizarRunbookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.issues });
  try {
    const rb = OperationalRunbookService.atualizarRunbook(req.params.id, parsed.data);
    return res.json(rb);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return res.status(404).json({ erro: msg });
  }
});

// ─── Execuções ───────────────────────────────────────────────────────────────

// POST /api/runbooks/:id/execucoes — iniciar execução
router.post("/:id/execucoes", (req, res) => {
  const parsed = IniciarExecucaoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.issues });
  try {
    const exec = OperationalRunbookService.iniciarExecucao({
      runbookId: req.params.id,
      ...parsed.data,
    });
    return res.status(201).json(exec);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return res.status(404).json({ erro: msg });
  }
});

// GET /api/runbooks/:id/execucoes — listar execuções de um runbook
router.get("/:id/execucoes", (req, res) => {
  return res.json(OperationalRunbookService.listarExecucoes(req.params.id));
});

// GET /api/runbooks/execucoes/:execId — obter execução
router.get("/execucoes/:execId", (req, res) => {
  const exec = OperationalRunbookService.getExecucao(req.params.execId);
  if (!exec) return res.status(404).json({ erro: "Execução não encontrada" });
  return res.json(exec);
});

// POST /api/runbooks/execucoes/:execId/avancar — avançar para próximo passo
router.post("/execucoes/:execId/avancar", (req, res) => {
  const parsed = AvancarPassoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.issues });
  try {
    const exec = OperationalRunbookService.avancarPasso({
      execucaoId: req.params.execId,
      resultado: parsed.data.resultado,
    });
    return res.json(exec);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return res.status(400).json({ erro: msg });
  }
});

// POST /api/runbooks/execucoes/:execId/encerrar — encerrar execução
router.post("/execucoes/:execId/encerrar", (req, res) => {
  const parsed = EncerrarExecucaoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.issues });
  try {
    const exec = OperationalRunbookService.encerrarExecucao({
      execucaoId: req.params.execId,
      status: parsed.data.status,
    });
    return res.json(exec);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return res.status(404).json({ erro: msg });
  }
});

export default router;
