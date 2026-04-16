import { expect, test } from "@playwright/test";
import {
  buildMetricsHeaders,
  normalizeHealthForSnapshot,
} from "./factories/critical-flow-factory";
import {
  CRITICAL_FLOW_FIXTURES,
  loadReleaseHealthSnapshot,
} from "./fixtures/critical-flow-fixtures";

const { backendBaseUrl, metricsToken } = CRITICAL_FLOW_FIXTURES;

test.describe("Release Smoke Critico @release-smoke", () => {
  test("contrato de health mantem shape minimo de release", async ({
    request,
  }) => {
    const response = await request.get(`${backendBaseUrl}/health`);
    expect([200, 503]).toContain(response.status());

    const body = await response.json();
    expect(["online", "degraded"]).toContain(body.status);
    expect(typeof body.service).toBe("string");
    expect(typeof body.version).toBe("string");
    expect(typeof body.timestamp).toBe("string");

    expect(body.system).toBeDefined();
    expect(typeof body.system.nodeVersion).toBe("string");
    expect(typeof body.system.platform).toBe("string");

    expect(body.dependencies).toBeDefined();
    expect(body.config).toBeDefined();
    expect(body.config.constantsCatalog).toBeDefined();
  });

  test("auth de metrics bloqueia anonimo e aceita bearer valido", async ({
    request,
  }) => {
    const unauthorized = await request.get(`${backendBaseUrl}/metrics`);
    expect(unauthorized.status()).toBe(401);
    expect(unauthorized.headers()["www-authenticate"]).toContain(
      'Bearer realm="metrics"',
    );

    const authorized = await request.get(`${backendBaseUrl}/metrics`, {
      headers: buildMetricsHeaders(metricsToken),
    });

    expect(authorized.status()).toBe(200);
    const metricsText = await authorized.text();
    expect(metricsText).toContain("# HELP");
  });

  test("snapshot de release preserva contrato critico de health", async ({
    request,
  }) => {
    const response = await request.get(`${backendBaseUrl}/health`);
    expect([200, 503]).toContain(response.status());

    const body = await response.json();
    const normalized = normalizeHealthForSnapshot(body);

    const snapshot = loadReleaseHealthSnapshot();
    expect(normalized).toEqual(snapshot);
  });
});
