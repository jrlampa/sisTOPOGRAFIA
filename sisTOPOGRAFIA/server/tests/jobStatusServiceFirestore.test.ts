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
    createJob,
    getJob,
    updateJobStatus,
    completeJob,
    failJob,
    cleanupOldJobs,
    stopCleanupInterval,
    JobStatus,
    JobInfo
} from '../services/jobStatusServiceFirestore';
import { FirestoreInfrastructure } from '../infrastructure/firestoreService';

afterAll(() => {
    stopCleanupInterval();
    process.env.USE_FIRESTORE = 'false';
});

afterEach(() => {
    process.env.USE_FIRESTORE = 'false';
    jest.clearAllMocks();
});

describe('JobStatusServiceFirestore (modo memória)', () => {
    describe('createJob', () => {
        it('deve criar job com status queued', async () => {
            const job = await createJob('fjob-001');
            expect(job.id).toBe('fjob-001');
            expect(job.status).toBe('queued');
            expect(job.progress).toBe(0);
        });

        it('deve criar job sem result ou error inicial', async () => {
            const job = await createJob('fjob-002');
            expect(job.result).toBeUndefined();
            expect(job.error).toBeUndefined();
        });
    });

    describe('getJob', () => {
        it('deve retornar null para job inexistente', async () => {
            const job = await getJob('fjob-inexistente');
            expect(job).toBeNull();
        });

        it('deve retornar job existente', async () => {
            await createJob('fjob-003');
            const job = await getJob('fjob-003');
            expect(job).not.toBeNull();
            expect(job!.id).toBe('fjob-003');
        });
    });

    describe('updateJobStatus', () => {
        it('deve atualizar status para processing', async () => {
            await createJob('fjob-004');
            await updateJobStatus('fjob-004', 'processing', 50);
            const job = await getJob('fjob-004');
            expect(job!.status).toBe('processing');
            expect(job!.progress).toBe(50);
        });

        it('não deve falhar para job inexistente', async () => {
            await expect(updateJobStatus('fjob-nao-existe', 'processing', 10)).resolves.toBeUndefined();
        });
    });

    describe('completeJob', () => {
        it('deve marcar job como concluído com resultado', async () => {
            await createJob('fjob-005');
            await completeJob('fjob-005', { url: 'http://example.com/file.dxf', filename: 'file.dxf' });
            const job = await getJob('fjob-005');
            expect(job!.status).toBe('completed');
            expect(job!.progress).toBe(100);
            expect(job!.result?.filename).toBe('file.dxf');
        });
    });

    describe('failJob', () => {
        it('deve marcar job como falho com mensagem de erro', async () => {
            await createJob('fjob-006');
            await failJob('fjob-006', 'Erro de geração DXF');
            const job = await getJob('fjob-006');
            expect(job!.status).toBe('failed');
            expect(job!.error).toBe('Erro de geração DXF');
        });
    });

    describe('cleanupOldJobs', () => {
        it('deve executar limpeza sem erros em modo memória', () => {
            expect(() => cleanupOldJobs()).not.toThrow();
        });

        it('deve remover jobs mais antigos que 1 hora', async () => {
            // Create job first (uses real Timestamp.now())
            await createJob('fjob-old-cleanup');

            // Mock Date.now to be 2 hours in the future so threshold is past job creation
            const futureNow = Date.now() + 2 * 60 * 60 * 1000;
            const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(futureNow);

            try {
                cleanupOldJobs();
            } finally {
                dateNowSpy.mockRestore();
            }

            const job = await getJob('fjob-old-cleanup');
            expect(job).toBeNull();
        });
    });
});

describe('JobStatusServiceFirestore (modo Firestore simulado)', () => {
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

    describe('createJob com Firestore', () => {
        it('deve criar job no Firestore quando USE_FIRESTORE=true', async () => {
            mockFirestore.safeWrite.mockResolvedValue(undefined);
            const job = await createJob('fsjob-fs-001');
            expect(job.id).toBe('fsjob-fs-001');
            expect(job.status).toBe('queued');
            expect(mockFirestore.safeWrite).toHaveBeenCalledWith('jobs', 'fsjob-fs-001', expect.objectContaining({
                id: 'fsjob-fs-001',
                status: 'queued'
            }));
        });

        it('deve fazer fallback para memória quando circuit breaker dispara na criação', async () => {
            mockFirestore.safeWrite.mockRejectedValue(new Error('Circuit breaker: quota exceeded'));
            const job = await createJob('fsjob-cb-001');
            expect(job.id).toBe('fsjob-cb-001');
            expect(job.status).toBe('queued');
        });

        it('deve lançar erro quando Firestore falha com erro crítico', async () => {
            mockFirestore.safeWrite.mockRejectedValue(new Error('Permission denied'));
            await expect(createJob('fsjob-err-001')).rejects.toThrow('Permission denied');
        });
    });

    describe('getJob com Firestore', () => {
        it('deve ler job do Firestore quando USE_FIRESTORE=true', async () => {
            mockFirestore.safeRead.mockResolvedValue({
                id: 'fsjob-fs-read',
                status: 'processing',
                progress: 50,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            const job = await getJob('fsjob-fs-read');
            expect(job).not.toBeNull();
            expect(job!.status).toBe('processing');
            expect(mockFirestore.safeRead).toHaveBeenCalledWith('jobs', 'fsjob-fs-read');
        });

        it('deve fazer fallback para memória quando circuit breaker dispara no read', async () => {
            mockFirestore.safeRead.mockRejectedValue(new Error('Circuit breaker: quota exceeded'));
            const job = await getJob('fsjob-cb-read');
            expect(job).toBeNull();
        });

        it('deve lançar erro quando Firestore falha com erro crítico no read', async () => {
            mockFirestore.safeRead.mockRejectedValue(new Error('Network error'));
            await expect(getJob('fsjob-err-read')).rejects.toThrow('Network error');
        });
    });

    describe('updateJobStatus com Firestore', () => {
        it('deve atualizar job no Firestore quando USE_FIRESTORE=true', async () => {
            mockFirestore.safeRead.mockResolvedValue({
                id: 'fsjob-upd',
                status: 'queued',
                progress: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            mockFirestore.safeWrite.mockResolvedValue(undefined);
            await updateJobStatus('fsjob-upd', 'processing', 25);
            expect(mockFirestore.safeWrite).toHaveBeenCalledWith('jobs', 'fsjob-upd', expect.objectContaining({
                status: 'processing',
                progress: 25
            }));
        });

        it('deve atualizar status sem progress quando progress não fornecido', async () => {
            mockFirestore.safeRead.mockResolvedValue({
                id: 'fsjob-upd-noprog',
                status: 'queued',
                progress: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            mockFirestore.safeWrite.mockResolvedValue(undefined);
            await updateJobStatus('fsjob-upd-noprog', 'processing');
            expect(mockFirestore.safeWrite).toHaveBeenCalledWith('jobs', 'fsjob-upd-noprog', expect.objectContaining({
                status: 'processing',
                progress: 0
            }));
        });

        it('deve fazer fallback para memória quando circuit breaker dispara no update', async () => {
            mockFirestore.safeRead.mockRejectedValue(new Error('Circuit breaker: quota exceeded'));
            await expect(updateJobStatus('fsjob-cb-upd', 'processing', 50)).resolves.toBeUndefined();
        });

        it('deve atualizar job em memória no fallback quando job existe', async () => {
            // First create job in memory mode
            process.env.USE_FIRESTORE = 'false';
            await createJob('fsjob-cb-upd-exists');
            // Switch to Firestore mode, trigger circuit breaker
            process.env.USE_FIRESTORE = 'true';
            mockFirestore.safeRead.mockRejectedValue(new Error('Circuit breaker: quota exceeded'));
            await updateJobStatus('fsjob-cb-upd-exists', 'processing', 75);
            // Switch back to memory and verify
            process.env.USE_FIRESTORE = 'false';
            const job = await getJob('fsjob-cb-upd-exists');
            expect(job!.status).toBe('processing');
            expect(job!.progress).toBe(75);
        });

        it('deve lançar erro quando Firestore falha com erro crítico no update', async () => {
            mockFirestore.safeRead.mockRejectedValue(new Error('Permission denied'));
            await expect(updateJobStatus('fsjob-err-upd', 'processing', 50)).rejects.toThrow('Permission denied');
        });
    });

    describe('completeJob com Firestore', () => {
        it('deve completar job no Firestore', async () => {
            mockFirestore.safeRead.mockResolvedValue({
                id: 'fsjob-cmp',
                status: 'processing',
                progress: 90,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            mockFirestore.safeWrite.mockResolvedValue(undefined);
            await completeJob('fsjob-cmp', { url: '/download/output.dxf', filename: 'output.dxf' });
            expect(mockFirestore.safeWrite).toHaveBeenCalledWith('jobs', 'fsjob-cmp', expect.objectContaining({
                status: 'completed',
                progress: 100
            }));
        });

        it('deve fazer fallback para memória quando circuit breaker dispara no complete', async () => {
            mockFirestore.safeRead.mockRejectedValue(new Error('Circuit breaker: quota exceeded'));
            await expect(completeJob('fsjob-cb-cmp', { url: '/dl/f.dxf', filename: 'f.dxf' })).resolves.toBeUndefined();
        });

        it('deve completar job em memória no fallback quando job existe', async () => {
            // First create job in memory mode
            process.env.USE_FIRESTORE = 'false';
            await createJob('fsjob-cb-cmp-exists');
            // Switch to Firestore mode, trigger circuit breaker
            process.env.USE_FIRESTORE = 'true';
            mockFirestore.safeRead.mockRejectedValue(new Error('Circuit breaker: quota exceeded'));
            await completeJob('fsjob-cb-cmp-exists', { url: '/download/out.dxf', filename: 'out.dxf' });
            // Switch back to memory and verify
            process.env.USE_FIRESTORE = 'false';
            const job = await getJob('fsjob-cb-cmp-exists');
            expect(job!.status).toBe('completed');
            expect(job!.result?.filename).toBe('out.dxf');
        });

        it('deve lançar erro quando Firestore falha com erro crítico no complete', async () => {
            mockFirestore.safeRead.mockRejectedValue(new Error('Permission denied'));
            await expect(completeJob('fsjob-err-cmp', { url: '/dl/f.dxf', filename: 'f.dxf' })).rejects.toThrow('Permission denied');
        });
    });

    describe('failJob com Firestore', () => {
        it('deve marcar job como failed no Firestore', async () => {
            mockFirestore.safeRead.mockResolvedValue({
                id: 'fsjob-fail',
                status: 'processing',
                progress: 30,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            mockFirestore.safeWrite.mockResolvedValue(undefined);
            await failJob('fsjob-fail', 'Erro fatal de geração');
            expect(mockFirestore.safeWrite).toHaveBeenCalledWith('jobs', 'fsjob-fail', expect.objectContaining({
                status: 'failed'
            }));
        });

        it('deve fazer fallback para memória quando circuit breaker dispara no fail', async () => {
            mockFirestore.safeRead.mockRejectedValue(new Error('Circuit breaker: quota exceeded'));
            await expect(failJob('fsjob-cb-fail', 'Erro')).resolves.toBeUndefined();
        });

        it('deve marcar job em memória como failed no fallback quando job existe', async () => {
            // First create job in memory mode
            process.env.USE_FIRESTORE = 'false';
            await createJob('fsjob-cb-fail-exists');
            // Switch to Firestore mode, trigger circuit breaker
            process.env.USE_FIRESTORE = 'true';
            mockFirestore.safeRead.mockRejectedValue(new Error('Circuit breaker: quota exceeded'));
            await failJob('fsjob-cb-fail-exists', 'Erro fatal');
            // Switch back to memory and verify
            process.env.USE_FIRESTORE = 'false';
            const job = await getJob('fsjob-cb-fail-exists');
            expect(job!.status).toBe('failed');
        });

        it('deve lançar erro quando Firestore falha com erro crítico no fail', async () => {
            mockFirestore.safeRead.mockRejectedValue(new Error('Permission denied'));
            await expect(failJob('fsjob-err-fail', 'Erro')).rejects.toThrow('Permission denied');
        });
    });

    describe('cleanupOldJobs com Firestore', () => {
        it('não deve executar limpeza em modo Firestore (tratado externamente)', () => {
            expect(() => cleanupOldJobs()).not.toThrow();
        });
    });
});
