/**
 * /metrics — Prometheus-compatible metrics endpoint.
 *
 * Scraped by Prometheus (or any compatible tool like Grafana Agent).
 * Only served when METRICS_ENABLED=true (default: true in all envs).
 * Should be protected behind a firewall / internal network in production.
 */
import { Router, Request, Response } from 'express';
import { metricsService } from '../services/metricsService.js';
import { config } from '../config.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
    if (!config.METRICS_ENABLED) {
        return res.status(404).json({ error: 'Metrics not enabled' });
    }

    try {
        const metrics = await metricsService.getMetrics();
        res.set('Content-Type', metricsService.contentType);
        return res.send(metrics);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return res.status(500).json({ error: 'Failed to collect metrics', details: message });
    }
});

export default router;
