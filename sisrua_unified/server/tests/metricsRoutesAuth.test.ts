/**
 * metricsRoutesAuth.test.ts — Item 11 regression
 *
 * Verifies that /metrics is protected by Bearer token when METRICS_TOKEN is
 * configured, and remains open (backwards-compatible) when the var is absent.
 */
import express from 'express';
import request from 'supertest';

// ─── Shared mock wiring ──────────────────────────────────────────────────────
const getMetricsMock = jest.fn().mockResolvedValue('# HELP sisrua_test\nsisrua_test 1\n');
const contentTypeMock = 'text/plain; version=0.0.4; charset=utf-8';

jest.mock('../services/metricsService', () => ({
  metricsService: {
    getMetrics: () => getMetricsMock(),
    contentType: contentTypeMock,
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Build an isolated Express app backed by a fresh config mock for each test. */
async function buildApp(metricsToken: string | undefined) {
  jest.resetModules();

  jest.doMock('../config', () => ({
    config: {
      METRICS_ENABLED: true,
      METRICS_TOKEN: metricsToken,
    },
  }));

  const { default: metricsRoutes } = await import('../routes/metricsRoutes');
  const app = express();
  app.use('/metrics', metricsRoutes);
  return app;
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('metricsRoutes — authentication (Item 11)', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('when METRICS_TOKEN is NOT configured', () => {
    it('returns 200 without any Authorization header (backwards-compatible)', async () => {
      const app = await buildApp(undefined);
      const res = await request(app).get('/metrics');
      expect(res.status).toBe(200);
    });
  });

  describe('when METRICS_TOKEN is configured', () => {
    const TOKEN = 'test-scrape-secret-abc123';

    it('returns 401 when Authorization header is absent', async () => {
      const app = await buildApp(TOKEN);
      const res = await request(app).get('/metrics');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Unauthorized' });
    });

    it('returns 401 when Authorization header has wrong scheme', async () => {
      const app = await buildApp(TOKEN);
      const res = await request(app)
        .get('/metrics')
        .set('Authorization', `Basic ${Buffer.from('user:pass').toString('base64')}`);
      expect(res.status).toBe(401);
    });

    it('returns 401 when token is incorrect', async () => {
      const app = await buildApp(TOKEN);
      const res = await request(app)
        .get('/metrics')
        .set('Authorization', 'Bearer wrong-token');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Unauthorized' });
    });

    it('returns 401 when token is correct prefix but longer (length mismatch)', async () => {
      const app = await buildApp(TOKEN);
      const res = await request(app)
        .get('/metrics')
        .set('Authorization', `Bearer ${TOKEN}-extra`);
      expect(res.status).toBe(401);
    });

    it('returns 401 when token is empty string', async () => {
      const app = await buildApp(TOKEN);
      const res = await request(app)
        .get('/metrics')
        .set('Authorization', 'Bearer ');
      expect(res.status).toBe(401);
    });

    it('returns 200 with correct Bearer token', async () => {
      const app = await buildApp(TOKEN);
      const res = await request(app)
        .get('/metrics')
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
    });

    it('includes WWW-Authenticate header on 401', async () => {
      const app = await buildApp(TOKEN);
      const res = await request(app).get('/metrics');
      expect(res.status).toBe(401);
      expect(res.headers['www-authenticate']).toBe('Bearer realm="metrics"');
    });

    it('does not expose the token value in the 401 response body', async () => {
      const app = await buildApp(TOKEN);
      const res = await request(app).get('/metrics');
      expect(JSON.stringify(res.body)).not.toContain(TOKEN);
    });
  });

  describe('when METRICS_ENABLED is false', () => {
    it('returns 404 regardless of token', async () => {
      jest.resetModules();
      jest.doMock('../config', () => ({
        config: { METRICS_ENABLED: false, METRICS_TOKEN: 'some-token' },
      }));
      jest.doMock('../services/metricsService', () => ({
        metricsService: { getMetrics: getMetricsMock, contentType: contentTypeMock },
      }));

      const { default: metricsRoutes } = await import('../routes/metricsRoutes');
      const app = express();
      app.use('/metrics', metricsRoutes);

      const res = await request(app)
        .get('/metrics')
        .set('Authorization', 'Bearer some-token');
      expect(res.status).toBe(404);
    });
  });
});
