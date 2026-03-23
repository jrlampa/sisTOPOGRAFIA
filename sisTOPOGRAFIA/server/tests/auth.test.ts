const mockVerifyIdToken = jest.fn();

jest.mock('google-auth-library', () => ({
    OAuth2Client: jest.fn().mockImplementation(() => ({
        verifyIdToken: mockVerifyIdToken
    }))
}));

import express, { Request, Response } from 'express';
import request from 'supertest';
import { verifyCloudTasksToken, webhookRateLimiter } from '../middleware/auth';

const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.post('/test', verifyCloudTasksToken, (_req: Request, res: Response) => res.json({ ok: true }));
    return app;
};

describe('verifyCloudTasksToken', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = { ...process.env };
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('calls next immediately in development mode (NODE_ENV != production)', async () => {
        process.env.NODE_ENV = 'development';
        const res = await request(buildApp()).post('/test').send({});
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
        expect(mockVerifyIdToken).not.toHaveBeenCalled();
    });

    it('returns 401 in production when Authorization header is missing', async () => {
        process.env.NODE_ENV = 'production';
        const res = await request(buildApp()).post('/test').send({});
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Unauthorized');
    });

    it('returns 401 in production when Authorization header does not start with Bearer', async () => {
        process.env.NODE_ENV = 'production';
        const res = await request(buildApp()).post('/test')
            .set('Authorization', 'Basic some-token')
            .send({});
        expect(res.status).toBe(401);
    });

    it('returns 200 in production with valid token matching service account', async () => {
        process.env.NODE_ENV = 'production';
        process.env.GCP_SERVICE_ACCOUNT = 'sa@project.iam.gserviceaccount.com';
        process.env.CLOUD_RUN_SERVICE_URL = 'https://example.com';
        mockVerifyIdToken.mockResolvedValueOnce({
            getPayload: () => ({ email: 'sa@project.iam.gserviceaccount.com', iss: 'https://accounts.google.com' })
        });
        const res = await request(buildApp()).post('/test')
            .set('Authorization', 'Bearer valid-token')
            .send({});
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
    });

    it('returns 403 in production with valid token but wrong service account', async () => {
        process.env.NODE_ENV = 'production';
        process.env.GCP_SERVICE_ACCOUNT = 'expected@project.iam.gserviceaccount.com';
        mockVerifyIdToken.mockResolvedValueOnce({
            getPayload: () => ({ email: 'wrong@project.iam.gserviceaccount.com', iss: 'https://accounts.google.com' })
        });
        const res = await request(buildApp()).post('/test')
            .set('Authorization', 'Bearer valid-token')
            .send({});
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
    });

    it('returns 200 in production when no GCP_SERVICE_ACCOUNT is set (skips account check)', async () => {
        process.env.NODE_ENV = 'production';
        delete process.env.GCP_SERVICE_ACCOUNT;
        mockVerifyIdToken.mockResolvedValueOnce({
            getPayload: () => ({ email: 'any@project.iam.gserviceaccount.com', iss: 'https://accounts.google.com' })
        });
        const res = await request(buildApp()).post('/test')
            .set('Authorization', 'Bearer valid-token')
            .send({});
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
    });

    it('returns 401 in production when token payload is null', async () => {
        process.env.NODE_ENV = 'production';
        mockVerifyIdToken.mockResolvedValueOnce({ getPayload: () => null });
        const res = await request(buildApp()).post('/test')
            .set('Authorization', 'Bearer bad-token')
            .send({});
        expect(res.status).toBe(401);
    });

    it('returns 401 in production when verifyIdToken throws non-Error', async () => {
        process.env.NODE_ENV = 'production';
        mockVerifyIdToken.mockRejectedValueOnce('non-error string');
        const res = await request(buildApp()).post('/test')
            .set('Authorization', 'Bearer token')
            .send({});
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Unauthorized');
    });

    it('returns 401 in production when verifyIdToken throws an Error', async () => {
        process.env.NODE_ENV = 'production';
        mockVerifyIdToken.mockRejectedValueOnce(new Error('Token expired'));
        const res = await request(buildApp()).post('/test')
            .set('Authorization', 'Bearer expired-token')
            .send({});
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Unauthorized');
    });
});

describe('webhookRateLimiter', () => {
    beforeEach(() => jest.clearAllMocks());

    it('is a function (middleware)', () => {
        expect(typeof webhookRateLimiter).toBe('function');
    });

    it('does not block requests in development mode', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        const app = express();
        app.use(webhookRateLimiter);
        app.get('/test', (_req, res) => res.json({ ok: true }));
        const res = await request(app).get('/test');
        expect(res.status).toBe(200);
        process.env.NODE_ENV = originalEnv;
    });
});
