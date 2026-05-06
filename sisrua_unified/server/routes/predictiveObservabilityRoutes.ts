/**
 * predictiveObservabilityRoutes.ts — Rotas de Observabilidade Preditiva (18 [T1])
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  PredictiveObservabilityService,
  MetricName,
} from "../services/predictiveObservabilityService.js";

const router = Router();

const MetricNameSchema = z.enum([
  "api_latency_ms",
  "dxf_generation_seconds",
  "bt_calculation_seconds",
  "error_rate_pct",
  "queue_depth",
]);

const IngestMetricSchema = z.object({
  metric: MetricNameSchema,
  value: z.number().finite(),
  source: z.string().min(1).optional(),
  ts: z.string().datetime().optional(),
});

const StatsQuerySchema = z.object({
  windowMinutes: z
    .string()
    .regex(/^\d+$/)
    .transform((v) => parseInt(v, 10))
    .optional(),
});

const SeriesQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform((v) => parseInt(v, 10))
    .optional(),
});

const AnomalyQuerySchema = z.object({
  windowMinutes: z
    .string()
    .regex(/^\d+$/)
    .transform((v) => parseInt(v, 10))
    .optional(),
  zThreshold: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .transform((v) => Number(v))
    .optional(),
});

const SignalQuerySchema = z.object({
  windowMinutes: z
    .string()
    .regex(/^\d+$/)
    .transform((v) => parseInt(v, 10))
    .optional(),
});

router.get("/metrics", (_req: Request, res: Response) => {
  return res.json({
    supportedMetrics: PredictiveObservabilityService.getSupportedMetrics(),
  });
});

router.post("/metrics", (req: Request, res: Response) => {
  const parsed = IngestMetricSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.issues });
  }

  const point = PredictiveObservabilityService.ingest(
    parsed.data.metric,
    parsed.data.value,
    parsed.data.source ?? null,
    parsed.data.ts ?? null,
  );

  return res.status(201).json(point);
});

router.get("/metrics/:metric/series", (req: Request, res: Response) => {
  const metricParsed = MetricNameSchema.safeParse(req.params["metric"]);
  if (!metricParsed.success) {
    return res.status(400).json({ errors: metricParsed.error.issues });
  }

  const queryParsed = SeriesQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    return res.status(400).json({ errors: queryParsed.error.issues });
  }

  const metric = metricParsed.data as MetricName;
  const limit = queryParsed.data.limit ?? 120;

  return res.json(PredictiveObservabilityService.getSeries(metric, limit));
});

router.get("/metrics/:metric/stats", (req: Request, res: Response) => {
  const metricParsed = MetricNameSchema.safeParse(req.params["metric"]);
  if (!metricParsed.success) {
    return res.status(400).json({ errors: metricParsed.error.issues });
  }

  const queryParsed = StatsQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    return res.status(400).json({ errors: queryParsed.error.issues });
  }

  const metric = metricParsed.data as MetricName;
  const windowMinutes = queryParsed.data.windowMinutes ?? 1440;

  return res.json(PredictiveObservabilityService.getStats(metric, windowMinutes));
});

router.get("/metrics/:metric/anomalies", (req: Request, res: Response) => {
  const metricParsed = MetricNameSchema.safeParse(req.params["metric"]);
  if (!metricParsed.success) {
    return res.status(400).json({ errors: metricParsed.error.issues });
  }

  const queryParsed = AnomalyQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    return res.status(400).json({ errors: queryParsed.error.issues });
  }

  const metric = metricParsed.data as MetricName;
  const windowMinutes = queryParsed.data.windowMinutes ?? 1440;
  const zThreshold = queryParsed.data.zThreshold ?? 2.5;

  return res.json(
    PredictiveObservabilityService.detectAnomalies(metric, windowMinutes, zThreshold),
  );
});

router.get("/metrics/:metric/signal", (req: Request, res: Response) => {
  const metricParsed = MetricNameSchema.safeParse(req.params["metric"]);
  if (!metricParsed.success) {
    return res.status(400).json({ errors: metricParsed.error.issues });
  }

  const queryParsed = SignalQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    return res.status(400).json({ errors: queryParsed.error.issues });
  }

  const metric = metricParsed.data as MetricName;
  const windowMinutes = queryParsed.data.windowMinutes ?? 360;

  return res.json(PredictiveObservabilityService.getPredictiveSignal(metric, windowMinutes));
});

router.get("/overview", (_req: Request, res: Response) => {
  return res.json(PredictiveObservabilityService.getOverview());
});

export default router;
