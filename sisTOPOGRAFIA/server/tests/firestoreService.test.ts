/**
 * server/tests/firestoreService.test.ts
 * Unit tests for FirestoreInfrastructure (infrastructure layer).
 * All Firestore SDK calls are mocked to keep tests zero-cost.
 */

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

// Build mock Firestore doc/collection chain before module import
const mockSet = jest.fn().mockResolvedValue(undefined);
const mockGet = jest.fn();
const mockDelete = jest.fn().mockResolvedValue(undefined);
const mockDoc = jest.fn(() => ({ set: mockSet, get: mockGet, delete: mockDelete }));
const mockCollection = jest.fn(() => ({ doc: mockDoc }));
const mockFirestoreConstructor = jest.fn(() => ({
    collection: mockCollection,
}));
const mockTimestampNow = jest.fn(() => ({ toMillis: () => Date.now() }));
const mockFieldValueIncrement = jest.fn((n: number) => ({ _increment: n }));

jest.mock('@google-cloud/firestore', () => ({
    Firestore: mockFirestoreConstructor,
    Timestamp: { now: mockTimestampNow },
    FieldValue: { increment: mockFieldValueIncrement },
}));

// Import AFTER mocking
import { FirestoreInfrastructure } from '../infrastructure/firestoreService';
import { logger } from '../utils/logger';

const mockLogger = logger as jest.Mocked<typeof logger>;

// Reset singleton between tests
beforeEach(() => {
    jest.clearAllMocks();
    // Reset the private static instance via type cast
    (FirestoreInfrastructure as any).instance = null;
});

describe('FirestoreInfrastructure', () => {
    describe('getInstance', () => {
        it('cria instância na primeira chamada', () => {
            const instance = FirestoreInfrastructure.getInstance();
            expect(instance).toBeInstanceOf(FirestoreInfrastructure);
            expect(mockFirestoreConstructor).toHaveBeenCalledTimes(1);
        });

        it('retorna a mesma instância em chamadas subsequentes (singleton)', () => {
            const a = FirestoreInfrastructure.getInstance();
            const b = FirestoreInfrastructure.getInstance();
            expect(a).toBe(b);
            expect(mockFirestoreConstructor).toHaveBeenCalledTimes(1);
        });

        it('loga inicialização com o project ID', () => {
            process.env.GCP_PROJECT = 'test-project';
            FirestoreInfrastructure.getInstance();
            expect(mockLogger.info).toHaveBeenCalledWith('Firestore Infrastructure initialized', { project: 'test-project' });
            delete process.env.GCP_PROJECT;
        });
    });

    describe('getDb', () => {
        it('retorna o objeto Firestore interno', () => {
            const instance = FirestoreInfrastructure.getInstance();
            const db = instance.getDb();
            expect(db).toBeDefined();
            expect(typeof db.collection).toBe('function');
        });
    });

    describe('incrementQuota', () => {
        it('retorna imediatamente em modo de desenvolvimento (NODE_ENV≠production, USE_FIRESTORE≠true)', async () => {
            process.env.NODE_ENV = 'test';
            delete process.env.USE_FIRESTORE;
            const instance = FirestoreInfrastructure.getInstance();
            await instance.incrementQuota('reads');
            expect(mockSet).not.toHaveBeenCalled();
        });

        it('chama db.set em modo de produção', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            const instance = FirestoreInfrastructure.getInstance();
            await instance.incrementQuota('writes', 2);
            expect(mockSet).toHaveBeenCalledWith(
                expect.objectContaining({ writes: expect.anything(), lastUpdated: expect.anything() }),
                { merge: true }
            );
            process.env.NODE_ENV = originalEnv;
        });

        it('chama db.set quando USE_FIRESTORE=true', async () => {
            process.env.USE_FIRESTORE = 'true';
            process.env.NODE_ENV = 'test';
            const instance = FirestoreInfrastructure.getInstance();
            await instance.incrementQuota('deletes', 1);
            expect(mockSet).toHaveBeenCalled();
            delete process.env.USE_FIRESTORE;
        });

        it('loga erro se db.set falha, sem propagar exceção', async () => {
            process.env.USE_FIRESTORE = 'true';
            mockSet.mockRejectedValueOnce(new Error('quota write failed'));
            const instance = FirestoreInfrastructure.getInstance();
            await expect(instance.incrementQuota('reads')).resolves.toBeUndefined();
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to increment quota', expect.objectContaining({ operation: 'reads' }));
            delete process.env.USE_FIRESTORE;
        });
    });

    describe('safeRead', () => {
        it('retorna null quando documento não existe', async () => {
            mockGet.mockResolvedValueOnce({ exists: false, data: () => undefined });
            const instance = FirestoreInfrastructure.getInstance();
            const result = await instance.safeRead('col', 'doc1');
            expect(result).toBeNull();
        });

        it('retorna dados quando documento existe', async () => {
            mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ foo: 'bar' }) });
            const instance = FirestoreInfrastructure.getInstance();
            const result = await instance.safeRead<{ foo: string }>('col', 'doc1');
            expect(result).toEqual({ foo: 'bar' });
        });
    });

    describe('safeWrite', () => {
        it('chama db.set com os dados fornecidos', async () => {
            const instance = FirestoreInfrastructure.getInstance();
            await instance.safeWrite('col', 'doc1', { key: 'value' });
            expect(mockSet).toHaveBeenCalledWith({ key: 'value' });
        });
    });

    describe('safeDelete', () => {
        it('chama db.delete no documento especificado', async () => {
            const instance = FirestoreInfrastructure.getInstance();
            await instance.safeDelete('col', 'doc1');
            expect(mockDelete).toHaveBeenCalled();
        });
    });

    describe('createProjectSnapshot', () => {
        it('escreve snapshot e retorna snapshotId com prefixo snap_', async () => {
            const instance = FirestoreInfrastructure.getInstance();
            const snapshotId = await instance.createProjectSnapshot('job123', { payload: 'data' });
            expect(typeof snapshotId).toBe('string');
            expect(snapshotId).toMatch(/^snap_\d+$/);
            expect(mockSet).toHaveBeenCalled();
        });
    });
});
