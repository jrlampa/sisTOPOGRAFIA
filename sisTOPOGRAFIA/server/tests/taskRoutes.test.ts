const mockGenerateDxf = jest.fn();
const mockCreateJob = jest.fn();
const mockUpdateJobStatus = jest.fn();
const mockCompleteJob = jest.fn();
const mockFailJob = jest.fn();
const mockGetJob = jest.fn();
const mockSetCachedFilename = jest.fn();
const mockScheduleDxfDeletion = jest.fn();

jest.mock('../pythonBridge', () => ({ generateDxf: mockGenerateDxf }));
jest.mock('../services/jobStatusServiceFirestore', () => ({
    createJob: mockCreateJob,
    updateJobStatus: mockUpdateJobStatus,
    completeJob: mockCompleteJob,
    failJob: mockFailJob,
    getJob: mockGetJob
}));
jest.mock('../services/cacheServiceFirestore', () => ({ setCachedFilename: mockSetCachedFilename }));
jest.mock('../services/dxfCleanupService', () => ({ scheduleDxfDeletion: mockScheduleDxfDeletion }));
jest.mock('../middleware/auth', () => ({
    webhookRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
    verifyCloudTasksToken: (_req: unknown, _res: unknown, next: () => void) => next()
}));

import express from 'express';
import request from 'supertest';
import taskRouter from '../interfaces/routes/taskRoutes';

const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/', taskRouter);
    return app;
};

const validTaskBody = {
    taskId: 'task-123',
    lat: -23.5,
    lon: -46.6,
    radius: 500,
    mode: 'circle',
    polygon: '[]',
    layers: {},
    projection: 'local',
    outputFile: '/tmp/test.dxf',
    filename: 'test.dxf',
    cacheKey: 'cache-key-1',
    downloadUrl: 'http://localhost/downloads/test.dxf'
};

describe('POST /process-dxf', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUpdateJobStatus.mockResolvedValue(undefined);
        mockCompleteJob.mockResolvedValue(undefined);
        mockFailJob.mockResolvedValue(undefined);
        mockSetCachedFilename.mockResolvedValue(undefined);
        mockScheduleDxfDeletion.mockReturnValue(undefined);
    });

    it('processes DXF successfully and returns 200 with url', async () => {
        mockGenerateDxf.mockResolvedValueOnce('stdout output');
        const res = await request(buildApp()).post('/process-dxf').send(validTaskBody);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.url).toBe(validTaskBody.downloadUrl);
        expect(res.body.taskId).toBe('task-123');
        expect(mockGenerateDxf).toHaveBeenCalled();
        expect(mockSetCachedFilename).toHaveBeenCalledWith('cache-key-1', 'test.dxf');
        expect(mockCompleteJob).toHaveBeenCalledWith('task-123', { url: validTaskBody.downloadUrl, filename: 'test.dxf' });
        expect(mockScheduleDxfDeletion).toHaveBeenCalledWith('/tmp/test.dxf');
    });

    it('returns 400 when taskId is missing', async () => {
        const { taskId: _taskId, ...noTaskId } = validTaskBody;
        const res = await request(buildApp()).post('/process-dxf').send(noTaskId);
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Task ID');
    });

    it('calls failJob and returns 500 when generateDxf throws', async () => {
        mockGenerateDxf.mockRejectedValueOnce(new Error('DXF generation failed'));
        const res = await request(buildApp()).post('/process-dxf').send(validTaskBody);
        expect(res.status).toBe(500);
        expect(res.body.status).toBe('failed');
        expect(res.body.taskId).toBe('task-123');
        expect(mockFailJob).toHaveBeenCalledWith('task-123', 'DXF generation failed');
    });

    it('returns 500 with string error when generateDxf throws non-Error', async () => {
        mockGenerateDxf.mockRejectedValueOnce('string dxf error');
        const res = await request(buildApp()).post('/process-dxf').send(validTaskBody);
        expect(res.status).toBe(500);
        expect(res.body.status).toBe('failed');
        expect(mockFailJob).toHaveBeenCalledWith('task-123', 'string dxf error');
    });

    it('returns 500 with "Task processing failed" when updateJobStatus throws (outer error)', async () => {
        mockUpdateJobStatus.mockRejectedValueOnce(new Error('Firestore unavailable'));
        const res = await request(buildApp()).post('/process-dxf').send(validTaskBody);
        expect(res.status).toBe(500);
        expect(res.body.error).toContain('Task processing failed');
        expect(res.body.details).toContain('Firestore unavailable');
    });

    it('returns 500 with string error when outer catch gets non-Error', async () => {
        mockUpdateJobStatus.mockRejectedValueOnce('string outer error');
        const res = await request(buildApp()).post('/process-dxf').send(validTaskBody);
        expect(res.status).toBe(500);
        expect(res.body.details).toBe('string outer error');
    });
});

describe('GET /jobs/:id', () => {
    beforeEach(() => jest.clearAllMocks());

    const mockJob = {
        id: 'job-1',
        status: 'completed',
        progress: 100,
        result: { url: 'http://localhost/downloads/test.dxf' },
        error: null
    };

    it('returns 200 with job data when job exists', async () => {
        mockGetJob.mockResolvedValueOnce(mockJob);
        const res = await request(buildApp()).get('/jobs/job-1');
        expect(res.status).toBe(200);
        expect(res.body.id).toBe('job-1');
        expect(res.body.status).toBe('completed');
        expect(res.body.progress).toBe(100);
    });

    it('returns 404 when job not found', async () => {
        mockGetJob.mockResolvedValueOnce(null);
        const res = await request(buildApp()).get('/jobs/unknown-job');
        expect(res.status).toBe(404);
        expect(res.body.error).toBeDefined();
    });

    it('returns 500 when getJob throws', async () => {
        mockGetJob.mockRejectedValueOnce(new Error('Firestore error'));
        const res = await request(buildApp()).get('/jobs/job-1');
        expect(res.status).toBe(500);
        expect(res.body.error).toBeDefined();
    });

    it('returns 500 with string error when getJob throws non-Error', async () => {
        mockGetJob.mockRejectedValueOnce('string get error');
        const res = await request(buildApp()).get('/jobs/job-1');
        expect(res.status).toBe(500);
        expect(res.body.details).toBe('string get error');
    });
});
