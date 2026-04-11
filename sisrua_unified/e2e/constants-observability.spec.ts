import { expect, test } from '@playwright/test';

const BACKEND_BASE_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:3001';
const REFRESH_TOKEN = process.env.E2E_CONSTANTS_REFRESH_TOKEN;

test.describe('Constants Catalog Observability', () => {
  test('health endpoint exposes constants catalog summary', async ({ request }) => {
    const response = await request.get(`${BACKEND_BASE_URL}/health`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('online');
    expect(body.constantsCatalog).toBeDefined();
    expect(body.constantsCatalog.enabledNamespaces).toBeDefined();
    expect(typeof body.constantsCatalog.enabledNamespaces.cqt).toBe('boolean');
    expect(typeof body.constantsCatalog.enabledNamespaces.clandestino).toBe('boolean');
    expect(typeof body.constantsCatalog.enabledNamespaces.config).toBe('boolean');
    expect(body.constantsCatalog.cache).toBeDefined();
  });

  test('constants status endpoint exposes flags and active policy snapshots', async ({ request }) => {
    const response = await request.get(`${BACKEND_BASE_URL}/api/constants/status`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.flags).toBeDefined();
    expect(typeof body.flags.cqt).toBe('boolean');
    expect(typeof body.flags.clandestino).toBe('boolean');
    expect(typeof body.flags.config).toBe('boolean');

    expect(body.cache).toBeDefined();

    expect(body.rateLimitPolicy).toBeDefined();
    expect(body.rateLimitPolicy.general).toBeDefined();
    expect(body.rateLimitPolicy.dxf).toBeDefined();
    expect(typeof body.rateLimitPolicy.general.windowMs).toBe('number');
    expect(typeof body.rateLimitPolicy.general.limit).toBe('number');
    expect(typeof body.rateLimitPolicy.dxf.windowMs).toBe('number');
    expect(typeof body.rateLimitPolicy.dxf.limit).toBe('number');

    expect(body.dxfCleanupPolicy).toBeDefined();
    expect(typeof body.dxfCleanupPolicy.fileTtlMs).toBe('number');
    expect(typeof body.dxfCleanupPolicy.maxFileAgeMs).toBe('number');
    expect(typeof body.dxfCleanupPolicy.cleanupCheckIntervalMs).toBe('number');

    // Audit metadata can be null before first refresh, otherwise contains summary.
    if (body.lastRefreshEvent !== null) {
      expect(Array.isArray(body.lastRefreshEvent.namespaces)).toBeTruthy();
      expect(typeof body.lastRefreshEvent.success).toBe('boolean');
      expect(typeof body.lastRefreshEvent.httpStatus).toBe('number');
      expect(typeof body.lastRefreshEvent.actor).toBe('string');
    }
  });

  test('constants refresh endpoint supports operational reload flow', async ({ request }) => {
    const refreshWithoutToken = await request.post(`${BACKEND_BASE_URL}/api/constants/refresh`);

    // Endpoint is allowed in non-production when no token is configured.
    // In production (or token-protected setup) a token is required.
    if (refreshWithoutToken.status() === 200) {
      const body = await refreshWithoutToken.json();
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.refreshedNamespaces)).toBeTruthy();
      return;
    }

    expect([400, 401]).toContain(refreshWithoutToken.status());

    if (refreshWithoutToken.status() === 401 && REFRESH_TOKEN) {
      const refreshWithToken = await request.post(`${BACKEND_BASE_URL}/api/constants/refresh`, {
        headers: {
          'x-constants-refresh-token': REFRESH_TOKEN,
        },
      });

      expect([200, 400]).toContain(refreshWithToken.status());
      if (refreshWithToken.status() === 200) {
        const body = await refreshWithToken.json();
        expect(body.ok).toBe(true);
      }
    }
  });

  test('refresh events endpoint exposes audit timeline for operations', async ({ request }) => {
    const withoutToken = await request.get(`${BACKEND_BASE_URL}/api/constants/refresh-events?limit=5`);

    if (withoutToken.status() === 200) {
      const body = await withoutToken.json();
      expect(Array.isArray(body.events)).toBeTruthy();
      expect(body.limit).toBe(5);
      if (body.events.length > 0) {
        expect(typeof body.events[0].httpStatus).toBe('number');
        expect(typeof body.events[0].actor).toBe('string');
      }
      return;
    }

    expect(withoutToken.status()).toBe(401);

    if (REFRESH_TOKEN) {
      const withToken = await request.get(`${BACKEND_BASE_URL}/api/constants/refresh-events?limit=5`, {
        headers: {
          'x-constants-refresh-token': REFRESH_TOKEN,
        },
      });

      expect(withToken.ok()).toBeTruthy();
      const body = await withToken.json();
      expect(Array.isArray(body.events)).toBeTruthy();
    }
  });

  test('refresh stats endpoint exposes aggregated operational metrics', async ({ request }) => {
    const withoutToken = await request.get(`${BACKEND_BASE_URL}/api/constants/refresh-stats`);

    if (withoutToken.status() === 200) {
      const body = await withoutToken.json();
      expect(typeof body.totalRefreshes).toBe('number');
      expect(typeof body.successCount).toBe('number');
      expect(typeof body.failureCount).toBe('number');
      expect(typeof body.successRate).toBe('number');
      expect(body.successRate).toBeGreaterThanOrEqual(0);
      expect(body.successRate).toBeLessThanOrEqual(100);
      expect(typeof body.namespaceFrequency).toBe('object');
      expect(Array.isArray(body.topActors)).toBeTruthy();
      return;
    }

    expect(withoutToken.status()).toBe(401);

    if (REFRESH_TOKEN) {
      const withToken = await request.get(`${BACKEND_BASE_URL}/api/constants/refresh-stats`, {
        headers: {
          'x-constants-refresh-token': REFRESH_TOKEN,
        },
      });

      expect(withToken.ok()).toBeTruthy();
      const body = await withToken.json();
      expect(typeof body.totalRefreshes).toBe('number');
      expect(typeof body.successRate).toBe('number');
    }
  });

  test('snapshots endpoint exposes catalog snapshot list', async ({ request }) => {
    const withoutToken = await request.get(`${BACKEND_BASE_URL}/api/constants/snapshots?limit=3`);

    if (withoutToken.status() === 200) {
      const body = await withoutToken.json();
      expect(Array.isArray(body.snapshots)).toBeTruthy();
      expect(typeof body.limit).toBe('number');
      if (body.snapshots.length > 0) {
        expect(typeof body.snapshots[0].id).toBe('number');
        expect(typeof body.snapshots[0].namespace).toBe('string');
        expect(typeof body.snapshots[0].actor).toBe('string');
      }
      return;
    }

    expect(withoutToken.status()).toBe(401);

    if (REFRESH_TOKEN) {
      const withToken = await request.get(`${BACKEND_BASE_URL}/api/constants/snapshots?limit=3`, {
        headers: {
          'x-constants-refresh-token': REFRESH_TOKEN,
        },
      });

      expect(withToken.ok()).toBeTruthy();
      const body = await withToken.json();
      expect(Array.isArray(body.snapshots)).toBeTruthy();
      expect(typeof body.limit).toBe('number');
    }
  });
});