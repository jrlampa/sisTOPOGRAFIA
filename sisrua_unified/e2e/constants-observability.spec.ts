import { expect, test } from "@playwright/test";
import { getJsonWithOptionalToken } from "./factories/critical-flow-factory";
import { CRITICAL_FLOW_FIXTURES } from "./fixtures/critical-flow-fixtures";

const { backendBaseUrl, constantsRefreshToken } = CRITICAL_FLOW_FIXTURES;

test.describe("Constants Catalog Observability", () => {
  test("health endpoint exposes constants catalog summary", async ({
    request,
  }) => {
    const response = await request.get(`${backendBaseUrl}/health`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe("online");
    expect(body.constantsCatalog).toBeDefined();
    expect(body.constantsCatalog.enabledNamespaces).toBeDefined();
    expect(typeof body.constantsCatalog.enabledNamespaces.cqt).toBe("boolean");
    expect(typeof body.constantsCatalog.enabledNamespaces.clandestino).toBe(
      "boolean",
    );
    expect(typeof body.constantsCatalog.enabledNamespaces.config).toBe(
      "boolean",
    );
    expect(body.constantsCatalog.cache).toBeDefined();
  });

  test("constants status endpoint exposes flags and active policy snapshots", async ({
    request,
  }) => {
    const result = await getJsonWithOptionalToken<any>(
      request,
      `${backendBaseUrl}/api/constants/status`,
      {
        headerName: "x-constants-refresh-token",
        token: constantsRefreshToken,
      },
    );

    if (result.response.status() === 401 && !constantsRefreshToken) {
      test.skip(
        true,
        "E2E_CONSTANTS_REFRESH_TOKEN not configured for protected constants status endpoint",
      );
    }

    expect(result.response.ok()).toBeTruthy();
    const body = result.body;

    expect(body.flags).toBeDefined();
    expect(typeof body.flags.cqt).toBe("boolean");
    expect(typeof body.flags.clandestino).toBe("boolean");
    expect(typeof body.flags.config).toBe("boolean");

    expect(body.cache).toBeDefined();

    expect(body.rateLimitPolicy).toBeDefined();
    expect(body.rateLimitPolicy.general).toBeDefined();
    expect(body.rateLimitPolicy.dxf).toBeDefined();
    expect(typeof body.rateLimitPolicy.general.windowMs).toBe("number");
    expect(typeof body.rateLimitPolicy.general.limit).toBe("number");
    expect(typeof body.rateLimitPolicy.dxf.windowMs).toBe("number");
    expect(typeof body.rateLimitPolicy.dxf.limit).toBe("number");

    expect(body.dxfCleanupPolicy).toBeDefined();
    expect(typeof body.dxfCleanupPolicy.fileTtlMs).toBe("number");
    expect(typeof body.dxfCleanupPolicy.maxFileAgeMs).toBe("number");
    expect(typeof body.dxfCleanupPolicy.cleanupCheckIntervalMs).toBe("number");

    // Audit metadata can be null before first refresh, otherwise contains summary.
    if (body.lastRefreshEvent !== null) {
      expect(Array.isArray(body.lastRefreshEvent.namespaces)).toBeTruthy();
      expect(typeof body.lastRefreshEvent.success).toBe("boolean");
      expect(typeof body.lastRefreshEvent.httpStatus).toBe("number");
      expect(typeof body.lastRefreshEvent.actor).toBe("string");
    }
  });

  test("constants refresh endpoint supports operational reload flow", async ({
    request,
  }) => {
    const refreshWithoutToken = await request.post(
      `${backendBaseUrl}/api/constants/refresh`,
    );

    // Endpoint is allowed in non-production when no token is configured.
    // In production (or token-protected setup) a token is required.
    if (refreshWithoutToken.status() === 200) {
      const body = await refreshWithoutToken.json();
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.refreshedNamespaces)).toBeTruthy();
      return;
    }

    expect([400, 401]).toContain(refreshWithoutToken.status());

    if (refreshWithoutToken.status() === 401 && constantsRefreshToken) {
      const refreshWithToken = await request.post(
        `${backendBaseUrl}/api/constants/refresh`,
        {
          headers: {
            "x-constants-refresh-token": constantsRefreshToken,
          },
        },
      );

      expect([200, 400]).toContain(refreshWithToken.status());
      if (refreshWithToken.status() === 200) {
        const body = await refreshWithToken.json();
        expect(body.ok).toBe(true);
      }
    }
  });

  test("refresh events endpoint exposes audit timeline for operations", async ({
    request,
  }) => {
    const result = await getJsonWithOptionalToken<any>(
      request,
      `${backendBaseUrl}/api/constants/refresh-events?limit=5`,
      {
        headerName: "x-constants-refresh-token",
        token: constantsRefreshToken,
      },
    );

    if (result.response.status() === 401 && !constantsRefreshToken) {
      test.skip(
        true,
        "E2E_CONSTANTS_REFRESH_TOKEN not configured for protected refresh-events endpoint",
      );
    }

    expect(result.response.ok()).toBeTruthy();
    const body = result.body;
    expect(Array.isArray(body.events)).toBeTruthy();
    expect(body.limit).toBe(5);
    if (body.events.length > 0) {
      expect(typeof body.events[0].httpStatus).toBe("number");
      expect(typeof body.events[0].actor).toBe("string");
    }
  });

  test("refresh stats endpoint exposes aggregated operational metrics", async ({
    request,
  }) => {
    const result = await getJsonWithOptionalToken<any>(
      request,
      `${backendBaseUrl}/api/constants/refresh-stats`,
      {
        headerName: "x-constants-refresh-token",
        token: constantsRefreshToken,
      },
    );

    if (result.response.status() === 401 && !constantsRefreshToken) {
      test.skip(
        true,
        "E2E_CONSTANTS_REFRESH_TOKEN not configured for protected refresh-stats endpoint",
      );
    }

    expect(result.response.ok()).toBeTruthy();
    const body = result.body;
    expect(typeof body.totalRefreshes).toBe("number");
    expect(typeof body.successCount).toBe("number");
    expect(typeof body.failureCount).toBe("number");
    expect(typeof body.successRate).toBe("number");
    expect(body.successRate).toBeGreaterThanOrEqual(0);
    expect(body.successRate).toBeLessThanOrEqual(100);
    expect(typeof body.namespaceFrequency).toBe("object");
    expect(Array.isArray(body.topActors)).toBeTruthy();
  });

  test("snapshots endpoint exposes catalog snapshot list", async ({
    request,
  }) => {
    const result = await getJsonWithOptionalToken<any>(
      request,
      `${backendBaseUrl}/api/constants/snapshots?limit=3`,
      {
        headerName: "x-constants-refresh-token",
        token: constantsRefreshToken,
      },
    );

    if (result.response.status() === 401 && !constantsRefreshToken) {
      test.skip(
        true,
        "E2E_CONSTANTS_REFRESH_TOKEN not configured for protected snapshots endpoint",
      );
    }

    expect(result.response.ok()).toBeTruthy();
    const body = result.body;
    expect(Array.isArray(body.snapshots)).toBeTruthy();
    expect(typeof body.limit).toBe("number");
    if (body.snapshots.length > 0) {
      expect(typeof body.snapshots[0].id).toBe("number");
      expect(typeof body.snapshots[0].namespace).toBe("string");
      expect(typeof body.snapshots[0].actor).toBe("string");
    }
  });
});
