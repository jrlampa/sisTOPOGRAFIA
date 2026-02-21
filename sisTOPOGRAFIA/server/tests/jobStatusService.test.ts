// Mock logger before importing
jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

import {
    createJob,
    getJob,
    updateJobStatus,
    completeJob,
    failJob,
    stopCleanupInterval,
    JobStatus,
    JobInfo
} from '../services/jobStatusService';

afterAll(() => {
    stopCleanupInterval();
});

describe('JobStatusService', () => {
    describe('createJob', () => {
        it('deve criar job com status queued', () => {
            const job = createJob('job-001');
            expect(job.id).toBe('job-001');
            expect(job.status).toBe('queued');
            expect(job.progress).toBe(0);
            expect(job.createdAt).toBeInstanceOf(Date);
            expect(job.updatedAt).toBeInstanceOf(Date);
        });

        it('deve criar job sem result ou error inicial', () => {
            const job = createJob('job-002');
            expect(job.result).toBeUndefined();
            expect(job.error).toBeUndefined();
        });

        it('deve retornar o mesmo job ao criar com id duplicado', () => {
            createJob('job-dup');
            const job = createJob('job-dup');
            expect(job.id).toBe('job-dup');
        });
    });

    describe('getJob', () => {
        it('deve retornar job criado', () => {
            createJob('job-get-001');
            const job = getJob('job-get-001');
            expect(job).not.toBeNull();
            expect(job!.id).toBe('job-get-001');
        });

        it('deve retornar null para id inexistente', () => {
            const job = getJob('nao-existe-xyzabc');
            expect(job).toBeNull();
        });
    });

    describe('updateJobStatus', () => {
        it('deve atualizar status para processing', () => {
            createJob('job-upd-001');
            updateJobStatus('job-upd-001', 'processing', 25);
            const job = getJob('job-upd-001');
            expect(job!.status).toBe('processing');
            expect(job!.progress).toBe(25);
        });

        it('deve atualizar status sem alterar progress quando omitido', () => {
            createJob('job-upd-002');
            updateJobStatus('job-upd-002', 'processing', 50);
            updateJobStatus('job-upd-002', 'processing');
            const job = getJob('job-upd-002');
            expect(job!.progress).toBe(50);
        });

        it('deve atualizar updatedAt ao mudar status', () => {
            createJob('job-upd-003');
            const before = getJob('job-upd-003')!.updatedAt;
            // Pequeno delay para garantir timestamp diferente
            jest.useFakeTimers();
            jest.advanceTimersByTime(100);
            updateJobStatus('job-upd-003', 'processing');
            jest.useRealTimers();
            const after = getJob('job-upd-003')!.updatedAt;
            expect(after).toBeDefined();
        });

        it('não deve lançar erro para id inexistente', () => {
            expect(() => updateJobStatus('nao-existe-upd', 'processing')).not.toThrow();
        });
    });

    describe('completeJob', () => {
        it('deve definir status completed e progress 100', () => {
            createJob('job-comp-001');
            completeJob('job-comp-001', { url: '/files/out.dxf', filename: 'out.dxf' });
            const job = getJob('job-comp-001');
            expect(job!.status).toBe('completed');
            expect(job!.progress).toBe(100);
            expect(job!.result).toEqual({ url: '/files/out.dxf', filename: 'out.dxf' });
        });

        it('não deve lançar erro para id inexistente', () => {
            expect(() => completeJob('nao-existe-comp', { url: '/x', filename: 'x.dxf' })).not.toThrow();
        });
    });

    describe('failJob', () => {
        it('deve definir status failed e registrar erro', () => {
            createJob('job-fail-001');
            failJob('job-fail-001', 'Falha crítica ao gerar DXF');
            const job = getJob('job-fail-001');
            expect(job!.status).toBe('failed');
            expect(job!.error).toBe('Falha crítica ao gerar DXF');
        });

        it('não deve lançar erro para id inexistente', () => {
            expect(() => failJob('nao-existe-fail', 'erro')).not.toThrow();
        });
    });

    describe('Fluxo completo de job', () => {
        it('deve percorrer ciclo queued → processing → completed', () => {
            const id = 'job-flow-001';
            createJob(id);
            expect(getJob(id)!.status).toBe('queued');

            updateJobStatus(id, 'processing', 50);
            expect(getJob(id)!.status).toBe('processing');
            expect(getJob(id)!.progress).toBe(50);

            completeJob(id, { url: '/files/flow.dxf', filename: 'flow.dxf' });
            expect(getJob(id)!.status).toBe('completed');
            expect(getJob(id)!.progress).toBe(100);
        });

        it('deve percorrer ciclo queued → processing → failed', () => {
            const id = 'job-flow-002';
            createJob(id);
            updateJobStatus(id, 'processing', 30);
            failJob(id, 'API timeout');
            const job = getJob(id)!;
            expect(job.status).toBe('failed');
            expect(job.error).toBe('API timeout');
        });
    });

    describe('Limpeza automática de jobs antigos (cleanup loop)', () => {
        it('deve remover job com mais de 1 hora via setInterval', () => {
            jest.useFakeTimers();

            // Use isolateModules to load a fresh instance so startCleanupInterval()
            // registers its setInterval against the fake timer engine
            let isolatedCreate: (id: string) => any;
            let isolatedGet: (id: string) => any;
            let isolatedStop: () => void;

            jest.isolateModules(() => {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const svc = require('../services/jobStatusService');
                isolatedCreate = svc.createJob;
                isolatedGet = svc.getJob;
                isolatedStop = svc.stopCleanupInterval;
            });

            try {
                // Create job at fake-clock T0
                isolatedCreate!('job-cleanup-old');
                const job = isolatedGet!('job-cleanup-old');
                expect(job).not.toBeNull();

                // Backdate createdAt by 2 hours so the cleanup condition fires
                // (MAX_JOB_AGE = 1h; Date.now() after advance = T0 + 1h + 1ms)
                job.createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000);

                // Advance fake clock by 1h + 1ms → fires the cleanup setInterval
                jest.advanceTimersByTime(60 * 60 * 1000 + 1);

                // Job should have been removed by the cleanup callback (lines 34-38)
                expect(isolatedGet!('job-cleanup-old')).toBeNull();
            } finally {
                isolatedStop!();
                jest.useRealTimers();
            }
        });
    });
});
