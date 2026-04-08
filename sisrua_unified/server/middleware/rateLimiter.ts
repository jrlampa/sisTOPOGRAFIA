import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import { constantsService } from '../services/constantsService.js';

/**
 * Custom key generator that uses the client IP address
 * This respects X-Forwarded-For when trust proxy is enabled
 * Uses ipKeyGenerator to properly handle both IPv4 and IPv6 addresses
 * Fixes: ValidationError about IPv6 addresses bypassing rate limits
 */
const keyGenerator = (req: Request): string => {
    return ipKeyGenerator(req.ip || 'unknown');
};

interface RateLimitPolicySnapshot {
    general: {
        windowMs: number;
        limit: number;
    };
    dxf: {
        windowMs: number;
        limit: number;
    };
}

const getConfigNumberConstant = (key: string, fallback: number): number => {
    if (!config.useDbConstantsConfig) {
        return fallback;
    }

    const value = constantsService.getSync<number>('config', key);
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const getGeneralWindowMs = (): number => getConfigNumberConstant('RATE_LIMIT_GENERAL_WINDOW_MS', config.RATE_LIMIT_GENERAL_WINDOW_MS);
const getGeneralLimit = (): number => getConfigNumberConstant('RATE_LIMIT_GENERAL_MAX', config.RATE_LIMIT_GENERAL_MAX);
const getDxfWindowMs = (): number => getConfigNumberConstant('RATE_LIMIT_DXF_WINDOW_MS', config.RATE_LIMIT_DXF_WINDOW_MS);
const getDxfLimit = (): number => getConfigNumberConstant('RATE_LIMIT_DXF_MAX', config.RATE_LIMIT_DXF_MAX);

export const getRateLimitPolicySnapshot = (): RateLimitPolicySnapshot => ({
    general: {
        windowMs: getGeneralWindowMs(),
        limit: getGeneralLimit(),
    },
    dxf: {
        windowMs: getDxfWindowMs(),
        limit: getDxfLimit(),
    },
});

const createDxfRateLimiter = (windowMs: number) => rateLimit({
    windowMs,
    limit: () => getDxfLimit(),
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

const createGeneralRateLimiter = (windowMs: number) => rateLimit({
    windowMs,
    limit: () => getGeneralLimit(),
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

let dxfRateLimiterHandler = createDxfRateLimiter(config.RATE_LIMIT_DXF_WINDOW_MS);
let generalRateLimiterHandler = createGeneralRateLimiter(config.RATE_LIMIT_GENERAL_WINDOW_MS);

export const refreshRateLimitersFromCatalog = (): void => {
    const policy = getRateLimitPolicySnapshot();
    dxfRateLimiterHandler = createDxfRateLimiter(policy.dxf.windowMs);
    generalRateLimiterHandler = createGeneralRateLimiter(policy.general.windowMs);
};

const dxfRateLimiter = (req: Parameters<typeof dxfRateLimiterHandler>[0], res: Parameters<typeof dxfRateLimiterHandler>[1], next: Parameters<typeof dxfRateLimiterHandler>[2]) =>
    dxfRateLimiterHandler(req, res, next);

const generalRateLimiter = (req: Parameters<typeof generalRateLimiterHandler>[0], res: Parameters<typeof generalRateLimiterHandler>[1], next: Parameters<typeof generalRateLimiterHandler>[2]) =>
    generalRateLimiterHandler(req, res, next);

export { dxfRateLimiter, generalRateLimiter };
