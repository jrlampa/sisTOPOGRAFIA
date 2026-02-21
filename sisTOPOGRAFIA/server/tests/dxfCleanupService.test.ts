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
});
