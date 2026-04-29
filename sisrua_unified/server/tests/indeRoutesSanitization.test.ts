import { vi } from "vitest";
import express from 'express';
import request from 'supertest';

const getWfsCapabilitiesMock = vi.fn();

vi.mock('../services/indeService', () => ({
  IndeService: {
    getWfsCapabilities: getWfsCapabilitiesMock,
    getFeaturesByBBox: vi.fn(),
    getWmsMapUrl: vi.fn(),
  },
}));

describe('indeRoutes error sanitization', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns generic 500 without leaking internal details on /capabilities/:source', async () => {
    getWfsCapabilitiesMock.mockRejectedValueOnce(new Error('WFS token expired for backend integration'));

    const { default: indeRoutes } = await import('../routes/indeRoutes');
    const app = express();
    app.use('/api/inde', indeRoutes);

    const response = await request(app).get('/api/inde/capabilities/ibge');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'INDE service temporarily unavailable' });
    expect(JSON.stringify(response.body)).not.toContain('token expired');
  });
});

