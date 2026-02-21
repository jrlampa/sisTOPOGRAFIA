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
    cleanupExpiredCache,
    DEFAULT_TTL_MS,
    stopCleanupInterval
} from '../services/cacheServiceFirestore';
import { FirestoreInfrastructure } from '../infrastructure/firestoreService';

afterAll(() => {
    stopCleanupInterval();
    process.env.USE_FIRESTORE = 'false';
});

afterEach(() => {
    process.env.USE_FIRESTORE = 'false';
    jest.clearAllMocks();
});

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

        it('deve serializar layers com valores de array corretamente', () => {
            const payloadWithArray = {
                lat: -22.15018,
                lon: -42.92185,
                radius: 500,
                mode: 'circle',
                polygon: null,
                layers: { buildings: [1, 2, 3] }
            };
            const payloadDifferentArray = {
                lat: -22.15018,
                lon: -42.92185,
                radius: 500,
                mode: 'circle',
                polygon: null,
                layers: { buildings: [1, 2, 4] }
            };
            const key1 = createCacheKey(payloadWithArray);
            const key2 = createCacheKey(payloadWithArray);
            const key3 = createCacheKey(payloadDifferentArray);
            // Same payload produces same key (deterministic)
            expect(key1).toBe(key2);
            // Different array values produce different keys
            expect(key1).not.toBe(key3);
            expect(key1).toHaveLength(64);
        });

        it('deve usar {} como padrão quando layers é undefined', () => {
            const payloadComLayers = {
                lat: -22.15018,
                lon: -42.92185,
                radius: 100,
                mode: 'circle',
                polygon: null,
                layers: {}
            };
            const payloadSemLayers = {
                lat: -22.15018,
                lon: -42.92185,
                radius: 100,
                mode: 'circle',
                polygon: null,
                layers: undefined
            };
            // layers=undefined é normalizado para {}, gerando o mesmo hash
            expect(createCacheKey(payloadSemLayers as any)).toBe(createCacheKey(payloadComLayers));
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

    describe('cleanupExpiredCache', () => {
        it('deve limpar entradas expiradas em modo memória', async () => {
            await setCachedFilename('chave-cleanup-exp', 'expirado.dxf', 1); // 1ms TTL
            await new Promise(resolve => setTimeout(resolve, 10));
            cleanupExpiredCache();
            const result = await getCachedFilename('chave-cleanup-exp');
            expect(result).toBeNull();
        });

        it('deve não limpar entradas não-expiradas em modo memória', async () => {
            await setCachedFilename('chave-nao-exp', 'valido.dxf', 60000);
            cleanupExpiredCache();
            const result = await getCachedFilename('chave-nao-exp');
            expect(result).toBe('valido.dxf');
        });
    });

    describe('DEFAULT_TTL_MS', () => {
        it('deve ser 24 horas em millisegundos', () => {
            expect(DEFAULT_TTL_MS).toBe(24 * 60 * 60 * 1000);
        });
    });
});

describe('CacheServiceFirestore (modo Firestore simulado)', () => {
    let mockFirestore: {
        safeRead: jest.Mock;
        safeWrite: jest.Mock;
        safeDelete: jest.Mock;
    };

    beforeEach(() => {
        mockFirestore = {
            safeRead: jest.fn(),
            safeWrite: jest.fn(),
            safeDelete: jest.fn()
        };
        (FirestoreInfrastructure.getInstance as jest.Mock).mockReturnValue(mockFirestore);
        process.env.USE_FIRESTORE = 'true';
    });

    afterEach(() => {
        process.env.USE_FIRESTORE = 'false';
        jest.clearAllMocks();
    });

    describe('getCachedFilename com Firestore', () => {
        it('deve retornar null quando Firestore não encontra entrada', async () => {
            mockFirestore.safeRead.mockResolvedValue(null);
            const result = await getCachedFilename('chave-fs-inexistente');
            expect(result).toBeNull();
            expect(mockFirestore.safeRead).toHaveBeenCalledWith('cache', 'chave-fs-inexistente');
        });

        it('deve retornar filename quando Firestore retorna entrada válida', async () => {
            const futureExpiry = new Date(Date.now() + 60000);
            mockFirestore.safeRead.mockResolvedValue({
                key: 'chave-fs-valid',
                filename: 'fs-arquivo.dxf',
                expiresAt: futureExpiry,
                createdAt: new Date()
            });
            const result = await getCachedFilename('chave-fs-valid');
            expect(result).toBe('fs-arquivo.dxf');
        });

        it('deve deletar e retornar null para entrada expirada do Firestore', async () => {
            const pastExpiry = new Date(Date.now() - 1000);
            mockFirestore.safeRead.mockResolvedValue({
                key: 'chave-fs-expired',
                filename: 'expirado.dxf',
                expiresAt: pastExpiry,
                createdAt: new Date()
            });
            mockFirestore.safeDelete.mockResolvedValue(undefined);
            const result = await getCachedFilename('chave-fs-expired');
            expect(result).toBeNull();
            expect(mockFirestore.safeDelete).toHaveBeenCalledWith('cache', 'chave-fs-expired');
        });

        it('deve tolerar falha ao deletar entrada expirada', async () => {
            const pastExpiry = new Date(Date.now() - 1000);
            mockFirestore.safeRead.mockResolvedValue({
                key: 'chave-fs-del-err',
                filename: 'expirado.dxf',
                expiresAt: pastExpiry,
                createdAt: new Date()
            });
            mockFirestore.safeDelete.mockRejectedValue(new Error('Firestore delete error'));
            const result = await getCachedFilename('chave-fs-del-err');
            expect(result).toBeNull();
        });

        it('deve fazer fallback para memória quando circuit breaker dispara no read', async () => {
            mockFirestore.safeRead.mockRejectedValue(new Error('Circuit breaker: quota exceeded'));
            const result = await getCachedFilename('chave-cb-read');
            expect(result).toBeNull();
        });

        it('deve retornar filename da memória quando circuit breaker dispara e entrada válida existe', async () => {
            // First set entry in memory mode
            process.env.USE_FIRESTORE = 'false';
            await setCachedFilename('chave-cb-memory-hit', 'memoria.dxf', 60000);
            // Switch to Firestore mode, trigger circuit breaker
            process.env.USE_FIRESTORE = 'true';
            mockFirestore.safeRead.mockRejectedValue(new Error('Circuit breaker: quota exceeded'));
            const result = await getCachedFilename('chave-cb-memory-hit');
            expect(result).toBe('memoria.dxf');
        });

        it('deve retornar null da memória quando circuit breaker dispara e entrada expirada existe', async () => {
            // First set expired entry in memory mode
            process.env.USE_FIRESTORE = 'false';
            await setCachedFilename('chave-cb-memory-exp', 'expirado.dxf', 1); // 1ms TTL
            await new Promise(resolve => setTimeout(resolve, 10));
            // Switch to Firestore mode, trigger circuit breaker
            process.env.USE_FIRESTORE = 'true';
            mockFirestore.safeRead.mockRejectedValue(new Error('Circuit breaker: quota exceeded'));
            const result = await getCachedFilename('chave-cb-memory-exp');
            expect(result).toBeNull();
        });

        it('deve lançar erro quando Firestore lança erro não relacionado a circuit breaker', async () => {
            mockFirestore.safeRead.mockRejectedValue(new Error('Firestore connection error'));
            await expect(getCachedFilename('chave-fs-err')).rejects.toThrow('Firestore connection error');
        });
    });

    describe('setCachedFilename com Firestore', () => {
        it('deve gravar no Firestore quando USE_FIRESTORE=true', async () => {
            mockFirestore.safeWrite.mockResolvedValue(undefined);
            await setCachedFilename('chave-fs-set', 'fs-output.dxf');
            expect(mockFirestore.safeWrite).toHaveBeenCalledWith('cache', 'chave-fs-set', expect.objectContaining({
                key: 'chave-fs-set',
                filename: 'fs-output.dxf'
            }));
        });

        it('deve fazer fallback para memória quando circuit breaker dispara no write', async () => {
            mockFirestore.safeWrite.mockRejectedValue(new Error('Circuit breaker: quota exceeded'));
            await expect(setCachedFilename('chave-cb-write', 'arquivo.dxf')).resolves.toBeUndefined();
        });

        it('deve lançar erro quando Firestore falha com erro crítico no write', async () => {
            mockFirestore.safeWrite.mockRejectedValue(new Error('Permission denied'));
            await expect(setCachedFilename('chave-fs-write-err', 'arquivo.dxf')).rejects.toThrow('Permission denied');
        });
    });

    describe('deleteCachedFilename com Firestore', () => {
        it('deve deletar do Firestore quando USE_FIRESTORE=true', async () => {
            mockFirestore.safeDelete.mockResolvedValue(undefined);
            await deleteCachedFilename('chave-fs-del');
            expect(mockFirestore.safeDelete).toHaveBeenCalledWith('cache', 'chave-fs-del');
        });

        it('deve fazer fallback para memória quando circuit breaker dispara no delete', async () => {
            mockFirestore.safeDelete.mockRejectedValue(new Error('Circuit breaker: quota exceeded'));
            await expect(deleteCachedFilename('chave-cb-del')).resolves.toBeUndefined();
        });

        it('deve lançar erro quando Firestore falha com erro crítico no delete', async () => {
            mockFirestore.safeDelete.mockRejectedValue(new Error('Permission denied'));
            await expect(deleteCachedFilename('chave-fs-del-err')).rejects.toThrow('Permission denied');
        });
    });

    describe('cleanupExpiredCache com Firestore', () => {
        it('não deve limpar entradas em modo Firestore (tratado externamente)', () => {
            expect(() => cleanupExpiredCache()).not.toThrow();
        });
    });
});
