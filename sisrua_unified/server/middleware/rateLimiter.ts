import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

/**
 * Custom key generator that uses the client IP address
 * This respects X-Forwarded-For when trust proxy is enabled
 * Uses ipKeyGenerator to properly handle both IPv4 and IPv6 addresses
 * Fixes: ValidationError about IPv6 addresses bypassing rate limits
 */
const keyGenerator = (req: Request): string => {
    return ipKeyGenerator(req.ip || 'unknown');
};

const dxfRateLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_DXF_WINDOW_MS,
    limit: config.RATE_LIMIT_DXF_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator,
    message: { error: 'Too many DXF requests, please try again later.' },
    handler: (req, res, _next, options) => {
        logger.warn('DXF rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            limit: options.limit,
            windowMs: options.windowMs
        });
        res.status(options.statusCode).json(options.message);
    }
});

const generalRateLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_GENERAL_WINDOW_MS,
    limit: config.RATE_LIMIT_GENERAL_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator,
    message: { error: 'Too many requests, please try again later.' },
    handler: (req, res, _next, options) => {
        logger.warn('Rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            limit: options.limit,
            windowMs: options.windowMs
        });
        res.status(options.statusCode).json(options.message);
    }
});

export { dxfRateLimiter, generalRateLimiter };
