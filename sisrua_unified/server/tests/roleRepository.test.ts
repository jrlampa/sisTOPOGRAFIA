import { vi } from "vitest";
/**
 * roleRepository.test.ts
 * Testa todas as operações SQL do repositório user_roles.
 */

const unsafeMock = vi.fn();

vi.mock('../repositories/dbClient', () => ({
  getDbClient: vi.fn(() => ({ unsafe: unsafeMock })),
}));

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { PostgresRoleRepository } from '../repositories/roleRepository';
import { getDbClient } from '../repositories/dbClient';

const getDbClientMock = getDbClient as vi.Mock;

const NOW = new Date('2025-01-01T08:00:00Z');

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    user_id: 'user-xyz',
    role: 'admin',
    assigned_by: 'superuser',
    reason: 'bootstrap',
    assigned_at: NOW,
    last_updated: NOW,
    ...overrides,
  };
}

describe('PostgresRoleRepository', () => {
  let repo: PostgresRoleRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    getDbClientMock.mockReturnValue({ unsafe: unsafeMock });
    repo = new PostgresRoleRepository();
  });

  // ── findByUserId ──────────────────────────────────────────────────────────

  describe('findByUserId', () => {
    it('retorna UserRoleRow mapeado quando encontrado', async () => {
      unsafeMock.mockResolvedValueOnce([makeRow()]);
      const row = await repo.findByUserId('user-xyz');
      expect(row!.userId).toBe('user-xyz');
      expect(row!.role).toBe('admin');
      expect(row!.assignedBy).toBe('superuser');
      expect(row!.reason).toBe('bootstrap');
      expect(row!.assignedAt).toBeInstanceOf(Date);
      expect(row!.lastUpdated).toBeInstanceOf(Date);
    });

    it('retorna null quando não encontrado', async () => {
      unsafeMock.mockResolvedValueOnce([]);
      expect(await repo.findByUserId('missing')).toBeNull();
    });

    it('retorna null quando DB indisponível', async () => {
      getDbClientMock.mockReturnValueOnce(null);
      expect(await repo.findByUserId('user-xyz')).toBeNull();
    });

    it('retorna null e loga warn em caso de erro SQL', async () => {
      unsafeMock.mockRejectedValueOnce(new Error('DB error'));
      expect(await repo.findByUserId('user-xyz')).toBeNull();
    });

    it('mapeia assigned_by e reason nulos corretamente', async () => {
      unsafeMock.mockResolvedValueOnce([
        makeRow({ assigned_by: null, reason: null }),
      ]);
      const row = await repo.findByUserId('user-xyz');
      expect(row!.assignedBy).toBeNull();
      expect(row!.reason).toBeNull();
    });
  });

  // ── findByRole ────────────────────────────────────────────────────────────

  describe('findByRole', () => {
    it('retorna array de rows com o role correto', async () => {
      unsafeMock.mockResolvedValueOnce([makeRow(), makeRow({ user_id: 'user-2' })]);
      const rows = await repo.findByRole('admin');
      expect(rows).toHaveLength(2);
      expect(rows[0].role).toBe('admin');
    });

    it('retorna array vazio quando não há usuários com o role', async () => {
      unsafeMock.mockResolvedValueOnce([]);
      expect(await repo.findByRole('guest')).toEqual([]);
    });

    it('retorna array vazio quando DB indisponível', async () => {
      getDbClientMock.mockReturnValueOnce(null);
      expect(await repo.findByRole('admin')).toEqual([]);
    });

    it('retorna array vazio e loga warn em caso de erro SQL', async () => {
      unsafeMock.mockRejectedValueOnce(new Error('DB error'));
      expect(await repo.findByRole('admin')).toEqual([]);
    });
  });

  // ── countByRole ───────────────────────────────────────────────────────────

  describe('countByRole', () => {
    it('retorna contagem correta por role', async () => {
      unsafeMock.mockResolvedValueOnce([
        { role: 'admin', cnt: '3' },
        { role: 'viewer', cnt: '10' },
      ]);
      const counts = await repo.countByRole();
      expect(counts.admin).toBe(3);
      expect(counts.viewer).toBe(10);
      expect(counts.technician).toBe(0);
      expect(counts.guest).toBe(0);
    });

    it('retorna defaults quando DB indisponível', async () => {
      getDbClientMock.mockReturnValueOnce(null);
      const counts = await repo.countByRole();
      expect(counts).toEqual({ admin: 0, technician: 0, viewer: 0, guest: 0 });
    });

    it('retorna defaults e loga warn em caso de erro SQL', async () => {
      unsafeMock.mockRejectedValueOnce(new Error('DB error'));
      const counts = await repo.countByRole();
      expect(counts).toEqual({ admin: 0, technician: 0, viewer: 0, guest: 0 });
    });

    it('retorna defaults quando resultado está vazio', async () => {
      unsafeMock.mockResolvedValueOnce([]);
      const counts = await repo.countByRole();
      expect(counts).toEqual({ admin: 0, technician: 0, viewer: 0, guest: 0 });
    });
  });

  // ── upsert ────────────────────────────────────────────────────────────────

  describe('upsert', () => {
    it('executa INSERT ON CONFLICT UPDATE', async () => {
      unsafeMock.mockResolvedValueOnce([]);
      await repo.upsert('user-xyz', 'technician', 'admin-1', 'promoção');
      expect(unsafeMock.mock.calls[0][0]).toMatch(/INSERT INTO user_roles/i);
      expect(unsafeMock.mock.calls[0][1]).toEqual([
        'user-xyz',
        'technician',
        'admin-1',
        'promoção',
      ]);
    });

    it('usa null para reason quando não fornecido', async () => {
      unsafeMock.mockResolvedValueOnce([]);
      await repo.upsert('user-xyz', 'viewer', 'admin-1');
      expect(unsafeMock.mock.calls[0][1]).toContain(null);
    });

    it('no-op quando DB indisponível', async () => {
      getDbClientMock.mockReturnValueOnce(null);
      await expect(
        repo.upsert('user-xyz', 'admin', 'system'),
      ).resolves.toBeUndefined();
      expect(unsafeMock).not.toHaveBeenCalled();
    });

    it('loga warn em caso de erro SQL', async () => {
      unsafeMock.mockRejectedValueOnce(new Error('DB error'));
      await expect(
        repo.upsert('user-xyz', 'admin', 'system'),
      ).resolves.toBeUndefined();
    });
  });
});

