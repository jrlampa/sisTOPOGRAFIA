import express from 'express';
import request from 'supertest';

const findMunicipioByCoordinatesMock = jest.fn();

jest.mock('../services/ibgeService', () => ({
  IbgeService: {
    findMunicipioByCoordinates: findMunicipioByCoordinatesMock,
    getStates: jest.fn(),
    getMunicipiosByState: jest.fn(),
    getMunicipalityBoundary: jest.fn(),
  },
}));

describe('ibgeRoutes error sanitization', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('returns generic 500 without leaking internal details on /location', async () => {
    findMunicipioByCoordinatesMock.mockRejectedValueOnce(new Error('IBGE upstream 500 at internal endpoint'));

    const { default: ibgeRoutes } = await import('../routes/ibgeRoutes');
    const app = express();
    app.use('/api/ibge', ibgeRoutes);

    const response = await request(app)
      .get('/api/ibge/location')
      .query({ lat: '-23.55', lng: '-46.63' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'IBGE service temporarily unavailable' });
    expect(JSON.stringify(response.body)).not.toContain('internal endpoint');
  });
});
