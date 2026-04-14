import express from 'express';
import request from 'supertest';

const findMunicipioByCoordinatesMock = jest.fn();
const getStatesMock = jest.fn();
const getMunicipiosByStateMock = jest.fn();

jest.mock('../services/ibgeService', () => ({
  IbgeService: {
    findMunicipioByCoordinates: findMunicipioByCoordinatesMock,
    getStates: (...args: unknown[]) => getStatesMock(...args),
    getMunicipiosByState: (...args: unknown[]) => getMunicipiosByStateMock(...args),
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

  it('applies list contract on /states with meta and paging', async () => {
    getStatesMock.mockResolvedValueOnce([
      { id: '35', nome: 'São Paulo', sigla: 'SP' },
      { id: '33', nome: 'Rio de Janeiro', sigla: 'RJ' }
    ]);

    const { default: ibgeRoutes } = await import('../routes/ibgeRoutes');
    const app = express();
    app.use('/api/ibge', ibgeRoutes);

    const response = await request(app)
      .get('/api/ibge/states')
      .query({ limit: '1', offset: '0', sortBy: 'nome', sortOrder: 'asc', search: 'rio' });

    expect(response.status).toBe(200);
    expect(response.body.states).toEqual([{ id: '33', nome: 'Rio de Janeiro', sigla: 'RJ' }]);
    expect(response.body.meta.filters.search).toBe('rio');
  });
});
