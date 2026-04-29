import { jest } from '@jest/globals';
import { DbMaintenanceService } from '../services/dbMaintenanceService.js';
import { config } from '../config.js';

// Prefix with 'mock' so Jest hoisting allows access
const mockUnsafe = jest.fn();
const mockSql = Object.assign(
  (query: any) => Promise.resolve([]),
  {
    unsafe: mockUnsafe,
    end: jest.fn().mockResolvedValue(undefined)
  }
);

jest.mock('postgres', () => {
  return () => mockSql;
});

describe('DbMaintenanceService', () => {
  const originalDbUrl = config.DATABASE_URL;

  beforeEach(() => {
    config.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
    jest.clearAllMocks();
    // Reset singleton internal state
    (DbMaintenanceService as any).sql = null;
  });

  afterAll(() => {
    config.DATABASE_URL = originalDbUrl;
  });

  describe('runVacuumAnalyze', () => {
    it('deve executar VACUUM ANALYZE nas tabelas com sucesso', async () => {
      mockUnsafe.mockResolvedValue([]);
      
      const tables = ['test_table'];
      const result = await DbMaintenanceService.runVacuumAnalyze(tables);

      expect(result.success).toBe(true);
      expect(result.results[0]).toContain('SUCCESS');
      expect(mockUnsafe).toHaveBeenCalledWith(expect.stringContaining('VACUUM ANALYZE public.test_table'));
    });

    it('deve capturar falhas individuais por tabela', async () => {
      mockUnsafe.mockRejectedValue(new Error('Permission Denied'));

      const result = await DbMaintenanceService.runVacuumAnalyze(['restricted_table']);

      expect(result.success).toBe(false);
      expect(result.results[0]).toContain('FAILED');
      expect(result.results[0]).toContain('Permission Denied');
    });

    it('deve falhar se DATABASE_URL não estiver configurada', async () => {
      config.DATABASE_URL = "";
      // @ts-ignore
      DbMaintenanceService.sql = null;
      await expect(DbMaintenanceService.runVacuumAnalyze()).rejects.toThrow('DATABASE_URL not configured');
    });
  });

  describe('getHealthStats', () => {
    it('deve retornar estatísticas de saúde chamando a função no banco', async () => {
      const mockStats = [{ bloat_ratio: 0.1 }];
      mockUnsafe.mockResolvedValue(mockStats);

      const stats = await DbMaintenanceService.getHealthStats();

      expect(stats).toEqual(mockStats);
      expect(mockUnsafe).toHaveBeenCalledWith("SELECT * FROM private.db_health_report()");
    });

    it('deve retornar null em caso de erro na query', async () => {
      mockUnsafe.mockRejectedValue(new Error('Query Timeout'));
      const stats = await DbMaintenanceService.getHealthStats();
      expect(stats).toBeNull();
    });
  });
});
