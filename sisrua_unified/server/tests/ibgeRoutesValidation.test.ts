import express from 'express';
import request from 'supertest';

describe('ibgeRoutes Zod validation', () => {
  let app: express.Application;

  beforeAll(async () => {
    const { default: ibgeRoutes } = await import('../routes/ibgeRoutes');
    app = express();
    app.use(express.json());
    app.use('/api/ibge', ibgeRoutes);
  });

  describe('GET /location', () => {
    it('returns 400 when lat is missing', async () => {
      const res = await request(app).get('/api/ibge/location').query({ lng: '-46.63' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 when lng is missing', async () => {
      const res = await request(app).get('/api/ibge/location').query({ lat: '-23.55' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 for out-of-range latitude', async () => {
      const res = await request(app)
        .get('/api/ibge/location')
        .query({ lat: '200', lng: '-46.63' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for non-numeric coordinates', async () => {
      const res = await request(app)
        .get('/api/ibge/location')
        .query({ lat: 'abc', lng: '-46.63' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /municipios/:uf', () => {
    it('returns 400 for invalid UF', async () => {
      const res = await request(app).get('/api/ibge/municipios/INVALID');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /boundary/municipio/:id', () => {
    it('returns 400 for non-7-digit id', async () => {
      const res = await request(app).get('/api/ibge/boundary/municipio/123');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 for non-numeric id', async () => {
      const res = await request(app).get('/api/ibge/boundary/municipio/abc1234');
      expect(res.status).toBe(400);
    });
  });
});
