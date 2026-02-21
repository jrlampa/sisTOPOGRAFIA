import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchOsmData } from '../../src/services/osmService';
import Logger from '../../src/utils/logger';

describe('osmService — fetchOsmData', () => {
  const lat = -22.15018;
  const lng = -42.92185;
  const radius = 500;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.spyOn(Logger, 'debug').mockImplementation(() => {});
    vi.spyOn(Logger, 'info').mockImplementation(() => {});
    vi.spyOn(Logger, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('retorna elementos OSM quando o primeiro endpoint responde ok', async () => {
    const mockElements = [
      { type: 'node', id: 1, lat: -22.15, lon: -42.92, tags: { name: 'Marco A' } }
    ];

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ elements: mockElements })
    }) as any;

    const result = await fetchOsmData(lat, lng, radius);

    expect(result).toEqual(mockElements);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('1 OSM elements'));
  });

  it('tenta próximo endpoint quando o primeiro falha (fallback)', async () => {
    const mockElements = [{ type: 'node', id: 2, lat, lon: lng, tags: {} }];

    // First endpoint returns HTTP error, second succeeds
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests' })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ elements: mockElements })
      }) as any;

    const result = await fetchOsmData(lat, lng, radius);

    expect(result).toEqual(mockElements);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(Logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Overpass endpoint failed'),
      expect.any(String)
    );
  });

  it('lança erro quando todos os endpoints falham', async () => {
    // All endpoints return errors
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable'
    }) as any;

    await expect(fetchOsmData(lat, lng, radius)).rejects.toThrow();
    expect(Logger.error).toHaveBeenCalledWith('Failed to fetch OSM data', expect.anything());
  });

  it('lança erro quando fetch lança exceção (network error)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any;

    await expect(fetchOsmData(lat, lng, radius)).rejects.toThrow();
    expect(Logger.error).toHaveBeenCalledWith('Failed to fetch OSM data', expect.anything());
  });

  it('inclui a query Overpass correta no body da requisição', async () => {
    const mockElements = [{ type: 'node', id: 3, lat, lon: lng, tags: {} }];

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ elements: mockElements })
    }) as any;

    await fetchOsmData(lat, lng, radius);

    const callBody = (global.fetch as any).mock.calls[0][1].body as string;
    // The body is URL-encoded: decode to verify content
    const decoded = decodeURIComponent(callBody.replace('data=', ''));
    expect(decoded).toContain(`around:${radius},${lat},${lng}`);
    expect(decoded).toContain('[out:json]');
  });

  it('captura erro não-Error do endpoint e usa String() (branch lines 52-54)', async () => {
    // Simulate a non-Error being thrown from fetch (e.g., AbortError string)
    global.fetch = vi.fn()
      .mockRejectedValueOnce('timeout string error') // Non-Error on first endpoint
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ elements: [] })
      }) as any;

    // Should still succeed via second endpoint
    const result = await fetchOsmData(lat, lng, radius);
    expect(result).toEqual([]);
    expect(Logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Overpass endpoint failed'),
      'timeout string error'
    );
  });
});
