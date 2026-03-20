/**
 * server/tests/batchRoutes.test.ts
 * Tests for the batch DXF route, verifying async Firestore-backed cache
 * and job status operations are used correctly.
 */

// ── Mocks (hoisted) ─────────────────────────────────────────────────────────
jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));
jest.mock('../services/batchService', () => ({
    parseBatchCsv: jest.fn()
}));
jest.mock('../services/cloudTasksService', () => ({
    createDxfTask: jest.fn()
}));
jest.mock('../services/jobStatusServiceFirestore', () => ({
    createJob: jest.fn()
}));
jest.mock('../services/cacheServiceFirestore', () => ({
    createCacheKey: jest.fn(() => 'cache-key-1'),
    getCachedFilename: jest.fn(),
    setCachedFilename: jest.fn(),
    deleteCachedFilename: jest.fn()
}));
jest.mock('../infrastructure/firestoreService', () => ({
    FirestoreInfrastructure: { getInstance: jest.fn() }
}));

import request from 'supertest';
import express from 'express';
import { createBatchRouter } from '../interfaces/routes/batchRoutes';
import { parseBatchCsv } from '../services/batchService';
import { createDxfTask } from '../services/cloudTasksService';
import { createJob } from '../services/jobStatusServiceFirestore';
import {
    createCacheKey, getCachedFilename, deleteCachedFilename
} from '../services/cacheServiceFirestore';

const mockParseBatchCsv = parseBatchCsv as jest.Mock;
const mockCreateDxfTask = createDxfTask as jest.Mock;
const mockCreateJob = createJob as jest.Mock;
const mockGetCachedFilename = getCachedFilename as jest.Mock;
const mockDeleteCachedFilename = deleteCachedFilename as jest.Mock;

const buildApp = () => {
    const app = express();
    const dxfDirectory = '/tmp/dxf-test';
    const getBaseUrl = () => 'http://localhost:3001';
    app.use('/api/batch', createBatchRouter(dxfDirectory, getBaseUrl));
    return app;
};

beforeEach(() => {
    jest.clearAllMocks();
});

describe('POST /api/batch/dxf', () => {
    it('retorna 400 quando nenhum arquivo é enviado', async () => {
        const app = buildApp();
        const res = await request(app).post('/api/batch/dxf');
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Arquivo CSV é obrigatório');
    });

    it('retorna 400 quando CSV é vazio (parseBatchCsv retorna [])', async () => {
        mockParseBatchCsv.mockResolvedValueOnce([]);

        const app = buildApp();
        const res = await request(app)
            .post('/api/batch/dxf')
            .attach('file', Buffer.from('name,lat,lon,radius'), 'empty.csv');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('CSV vazio ou inválido');
    });

    it('chama getCachedFilename (async) e createJob (async) ao processar linha válida', async () => {
        mockParseBatchCsv.mockResolvedValueOnce([
            { line: 2, row: { name: 'Loc1', lat: '-22.15', lon: '-42.92', radius: '500', mode: 'circle' } }
        ]);
        mockGetCachedFilename.mockResolvedValueOnce(null); // cache miss
        mockCreateDxfTask.mockResolvedValueOnce({ taskId: 'task-abc' });
        mockCreateJob.mockResolvedValueOnce({});

        const app = buildApp();
        const res = await request(app)
            .post('/api/batch/dxf')
            .attach('file', Buffer.from('name,lat,lon,radius,mode\nLoc1,-22.15,-42.92,500,circle'), 'batch.csv');

        expect(res.status).toBe(200);
        expect(mockGetCachedFilename).toHaveBeenCalledWith('cache-key-1');
        expect(mockCreateJob).toHaveBeenCalledWith('task-abc');
        expect(res.body.results[0]).toMatchObject({ name: 'Loc1', status: 'queued', jobId: 'task-abc' });
    });

    it('chama deleteCachedFilename (async) quando arquivo em cache não existe no disco', async () => {
        mockParseBatchCsv.mockResolvedValueOnce([
            { line: 2, row: { name: 'Loc1', lat: '-22.15', lon: '-42.92', radius: '500', mode: 'circle' } }
        ]);
        // Cache hit, but file no longer on disk
        mockGetCachedFilename.mockResolvedValueOnce('stale_file.dxf');
        mockDeleteCachedFilename.mockResolvedValueOnce(undefined);
        mockCreateDxfTask.mockResolvedValueOnce({ taskId: 'task-xyz' });
        mockCreateJob.mockResolvedValueOnce({});

        const app = buildApp();
        const res = await request(app)
            .post('/api/batch/dxf')
            .attach('file', Buffer.from('name,lat,lon,radius,mode\nLoc1,-22.15,-42.92,500,circle'), 'batch.csv');

        expect(res.status).toBe(200);
        expect(mockDeleteCachedFilename).toHaveBeenCalledWith('cache-key-1');
        expect(mockCreateJob).toHaveBeenCalledWith('task-xyz');
    });

    it('reporta erros de validação sem rejeitar o lote inteiro', async () => {
        mockParseBatchCsv.mockResolvedValueOnce([
            { line: 2, row: { name: 'Bad', lat: 'not-a-number', lon: '-42.92', radius: '500' } },
            { line: 3, row: { name: 'Good', lat: '-22.15', lon: '-42.92', radius: '500', mode: 'circle' } }
        ]);
        mockGetCachedFilename.mockResolvedValueOnce(null);
        mockCreateDxfTask.mockResolvedValueOnce({ taskId: 'task-good' });
        mockCreateJob.mockResolvedValueOnce({});

        const app = buildApp();
        const res = await request(app)
            .post('/api/batch/dxf')
            .attach('file', Buffer.from('name,lat,lon,radius,mode'), 'batch.csv');

        expect(res.status).toBe(200);
        expect(res.body.errors).toHaveLength(1);
        expect(res.body.errors[0].line).toBe(2);
        expect(res.body.results[0]).toMatchObject({ name: 'Good', status: 'queued' });
    });
});
