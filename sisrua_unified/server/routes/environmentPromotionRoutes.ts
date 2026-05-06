/**
 * environmentPromotionRoutes.ts — Rotas de Promotion Controlado (20 [T1])
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  EnvironmentPromotionService,
  Environment,
} from "../services/environmentPromotionService.js";

const router = Router();

const RegisterBuildSchema = z.object({
  version: z.string().min(1),
  gitCommit: z.string().min(1),
  artifactHash: z.string().min(1),
});

const PromoteSchema = z.object({
  buildId: z.string().min(1),
  to: z.enum(["homolog", "preprod", "prod"]),
  approvedBy: z.string().min(1),
  changeRequestId: z.string().min(1),
  checks: z.object({
    testsPassed: z.boolean(),
    securityGatePassed: z.boolean(),
    observabilityGatePassed: z.boolean(),
  }),
});

router.post("/builds", (req: Request, res: Response) => {
  const parsed = RegisterBuildSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });

  const build = EnvironmentPromotionService.registerBuild(parsed.data);
  return res.status(201).json(build);
});

router.get("/builds", (_req: Request, res: Response) => {
  return res.json(EnvironmentPromotionService.listBuilds());
});

router.get("/builds/:id", (req: Request, res: Response) => {
  const build = EnvironmentPromotionService.getBuildById(req.params["id"]!);
  if (!build) return res.status(404).json({ error: "Build não encontrada." });
  return res.json(build);
});

router.post("/promote", (req: Request, res: Response) => {
  const parsed = PromoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });

  try {
    const event = EnvironmentPromotionService.promote({
      buildId: parsed.data.buildId,
      to: parsed.data.to as Environment,
      approvedBy: parsed.data.approvedBy,
      changeRequestId: parsed.data.changeRequestId,
      checks: parsed.data.checks,
    });
    return res.status(201).json(event);
  } catch (err: unknown) {
    return res.status(422).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/history", (req: Request, res: Response) => {
  const buildId = req.query["buildId"] as string | undefined;
  return res.json(EnvironmentPromotionService.getPromotionHistory(buildId));
});

router.get("/pipeline", (_req: Request, res: Response) => {
  return res.json(EnvironmentPromotionService.getPipelineState());
});

export default router;
