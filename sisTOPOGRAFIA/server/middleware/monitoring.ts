import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { logger } from '../utils/logger.js';

/** Limite (ms) acima do qual uma requisição é considerada lenta */
const SLOW_REQUEST_THRESHOLD_MS = 5000;

/**
 * Middleware de monitoramento de performance.
 * Registra método, caminho, status HTTP, duração, correlation ID e usuário.
 * Emite aviso adicional para requisições lentas (> 5 s).
 * Responsabilidade única (SRP): apenas observação — sem lógica de negócio.
 */
export const monitoringMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const start = performance.now();

    res.on('finish', () => {
        const durationMs = Math.round(performance.now() - start);
        const requestId = res.getHeader('x-request-id');
        const userId = (req as Request & { user?: { uid: string } }).user?.uid;

        logger.info('Requisição concluída', {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            durationMs,
            requestId,
            userId,
            contentLength: res.getHeader('content-length')
        });

        if (durationMs > SLOW_REQUEST_THRESHOLD_MS) {
            logger.warn('Requisição lenta detectada', {
                method: req.method,
                path: req.path,
                durationMs,
                requestId
            });
        }
    });

    next();
};
