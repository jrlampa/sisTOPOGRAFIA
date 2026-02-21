import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateDXF, getDxfJobStatus, calculateStats } from '../../src/services/dxfService';

describe('dxfService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ── generateDXF ──────────────────────────────────────────────────────────

  describe('generateDXF', () => {
    const lat = -22.15018;
    const lon = -42.92185;
    const radius = 500;

    it('retorna resposta "queued" quando servidor enfileira o job', async () => {
      const queuedResponse = { status: 'queued', jobId: 'abc-123' };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => queuedResponse
      }) as any;

      const result = await generateDXF(lat, lon, radius, 'circle', [], {});

      expect(result).toEqual(queuedResponse);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const call = (global.fetch as any).mock.calls[0];
      expect(call[0]).toContain('/dxf');
      expect(call[1].method).toBe('POST');
    });

    it('retorna resposta "success" quando DXF está em cache', async () => {
      const cachedResponse = { status: 'success', url: '/downloads/test.dxf', message: 'cached' };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => cachedResponse
      }) as any;

      const result = await generateDXF(lat, lon, radius, 'polygon', [[lat, lon]], { buildings: true }, 'utm', false);

      expect(result).toEqual(cachedResponse);
    });

    it('lança erro quando servidor retorna HTTP não-ok', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ details: 'Coordenada fora do Brasil' })
      }) as any;

      await expect(generateDXF(lat, lon, radius, 'circle', [], {})).rejects.toThrow('Coordenada fora do Brasil');
    });

    it('lança erro genérico quando corpo do erro não tem details', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Internal server error' })
      }) as any;

      await expect(generateDXF(lat, lon, radius, 'circle', [], {})).rejects.toThrow('Backend generation failed');
    });
  });

  // ── getDxfJobStatus ──────────────────────────────────────────────────────

  describe('getDxfJobStatus', () => {
    it('retorna status do job quando servidor responde ok', async () => {
      const jobStatus = {
        id: 'abc-123',
        status: 'completed',
        progress: 100,
        result: { url: '/downloads/test.dxf', filename: 'test.dxf' },
        error: null
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => jobStatus
      }) as any;

      const result = await getDxfJobStatus('abc-123');

      expect(result).toEqual(jobStatus);
      const callUrl = (global.fetch as any).mock.calls[0][0] as string;
      expect(callUrl).toContain('/jobs/abc-123');
    });

    it('lança erro quando servidor retorna HTTP não-ok', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Job not found' })
      }) as any;

      await expect(getDxfJobStatus('unknown-id')).rejects.toThrow('Job not found');
    });

    it('usa details quando disponível no corpo do erro', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ details: 'Detalhes do erro' })
      }) as any;

      await expect(getDxfJobStatus('bad-id')).rejects.toThrow('Detalhes do erro');
    });
  });

  // ── calculateStats ────────────────────────────────────────────────────────

  describe('calculateStats', () => {
    it('retorna zeros para array vazio', () => {
      const stats = calculateStats([]);

      expect(stats.totalBuildings).toBe(0);
      expect(stats.totalRoads).toBe(0);
      expect(stats.totalNature).toBe(0);
      expect(stats.avgHeight).toBe(0);
      expect(stats.maxHeight).toBe(0);
    });

    it('conta edificações corretamente', () => {
      const elements = [
        { type: 'way', id: 1, tags: { building: 'yes' } },
        { type: 'way', id: 2, tags: { building: 'residential' } },
        { type: 'way', id: 3, tags: { highway: 'residential' } }
      ] as any[];

      const stats = calculateStats(elements);
      expect(stats.totalBuildings).toBe(2);
      expect(stats.totalRoads).toBe(1);
    });

    it('conta natureza e uso do solo (landuse)', () => {
      const elements = [
        { type: 'way', id: 1, tags: { natural: 'tree' } },
        { type: 'way', id: 2, tags: { landuse: 'forest' } },
        { type: 'way', id: 3, tags: { natural: 'water' } }
      ] as any[];

      const stats = calculateStats(elements);
      expect(stats.totalNature).toBe(3);
    });

    it('calcula altura media e maxima usando tag "height"', () => {
      const elements = [
        { type: 'way', id: 1, tags: { building: 'yes', height: '10' } },
        { type: 'way', id: 2, tags: { building: 'yes', height: '20' } }
      ] as any[];

      const stats = calculateStats(elements);
      expect(stats.maxHeight).toBe(20);
      expect(stats.avgHeight).toBeCloseTo(15, 1);
    });

    it('usa building:levels como fallback para altura (×3.2m por andar)', () => {
      const elements = [
        { type: 'way', id: 1, tags: { building: 'yes', 'building:levels': '5' } }
      ] as any[];

      const stats = calculateStats(elements);
      // 5 levels × 3.2m = 16m
      expect(stats.maxHeight).toBeCloseTo(16, 1);
      expect(stats.avgHeight).toBeCloseTo(16, 1);
    });

    it('ignora altura zero ou inválida', () => {
      const elements = [
        { type: 'way', id: 1, tags: { building: 'yes', height: '0' } },
        { type: 'way', id: 2, tags: { building: 'yes', height: 'N/A' } }
      ] as any[];

      const stats = calculateStats(elements);
      expect(stats.avgHeight).toBe(0);
      expect(stats.maxHeight).toBe(0);
    });

    it('retorna campos fixos: avgSlope, avgSolar, etc.', () => {
      const stats = calculateStats([]);
      expect(stats.avgSlope).toBe(8.4);
      expect(stats.avgSolar).toBe(0.72);
      expect(stats.maxFlow).toBe(0);
      expect(stats.cutVolume).toBe(0);
      expect(stats.fillVolume).toBe(0);
    });
  });
});
