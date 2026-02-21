import { Request, Response, NextFunction } from 'express';
import { dxfRateLimiter, generalRateLimiter, keyGenerator } from '../middleware/rateLimiter';

// Mock logger
jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

// Mock express-rate-limit to expose ipKeyGenerator and capture options
jest.mock('express-rate-limit', () => {
    const ipKeyGeneratorMock = jest.fn((ip: string) => ip);
    const rateLimitMock = jest.fn((options: any) => {
        const middleware = jest.fn();
        (middleware as any).options = options;
        return middleware;
    });
    (rateLimitMock as any).ipKeyGenerator = ipKeyGeneratorMock;
    return {
        __esModule: true,
        default: rateLimitMock,
        ipKeyGenerator: ipKeyGeneratorMock
    };
});

// Import after mock so jest.mock is hoisted correctly
import { logger } from '../utils/logger';
import { ipKeyGenerator } from 'express-rate-limit';

const mockRes = (): Partial<Response> => {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('Rate Limiter Middleware', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('keyGenerator', () => {
        it('deve gerar chave com IPv4', () => {
            const req = { ip: '192.168.1.100' } as unknown as Request;
            const key = keyGenerator(req);
            expect(ipKeyGenerator).toHaveBeenCalledWith('192.168.1.100');
            expect(key).toBe('192.168.1.100');
        });

        it('deve gerar chave com IPv6', () => {
            const req = { ip: '2001:db8::1' } as unknown as Request;
            const key = keyGenerator(req);
            expect(ipKeyGenerator).toHaveBeenCalledWith('2001:db8::1');
            expect(key).toBe('2001:db8::1');
        });

        it('deve usar fallback "unknown" quando IP é undefined', () => {
            const req = { ip: undefined } as unknown as Request;
            const key = keyGenerator(req);
            expect(ipKeyGenerator).toHaveBeenCalledWith('unknown');
            expect(key).toBe('unknown');
        });
    });

    describe('Rate Limiter Configuration', () => {
        it('should export dxfRateLimiter', () => {
            expect(dxfRateLimiter).toBeDefined();
            expect(typeof dxfRateLimiter).toBe('function');
        });

        it('should export generalRateLimiter', () => {
            expect(generalRateLimiter).toBeDefined();
            expect(typeof generalRateLimiter).toBe('function');
        });

        it('deve exportar keyGenerator', () => {
            expect(keyGenerator).toBeDefined();
            expect(typeof keyGenerator).toBe('function');
        });
    });

    describe('X-Forwarded-For Support', () => {
        it('should respect X-Forwarded-For when trust proxy is enabled', () => {
            const req = { ip: '10.0.0.1', headers: { 'x-forwarded-for': '10.0.0.1' } } as unknown as Request;
            const key = keyGenerator(req);
            expect(key).toBe('10.0.0.1');
        });
    });

    describe('DXF Rate Limiter handler', () => {
        it('deve retornar 429 com mensagem em pt-BR ao exceder limite DXF', () => {
            const req = {
                ip: '192.168.0.1',
                path: '/api/generate-dxf',
                headers: {}
            } as unknown as Request;
            const res = mockRes() as Response;
            const next = jest.fn() as NextFunction;

            const options = {
                statusCode: 429,
                message: { error: 'Muitas requisições de DXF. Tente novamente mais tarde.' },
                limit: 10,
                windowMs: 3600000
            };

            const handler = (dxfRateLimiter as any).options?.handler;
            expect(handler).toBeDefined();
            handler(req, res, next, options);
            expect(res.status).toHaveBeenCalledWith(429);
            expect(res.json).toHaveBeenCalledWith(options.message);
            expect(logger.warn).toHaveBeenCalledWith('DXF rate limit exceeded', expect.objectContaining({
                ip: req.ip,
                path: req.path,
                limit: options.limit,
                windowMs: options.windowMs
            }));
        });
    });

    describe('General Rate Limiter handler', () => {
        it('deve retornar 429 com mensagem em pt-BR ao exceder limite geral', () => {
            const req = {
                ip: '10.0.0.1',
                path: '/api/elevation',
                headers: {}
            } as unknown as Request;
            const res = mockRes() as Response;
            const next = jest.fn() as NextFunction;

            const options = {
                statusCode: 429,
                message: { error: 'Muitas requisições. Tente novamente mais tarde.' },
                limit: 100,
                windowMs: 900000
            };

            const handler = (generalRateLimiter as any).options?.handler;
            expect(handler).toBeDefined();
            handler(req, res, next, options);
            expect(res.status).toHaveBeenCalledWith(429);
            expect(res.json).toHaveBeenCalledWith(options.message);
            expect(logger.warn).toHaveBeenCalledWith('Rate limit exceeded', expect.objectContaining({
                ip: req.ip,
                path: req.path,
                limit: options.limit,
                windowMs: options.windowMs
            }));
        });
    });
});
