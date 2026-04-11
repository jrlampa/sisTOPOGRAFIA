/**
 * Express middleware that automatically records request metrics for every route.
 *
 * Counters the route as `baseUrl + req.route.path` for matched routes, or
 * normalises dynamic segments (UUIDs / large numeric IDs) for unmatched paths
 * to avoid metric label cardinality explosion.
 */
import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/metricsService.js';

/** Normalise a raw URL path so IDs don't create unbounded label sets. */
function normalisePath(rawPath: string): string {
    return rawPath
        // Replace UUIDs
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
        // Replace long numeric IDs (5+ digits)
        .replace(/\/\d{5,}/g, '/:id')
        // Keep at most 4 path segments to bound cardinality further
        .split('/')
        .slice(0, 5)
        .join('/') || '/';
}

export function requestMetrics(req: Request, res: Response, next: NextFunction): void {
    const startMs = Date.now();

    res.on('finish', () => {
        // req.route is set by Express after the matching handler runs; use it
        // when available for the most accurate label, fall back to normalisation.
        const route =
            req.route?.path
                ? `${req.baseUrl}${req.route.path}`
                : normalisePath(req.path);

        const durationSec = (Date.now() - startMs) / 1_000;
        metricsService.recordHttpRequest(req.method, route, res.statusCode, durationSec);
    });

    next();
}
