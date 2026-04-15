/**
 * /metrics — Prometheus-compatible metrics endpoint.
 *
 * Scraped by Prometheus (or any compatible tool like Grafana Agent).
 * Only served when METRICS_ENABLED=true (default: true in all envs).
 *
 * Authentication:
 *   - If METRICS_TOKEN is set in the environment, all requests MUST supply:
 *       Authorization: Bearer <METRICS_TOKEN>
 *     Otherwise the endpoint returns 401.
 *   - If METRICS_TOKEN is not set, the endpoint is served without
 *     authentication — appropriate only for internal-network Prometheus
 *     scrapers that are NOT publicly exposed.
 */
import { Router, Request, Response } from 'express';
import { metricsService } from '../services/metricsService.js';
import { config } from '../config.js';
import { isBearerRequestAuthorized, setBearerChallenge } from '../utils/bearerAuth.js';

const router = Router();

/**
 * Validates the Authorization Bearer token for the /metrics endpoint.
 * Returns true when access is allowed, false when it must be denied.
 * Uses constant-time comparison to prevent timing attacks.
 */
function isMetricsRequestAuthorized(req: Request): boolean {
    return isBearerRequestAuthorized(req, config.METRICS_TOKEN);
}

router.get('/', async (req: Request, res: Response) => {
    if (!config.METRICS_ENABLED) {
        return res.status(404).json({ error: 'Metrics not enabled' });
    }

    if (!isMetricsRequestAuthorized(req)) {
        setBearerChallenge(res, 'metrics');
        return res.status(401).json({ error: 'Unauthorized' });
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
