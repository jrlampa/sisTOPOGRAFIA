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
import { timingSafeEqual } from 'crypto';
import { metricsService } from '../services/metricsService.js';
import { config } from '../config.js';

const router = Router();

/**
 * Validates the Authorization Bearer token for the /metrics endpoint.
 * Returns true when access is allowed, false when it must be denied.
 * Uses constant-time comparison to prevent timing attacks.
 */
function isMetricsRequestAuthorized(req: Request): boolean {
    // No token configured → unrestricted (caller is responsible for network isolation)
    if (!config.METRICS_TOKEN) {
        return true;
    }

    const authHeader = req.headers.authorization ?? '';
    if (!authHeader.startsWith('Bearer ')) {
        return false;
    }

    const providedToken = authHeader.slice('Bearer '.length);

    // Constant-time comparison to mitigate timing-based token enumeration.
    const expected = Buffer.from(config.METRICS_TOKEN, 'utf8');
    const provided = Buffer.from(providedToken, 'utf8');

    if (provided.length !== expected.length) {
        return false;
    }

    return timingSafeEqual(provided, expected);
}

router.get('/', async (req: Request, res: Response) => {
    if (!config.METRICS_ENABLED) {
        return res.status(404).json({ error: 'Metrics not enabled' });
    }

    if (!isMetricsRequestAuthorized(req)) {
        res.set('WWW-Authenticate', 'Bearer realm="metrics"');
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
