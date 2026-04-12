import express from 'express';
import request from 'supertest';

describe('osmRoutes Zod validation', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.resetModules();
  });

  async function buildApp() {
    process.env.NODE_ENV = 'test';
    const { default: osmRoutes } = await import('../routes/osmRoutes');
    const app = express();
    app.use(express.json());
    app.use('/api/osm', osmRoutes);
    return app;
  }

  it('returns 400 when lat is missing', async () => {
    const app = await buildApp();
    const res = await request(app).post('/api/osm').send({ lng: -46.63, radius: 300 });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when radius is negative', async () => {
    const app = await buildApp();
    const res = await request(app).post('/api/osm').send({ lat: -23.55, lng: -46.63, radius: -1 });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for out-of-range latitude', async () => {
    const app = await buildApp();
    const res = await request(app).post('/api/osm').send({ lat: 200, lng: -46.63, radius: 300 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-numeric body', async () => {
    const app = await buildApp();
    const res = await request(app).post('/api/osm').send({ lat: 'bad', lng: -46.63, radius: 300 });
    expect(res.status).toBe(400);
  });
});
