import { vi } from "vitest";
/**
 * maintenanceRepository.test.ts
 * Testa as operações de manutenção (delete em lote) do repositório.
 */

const unsafeMock = vi.fn();

vi.mock('../repositories/dbClient', () => ({
  getDbClient: vi.fn(() => ({ unsafe: unsafeMock })),
}));

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { PostgresMaintenanceRepository } from '../repositories/maintenanceRepository';
import { getDbClient } from '../repositories/dbClient';

const getDbClientMock = getDbClient as vi.Mock;

describe('PostgresMaintenanceRepository', () => {
  let repo: PostgresMaintenanceRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    getDbClientMock.mockReturnValue({ unsafe: unsafeMock });
    repo = new PostgresMaintenanceRepository();
  });

  // ── deleteOldAuditLogs ────────────────────────────────────────────────────

  describe('deleteOldAuditLogs', () => {
    it('executa DELETE e retorna contagem', async () => {
      unsafeMock.mockResolvedValueOnce([{ cnt: '12' }]);
      const count = await repo.deleteOldAuditLogs(90);
      expect(count).toBe(12);
      expect(unsafeMock.mock.calls[0][0]).toMatch(/DELETE FROM audit_logs/i);
      expect(unsafeMock.mock.calls[0][1]).toEqual(['90']);
    });

    it('retorna 0 quando nenhum registro é deletado', async () => {
      unsafeMock.mockResolvedValueOnce([{ cnt: '0' }]);
      expect(await repo.deleteOldAuditLogs(90)).toBe(0);
    });

    it('retorna 0 quando DB indisponível', async () => {
      getDbClientMock.mockReturnValueOnce(null);
      expect(await repo.deleteOldAuditLogs(90)).toBe(0);
    });

    it('retorna 0 e loga warn em caso de erro SQL', async () => {
      unsafeMock.mockRejectedValueOnce(new Error('DB error'));
      expect(await repo.deleteOldAuditLogs(90)).toBe(0);
    });

    it('retorna 0 quando resultado é undefined', async () => {
      unsafeMock.mockResolvedValueOnce([{}]);
      expect(await repo.deleteOldAuditLogs(90)).toBe(0);
    });
  });

  // ── deleteOldJobs ─────────────────────────────────────────────────────────

  describe('deleteOldJobs', () => {
    it('executa DELETE e retorna contagem', async () => {
      unsafeMock.mockResolvedValueOnce([{ cnt: '5' }]);
      const count = await repo.deleteOldJobs(86400000, 604800000);
      expect(count).toBe(5);
      expect(unsafeMock.mock.calls[0][0]).toMatch(/DELETE FROM jobs/i);
      expect(unsafeMock.mock.calls[0][1]).toEqual([86400000, 604800000]);
    });

    it('retorna 0 quando nenhum job é deletado', async () => {
      unsafeMock.mockResolvedValueOnce([{ cnt: '0' }]);
      expect(await repo.deleteOldJobs(86400000, 604800000)).toBe(0);
    });

    it('retorna 0 quando DB indisponível', async () => {
      getDbClientMock.mockReturnValueOnce(null);
      expect(await repo.deleteOldJobs(86400000, 604800000)).toBe(0);
    });

    it('retorna 0 e loga warn em caso de erro SQL', async () => {
      unsafeMock.mockRejectedValueOnce(new Error('DB error'));
      expect(await repo.deleteOldJobs(86400000, 604800000)).toBe(0);
    });

    it('retorna 0 quando resultado não tem cnt', async () => {
      unsafeMock.mockResolvedValueOnce([{}]);
      expect(await repo.deleteOldJobs(86400000, 604800000)).toBe(0);
    });
  });
});

