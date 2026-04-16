import fs from "node:fs";
import path from "node:path";

export interface HealthReleaseSnapshot {
  status: string;
  service: string;
  dependencyKeys: string[];
  configEnvironment: string | null;
  constantsCatalogNamespaces: unknown;
  queueBackendType: string;
  queueBackendAllowed: boolean;
  hasExternalApiSection: boolean;
  systemKeys: string[];
}

export const CRITICAL_FLOW_FIXTURES = {
  backendBaseUrl: process.env.E2E_BACKEND_URL ?? "http://localhost:3001",
  metricsToken: process.env.METRICS_TOKEN ?? "release-smoke-metrics-token",
  constantsRefreshToken: process.env.E2E_CONSTANTS_REFRESH_TOKEN,
  snapshotPath: path.resolve(
    process.cwd(),
    "e2e/snapshots/release-health.snapshot.json",
  ),
} as const;

export function loadReleaseHealthSnapshot(): HealthReleaseSnapshot {
  return JSON.parse(
    fs.readFileSync(CRITICAL_FLOW_FIXTURES.snapshotPath, "utf8"),
  ) as HealthReleaseSnapshot;
}
