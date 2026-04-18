/**
 * dxfTaskRepository.test.ts
 * Testa todas as operações SQL do repositório dxf_tasks.
 */
import { jest } from '@jest/globals';

const unsafeMock = jest.fn();

jest.mock('../repositories/dbClient', () => ({
  getDbClient: jest.fn(() => ({ unsafe: unsafeMock })),
}));

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { PostgresDxfTaskRepository } from '../repositories/dxfTaskRepository';
import { getDbClient } from '../repositories/dbClient';

const getDbClientMock = getDbClient as jest.Mock;

const PAYLOAD = { lat: -23.5, lon: -46.6, radius: 500 };
const NOW = new Date('2025-01-01T12:00:00Z');

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    task_id: 'task-abc',
    status: 'queued',
    payload: PAYLOAD,
    attempts: 0,
    idempotency_key: 'idem-1',
    error: null,
    artifact_sha256: null,
    created_at: NOW,
    updated_at: NOW,
    started_at: null,
    finished_at: null,
    ...overrides,
  };
}

describe('PostgresDxfTaskRepository', () => {
  let repo: PostgresDxfTaskRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    getDbClientMock.mockReturnValue({ unsafe: unsafeMock });
    repo = new PostgresDxfTaskRepository();
  });

  // ── enqueue ───────────────────────────────────────────────────────────────

  describe('enqueue', () => {
    it('retorna true quando INSERT insere nova linha', async () => {
      unsafeMock.mockResolvedValueOnce([{ task_id: 'task-abc' }]);
      const result = await repo.enqueue('task-abc', PAYLOAD, 'idem-1');
      expect(result).toBe(true);
      expect(unsafeMock).toHaveBeenCalledTimes(1);
      expect(unsafeMock.mock.calls[0][0]).toMatch(/INSERT INTO dxf_tasks/i);
    });

    it('retorna false quando ON CONFLICT não insere (resultado vazio)', async () => {
      unsafeMock.mockResolvedValueOnce([]);
      const result = await repo.enqueue('task-abc', PAYLOAD, 'idem-1');
      expect(result).toBe(false);
    });

    it('retorna false quando DB indisponível (getDbClient retorna null)', async () => {
      getDbClientMock.mockReturnValueOnce(null);
      const result = await repo.enqueue('task-abc', PAYLOAD);
      expect(result).toBe(false);
    });

    it('retorna false e loga warn em caso de erro SQL', async () => {
      unsafeMock.mockRejectedValueOnce(new Error('DB error'));
      const result = await repo.enqueue('task-abc', PAYLOAD);
      expect(result).toBe(false);
    });

    it('funciona sem idempotency_key (usa null)', async () => {
      unsafeMock.mockResolvedValueOnce([{ task_id: 'task-abc' }]);
      const result = await repo.enqueue('task-abc', PAYLOAD);
      expect(result).toBe(true);
      expect(unsafeMock.mock.calls[0][1]).toContain(null); // third param = null
    });
  });

  // ── dequeue ───────────────────────────────────────────────────────────────

  describe('dequeue', () => {
    it('retorna DxfTaskRow mapeado quando há linha', async () => {
      unsafeMock.mockResolvedValueOnce([makeRow()]);
      const row = await repo.dequeue();
      expect(row).not.toBeNull();
      expect(row!.taskId).toBe('task-abc');
      expect(row!.status).toBe('queued');
      expect(row!.attempts).toBe(0);
    });

    it('retorna null quando fila está vazia', async () => {
      unsafeMock.mockResolvedValueOnce([]);
      const row = await repo.dequeue();
      expect(row).toBeNull();
    });

    it('retorna null quando DB indisponível', async () => {
      getDbClientMock.mockReturnValueOnce(null);
      const row = await repo.dequeue();
      expect(row).toBeNull();
    });

    it('mapeia payload string como JSON', async () => {
      unsafeMock.mockResolvedValueOnce([makeRow({ payload: JSON.stringify(PAYLOAD) })]);
      const row = await repo.dequeue();
      expect(row!.payload.lat).toBe(-23.5);
    });

    it('mapeia datas opcionais corretamente', async () => {
      unsafeMock.mockResolvedValueOnce([
        makeRow({ started_at: NOW, finished_at: NOW }),
      ]);
      const row = await repo.dequeue();
      expect(row!.startedAt).toBeInstanceOf(Date);
      expect(row!.finishedAt).toBeInstanceOf(Date);
    });
  });

  // ── setProcessing ─────────────────────────────────────────────────────────

  describe('setProcessing', () => {
    it('executa UPDATE quando DB disponível', async () => {
      unsafeMock.mockResolvedValueOnce([]);
      await repo.setProcessing('task-abc');
      expect(unsafeMock).toHaveBeenCalledTimes(1);
      expect(unsafeMock.mock.calls[0][0]).toMatch(/status = 'processing'/);
    });

    it('no-op quando DB indisponível', async () => {
      getDbClientMock.mockReturnValueOnce(null);
      await expect(repo.setProcessing('task-abc')).resolves.toBeUndefined();
      expect(unsafeMock).not.toHaveBeenCalled();
    });
  });

  // ── setCompleted ──────────────────────────────────────────────────────────

  describe('setCompleted', () => {
    it('executa UPDATE com sha256 quando fornecido', async () => {
      unsafeMock.mockResolvedValueOnce([]);
      await repo.setCompleted('task-abc', 'abc123hash');
      expect(unsafeMock.mock.calls[0][1]).toContain('abc123hash');
    });

    it('usa null para sha256 quando não fornecido', async () => {
      unsafeMock.mockResolvedValueOnce([]);
      await repo.setCompleted('task-abc');
      expect(unsafeMock.mock.calls[0][1]).toContain(null);
    });

    it('no-op quando DB indisponível', async () => {
      getDbClientMock.mockReturnValueOnce(null);
      await expect(repo.setCompleted('task-abc')).resolves.toBeUndefined();
    });
  });

  // ── setFailed ─────────────────────────────────────────────────────────────

  describe('setFailed', () => {
    it('executa UPDATE com mensagem de erro', async () => {
      unsafeMock.mockResolvedValueOnce([]);
      await repo.setFailed('task-abc', 'timeout error');
      expect(unsafeMock.mock.calls[0][0]).toMatch(/status = 'failed'/);
      expect(unsafeMock.mock.calls[0][1]).toContain('timeout error');
    });

    it('no-op quando DB indisponível', async () => {
      getDbClientMock.mockReturnValueOnce(null);
      await expect(repo.setFailed('task-abc', 'err')).resolves.toBeUndefined();
    });
  });

  // ── findByIdempotencyKey ──────────────────────────────────────────────────

  describe('findByIdempotencyKey', () => {
    it('retorna row mapeado quando encontrado', async () => {
      unsafeMock.mockResolvedValueOnce([makeRow()]);
      const row = await repo.findByIdempotencyKey('idem-1');
      expect(row!.idempotencyKey).toBe('idem-1');
    });

    it('retorna null quando não encontrado', async () => {
      unsafeMock.mockResolvedValueOnce([]);
      const row = await repo.findByIdempotencyKey('missing');
      expect(row).toBeNull();
    });

    it('retorna null quando DB indisponível', async () => {
      getDbClientMock.mockReturnValueOnce(null);
      const row = await repo.findByIdempotencyKey('idem-1');
      expect(row).toBeNull();
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('retorna row mapeado quando encontrado', async () => {
      unsafeMock.mockResolvedValueOnce([makeRow({ artifact_sha256: 'sha-xyz' })]);
      const row = await repo.findById('task-abc');
      expect(row!.taskId).toBe('task-abc');
      expect(row!.artifactSha256).toBe('sha-xyz');
    });

    it('retorna null quando não encontrado', async () => {
      unsafeMock.mockResolvedValueOnce([]);
      const row = await repo.findById('missing');
      expect(row).toBeNull();
    });

    it('retorna null quando DB indisponível', async () => {
      getDbClientMock.mockReturnValueOnce(null);
      const row = await repo.findById('task-abc');
      expect(row).toBeNull();
    });
  });
});
