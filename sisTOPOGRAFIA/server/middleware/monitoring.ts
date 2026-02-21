import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { logger } from '../utils/logger.js';

/** Limite (ms) acima do qual uma requisição é considerada lenta */
const SLOW_REQUEST_THRESHOLD_MS = 5000;

/**
 * Middleware de monitoramento de performance.
 * Registra método, caminho, status HTTP e duração de cada requisição.
 * Emite aviso adicional para requisições lentas (> 5 s).
 * Responsabilidade única (SRP): apenas observação — sem lógica de negócio.
 */
export const monitoringMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const start = performance.now();

    res.on('finish', () => {
        const durationMs = Math.round(performance.now() - start);

        logger.info('Requisição concluída', {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            durationMs
        });

        if (durationMs > SLOW_REQUEST_THRESHOLD_MS) {
            logger.warn('Requisição lenta detectada', {
                method: req.method,
                path: req.path,
                durationMs
            });
        }
    });

    next();
};
