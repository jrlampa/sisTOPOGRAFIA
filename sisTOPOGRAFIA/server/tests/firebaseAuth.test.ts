/**
 * server/tests/firebaseAuth.test.ts
 * Tests for Firebase authentication middleware and JWT verification helpers.
 */

import { generateKeyPairSync, createSign } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { getFirebaseCerts, verifyFirebaseIdToken, requireAuth, checkQuota } from '../middleware/firebaseAuth';
import type { AuthenticatedRequest } from '../middleware/firebaseAuth';

const PROJECT_ID = 'test-project';

// ── Helper: build a minimal fake JWT (NOT cryptographically valid) ──────────
function fakeBearerHeader(token: string) {
    return `Bearer ${token}`;
}

// ── Helper: build RSA-signed JWT for given key pair and project ─────────────
function buildSignedJwt(
    privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'],
    claims: Record<string, unknown>,
    kid = 'k1'
): string {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${payload}`);
    const sig = signer.sign(privateKey, 'base64url');
    return `${header}.${payload}.${sig}`;
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
        // Simulate the clock advancing 2 hours past the cached certificate TTL so
        // getFirebaseCerts() skips the cache and makes a real fetch call.
        // mockReturnValue returns the same fixed future timestamp on every Date.now() call,
        // which is sufficient because the cache-expiry check only calls Date.now() once.
        jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 7_200_000); // simulate +2 hours

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

    it('lança erro quando Firebase retorna conjunto de certificados vazio', async () => {
        jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 14_400_000); // simulate +4 hours

        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            headers: { get: () => 'max-age=3600' },
            json: async () => ({}) // empty cert set
        }) as any;

        try {
            await expect(getFirebaseCerts()).rejects.toThrow('Firebase returned an empty or invalid certificate set');
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
        const originalDevToken = process.env.DEV_AUTH_TOKEN;
        process.env.NODE_ENV = 'development';
        process.env.DEV_AUTH_TOKEN = 'dev-token';
        req.headers = { authorization: 'Bearer dev-token' };

        await requireAuth(req as any, res as any, next);

        expect(next).toHaveBeenCalled();
        expect((req as AuthenticatedRequest).user).toEqual({ uid: 'dev-user', email: 'dev@example.com' });

        process.env.NODE_ENV = originalEnv;
        process.env.DEV_AUTH_TOKEN = originalDevToken;
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

    it('autentica com sucesso usando JWT RSA-signed válido', async () => {
        const originalEnv = process.env.NODE_ENV;
        const originalProjectId = process.env.FIREBASE_PROJECT_ID;
        const originalFetch = global.fetch;

        process.env.NODE_ENV = 'production';
        process.env.FIREBASE_PROJECT_ID = PROJECT_ID;

        // Generate a dedicated key pair for this test
        const { publicKey: pk, privateKey: sk } = generateKeyPairSync('rsa', { modulusLength: 2048 });
        const pkPem = pk.export({ type: 'spki', format: 'pem' }) as string;
        const kid = 'k-req-auth-ok';

        // Advance Date.now() 2h to bust any cached certs from earlier tests (max TTL = 3600s)
        const futureNow = Date.now() + 7_200_000;
        jest.spyOn(Date, 'now').mockReturnValue(futureNow);

        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            headers: { get: () => 'max-age=0' }, // TTL=0 → never persists in cache
            json: async () => ({ [kid]: pkPem })
        }) as any;

        const nowSec = Math.floor(Date.now() / 1000); // uses mocked future time
        const jwt = buildSignedJwt(sk, {
            iss: `https://securetoken.google.com/${PROJECT_ID}`,
            aud: PROJECT_ID,
            exp: nowSec + 3600,
            iat: nowSec - 60,
            sub: 'real-user-uid',
            email: 'real@test.com'
        }, kid);

        req.headers = { authorization: `Bearer ${jwt}` };

        try {
            await requireAuth(req as any, res as any, next);

            expect(next).toHaveBeenCalled();
            expect((req as AuthenticatedRequest).user).toEqual({ uid: 'real-user-uid', email: 'real@test.com' });
            expect(statusSpy).not.toHaveBeenCalled();
        } finally {
            jest.restoreAllMocks();
            global.fetch = originalFetch;
            process.env.NODE_ENV = originalEnv;
            if (originalProjectId !== undefined) process.env.FIREBASE_PROJECT_ID = originalProjectId;
            else delete process.env.FIREBASE_PROJECT_ID;
        }
    });
});

// ── verifyFirebaseIdToken — edge cases ───────────────────────────────────────

describe('verifyFirebaseIdToken — edge cases', () => {
    // Generate RSA key pair once per describe block for speed
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const { privateKey: wrongKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    // Use SPKI (SubjectPublicKeyInfo) format — accepted by Node.js createVerify
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

    // Helper: mock fetch AND advance Date.now() well past the 1-hour cert-cache TTL set
    // by earlier tests, so getFirebaseCerts() always makes a fresh network call.
    // max-age=0 ensures THIS entry is immediately expired and never leaks into other tests.
    function setupCertMock(kid: string): () => void {
        const originalFetch = global.fetch;
        // Advance 2 hours past any 1-hour cert-cache TTL from earlier tests
        const futureNow = Date.now() + 7_200_000;
        jest.spyOn(Date, 'now').mockReturnValue(futureNow);
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            headers: { get: () => 'max-age=0' }, // TTL=0 → this entry never persists in cache
            json: async () => ({ [kid]: publicKeyPem })
        }) as any;
        return () => {
            jest.restoreAllMocks();
            global.fetch = originalFetch;
        };
    }

    it('rejeita token com iat no futuro (clock-skew > 5 min)', async () => {
        const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k1' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({
            iss: `https://securetoken.google.com/${PROJECT_ID}`,
            aud: PROJECT_ID,
            exp: Math.floor(Date.now() / 1000) + 7200,
            iat: Math.floor(Date.now() / 1000) + 400, // > 300 seconds in future
            sub: 'uid123'
        })).toString('base64url');

        await expect(verifyFirebaseIdToken(`${header}.${payload}.sig`, PROJECT_ID))
            .rejects.toThrow('Token issued in the future');
    });

    it('rejeita token com assinatura inválida', async () => {
        const kid = 'k-test-inv';
        const restore = setupCertMock(kid);
        // Token exp/iat must be relative to the mocked future time
        const nowSec = Math.floor(Date.now() / 1000); // returns mocked future time
        const jwt = buildSignedJwt(wrongKey, { // signed with WRONG key
            iss: `https://securetoken.google.com/${PROJECT_ID}`,
            aud: PROJECT_ID,
            exp: nowSec + 3600,
            iat: nowSec - 60,
            sub: 'uid-xyz',
            email: 'x@test.com'
        }, kid);

        try {
            await expect(verifyFirebaseIdToken(jwt, PROJECT_ID))
                .rejects.toThrow('Invalid token signature');
        } finally {
            restore();
        }
    });

    it('retorna uid e email quando assinatura é válida', async () => {
        const kid = 'k-test-val';
        const restore = setupCertMock(kid);
        // Token exp/iat must be relative to the mocked future time
        const nowSec = Math.floor(Date.now() / 1000); // returns mocked future time
        const jwt = buildSignedJwt(privateKey, { // signed with MATCHING key
            iss: `https://securetoken.google.com/${PROJECT_ID}`,
            aud: PROJECT_ID,
            exp: nowSec + 3600,
            iat: nowSec - 60,
            sub: 'user-uid-42',
            email: 'user@test.com'
        }, kid);

        try {
            const result = await verifyFirebaseIdToken(jwt, PROJECT_ID);
            expect(result).toEqual({ uid: 'user-uid-42', email: 'user@test.com' });
        } finally {
            restore();
        }
    });
});

// ── checkQuota middleware ────────────────────────────────────────────────────

describe('checkQuota', () => {
    let req: Partial<AuthenticatedRequest>;
    let res: Partial<Response>;
    let next: jest.Mock;
    let jsonSpy: jest.Mock;
    let statusSpy: jest.Mock;

    const originalNodeEnv = process.env.NODE_ENV;
    const originalUseFirestore = process.env.USE_FIRESTORE;

    beforeEach(() => {
        jsonSpy = jest.fn();
        statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
        next = jest.fn();
        req = {
            user: { uid: 'user-123', email: 'user@example.com' }
        };
        res = { status: statusSpy, json: jsonSpy } as any;
        process.env.NODE_ENV = 'test';
        process.env.USE_FIRESTORE = 'false';
    });

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
        process.env.USE_FIRESTORE = originalUseFirestore;
        delete process.env.MAX_DAILY_DXF_REQUESTS;
        jest.clearAllMocks();
    });

    it('retorna 401 quando req.user está ausente', async () => {
        req.user = undefined;

        await checkQuota(req as any, res as any, next);

        expect(statusSpy).toHaveBeenCalledWith(401);
        expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('User not found') }));
        expect(next).not.toHaveBeenCalled();
    });

    it('chama next() diretamente em modo desenvolvimento (sem Firestore)', async () => {
        process.env.NODE_ENV = 'development';
        process.env.USE_FIRESTORE = 'false';

        await checkQuota(req as any, res as any, next);

        expect(next).toHaveBeenCalled();
        expect(statusSpy).not.toHaveBeenCalled();
    });

    it('chama next() em modo test (sem Firestore)', async () => {
        process.env.NODE_ENV = 'test';
        process.env.USE_FIRESTORE = 'false';

        await checkQuota(req as any, res as any, next);

        expect(next).toHaveBeenCalled();
        expect(statusSpy).not.toHaveBeenCalled();
    });

    it('permite requisição quando cota não excedida (Firestore mockado)', async () => {
        process.env.USE_FIRESTORE = 'true';
        process.env.MAX_DAILY_DXF_REQUESTS = '5';

        // Mock FirestoreInfrastructure at module level
        const mockTransaction = {
            get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ count: 3 }) }),
            set: jest.fn()
        };
        const mockDb = {
            collection: jest.fn().mockReturnValue({
                doc: jest.fn().mockReturnValue({})
            }),
            runTransaction: jest.fn().mockImplementation(async (fn: any) => {
                await fn(mockTransaction);
            })
        };
        const mockFirestoreInstance = { getDb: jest.fn().mockReturnValue(mockDb) };

        // Temporarily replace getInstance
        const firestoreModule = await import('../infrastructure/firestoreService');
        const originalGetInstance = firestoreModule.FirestoreInfrastructure.getInstance;
        (firestoreModule.FirestoreInfrastructure as any).getInstance = jest.fn().mockReturnValue(mockFirestoreInstance);

        try {
            await checkQuota(req as any, res as any, next);

            expect(next).toHaveBeenCalled();
            expect(statusSpy).not.toHaveBeenCalled();
        } finally {
            (firestoreModule.FirestoreInfrastructure as any).getInstance = originalGetInstance;
        }
    });

    it('retorna 429 quando cota diária excedida (Firestore mockado)', async () => {
        process.env.USE_FIRESTORE = 'true';
        process.env.MAX_DAILY_DXF_REQUESTS = '3';

        const mockTransaction = {
            get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ count: 3 }) }), // already at limit
            set: jest.fn()
        };
        const mockDb = {
            collection: jest.fn().mockReturnValue({
                doc: jest.fn().mockReturnValue({})
            }),
            runTransaction: jest.fn().mockImplementation(async (fn: any) => {
                await fn(mockTransaction);
            })
        };
        const mockFirestoreInstance = { getDb: jest.fn().mockReturnValue(mockDb) };

        const firestoreModule = await import('../infrastructure/firestoreService');
        const originalGetInstance = firestoreModule.FirestoreInfrastructure.getInstance;
        (firestoreModule.FirestoreInfrastructure as any).getInstance = jest.fn().mockReturnValue(mockFirestoreInstance);

        try {
            await checkQuota(req as any, res as any, next);

            expect(next).not.toHaveBeenCalled();
            expect(statusSpy).toHaveBeenCalledWith(429);
            expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
                error: expect.stringContaining('Limite diário'),
                retryAfter: 'tomorrow'
            }));
        } finally {
            (firestoreModule.FirestoreInfrastructure as any).getInstance = originalGetInstance;
        }
    });

    it('permite primeiro uso do dia (snapshot.exists=false)', async () => {
        process.env.USE_FIRESTORE = 'true';
        process.env.MAX_DAILY_DXF_REQUESTS = '10';

        const mockTransaction = {
            get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
            set: jest.fn()
        };
        const mockDb = {
            collection: jest.fn().mockReturnValue({
                doc: jest.fn().mockReturnValue({})
            }),
            runTransaction: jest.fn().mockImplementation(async (fn: any) => {
                await fn(mockTransaction);
            })
        };
        const mockFirestoreInstance = { getDb: jest.fn().mockReturnValue(mockDb) };

        const firestoreModule = await import('../infrastructure/firestoreService');
        const originalGetInstance = firestoreModule.FirestoreInfrastructure.getInstance;
        (firestoreModule.FirestoreInfrastructure as any).getInstance = jest.fn().mockReturnValue(mockFirestoreInstance);

        try {
            await checkQuota(req as any, res as any, next);

            expect(next).toHaveBeenCalled();
            expect(mockTransaction.set).toHaveBeenCalled();
        } finally {
            (firestoreModule.FirestoreInfrastructure as any).getInstance = originalGetInstance;
        }
    });

    it('fail-open: chama next() quando Firestore lança exceção', async () => {
        process.env.USE_FIRESTORE = 'true';

        const mockDb = {
            collection: jest.fn().mockReturnValue({
                doc: jest.fn().mockReturnValue({})
            }),
            runTransaction: jest.fn().mockRejectedValue(new Error('Firestore unavailable'))
        };
        const mockFirestoreInstance = { getDb: jest.fn().mockReturnValue(mockDb) };

        const firestoreModule = await import('../infrastructure/firestoreService');
        const originalGetInstance = firestoreModule.FirestoreInfrastructure.getInstance;
        (firestoreModule.FirestoreInfrastructure as any).getInstance = jest.fn().mockReturnValue(mockFirestoreInstance);

        try {
            await checkQuota(req as any, res as any, next);

            // Fail-open: next() must be called despite Firestore error
            expect(next).toHaveBeenCalled();
            expect(statusSpy).not.toHaveBeenCalled();
        } finally {
            (firestoreModule.FirestoreInfrastructure as any).getInstance = originalGetInstance;
        }
    });

    it('fail-closed em produção: retorna 503 quando Firestore lança exceção', async () => {
        process.env.NODE_ENV = 'production';
        process.env.USE_FIRESTORE = 'true';

        const mockDb = {
            collection: jest.fn().mockReturnValue({
                doc: jest.fn().mockReturnValue({})
            }),
            runTransaction: jest.fn().mockRejectedValue(new Error('Firestore unavailable'))
        };
        const mockFirestoreInstance = { getDb: jest.fn().mockReturnValue(mockDb) };

        const firestoreModule = await import('../infrastructure/firestoreService');
        const originalGetInstance = firestoreModule.FirestoreInfrastructure.getInstance;
        (firestoreModule.FirestoreInfrastructure as any).getInstance = jest.fn().mockReturnValue(mockFirestoreInstance);

        try {
            await checkQuota(req as any, res as any, next);

            // Fail-closed: must NOT call next() and must return 503
            expect(next).not.toHaveBeenCalled();
            expect(statusSpy).toHaveBeenCalledWith(503);
            expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
        } finally {
            (firestoreModule.FirestoreInfrastructure as any).getInstance = originalGetInstance;
        }
    });

    it('fail-open não-produção: chama next() quando Firestore lança valor não-Error', async () => {
        process.env.NODE_ENV = 'test';
        process.env.USE_FIRESTORE = 'true';

        const mockDb = {
            collection: jest.fn().mockReturnValue({
                doc: jest.fn().mockReturnValue({})
            }),
            // Throw a non-Error string to exercise the String(error) branch of the ternary
            runTransaction: jest.fn().mockRejectedValue('plain string error')
        };
        const mockFirestoreInstance = { getDb: jest.fn().mockReturnValue(mockDb) };

        const firestoreModule = await import('../infrastructure/firestoreService');
        const originalGetInstance = firestoreModule.FirestoreInfrastructure.getInstance;
        (firestoreModule.FirestoreInfrastructure as any).getInstance = jest.fn().mockReturnValue(mockFirestoreInstance);

        try {
            await checkQuota(req as any, res as any, next);
            // Fail-open in non-production: next() is still called
            expect(next).toHaveBeenCalled();
        } finally {
            (firestoreModule.FirestoreInfrastructure as any).getInstance = originalGetInstance;
        }
    });
});
