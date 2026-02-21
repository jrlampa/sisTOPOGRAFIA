import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchElevationGrid, fetchElevationProfile } from '../../src/services/elevationService';
import Logger from '../../src/utils/logger';

describe('fetchElevationGrid', () => {
  const center = { lat: -22.15018, lng: -42.92185 };
  const radius = 100;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.spyOn(Logger, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger, 'error').mockImplementation(() => {});
    vi.spyOn(Logger, 'info').mockImplementation(() => {});
    vi.spyOn(Logger, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('clamps grid size to avoid oversized Open-Meteo requests', async () => {
    const elevationCount = 81; // 9x9 grid after clamping
    const mockJson = { elevation: Array(elevationCount).fill(10) };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson)
    }) as any;

    await fetchElevationGrid(center, radius, 12);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const url = (global.fetch as any).mock.calls[0][0] as string;
    const params = new URL(url).searchParams;
    const lats = params.get('latitude')?.split(',') ?? [];
    const lngs = params.get('longitude')?.split(',') ?? [];

    expect(lats.length).toBe(elevationCount);
    expect(lngs.length).toBe(elevationCount);
    expect(Logger.warn).toHaveBeenCalled();
  });

  it('retorna grade 2D correta quando gridSize ≤ MAX_GRID_SIZE (sem clamping)', async () => {
    const gridSize = 3; // 3x3 = 9 points, well below 9 limit
    const elevationCount = gridSize * gridSize;
    const mockJson = { elevation: Array(elevationCount).fill(50) };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson)
    }) as any;

    const grid = await fetchElevationGrid(center, radius, gridSize);

    // No clamping warning
    expect(Logger.warn).not.toHaveBeenCalled();
    // Grid has correct shape
    expect(grid).toHaveLength(gridSize);
    expect(grid[0]).toHaveLength(gridSize);
    // Each point has lat, lng, elevation
    expect(grid[0][0]).toHaveProperty('lat');
    expect(grid[0][0]).toHaveProperty('lng');
    expect(grid[0][0].elevation).toBe(50);
    // Success log
    expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('successfully'));
  });

  it('retorna grade plana (elevation=0) quando HTTP response não é ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({})
    }) as any;

    const gridSize = 3;
    const grid = await fetchElevationGrid(center, radius, gridSize);

    // Should fall through to catch → flat grid
    expect(Logger.error).toHaveBeenCalledWith('Elevation API Error', expect.anything());
    expect(grid).toHaveLength(gridSize);
    expect(grid[0][0].elevation).toBe(0);
  });

  it('retorna grade plana quando dados de elevação são inválidos (tamanho errado)', async () => {
    const gridSize = 3;
    // Return fewer points than expected
    const mockJson = { elevation: [10, 20] }; // Only 2 points, not 9

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson)
    }) as any;

    const grid = await fetchElevationGrid(center, radius, gridSize);

    expect(Logger.error).toHaveBeenCalledWith('Elevation API Error', expect.anything());
    expect(grid).toHaveLength(gridSize);
    expect(grid[0][0].elevation).toBe(0);
  });

  it('retorna grade plana quando fetch lança exceção', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any;

    const gridSize = 3;
    const grid = await fetchElevationGrid(center, radius, gridSize);

    expect(Logger.error).toHaveBeenCalledWith('Elevation API Error', expect.anything());
    expect(grid).toHaveLength(gridSize);
    expect(grid.every(row => row.every(pt => pt.elevation === 0))).toBe(true);
  });
});

describe('fetchElevationProfile', () => {
  const start = { lat: -22.15018, lng: -42.92185 };
  const end = { lat: -22.16, lng: -42.93 };
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.spyOn(Logger, 'error').mockImplementation(() => {});
    vi.spyOn(Logger, 'info').mockImplementation(() => {});
    vi.spyOn(Logger, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('retorna perfil de elevação com sucesso', async () => {
    const mockProfile = [
      { dist: 0, elev: 100 },
      { dist: 50, elev: 120 },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ profile: mockProfile })
    }) as any;

    const result = await fetchElevationProfile(start, end);

    expect(result).toEqual(mockProfile);
    expect(Logger.info).toHaveBeenCalledWith('Elevation profile fetched successfully');
    // Verify request was made to the correct endpoint
    const url = (global.fetch as any).mock.calls[0][0] as string;
    expect(url).toBe('/api/elevation/profile');
  });

  it('retorna [] quando HTTP response não é ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({})
    }) as any;

    const result = await fetchElevationProfile(start, end);

    expect(result).toEqual([]);
    expect(Logger.error).toHaveBeenCalledWith('Error fetching elevation profile:', expect.anything());
  });

  it('retorna [] quando fetch lança exceção', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network failure')) as any;

    const result = await fetchElevationProfile(start, end);

    expect(result).toEqual([]);
    expect(Logger.error).toHaveBeenCalledWith('Error fetching elevation profile:', expect.anything());
  });
});
