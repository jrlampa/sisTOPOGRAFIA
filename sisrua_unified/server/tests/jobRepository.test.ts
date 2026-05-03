import { vi } from "vitest";
/**
 * jobRepository.test.ts
 * Testa todas as operações SQL do repositório jobs com multi-tenancy.
 */

const unsafeMock = vi.fn();

vi.mock('../repositories/dbClient', () => ({
  getDbClient: vi.fn(() => ({ unsafe: unsafeMock })),
}));

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { PostgresJobRepository } from '../repositories/jobRepository';
import { getDbClient } from '../repositories/dbClient';

const getDbClientMock = getDbClient as vi.Mock;

const NOW = new Date('2025-06-01T10:00:00Z');
const TEST_TENANT = 'tenant-123';

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-001',
    tenant_id: TEST_TENANT,
    status: 'pending',
    progress: 0,
    result: null,
    error: null,
    created_at: NOW,
    updated_at: NOW,
    attempts: 0,
    ...overrides,
  };
}

describe('PostgresJobRepository', () => {
  let repo: PostgresJobRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    getDbClientMock.mockReturnValue({ unsafe: unsafeMock });
    repo = new PostgresJobRepository();
  });

  // ── upsert ────────────────────────────────────────────────────────────────

  describe('upsert', () => {
    it('executa INSERT ON CONFLICT UPDATE', async () => {
      unsafeMock.mockResolvedValueOnce([]);
      await repo.upsert('job-001', TEST_TENANT, 'processing', 50);
      expect(unsafeMock).toHaveBeenCalledTimes(1);
      expect(unsafeMock.mock.calls[0][0]).toMatch(/INSERT INTO jobs/i);
      expect(unsafeMock.mock.calls[0][1]).toEqual(['job-001', TEST_TENANT, 'processing', 50]);
    });

    it('no-op quando DB indisponível', async () => {
      getDbClientMock.mockReturnValueOnce(null);
      await expect(repo.upsert('job-001', TEST_TENANT, 'processing', 50)).resolves.toBeUndefined();
      expect(unsafeMock).not.toHaveBeenCalled();
    });

    it('loga warn e não lança em caso de erro SQL', async () => {
      unsafeMock.mockRejectedValueOnce(new Error('DB error'));
      await expect(repo.upsert('job-001', TEST_TENANT, 'pending', 0)).resolves.toBeUndefined();
    });
  });

  // ── complete ──────────────────────────────────────────────────────────────

  describe('complete', () => {
    it('executa UPDATE com result e sha256', async () => {
      unsafeMock.mockResolvedValueOnce([]);
      await repo.complete('job-001', TEST_TENANT, {
        url: '/dl/file.dxf',
        filename: 'file.dxf',
        artifactSha256: 'hash123',
      });
      expect(unsafeMock.mock.calls[0][0]).toMatch(/status = 'completed'/);
      expect(unsafeMock.mock.calls[0][1]).toContain('hash123');
      expect(unsafeMock.mock.calls[0][1]).toContain(TEST_TENANT);
    });

    it('usa null para sha256 quando não fornecido', async () => {
      unsafeMock.mockResolvedValueOnce([]);
      await repo.complete('job-001', TEST_TENANT, { url: '/dl/file.dxf', filename: 'file.dxf' });
      expect(unsafeMock.mock.calls[0][1]).toContain(null);
    });

    it('no-op quando DB indisponível', async () => {
      getDbClientMock.mockReturnValueOnce(null);
      await expect(
        repo.complete('job-001', TEST_TENANT, { url: '/dl/file.dxf', filename: 'file.dxf' }),
      ).resolves.toBeUndefined();
    });

    it('loga warn em caso de erro SQL', async () => {
      unsafeMock.mockRejectedValueOnce(new Error('DB error'));
      await expect(
        repo.complete('job-001', TEST_TENANT, { url: '/dl/file.dxf', filename: 'file.dxf' }),
      ).resolves.toBeUndefined();
    });
  });

  // ── fail ──────────────────────────────────────────────────────────────────

  describe('fail', () => {
    it('executa UPDATE para status failed', async () => {
      unsafeMock.mockResolvedValueOnce([]);
      await repo.fail('job-001', TEST_TENANT, 'timeout');
      expect(unsafeMock.mock.calls[0][0]).toMatch(/status = 'failed'/);
      expect(unsafeMock.mock.calls[0][1]).toEqual(['job-001', TEST_TENANT, 'timeout']);
    });

    it('no-op quando DB indisponível', async () => {
      getDbClientMock.mockReturnValueOnce(null);
      await expect(repo.fail('job-001', TEST_TENANT, 'err')).resolves.toBeUndefined();
    });

    it('loga warn em caso de erro SQL', async () => {
      unsafeMock.mockRejectedValueOnce(new Error('DB error'));
      await expect(repo.fail('job-001', TEST_TENANT, 'err')).resolves.toBeUndefined();
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('retorna JobRow mapeado quando encontrado', async () => {
      unsafeMock.mockResolvedValueOnce([
        makeRow({ status: 'completed', progress: 100 }),
      ]);
      const row = await repo.findById('job-001', TEST_TENANT);
      expect(row!.id).toBe('job-001');
      expect(row!.status).toBe('completed');
      expect(row!.progress).toBe(100);
      expect(row!.createdAt).toBeInstanceOf(Date);
    });

    it('retorna null quando não encontrado', async () => {
      unsafeMock.mockResolvedValueOnce([]);
      expect(await repo.findById('missing', TEST_TENANT)).toBeNull();
    });

    it('retorna null quando DB indisponível', async () => {
      getDbClientMock.mockReturnValueOnce(null);
      expect(await repo.findById('job-001', TEST_TENANT)).toBeNull();
    });

    it('mapeia result e error como null quando ausentes', async () => {
      unsafeMock.mockResolvedValueOnce([makeRow()]);
      const row = await repo.findById('job-001', TEST_TENANT);
      expect(row!.result).toBeNull();
      expect(row!.error).toBeNull();
    });
  });

  // ── findRecent ────────────────────────────────────────────────────────────

  describe('findRecent', () => {
    it('retorna array de JobRows', async () => {
      unsafeMock.mockResolvedValueOnce([makeRow(), makeRow({ id: 'job-002' })]);
      const rows = await repo.findRecent(10, TEST_TENANT);
      expect(rows).toHaveLength(2);
      expect(rows[0].id).toBe('job-001');
    });

    it('retorna array vazio quando DB indisponível', async () => {
      getDbClientMock.mockReturnValueOnce(null);
      const rows = await repo.findRecent(10, TEST_TENANT);
      expect(rows).toEqual([]);
    });

    it('retorna array vazio quando tabela está vazia', async () => {
      unsafeMock.mockResolvedValueOnce([]);
      const rows = await repo.findRecent(10, TEST_TENANT);
      expect(rows).toEqual([]);
    });
  });

  // ── deleteOld ─────────────────────────────────────────────────────────────

  describe('deleteOld', () => {
    it('retorna contagem de linhas deletadas', async () => {
      unsafeMock.mockResolvedValueOnce([{ cnt: '7' }]);
      const count = await repo.deleteOld(86400000, 604800000);
      expect(count).toBe(7);
    });

    it('retorna 0 quando nenhuma linha foi deletada', async () => {
      unsafeMock.mockResolvedValueOnce([{ cnt: '0' }]);
      const count = await repo.deleteOld(86400000, 604800000);
      expect(count).toBe(0);
    });

    it('retorna 0 quando DB indisponível', async () => {
      getDbClientMock.mockReturnValueOnce(null);
      const count = await repo.deleteOld(86400000, 604800000);
      expect(count).toBe(0);
    });

    it('retorna 0 quando resultado é undefined', async () => {
      unsafeMock.mockResolvedValueOnce([{}]);
      const count = await repo.deleteOld(86400000, 604800000);
      expect(count).toBe(0);
    });
  });
});
