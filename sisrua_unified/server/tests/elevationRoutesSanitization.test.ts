import { vi } from "vitest";
import express from 'express';
import request from 'supertest';

const getElevationProfileMock = vi.fn();

vi.mock('../services/elevationService', () => ({
  ElevationService: {
    getElevationProfile: getElevationProfileMock,
  },
}));

describe('elevationRoutes error sanitization', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns generic 500 without leaking internal details on /profile', async () => {
    getElevationProfileMock.mockRejectedValueOnce(new Error('open-elevation upstream timeout 10.1.2.3'));

    const { default: elevationRoutes } = await import('../routes/elevationRoutes');
    const app = express();
    app.use(express.json());
    app.use('/api/elevation', elevationRoutes);

    const response = await request(app)
      .post('/api/elevation/profile')
      .send({
        start: { lat: -23.55, lng: -46.63 },
        end: { lat: -23.56, lng: -46.62 },
        steps: 10,
      });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Elevation service temporarily unavailable' });
    expect(JSON.stringify(response.body)).not.toContain('10.1.2.3');
    expect(JSON.stringify(response.body)).not.toContain('timeout');
  });
});

