/**
 * server/tests/firebaseAuth.test.ts
 * Tests for Firebase authentication middleware and JWT verification helpers.
 */

import { Request, Response, NextFunction } from 'express';
import { getFirebaseCerts, verifyFirebaseIdToken, requireAuth } from '../middleware/firebaseAuth';
import type { AuthenticatedRequest } from '../middleware/firebaseAuth';

const PROJECT_ID = 'test-project';

// ── Helper: build a minimal fake JWT (NOT cryptographically valid) ──────────
function fakeBearerHeader(token: string) {
    return `Bearer ${token}`;
}

// ── getFirebaseCerts ─────────────────────────────────────────────────────────

describe('getFirebaseCerts', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        // Reset module-level cert cache between tests by faking a past expiry
        // (done indirectly by making fetch return different data)
    });

    it('retorna certificados quando fetch é bem-sucedido', async () => {
        const fakeCerts = { kid1: '-----BEGIN CERTIFICATE-----\nFAKE\n-----END CERTIFICATE-----' };
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            headers: { get: () => 'max-age=3600' },
            json: async () => fakeCerts
        }) as any;

        const result = await getFirebaseCerts();
        expect(result).toEqual(fakeCerts);
    });

    it('lança erro quando fetch falha (HTTP não-ok)', async () => {
        // Force cache miss by advancing time past any cached expiry
        jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 7_200_000); // +2 hours

        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: false,
            status: 503,
            headers: { get: () => null },
            json: async () => ({})
        }) as any;

        try {
            await expect(getFirebaseCerts()).rejects.toThrow('Failed to fetch Firebase certificates');
        } finally {
            jest.restoreAllMocks();
            global.fetch = originalFetch;
        }
    });
});

// ── verifyFirebaseIdToken ────────────────────────────────────────────────────

describe('verifyFirebaseIdToken', () => {
    it('rejeita token com formato inválido (não tem 3 partes)', async () => {
        await expect(verifyFirebaseIdToken('invalid', PROJECT_ID))
            .rejects.toThrow('Invalid JWT format');
    });

    it('rejeita token com header não decodificável', async () => {
        await expect(verifyFirebaseIdToken('###.###.###', PROJECT_ID))
            .rejects.toThrow('Failed to decode JWT claims');
    });

    it('rejeita token com algoritmo diferente de RS256', async () => {
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', kid: 'k1' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({
            iss: `https://securetoken.google.com/${PROJECT_ID}`,
            aud: PROJECT_ID,
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000) - 60,
            sub: 'uid123'
        })).toString('base64url');

        await expect(verifyFirebaseIdToken(`${header}.${payload}.sig`, PROJECT_ID))
            .rejects.toThrow('Unsupported algorithm: HS256');
    });

    it('rejeita token expirado', async () => {
        const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k1' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({
            iss: `https://securetoken.google.com/${PROJECT_ID}`,
            aud: PROJECT_ID,
            exp: Math.floor(Date.now() / 1000) - 1, // already expired
            iat: Math.floor(Date.now() / 1000) - 3600,
            sub: 'uid123'
        })).toString('base64url');

        await expect(verifyFirebaseIdToken(`${header}.${payload}.sig`, PROJECT_ID))
            .rejects.toThrow('Token has expired');
    });

    it('rejeita token com audience incorreta', async () => {
        const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k1' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({
            iss: `https://securetoken.google.com/${PROJECT_ID}`,
            aud: 'wrong-project',
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000) - 60,
            sub: 'uid123'
        })).toString('base64url');

        await expect(verifyFirebaseIdToken(`${header}.${payload}.sig`, PROJECT_ID))
            .rejects.toThrow('Invalid token audience');
    });

    it('rejeita token com issuer incorreto', async () => {
        const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k1' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({
            iss: 'https://accounts.google.com',
            aud: PROJECT_ID,
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000) - 60,
            sub: 'uid123'
        })).toString('base64url');

        await expect(verifyFirebaseIdToken(`${header}.${payload}.sig`, PROJECT_ID))
            .rejects.toThrow('Invalid token issuer');
    });

    it('rejeita token sem campo sub', async () => {
        const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k1' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({
            iss: `https://securetoken.google.com/${PROJECT_ID}`,
            aud: PROJECT_ID,
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000) - 60
            // sub missing
        })).toString('base64url');

        await expect(verifyFirebaseIdToken(`${header}.${payload}.sig`, PROJECT_ID))
            .rejects.toThrow('Missing or invalid token subject');
    });

    it('rejeita quando kid não encontrado nos certificados', async () => {
        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            headers: { get: () => 'max-age=1' }, // short TTL to bypass cache
            json: async () => ({ other_kid: 'cert' })
        }) as any;

        const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'missing_kid' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({
            iss: `https://securetoken.google.com/${PROJECT_ID}`,
            aud: PROJECT_ID,
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000) - 60,
            sub: 'uid123'
        })).toString('base64url');

        try {
            await expect(verifyFirebaseIdToken(`${header}.${payload}.sig`, PROJECT_ID))
                .rejects.toThrow('No matching certificate found');
        } finally {
            global.fetch = originalFetch;
        }
    });
});

// ── requireAuth middleware ───────────────────────────────────────────────────

describe('requireAuth', () => {
    let req: Partial<AuthenticatedRequest>;
    let res: Partial<Response>;
    let next: NextFunction;
    let jsonSpy: jest.Mock;
    let statusSpy: jest.Mock;

    beforeEach(() => {
        jsonSpy = jest.fn();
        statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
        next = jest.fn();
        req = { headers: {} };
        res = { status: statusSpy, json: jsonSpy } as any;
    });

    it('retorna 401 quando cabeçalho Authorization está ausente', async () => {
        await requireAuth(req as any, res as any, next);
        expect(statusSpy).toHaveBeenCalledWith(401);
        expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('No token provided') }));
        expect(next).not.toHaveBeenCalled();
    });

    it('retorna 401 quando cabeçalho não começa com Bearer', async () => {
        req.headers = { authorization: 'Basic abc123' };
        await requireAuth(req as any, res as any, next);
        expect(statusSpy).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('aceita dev-token em modo de desenvolvimento', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        req.headers = { authorization: 'Bearer dev-token' };

        await requireAuth(req as any, res as any, next);

        expect(next).toHaveBeenCalled();
        expect((req as AuthenticatedRequest).user).toEqual({ uid: 'dev-user', email: 'dev@example.com' });

        process.env.NODE_ENV = originalEnv;
    });

    it('rejeita dev-token em modo de produção', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        process.env.FIREBASE_PROJECT_ID = 'test-proj';
        req.headers = { authorization: 'Bearer dev-token' };

        // verifyFirebaseIdToken will be called and fail (dev-token isn't a real JWT)
        await requireAuth(req as any, res as any, next);

        expect(statusSpy).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();

        process.env.NODE_ENV = originalEnv;
        delete process.env.FIREBASE_PROJECT_ID;
    });

    it('retorna 500 quando FIREBASE_PROJECT_ID não está configurado em produção', async () => {
        const originalEnv = process.env.NODE_ENV;
        const originalProjectId = process.env.FIREBASE_PROJECT_ID;
        process.env.NODE_ENV = 'production';
        delete process.env.FIREBASE_PROJECT_ID;
        delete process.env.VITE_FIREBASE_PROJECT_ID;

        req.headers = { authorization: 'Bearer some-real-looking-token' };

        await requireAuth(req as any, res as any, next);

        expect(statusSpy).toHaveBeenCalledWith(500);
        expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('configuration error') }));
        expect(next).not.toHaveBeenCalled();

        process.env.NODE_ENV = originalEnv;
        if (originalProjectId !== undefined) process.env.FIREBASE_PROJECT_ID = originalProjectId;
    });

    it('aceita DEV_AUTH_TOKEN personalizado em desenvolvimento', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        process.env.DEV_AUTH_TOKEN = 'my-custom-dev-token';
        req.headers = { authorization: 'Bearer my-custom-dev-token' };

        await requireAuth(req as any, res as any, next);

        expect(next).toHaveBeenCalled();
        expect((req as AuthenticatedRequest).user).toEqual({ uid: 'dev-user', email: 'dev@example.com' });

        process.env.NODE_ENV = originalEnv;
        delete process.env.DEV_AUTH_TOKEN;
    });
});
