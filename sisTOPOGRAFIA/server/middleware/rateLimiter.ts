import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Custom key generator that uses the client IP address
 * This respects X-Forwarded-For when trust proxy is enabled
 * Uses ipKeyGenerator to properly handle both IPv4 and IPv6 addresses
 * Fixes: ValidationError about IPv6 addresses bypassing rate limits
 */
export const keyGenerator = (req: Request): string => {
    return ipKeyGenerator(req.ip || 'unknown');
};

// Rate limit thresholds are configurable via environment variables for easy tuning
const DXF_RATE_LIMIT = parseInt(process.env.RATE_LIMIT_DXF || '10', 10);
const GENERAL_RATE_LIMIT = parseInt(process.env.RATE_LIMIT_GENERAL || '100', 10);
const GEO_RATE_LIMIT = parseInt(process.env.RATE_LIMIT_GEO || '30', 10);

const dxfRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: DXF_RATE_LIMIT,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator,
    message: { error: 'Muitas requisições de DXF. Tente novamente mais tarde.' },
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
    windowMs: 15 * 60 * 1000,
    limit: GENERAL_RATE_LIMIT,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator,
    message: { error: 'Muitas requisições. Tente novamente mais tarde.' },
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

// Geo/search endpoints: stricter limit to prevent geocoding enumeration attacks
const geoRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: GEO_RATE_LIMIT,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator,
    message: { error: 'Muitas requisições de busca. Tente novamente mais tarde.' },
    handler: (req, res, _next, options) => {
        logger.warn('Geo rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            limit: options.limit,
            windowMs: options.windowMs
        });
        res.status(options.statusCode).json(options.message);
    }
});

export { dxfRateLimiter, generalRateLimiter, geoRateLimiter };
