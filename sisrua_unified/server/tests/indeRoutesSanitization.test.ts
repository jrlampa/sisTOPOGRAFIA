import express from 'express';
import request from 'supertest';

const getWfsCapabilitiesMock = jest.fn();

jest.mock('../services/indeService', () => ({
  IndeService: {
    getWfsCapabilities: getWfsCapabilitiesMock,
    getFeaturesByBBox: jest.fn(),
    getWmsMapUrl: jest.fn(),
  },
}));

describe('indeRoutes error sanitization', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
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
