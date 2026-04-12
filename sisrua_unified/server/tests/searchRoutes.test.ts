import express from 'express';
import request from 'supertest';

const resolveLocationMock = jest.fn();

jest.mock('../services/geocodingService', () => ({
  GeocodingService: {
    resolveLocation: resolveLocationMock,
  },
}));

describe('searchRoutes error sanitization', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('returns generic 500 without leaking internal error details', async () => {
    resolveLocationMock.mockRejectedValueOnce(new Error('DB host 10.0.0.5 failed'));

    const { default: searchRoutes } = await import('../routes/searchRoutes');
    const app = express();
    app.use(express.json());
    app.use('/api/search', searchRoutes);

    const response = await request(app)
      .post('/api/search')
      .send({ query: 'Rua das Flores 10' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Search service temporarily unavailable' });
    expect(JSON.stringify(response.body)).not.toContain('10.0.0.5');
    expect(JSON.stringify(response.body)).not.toContain('DB host');
  });
});
