/**
 * Rotas T2-87 — Hybrid Cloud Support
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { HybridCloudService } from "../services/hybridCloudService.js";

const router = Router();

const CadastrarWorkerSchema = z.object({
  tenantId: z.string().min(2),
  nome: z.string().min(3),
  tipoWorker: z.enum(["local", "cloud"]),
  capacidadeMaxJobs: z.number().int().positive(),
  latenciaMs: z.number().int().nonnegative(),
});

const RegistrarJobSchema = z.object({
  tenantId: z.string().min(2),
  tipoJob: z.string().min(3),
  prioridade: z.enum(["baixa", "media", "alta", "critica"]),
  estrategiaRoteamento: z.enum(["prefer_local", "prefer_cloud", "hibrido"]),
  payload: z.record(z.unknown()),
});

const AtualizarStatusSchema = z.object({
  status: z.enum([
    "enfileirado",
    "roteado",
    "executando",
    "concluido",
    "falha",
  ]),
});

router.post("/workers", (req: Request, res: Response) => {
  const parse = CadastrarWorkerSchema.safeParse(req.body);
  if (!parse.success)
    return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(HybridCloudService.cadastrarWorker(parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.get("/workers", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;
  return res.json(HybridCloudService.listarWorkers(tenantId));
});

router.get("/workers/:id", (req: Request, res: Response) => {
  const worker = HybridCloudService.obterWorker(req.params.id);
  if (!worker) return res.status(404).json({ error: "Worker não encontrado" });
  return res.json(worker);
});

router.post("/jobs", (req: Request, res: Response) => {
  const parse = RegistrarJobSchema.safeParse(req.body);
  if (!parse.success)
    return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.status(201).json(HybridCloudService.registrarJob(parse.data));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.get("/jobs", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;
  return res.json(HybridCloudService.listarJobs(tenantId));
});

router.post("/jobs/:id/rotear", (req: Request, res: Response) => {
  try {
    return res.json(HybridCloudService.rotearJob(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.patch("/jobs/:id/status", (req: Request, res: Response) => {
  const parse = AtualizarStatusSchema.safeParse(req.body);
  if (!parse.success)
    return res.status(400).json({ errors: parse.error.issues });
  try {
    return res.json(
      HybridCloudService.atualizarStatusJob(req.params.id, parse.data.status),
    );
  } catch (err: unknown) {
    return res.status(422).json({ error: (err as Error).message });
  }
});

router.get("/estrategias", (_req: Request, res: Response) => {
  return res.json(HybridCloudService.listarEstrategias());
});

export default router;
