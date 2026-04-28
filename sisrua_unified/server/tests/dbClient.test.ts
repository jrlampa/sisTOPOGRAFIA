/**
 * dbClient.test.ts
 * Testa todas as funções do cliente PostgreSQL singleton.
 */
import { jest } from '@jest/globals';

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('dbClient', () => {
  const DB_URL = 'postgresql://user:pass@localhost:5432/testdb';

  let mockClientInstance: any;
  let mockPostgres: jest.Mock;

  beforeEach(() => {
    jest.resetModules();

    mockClientInstance = Object.assign(
      jest.fn().mockResolvedValue([{ '?column?': 1 }]) as any,
      {
        unsafe: jest.fn().mockResolvedValue([]),
        end: jest.fn().mockResolvedValue(undefined),
      },
    );
    mockPostgres = jest.fn(() => mockClientInstance);

    jest.doMock('postgres', () => ({ __esModule: true, default: mockPostgres }));
    jest.doMock('../config', () => ({
      config: { DATABASE_URL: DB_URL, NODE_ENV: 'test' },
    }));
  });

  async function loadModule() {
    return import('../repositories/dbClient.js') as Promise<
      typeof import('../repositories/dbClient')
    >;
  }

  // ── initDbClient ─────────────────────────────────────────────────────────

  it('initDbClient: inicializa o pool e sinaliza disponível', async () => {
    const { initDbClient, isDbAvailable, getDbClient } = await loadModule();
    await initDbClient();
    expect(isDbAvailable()).toBe(true);
    expect(getDbClient()).not.toBeNull();
  });

  it('initDbClient: não reinicializa se já existir cliente', async () => {
    const { initDbClient } = await loadModule();
    await initDbClient();
    await initDbClient(); // segunda chamada deve ser no-op
    expect(mockPostgres).toHaveBeenCalledTimes(1);
  });

  it('initDbClient: não inicializa sem DATABASE_URL', async () => {
    jest.doMock('../config', () => ({
      config: { DATABASE_URL: '', NODE_ENV: 'test' },
    }));
    const { initDbClient, isDbAvailable } = await loadModule();
    await initDbClient();
    expect(isDbAvailable()).toBe(false);
  });

  it('initDbClient: trata falha na conexão (warm-up rejeita)', async () => {
    const originalSetTimeout = global.setTimeout;
    (global as any).setTimeout = (cb: any) => cb();
    mockClientInstance.mockRejectedValue(new Error('conn refused'));
    const { initDbClient, isDbAvailable } = await loadModule();
    await initDbClient();
    expect(isDbAvailable()).toBe(false);
    global.setTimeout = originalSetTimeout;
  });

  it('initDbClient: NODE_ENV production usa ssl=require', async () => {
    jest.doMock('../config', () => ({
      config: { DATABASE_URL: DB_URL, NODE_ENV: 'production' },
    }));
    const { initDbClient } = await loadModule();
    await initDbClient();
    expect(mockPostgres).toHaveBeenCalledWith(
      DB_URL,
      expect.objectContaining({ ssl: 'require' }),
    );
  });

  it('initDbClient: NODE_ENV test usa ssl=false', async () => {
    const { initDbClient } = await loadModule();
    await initDbClient();
    expect(mockPostgres).toHaveBeenCalledWith(
      DB_URL,
      expect.objectContaining({ ssl: false }),
    );
  });

  // ── getDbClient ───────────────────────────────────────────────────────────

  it('getDbClient: retorna null quando DB indisponível', async () => {
    const { getDbClient } = await loadModule();
    expect(getDbClient()).toBeNull();
  });

  it('getDbClient(required=true): lança quando DB indisponível', async () => {
    const { getDbClient } = await loadModule();
    expect(() => getDbClient(true)).toThrow(/unavailable/i);
  });

  it('getDbClient(required=true): retorna cliente quando disponível', async () => {
    const { initDbClient, getDbClient } = await loadModule();
    await initDbClient();
    expect(getDbClient(true)).not.toBeNull();
  });

  // ── isDbAvailable ─────────────────────────────────────────────────────────

  it('isDbAvailable: false antes de inicializar', async () => {
    const { isDbAvailable } = await loadModule();
    expect(isDbAvailable()).toBe(false);
  });

  it('isDbAvailable: true após init bem-sucedido', async () => {
    const { initDbClient, isDbAvailable } = await loadModule();
    await initDbClient();
    expect(isDbAvailable()).toBe(true);
  });

  // ── closeDbClient ─────────────────────────────────────────────────────────

  it('closeDbClient: fecha o pool e marca indisponível', async () => {
    const { initDbClient, closeDbClient, isDbAvailable, getDbClient } =
      await loadModule();
    await initDbClient();
    await closeDbClient();
    expect(mockClientInstance.end).toHaveBeenCalled();
    expect(isDbAvailable()).toBe(false);
    expect(getDbClient()).toBeNull();
  });

  it('closeDbClient: no-op quando sem cliente', async () => {
    const { closeDbClient } = await loadModule();
    await expect(closeDbClient()).resolves.toBeUndefined();
  });

  // ── pingDb ────────────────────────────────────────────────────────────────

  it('pingDb: retorna false sem cliente inicializado', async () => {
    const { pingDb } = await loadModule();
    expect(await pingDb()).toBe(false);
  });

  it('pingDb: retorna true após SELECT 1 bem-sucedido', async () => {
    const { initDbClient, pingDb } = await loadModule();
    await initDbClient();
    mockClientInstance.mockResolvedValueOnce([{ '?column?': 1 }]);
    expect(await pingDb()).toBe(true);
  });

  it('pingDb: retorna false e marca indisponível após falha', async () => {
    const { initDbClient, pingDb, isDbAvailable } = await loadModule();
    await initDbClient();
    mockClientInstance.mockRejectedValueOnce(new Error('timeout'));
    expect(await pingDb()).toBe(false);
    expect(isDbAvailable()).toBe(false);
  });
});
