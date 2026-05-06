import { vi } from "vitest";
import express from 'express';
import request from 'supertest';

vi.mock('../services/elevationService', () => ({
  ElevationService: {
    getElevationAt: vi.fn(),
    getElevationProfile: vi.fn(),
  },
}));

vi.mock('../services/topodataService', () => ({
  TopodataService: {
    isWithinBrazil: vi.fn(() => true),
    getCacheStats: vi.fn(() => ({ hits: 0, misses: 0 })),
    clearCache: vi.fn(),
    getElevation: vi.fn(),
  },
}));

describe('elevationRoutes stats radius validation', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 400 for out-of-range radius on /stats', async () => {
    const { default: elevationRoutes } = await import('../routes/elevationRoutes');
    const app = express();
    app.use('/api/elevation', elevationRoutes);

    const response = await request(app)
      .get('/api/elevation/stats')
      .query({ lat: '-23.55', lng: '-46.63', radius: '50000' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid radius');
  });
});

