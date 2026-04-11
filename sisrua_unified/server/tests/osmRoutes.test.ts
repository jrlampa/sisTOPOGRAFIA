import express from 'express';
import request from 'supertest';

describe('osmRoutes', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
    if (originalFetch) {
      global.fetch = originalFetch;
    }
  });

  it('returns 503 when all Overpass endpoints fail outside test environment', async () => {
    process.env.NODE_ENV = 'production';
    jest.resetModules();

    global.fetch = jest.fn().mockRejectedValue(new Error('overpass-down')) as unknown as typeof fetch;

    const { default: osmRoutes } = await import('../routes/osmRoutes');
    const app = express();
    app.use(express.json());
    app.use('/api/osm', osmRoutes);

    const response = await request(app)
      .post('/api/osm')
      .send({ lat: -23.55, lng: -46.63, radius: 300 });

    expect(response.status).toBe(503);
    expect(response.body).toEqual(expect.objectContaining({
      error: 'OSM provider unavailable',
      code: 'OVERPASS_UNAVAILABLE'
    }));
  });

  it('keeps synthetic fallback enabled only in test environment', async () => {
    process.env.NODE_ENV = 'test';
    jest.resetModules();

    global.fetch = jest.fn().mockRejectedValue(new Error('overpass-down')) as unknown as typeof fetch;

    const { default: osmRoutes } = await import('../routes/osmRoutes');
    const app = express();
    app.use(express.json());
    app.use('/api/osm', osmRoutes);

    const response = await request(app)
      .post('/api/osm')
      .send({ lat: -23.55, lng: -46.63, radius: 300 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      _fallback: true
    }));
    expect(Array.isArray(response.body.elements)).toBe(true);
  });

  it('blocks /mock route outside test environment', async () => {
    process.env.NODE_ENV = 'production';
    jest.resetModules();

    const { default: osmRoutes } = await import('../routes/osmRoutes');
    const app = express();
    app.use(express.json());
    app.use('/api/osm', osmRoutes);

    const response = await request(app)
      .post('/api/osm/mock')
      .send({ lat: -23.55, lng: -46.63, radius: 300 });

    expect(response.status).toBe(404);
  });
});
