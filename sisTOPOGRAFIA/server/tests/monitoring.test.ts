import { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

// Mock logger
jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

import { monitoringMiddleware } from '../middleware/monitoring';
import { logger } from '../utils/logger';

const buildMockRes = (statusCode = 200): Partial<Response> & EventEmitter => {
    const emitter = new EventEmitter();
    return Object.assign(emitter, {
        statusCode,
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    }) as unknown as Partial<Response> & EventEmitter;
};

describe('Monitoring Middleware', () => {
    let nowSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        nowSpy = jest.spyOn(performance, 'now');
    });

    afterEach(() => {
        nowSpy.mockRestore();
    });

    it('deve chamar next()', () => {
        nowSpy.mockReturnValueOnce(0).mockReturnValueOnce(100);
        const req = { method: 'GET', path: '/api/health' } as unknown as Request;
        const res = buildMockRes();
        const next = jest.fn() as NextFunction;

        monitoringMiddleware(req, res as unknown as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
    });

    it('deve registrar log ao finalizar requisição', () => {
        nowSpy.mockReturnValueOnce(0).mockReturnValueOnce(150);
        const req = { method: 'GET', path: '/api/health' } as unknown as Request;
        const res = buildMockRes(200);
        const next = jest.fn() as NextFunction;

        monitoringMiddleware(req, res as unknown as Response, next);
        res.emit('finish');

        expect(logger.info).toHaveBeenCalledWith('Requisição concluída', expect.objectContaining({
            method: 'GET',
            path: '/api/health',
            status: 200,
            durationMs: 150
        }));
    });

    it('deve registrar aviso para requisições lentas (> 5000 ms)', () => {
        nowSpy.mockReturnValueOnce(0).mockReturnValueOnce(6000);
        const req = { method: 'POST', path: '/api/tasks/generate-dxf' } as unknown as Request;
        const res = buildMockRes(200);
        const next = jest.fn() as NextFunction;

        monitoringMiddleware(req, res as unknown as Response, next);
        res.emit('finish');

        expect(logger.warn).toHaveBeenCalledWith('Requisição lenta detectada', expect.objectContaining({
            method: 'POST',
            path: '/api/tasks/generate-dxf',
            durationMs: 6000
        }));
    });

    it('não deve emitir aviso para requisições rápidas (≤ 5000 ms)', () => {
        nowSpy.mockReturnValueOnce(0).mockReturnValueOnce(4999);
        const req = { method: 'GET', path: '/health' } as unknown as Request;
        const res = buildMockRes(200);
        const next = jest.fn() as NextFunction;

        monitoringMiddleware(req, res as unknown as Response, next);
        res.emit('finish');

        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('deve incluir status HTTP no log', () => {
        nowSpy.mockReturnValueOnce(0).mockReturnValueOnce(50);
        const req = { method: 'GET', path: '/api/nao-encontrado' } as unknown as Request;
        const res = buildMockRes(404);
        const next = jest.fn() as NextFunction;

        monitoringMiddleware(req, res as unknown as Response, next);
        res.emit('finish');

        expect(logger.info).toHaveBeenCalledWith('Requisição concluída', expect.objectContaining({
            status: 404
        }));
    });

    it('deve arredondar duração em ms', () => {
        // start=0, end=100.6 → duração=100.6 ms → Math.round(100.6) = 101
        nowSpy.mockReturnValueOnce(0).mockReturnValueOnce(100.6);
        const req = { method: 'GET', path: '/api/test' } as unknown as Request;
        const res = buildMockRes(200);
        const next = jest.fn() as NextFunction;

        monitoringMiddleware(req, res as unknown as Response, next);
        res.emit('finish');

        expect(logger.info).toHaveBeenCalledWith('Requisição concluída', expect.objectContaining({
            durationMs: 101
        }));
    });
});
