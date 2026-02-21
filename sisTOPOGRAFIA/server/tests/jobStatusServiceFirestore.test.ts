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

afterAll(() => {
    stopCleanupInterval();
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
    });
});
