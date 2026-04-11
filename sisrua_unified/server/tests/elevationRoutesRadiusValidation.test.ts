import express from 'express';
import request from 'supertest';

jest.mock('../services/elevationService', () => ({
  ElevationService: {
    getElevationAt: jest.fn(),
    getElevationProfile: jest.fn(),
  },
}));

jest.mock('../services/topodataService', () => ({
  TopodataService: {
    isWithinBrazil: jest.fn(() => true),
    getCacheStats: jest.fn(() => ({ hits: 0, misses: 0 })),
    clearCache: jest.fn(),
    getElevation: jest.fn(),
  },
}));

describe('elevationRoutes stats radius validation', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
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
