/**
 * blueGreenRoutes.ts — Rotas Blue/Green Deployment (23 [T1])
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { BlueGreenService, SlotColor } from "../services/blueGreenService.js";

const router = Router();

const DeploySchema = z.object({
  color: z.enum(["blue", "green"]),
  version: z.string().min(1),
  gitCommit: z.string().min(1),
  healthUrl: z.string().url().optional(),
});

const SmokeGateSchema = z.object({
  color: z.enum(["blue", "green"]),
  passed: z.boolean(),
});

const SwitchSchema = z.object({
  to: z.enum(["blue", "green"]),
  approvedBy: z.string().min(1),
  motivo: z.string().min(1),
});

const RollbackSchema = z.object({
  approvedBy: z.string().min(1),
});

// POST /slots — deploy em slot
router.post("/slots", (req: Request, res: Response) => {
  const parse = DeploySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.flatten() });
    return;
  }
  const { color, ...params } = parse.data;
  const slot = BlueGreenService.deploySlot(color as SlotColor, params);
  res.status(201).json(slot);
});

// POST /smoke-gate — registra resultado dos smoke tests
router.post("/smoke-gate", (req: Request, res: Response) => {
  const parse = SmokeGateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.flatten() });
    return;
  }
  try {
    const slot = BlueGreenService.getSmokeGate(parse.data.color as SlotColor, parse.data.passed);
    res.json(slot);
  } catch (err: unknown) {
    res.status(404).json({ erro: (err as Error).message });
  }
});

// POST /switch — alterna slot ativo
router.post("/switch", (req: Request, res: Response) => {
  const parse = SwitchSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.flatten() });
    return;
  }
  const event = BlueGreenService.switch({ ...parse.data, to: parse.data.to as SlotColor });
  res.status(event.sucesso ? 200 : 409).json(event);
});

// POST /rollback — rollback para slot anterior
router.post("/rollback", (req: Request, res: Response) => {
  const parse = RollbackSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.flatten() });
    return;
  }
  const event = BlueGreenService.rollback(parse.data.approvedBy);
  res.status(event.sucesso ? 200 : 409).json(event);
});

// GET /state — estado atual dos slots
router.get("/state", (_req: Request, res: Response) => {
  res.json(BlueGreenService.getState());
});

// GET /history — histórico de switches
router.get("/history", (_req: Request, res: Response) => {
  res.json(BlueGreenService.getSwitchHistory());
});

export default router;
