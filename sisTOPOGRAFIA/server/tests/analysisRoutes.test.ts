const mockAnalyzeArea = jest.fn();

jest.mock('../services/analysisService', () => ({
    AnalysisService: { analyzeArea: mockAnalyzeArea }
}));

import express from 'express';
import request from 'supertest';
import router from '../interfaces/routes/analysisRoutes';

const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/', router);
    return app;
};

const validBody = {
    stats: { buildings: 10, roads: 5, trees: 3 },
    locationName: 'São Paulo'
};

describe('POST /analysis', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.GROQ_API_KEY = 'test-key';
    });

    afterEach(() => {
        delete process.env.GROQ_API_KEY;
    });

    it('returns 200 with analysis result on valid request', async () => {
        mockAnalyzeArea.mockResolvedValueOnce({ analysis: '## Test Analysis' });
        const res = await request(buildApp()).post('/').send(validBody);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ analysis: '## Test Analysis' });
        expect(mockAnalyzeArea).toHaveBeenCalledWith(validBody.stats, 'São Paulo', 'test-key');
    });

    it('returns 400 when stats is missing', async () => {
        const res = await request(buildApp()).post('/').send({ locationName: 'Test' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
    });

    it('returns 503 when GROQ_API_KEY is not set', async () => {
        delete process.env.GROQ_API_KEY;
        const res = await request(buildApp()).post('/').send(validBody);
        expect(res.status).toBe(503);
        expect(res.body.error).toContain('GROQ_API_KEY');
    });

    it('returns 500 with Limite de Taxa message on 429 rate limit error', async () => {
        mockAnalyzeArea.mockRejectedValueOnce(new Error('429 rate limit exceeded'));
        const res = await request(buildApp()).post('/').send(validBody);
        expect(res.status).toBe(500);
        expect(res.body.analysis).toContain('Limite de Taxa');
    });

    it('returns 500 with Autenticação message on 401 auth error', async () => {
        mockAnalyzeArea.mockRejectedValueOnce(new Error('401 unauthorized'));
        const res = await request(buildApp()).post('/').send(validBody);
        expect(res.status).toBe(500);
        expect(res.body.analysis).toContain('Autenticação');
    });

    it('returns 500 with Conexão message on ECONNREFUSED network error', async () => {
        mockAnalyzeArea.mockRejectedValueOnce(new Error('ECONNREFUSED connection refused'));
        const res = await request(buildApp()).post('/').send(validBody);
        expect(res.status).toBe(500);
        expect(res.body.analysis).toContain('Conexão');
    });

    it('returns 500 with generic error message on unknown error', async () => {
        mockAnalyzeArea.mockRejectedValueOnce(new Error('Something went wrong'));
        const res = await request(buildApp()).post('/').send(validBody);
        expect(res.status).toBe(500);
        expect(res.body.analysis).toContain('Erro na Análise AI');
    });

    it('uses "Área Selecionada" as default when locationName is not provided', async () => {
        mockAnalyzeArea.mockResolvedValueOnce({ analysis: 'ok' });
        const res = await request(buildApp()).post('/').send({ stats: validBody.stats });
        expect(res.status).toBe(200);
        expect(mockAnalyzeArea).toHaveBeenCalledWith(validBody.stats, 'Área Selecionada', 'test-key');
    });

    it('returns 400 for invalid body (non-object stats)', async () => {
        const res = await request(buildApp()).post('/').send({ stats: 'invalid_string', locationName: 'Test' });
        expect(res.status).toBe(400);
    });

    it('returns 500 with sanitized message when error is not an Error instance', async () => {
        mockAnalyzeArea.mockRejectedValueOnce('string error value');
        const res = await request(buildApp()).post('/').send(validBody);
        expect(res.status).toBe(500);
        expect(res.body.details).toBe('string error value');
    });
});
