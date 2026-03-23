const mockCreateCacheKey = jest.fn(() => 'cache-key-123');
const mockGetCachedFilename = jest.fn();
const mockDeleteCachedFilename = jest.fn();
const mockCreateDxfTask = jest.fn();
const mockCreateJob = jest.fn();
const mockExistsSync = jest.fn();

jest.mock('../services/cacheServiceFirestore', () => ({
    createCacheKey: mockCreateCacheKey,
    getCachedFilename: mockGetCachedFilename,
    deleteCachedFilename: mockDeleteCachedFilename
}));
jest.mock('../services/cloudTasksService', () => ({
    createDxfTask: mockCreateDxfTask
}));
jest.mock('../services/jobStatusServiceFirestore', () => ({
    createJob: mockCreateJob
}));
jest.mock('fs', () => ({
    default: { existsSync: mockExistsSync },
    existsSync: mockExistsSync
}));
jest.mock('path', () => {
    const actual = jest.requireActual<typeof import('path')>('path');
    return { ...actual, default: actual };
});

import { GenerateDxfUseCase } from '../application/GenerateDxfUseCase';
import { DxfGenerationRequest } from '../interfaces/schemas/dxfSchema';
import type { Request } from 'express';

const mockReq = { ip: '127.0.0.1' } as Request;
const getBaseUrl = () => 'http://localhost:3000';
const dxfDirectory = '/tmp/dxf';

const baseData: DxfGenerationRequest = {
    radius: 500,
    mode: 'circle',
    lat: -23.5,
    lon: -46.6,
    projection: 'local'
};

describe('GenerateDxfUseCase', () => {
    let useCase: GenerateDxfUseCase;

    beforeEach(() => {
        jest.clearAllMocks();
        mockCreateCacheKey.mockReturnValue('cache-key-123');
        mockGetCachedFilename.mockResolvedValue(null);
        mockDeleteCachedFilename.mockResolvedValue(undefined);
        mockCreateDxfTask.mockResolvedValue({ taskId: 'task-abc', alreadyCompleted: false });
        mockCreateJob.mockResolvedValue(undefined);
        mockExistsSync.mockReturnValue(false);
        useCase = new GenerateDxfUseCase(dxfDirectory, getBaseUrl);
    });

    describe('cache hit', () => {
        it('returns 200 with url when cached file exists', async () => {
            mockGetCachedFilename.mockResolvedValueOnce('cached.dxf');
            mockExistsSync.mockReturnValueOnce(true);
            const result = await useCase.execute(baseData, mockReq);
            expect(result.status).toBe(200);
            expect((result.data as Record<string, unknown>).url).toContain('cached.dxf');
            expect((result.data as Record<string, unknown>).status).toBe('success');
        });

        it('deletes stale cache and queues new task when file missing', async () => {
            mockGetCachedFilename.mockResolvedValueOnce('stale.dxf');
            mockExistsSync.mockReturnValueOnce(false);
            const result = await useCase.execute(baseData, mockReq);
            expect(mockDeleteCachedFilename).toHaveBeenCalledWith('cache-key-123');
            expect(mockCreateDxfTask).toHaveBeenCalled();
            expect(result.status).toBe(202);
        });
    });

    describe('no cache', () => {
        it('calls createDxfTask, createJob and returns 202 with jobId', async () => {
            mockGetCachedFilename.mockResolvedValueOnce(null);
            const result = await useCase.execute(baseData, mockReq);
            expect(mockCreateDxfTask).toHaveBeenCalled();
            expect(mockCreateJob).toHaveBeenCalledWith('task-abc');
            expect(result.status).toBe(202);
            expect((result.data as Record<string, unknown>).jobId).toBe('task-abc');
            expect((result.data as Record<string, unknown>).status).toBe('queued');
        });
    });

    describe('UTM coordinate', () => {
        it('uses utm northing/easting in cacheKey', async () => {
            const utmData: DxfGenerationRequest = {
                radius: 500,
                mode: 'utm',
                utm: { zone: '23K', easting: 714316, northing: 7549084 },
                projection: 'utm'
            };
            await useCase.execute(utmData, mockReq);
            const cacheKeyArgs = mockCreateCacheKey.mock.calls[0][0];
            expect(cacheKeyArgs.lat).toBe(7549084); // northing
            expect(cacheKeyArgs.lon).toBe(714316);  // easting
        });

        it('includes utm fields in task payload', async () => {
            const utmData: DxfGenerationRequest = {
                radius: 500,
                mode: 'utm',
                utm: { zone: '23K', easting: 714316, northing: 7549084 },
                projection: 'utm'
            };
            await useCase.execute(utmData, mockReq);
            const taskPayload = mockCreateDxfTask.mock.calls[0][0];
            expect(taskPayload.utm_zone).toBe('23K');
            expect(taskPayload.utm_easting).toBe(714316);
            expect(taskPayload.utm_northing).toBe(7549084);
        });
    });

    describe('alreadyCompleted', () => {
        it('returns 200 with url and does NOT call createJob when alreadyCompleted=true', async () => {
            mockCreateDxfTask.mockResolvedValueOnce({ taskId: 't1', alreadyCompleted: true });
            const result = await useCase.execute(baseData, mockReq);
            expect(mockCreateJob).not.toHaveBeenCalled();
            expect(result.status).toBe(200);
            expect((result.data as Record<string, unknown>).url).toBeDefined();
            expect((result.data as Record<string, unknown>).status).toBe('success');
        });

        it('calls createJob and returns 202 when alreadyCompleted=false', async () => {
            mockCreateDxfTask.mockResolvedValueOnce({ taskId: 't2', alreadyCompleted: false });
            const result = await useCase.execute(baseData, mockReq);
            expect(mockCreateJob).toHaveBeenCalledWith('t2');
            expect(result.status).toBe(202);
        });
    });

    describe('polygon handling', () => {
        it('passes polygon string as-is in task payload', async () => {
            const data: DxfGenerationRequest = { ...baseData, mode: 'polygon', polygon: '[[0,0],[1,0],[1,1],[0,0]]' };
            await useCase.execute(data, mockReq);
            const taskPayload = mockCreateDxfTask.mock.calls[0][0];
            expect(taskPayload.polygon).toBe('[[0,0],[1,0],[1,1],[0,0]]');
        });

        it('JSON.stringifies polygon array in task payload', async () => {
            const polygonArray = [[0, 0], [1, 0], [1, 1], [0, 0]];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data: DxfGenerationRequest = { ...baseData, mode: 'polygon', polygon: polygonArray as any };
            await useCase.execute(data, mockReq);
            const taskPayload = mockCreateDxfTask.mock.calls[0][0];
            expect(taskPayload.polygon).toBe(JSON.stringify(polygonArray));
        });

        it('uses empty array when no polygon provided', async () => {
            const data: DxfGenerationRequest = { ...baseData };
            delete (data as Partial<DxfGenerationRequest>).polygon;
            await useCase.execute(data, mockReq);
            const taskPayload = mockCreateDxfTask.mock.calls[0][0];
            expect(taskPayload.polygon).toBe('[]');
        });

        it('uses empty layers object when layers not provided', async () => {
            const data: DxfGenerationRequest = { ...baseData };
            delete (data as Partial<DxfGenerationRequest>).layers;
            await useCase.execute(data, mockReq);
            const cacheKeyArgs = mockCreateCacheKey.mock.calls[0][0];
            expect(cacheKeyArgs.layers).toEqual({});
            const taskPayload = mockCreateDxfTask.mock.calls[0][0];
            expect(taskPayload.layers).toEqual({});
        });
    });
});
