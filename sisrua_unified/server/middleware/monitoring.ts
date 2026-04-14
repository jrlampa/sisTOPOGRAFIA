import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { performance } from 'perf_hooks';

/**
 * Monitoring middleware to track request duration and identify slow requests.
 * Logs duration, method, path, and status code for every request.
 * Warning logs are generated for requests exceeding 5 seconds.
 */
export const monitoringMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    const path = req.path;
    const method = req.method;

    res.on('finish', () => {
        const duration = performance.now() - start;
        const statusCode = res.statusCode;

        const logData = {
            method,
            path,
            statusCode,
            durationMs: Math.round(duration * 100) / 100,
            ip: req.ip,
            userAgent: req.get('user-agent')
        };

        if (duration > 5000) {
            logger.warn('Slow request detected', logData);
        } else {
            logger.info('Request completed', logData);
        }
    });

    next();
};
