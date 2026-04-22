import { Router } from "express";
import { z } from "zod";
import { JobIdempotencyService } from "../services/jobIdempotencyService.js";

const router = Router();

// ─── Schemas ────────────────────────────────────────────────────────────────

const RegistrarSchema = z.object({
  chave: z.string().min(1),
  payload: z.unknown(),
});

const ConcluirSchema = z.object({
  resultado: z.unknown(),
});

const FalharSchema = z.object({
  erro: z.string().min(1),
});

// ─── Endpoints ───────────────────────────────────────────────────────────────

// POST /api/idempotency/registrar — registrar chave de idempotência
router.post("/registrar", (req, res) => {
  const parsed = RegistrarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.issues });
  const { registro, duplicata } = JobIdempotencyService.registrar(parsed.data);
  const status = duplicata ? 200 : 201;
  return res.status(status).json({ registro, duplicata });
});

// GET /api/idempotency/:chave — consultar status por chave
router.get("/:chave", (req, res) => {
  const record = JobIdempotencyService.consultar(req.params.chave);
  if (!record) return res.status(404).json({ erro: "Chave não encontrada ou expirada" });
  return res.json(record);
});

// POST /api/idempotency/:chave/concluir — marcar como concluído
router.post("/:chave/concluir", (req, res) => {
  const parsed = ConcluirSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.issues });
  try {
    const record = JobIdempotencyService.concluir({ chave: req.params.chave, resultado: parsed.data.resultado });
    return res.json(record);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return res.status(404).json({ erro: msg });
  }
});

// POST /api/idempotency/:chave/falhar — marcar como falha
router.post("/:chave/falhar", (req, res) => {
  const parsed = FalharSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.issues });
  try {
    const record = JobIdempotencyService.falhar({ chave: req.params.chave, erro: parsed.data.erro });
    return res.json(record);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return res.status(404).json({ erro: msg });
  }
});

// GET /api/idempotency — listar todos os registros
router.get("/", (_req, res) => {
  return res.json(JobIdempotencyService.listar());
});

// DELETE /api/idempotency/:chave — remover chave
router.delete("/:chave", (req, res) => {
  const removed = JobIdempotencyService.remover(req.params.chave);
  if (!removed) return res.status(404).json({ erro: "Chave não encontrada" });
  return res.status(204).send();
});

export default router;
