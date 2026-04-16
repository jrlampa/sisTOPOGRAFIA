import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BACKEND_BASE_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:3001";
const METRICS_TOKEN =
  process.env.METRICS_TOKEN ?? "release-smoke-metrics-token";

function loadSnapshot(): Record<string, unknown> {
  const snapshotPath = path.resolve(
    process.cwd(),
    "e2e/snapshots/release-health.snapshot.json",
  );
  return JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
}

test.describe("Release Smoke Critico @release-smoke", () => {
  test("contrato de health mantem shape minimo de release", async ({
    request,
  }) => {
    const response = await request.get(`${BACKEND_BASE_URL}/health`);
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
    const unauthorized = await request.get(`${BACKEND_BASE_URL}/metrics`);
    expect(unauthorized.status()).toBe(401);
    expect(unauthorized.headers()["www-authenticate"]).toContain(
      'Bearer realm="metrics"',
    );

    const authorized = await request.get(`${BACKEND_BASE_URL}/metrics`, {
      headers: {
        Authorization: `Bearer ${METRICS_TOKEN}`,
      },
    });

    expect(authorized.status()).toBe(200);
    const metricsText = await authorized.text();
    expect(metricsText).toContain("# HELP");
  });

  test("snapshot de release preserva contrato critico de health", async ({
    request,
  }) => {
    const response = await request.get(`${BACKEND_BASE_URL}/health`);
    expect([200, 503]).toContain(response.status());

    const body = await response.json();
    const normalized = {
      status: body.status,
      service: body.service,
      dependencyKeys: Object.keys(body.dependencies ?? {}).sort(),
      configEnvironment: body.config?.environment,
      constantsCatalogNamespaces:
        body.config?.constantsCatalog?.enabledNamespaces ?? null,
      queueBackendType: typeof body.dependencies?.queueBackend,
      queueBackendAllowed: ["local-async", "supabase-postgres"].includes(
        body.dependencies?.queueBackend,
      ),
      hasExternalApiSection:
        typeof body.dependencies?.externalApis === "object",
      systemKeys: Object.keys(body.system ?? {}).sort(),
    };

    const snapshot = loadSnapshot();
    expect(normalized).toEqual(snapshot);
  });
});
