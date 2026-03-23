import { EventEmitter } from 'events';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    readdirSync: jest.fn(() => [])
}));

import express from 'express';
import request from 'supertest';
import { spawn } from 'child_process';
import fs from 'fs';
import systemRouter from '../interfaces/routes/systemRoutes';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockSpawnProcess(exitCode: number): any {
    const proc = new EventEmitter();
    setTimeout(() => proc.emit('close', exitCode), 0);
    return proc;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockSpawnErrorProcess(): any {
    const proc = new EventEmitter();
    setTimeout(() => proc.emit('error', new Error('spawn ENOENT')), 0);
    return proc;
}

const buildApp = () => {
    const app = express();
    app.use('/', systemRouter);
    return app;
};

describe('GET /', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = { ...process.env };
        delete process.env.PYTHON_COMMAND;
        delete process.env.OSM_CACHE_DIR;
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('returns 200 with status "online" when python is available', async () => {
        (spawn as jest.Mock).mockImplementationOnce(() => createMockSpawnProcess(0));
        (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
        const res = await request(buildApp()).get('/');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('online');
        expect(res.body.python).toBe('available');
    });

    it('returns 503 with status "degraded" when python is unavailable (exit code 1)', async () => {
        (spawn as jest.Mock).mockImplementationOnce(() => createMockSpawnProcess(1));
        (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
        const res = await request(buildApp()).get('/');
        expect(res.status).toBe(503);
        expect(res.body.status).toBe('degraded');
        expect(res.body.python).toBe('unavailable');
    });

    it('returns 503 with status "degraded" on spawn error event', async () => {
        (spawn as jest.Mock).mockImplementationOnce(() => createMockSpawnErrorProcess());
        (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
        const res = await request(buildApp()).get('/');
        expect(res.status).toBe(503);
        expect(res.body.status).toBe('degraded');
    });

    it('returns 200 with status "degraded" on invalid PYTHON_COMMAND (no spawn)', async () => {
        process.env.PYTHON_COMMAND = 'invalid_command';
        const res = await request(buildApp()).get('/');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('degraded');
        expect(spawn).not.toHaveBeenCalled();
    });

    it('reports osmCache.entries > 0 when OSM cache dir exists with .pkl files', async () => {
        process.env.OSM_CACHE_DIR = '/tmp/osm_cache';
        (spawn as jest.Mock).mockImplementationOnce(() => createMockSpawnProcess(0));
        (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
        (fs.readdirSync as jest.Mock).mockReturnValueOnce(['osm_a.pkl', 'osm_b.pkl', 'other.txt']);
        const res = await request(buildApp()).get('/');
        expect(res.body.osmCache.available).toBe(true);
        expect(res.body.osmCache.entries).toBe(2);
    });

    it('reports osmCache.entries = 0 when OSM cache dir does not exist', async () => {
        process.env.OSM_CACHE_DIR = '/tmp/nonexistent_cache';
        (spawn as jest.Mock).mockImplementationOnce(() => createMockSpawnProcess(0));
        (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
        const res = await request(buildApp()).get('/');
        expect(res.body.osmCache.available).toBe(true);
        expect(res.body.osmCache.entries).toBe(0);
    });

    it('reports osmCache.available = false when fs.readdirSync throws', async () => {
        process.env.OSM_CACHE_DIR = '/tmp/osm_cache_error';
        (spawn as jest.Mock).mockImplementationOnce(() => createMockSpawnProcess(0));
        (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
        (fs.readdirSync as jest.Mock).mockImplementationOnce(() => { throw new Error('permission denied'); });
        const res = await request(buildApp()).get('/');
        expect(res.body.osmCache.available).toBe(false);
    });

    it('returns 200 degraded when health check throws internally', async () => {
        // Make spawn throw synchronously to trigger outer catch
        (spawn as jest.Mock).mockImplementationOnce(() => { throw new Error('spawn crashed'); });
        const res = await request(buildApp()).get('/');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('degraded');
        expect(res.body.error).toBeDefined();
    });

    it('returns expected top-level fields in health check response', async () => {
        (spawn as jest.Mock).mockImplementationOnce(() => createMockSpawnProcess(0));
        (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
        const res = await request(buildApp()).get('/');
        expect(res.body.service).toBe('sisTOPOGRAFIA Backend');
        expect(res.body.version).toBe('1.0.0');
        expect(res.body.groqApiKey).toBeDefined();
        expect(res.body.firestoreEnabled).toBeDefined();
    });

    it('uses "development" fallback when NODE_ENV is unset', async () => {
        delete process.env.NODE_ENV;
        (spawn as jest.Mock).mockImplementationOnce(() => createMockSpawnProcess(0));
        (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
        const res = await request(buildApp()).get('/');
        expect(res.body.environment).toBe('development');
    });

    it('sets dockerized=true when DOCKER_ENV=true', async () => {
        process.env.DOCKER_ENV = 'true';
        (spawn as jest.Mock).mockImplementationOnce(() => createMockSpawnProcess(0));
        (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
        const res = await request(buildApp()).get('/');
        expect(res.body.dockerized).toBe(true);
        delete process.env.DOCKER_ENV;
    });

    it('filters out non-.pkl files that start with osm_ in OSM cache dir', async () => {
        process.env.OSM_CACHE_DIR = '/tmp/osm_cache2';
        (spawn as jest.Mock).mockImplementationOnce(() => createMockSpawnProcess(0));
        (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
        // 'osm_cache.json' starts with osm_ but doesn't end with .pkl → should be excluded
        (fs.readdirSync as jest.Mock).mockReturnValueOnce(['osm_a.pkl', 'osm_cache.json']);
        const res = await request(buildApp()).get('/');
        expect(res.body.osmCache.entries).toBe(1);
    });
});

describe('GET /firestore/status', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns enabled:true when USE_FIRESTORE=true', async () => {
        process.env.USE_FIRESTORE = 'true';
        const res = await request(buildApp()).get('/firestore/status');
        expect(res.status).toBe(200);
        expect(res.body.enabled).toBe(true);
        delete process.env.USE_FIRESTORE;
    });

    it('returns enabled:false when USE_FIRESTORE is not set', async () => {
        delete process.env.USE_FIRESTORE;
        const res = await request(buildApp()).get('/firestore/status');
        expect(res.status).toBe(200);
        expect(res.body.enabled).toBe(false);
    });
});
