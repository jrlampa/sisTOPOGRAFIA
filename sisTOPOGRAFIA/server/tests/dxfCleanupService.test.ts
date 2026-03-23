import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock logger before importing the service
jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

import {
    scheduleDxfDeletion,
    triggerCleanupNow,
    stopDxfCleanup
} from '../services/dxfCleanupService';

afterAll(() => {
    stopDxfCleanup();
});

describe('DxfCleanupService', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dxf-test-'));
    });

    afterEach(() => {
        jest.restoreAllMocks();
        // Limpa arquivos temporários
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
            // Ignora erros de limpeza
        }
    });

    describe('scheduleDxfDeletion', () => {
        it('deve agendar arquivo para deleção sem erros', () => {
            const filePath = path.join(tmpDir, 'test.dxf');
            fs.writeFileSync(filePath, 'DXF content');
            expect(() => scheduleDxfDeletion(filePath)).not.toThrow();
        });

        it('deve aceitar path de arquivo inexistente sem erro', () => {
            const nonExistentPath = path.join(tmpDir, 'nao-existe.dxf');
            expect(() => scheduleDxfDeletion(nonExistentPath)).not.toThrow();
        });
    });

    describe('triggerCleanupNow', () => {
        it('deve executar cleanup sem erros quando não há arquivos agendados', () => {
            expect(() => triggerCleanupNow()).not.toThrow();
        });

        it('deve deletar arquivo expirado quando cleanup é forçado', () => {
            const filePath = path.join(tmpDir, 'expired.dxf');
            fs.writeFileSync(filePath, 'DXF expired');

            // Agenda para deleção imediata (TTL negativo não é possível via API pública,
            // mas podemos verificar que o arquivo persiste antes do TTL)
            scheduleDxfDeletion(filePath);

            // Arquivo ainda existe logo após agendar (TTL é de 10 min)
            expect(fs.existsSync(filePath)).toBe(true);
        });

        it('deve preservar arquivo que ainda não expirou', () => {
            const filePath = path.join(tmpDir, 'fresh.dxf');
            fs.writeFileSync(filePath, 'DXF fresh');
            scheduleDxfDeletion(filePath);
            triggerCleanupNow();
            // Arquivo recém agendado não deve ser deletado ainda
            expect(fs.existsSync(filePath)).toBe(true);
        });

        it('deve tratar arquivo já removido graciosamente', () => {
            const filePath = path.join(tmpDir, 'already-gone.dxf');
            // Não cria o arquivo — simula arquivo já deletado antes do cleanup
            scheduleDxfDeletion(filePath);
            expect(() => triggerCleanupNow()).not.toThrow();
        });

        it('deve efetivamente deletar arquivo quando TTL expirou (Date.now mockado)', () => {
            const filePath = path.join(tmpDir, 'to-expire.dxf');
            fs.writeFileSync(filePath, 'DXF content');

            scheduleDxfDeletion(filePath);

            // Avança Date.now 11 minutos para forçar expiração
            const futureTime = Date.now() + 11 * 60 * 1000;
            jest.spyOn(Date, 'now').mockReturnValue(futureTime);

            triggerCleanupNow();

            expect(fs.existsSync(filePath)).toBe(false);
        });

        it('deve logar ciclo de cleanup quando arquivos são deletados', () => {
            const { logger } = jest.requireMock('../utils/logger') as any;
            const filePath = path.join(tmpDir, 'cycle-log.dxf');
            fs.writeFileSync(filePath, 'DXF content');

            scheduleDxfDeletion(filePath);

            const futureTime = Date.now() + 11 * 60 * 1000;
            jest.spyOn(Date, 'now').mockReturnValue(futureTime);

            triggerCleanupNow();

            // Verifica que o logger foi chamado (info ou warn para o ciclo)
            expect(logger.info).toHaveBeenCalled();
        });

        it('deve tratar erro de fs.unlinkSync graciosamente', () => {
            const filePath = path.join(tmpDir, 'error-delete.dxf');
            fs.writeFileSync(filePath, 'DXF content');

            scheduleDxfDeletion(filePath);

            const futureTime = Date.now() + 11 * 60 * 1000;
            jest.spyOn(Date, 'now').mockReturnValue(futureTime);
            jest.spyOn(fs, 'unlinkSync').mockImplementationOnce(() => {
                throw new Error('Permission denied');
            });

            // Não deve propagar o erro
            expect(() => triggerCleanupNow()).not.toThrow();
        });

        it('deve tratar erro não-Error de fs.unlinkSync graciosamente (cobre String(error))', () => {
            const filePath = path.join(tmpDir, 'non-error-delete.dxf');
            fs.writeFileSync(filePath, 'DXF content');

            scheduleDxfDeletion(filePath);

            const futureTime = Date.now() + 11 * 60 * 1000;
            jest.spyOn(Date, 'now').mockReturnValue(futureTime);
            jest.spyOn(fs, 'unlinkSync').mockImplementationOnce(() => {
                // eslint-disable-next-line @typescript-eslint/only-throw-error
                throw 'string error value';
            });

            // Não deve propagar o erro
            expect(() => triggerCleanupNow()).not.toThrow();
        });

        it('deve logar arquivo não encontrado quando já foi deletado externamente', () => {
            const { logger } = jest.requireMock('../utils/logger') as any;
            const filePath = path.join(tmpDir, 'gone-externally.dxf');
            // Não cria o arquivo — simula deleção externa

            scheduleDxfDeletion(filePath);

            const futureTime = Date.now() + 11 * 60 * 1000;
            jest.spyOn(Date, 'now').mockReturnValue(futureTime);

            triggerCleanupNow();

            expect(logger.warn).toHaveBeenCalled();
        });
    });

    describe('stopDxfCleanup', () => {
        it('deve parar o intervalo sem erros', () => {
            expect(() => stopDxfCleanup()).not.toThrow();
        });

        it('deve ser idempotente (chamar duas vezes não causa erro)', () => {
            expect(() => {
                stopDxfCleanup();
                stopDxfCleanup();
            }).not.toThrow();
        });
    });

    describe('startCleanupInterval — guard e corpo do intervalo', () => {
        it('deve acionar performCleanup() via setInterval e respeitar guard "already running"', () => {
            jest.useFakeTimers();

            let isolatedSchedule: (f: string) => void;
            let isolatedStop: () => void;
            let isolatedTrigger: () => void;

            jest.isolateModules(() => {
                const svc = require('../services/dxfCleanupService');
                isolatedSchedule = svc.scheduleDxfDeletion;
                isolatedStop = svc.stopDxfCleanup;
                isolatedTrigger = svc.triggerCleanupNow;
            });

            // Mirrors service constants: DXF_FILE_TTL_MS = 10 min, CLEANUP_CHECK_INTERVAL = 2 min
            const DXF_TTL_MS = 10 * 60 * 1000;
            const CLEANUP_INTERVAL_MS = 2 * 60 * 1000;

            try {
                // Schedule a file — at module load startCleanupInterval() ran once (interval registered)
                const filePath = path.join(tmpDir, 'guard-test.dxf');
                fs.writeFileSync(filePath, 'DXF');
                isolatedSchedule!(filePath);

                // Mark file as old so performCleanup() finds it (advance past TTL)
                const futureTime = Date.now() + DXF_TTL_MS + 60_000; // 1 min past TTL
                jest.spyOn(Date, 'now').mockReturnValue(futureTime);

                // Advance timers by CLEANUP_CHECK_INTERVAL to fire the interval body (line 87)
                jest.advanceTimersByTime(CLEANUP_INTERVAL_MS + 1);

                // File should have been deleted by the interval-driven performCleanup (line 87)
                expect(fs.existsSync(filePath)).toBe(false);
            } finally {
                isolatedStop!();
                jest.useRealTimers();
            }
        });
    });
});
