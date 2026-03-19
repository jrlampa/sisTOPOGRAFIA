/**
 * server/tests/dxfController.test.ts
 * Tests for DxfController, focusing on error handling and schema validation.
 */

// ── Transitive ESM dependency mocks (must be hoisted) ────────────────────────
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
jest.mock('../pythonBridge', () => ({ generateDxf: jest.fn() }));
jest.mock('../services/cloudTasksService', () => ({ createDxfTask: jest.fn() }));
jest.mock('../services/jobStatusServiceFirestore', () => ({
    createJob: jest.fn(),
    getJob: jest.fn(),
    updateJobStatus: jest.fn(),
    completeJob: jest.fn(),
    failJob: jest.fn()
}));
jest.mock('../services/cacheServiceFirestore', () => ({
    createCacheKey: jest.fn(() => 'test-key'),
    getCachedFilename: jest.fn(() => null),
    deleteCachedFilename: jest.fn(),
    setCachedFilename: jest.fn()
}));
jest.mock('../services/dxfCleanupService', () => ({ scheduleDxfDeletion: jest.fn() }));
jest.mock('../infrastructure/firestoreService', () => ({
    FirestoreInfrastructure: { getInstance: jest.fn() }
}));

// ── Mock logger ──────────────────────────────────────────────────────────────
jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

import { Request, Response } from 'express';
import { DxfController } from '../interfaces/controllers/DxfController';
import { GenerateDxfUseCase } from '../application/GenerateDxfUseCase';

const makeMockRes = () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    return { res: { status, json } as unknown as Response, json, status };
};

const makeReq = (body: object = {}): Request =>
    ({ body, ip: '127.0.0.1' }) as unknown as Request;

describe('DxfController', () => {
    let controller: DxfController;
    let mockExecute: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockExecute = jest.fn();
        const useCase = { execute: mockExecute } as unknown as GenerateDxfUseCase;
        controller = new DxfController(useCase);
    });

    // ── Validation errors ─────────────────────────────────────────────────────

    it('retorna 400 quando corpo da requisição é inválido (sem lat/lon em modo circle)', async () => {
        const { res, status, json } = makeMockRes();
        const req = makeReq({ mode: 'circle', radius: 500 }); // missing lat/lon

        await controller.generate(req, res);

        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invalid request body' }));
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it('retorna 400 quando projection é inválida', async () => {
        const { res, status, json } = makeMockRes();
        const req = makeReq({
            mode: 'circle', lat: -22.15018, lon: -42.92185, radius: 500, projection: 'invalid'
        });

        await controller.generate(req, res);

        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invalid request body' }));
    });

    it('retorna 400 quando layers contém campo desconhecido', async () => {
        const { res, status, json } = makeMockRes();
        const req = makeReq({
            mode: 'circle', lat: -22.15018, lon: -42.92185, radius: 500,
            layers: { buildings: true, unknown_field: true }
        });

        await controller.generate(req, res);

        expect(status).toHaveBeenCalledWith(400);
    });

    // ── Successful generation ─────────────────────────────────────────────────

    it('retorna resultado do use case quando requisição é válida', async () => {
        const useCaseResult = { status: 202, data: { status: 'queued', jobId: 'abc-123' } };
        mockExecute.mockResolvedValueOnce(useCaseResult);

        const { res, status, json } = makeMockRes();
        const req = makeReq({ mode: 'circle', lat: -22.15018, lon: -42.92185, radius: 500 });

        await controller.generate(req, res);

        expect(status).toHaveBeenCalledWith(202);
        expect(json).toHaveBeenCalledWith(useCaseResult.data);
    });

    // ── Error handling ────────────────────────────────────────────────────────

    it('retorna 500 com mensagem de erro quando use case lança Error', async () => {
        mockExecute.mockRejectedValueOnce(new Error('Python engine crashed'));

        const { res, status, json } = makeMockRes();
        const req = makeReq({ mode: 'circle', lat: -22.15018, lon: -42.92185, radius: 500 });

        await controller.generate(req, res);

        expect(status).toHaveBeenCalledWith(500);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({
            error: 'Generation failed',
            details: 'Python engine crashed'
        }));
    });

    it('retorna 500 com String(err) quando use case lança não-Error', async () => {
        mockExecute.mockRejectedValueOnce('string error value');

        const { res, status, json } = makeMockRes();
        const req = makeReq({ mode: 'circle', lat: -22.15018, lon: -42.92185, radius: 500 });

        await controller.generate(req, res);

        expect(status).toHaveBeenCalledWith(500);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({
            error: 'Generation failed',
            details: 'string error value'
        }));
    });

    it('details não é undefined quando use case lança objeto sem .message', async () => {
        mockExecute.mockRejectedValueOnce({ code: 42 }); // no .message property

        const { res, status, json } = makeMockRes();
        const req = makeReq({ mode: 'circle', lat: -22.15018, lon: -42.92185, radius: 500 });

        await controller.generate(req, res);

        expect(status).toHaveBeenCalledWith(500);
        const body = json.mock.calls[0][0];
        expect(body.details).toBeDefined();
        expect(typeof body.details).toBe('string');
    });
});

