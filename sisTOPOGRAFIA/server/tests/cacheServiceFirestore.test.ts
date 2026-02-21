// Mock logger before importing
jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

// Mock Firestore infrastructure — testes rodam sem GCP
jest.mock('../infrastructure/firestoreService', () => ({
    FirestoreInfrastructure: {
        getInstance: jest.fn()
    }
}));

// Força modo memória (USE_FIRESTORE=false) para testes unitários
process.env.USE_FIRESTORE = 'false';
process.env.NODE_ENV = 'test';

import {
    createCacheKey,
    getCachedFilename,
    setCachedFilename,
    deleteCachedFilename,
    DEFAULT_TTL_MS
} from '../services/cacheServiceFirestore';

describe('CacheServiceFirestore (modo memória)', () => {
    describe('createCacheKey', () => {
        it('deve gerar hash consistente para mesmo payload', () => {
            const payload = {
                lat: -22.15018,
                lon: -42.92185,
                radius: 500,
                mode: 'circle',
                polygon: null,
                layers: {}
            };
            const key1 = createCacheKey(payload);
            const key2 = createCacheKey(payload);
            expect(key1).toBe(key2);
            expect(key1).toHaveLength(64);
        });

        it('deve gerar hashes diferentes para payloads distintos', () => {
            const payload1 = { lat: -22.15018, lon: -42.92185, radius: 500, mode: 'circle', polygon: null, layers: {} };
            const payload2 = { lat: -22.15020, lon: -42.92185, radius: 500, mode: 'circle', polygon: null, layers: {} };
            expect(createCacheKey(payload1)).not.toBe(createCacheKey(payload2));
        });

        it('deve normalizar polygon null e undefined de forma igual', () => {
            const payloadNull = { lat: -22.15018, lon: -42.92185, radius: 500, mode: 'circle', polygon: null, layers: {} };
            const payloadUndefined = { lat: -22.15018, lon: -42.92185, radius: 500, mode: 'circle', polygon: undefined, layers: {} };
            expect(createCacheKey(payloadNull)).toBe(createCacheKey(payloadUndefined));
        });
    });

    describe('getCachedFilename', () => {
        it('deve retornar null para chave inexistente', async () => {
            const result = await getCachedFilename('chave-inexistente');
            expect(result).toBeNull();
        });

        it('deve retornar filename após set', async () => {
            const key = 'chave-teste-get';
            await setCachedFilename(key, 'arquivo.dxf');
            const result = await getCachedFilename(key);
            expect(result).toBe('arquivo.dxf');
        });
    });

    describe('setCachedFilename', () => {
        it('deve armazenar e recuperar filename', async () => {
            const key = 'chave-teste-set';
            await setCachedFilename(key, 'output.dxf');
            const result = await getCachedFilename(key);
            expect(result).toBe('output.dxf');
        });

        it('deve retornar null após expiração de TTL', async () => {
            const key = 'chave-expirada';
            await setCachedFilename(key, 'expirado.dxf', 1); // 1ms TTL
            await new Promise(resolve => setTimeout(resolve, 10));
            const result = await getCachedFilename(key);
            expect(result).toBeNull();
        });
    });

    describe('deleteCachedFilename', () => {
        it('deve remover entrada de cache existente', async () => {
            const key = 'chave-delete';
            await setCachedFilename(key, 'deletar.dxf');
            await deleteCachedFilename(key);
            const result = await getCachedFilename(key);
            expect(result).toBeNull();
        });

        it('não deve falhar ao deletar chave inexistente', async () => {
            await expect(deleteCachedFilename('chave-nao-existe')).resolves.toBeUndefined();
        });
    });

    describe('DEFAULT_TTL_MS', () => {
        it('deve ser 24 horas em millisegundos', () => {
            expect(DEFAULT_TTL_MS).toBe(24 * 60 * 60 * 1000);
        });
    });
});
