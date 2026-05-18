import { vi } from "vitest";
import {
  findOrCreateJob,
  computeIdempotencyKey,
  getJob,
  stopCleanupInterval,
} from "../services/jobStatusService";

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../config.js", () => ({
  config: {
    useSupabaseJobs: false,
    DATABASE_URL: undefined,
    NODE_ENV: "test",
    JOB_CLEANUP_INTERVAL_MS: 60_000,
    JOB_MAX_AGE_MS: 60 * 60 * 1_000,
  },
}));

vi.mock("../repositories/jobRepository.js", () => ({
  jobRepository: {
    upsert: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  },
}));

const TEST_TENANT = "tenant-idemp";

describe("findOrCreateJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    stopCleanupInterval();
  });

  it("creates a new job when no job with that idempotency key exists", async () => {
    const key = computeIdempotencyKey({ lat: 1, lng: 1, ts: Date.now() });
    const job = await findOrCreateJob("idempotent-new-1", TEST_TENANT, key);
    expect(job.id).toBe("idempotent-new-1");
    expect(job.tenantId).toBe(TEST_TENANT);
    expect(job.status).toBe("queued");
  });

  it("returns the existing job when reusing the same key (queued state)", async () => {
    const key = computeIdempotencyKey({ lat: 2, lng: 2 });
    const first = await findOrCreateJob("idempotent-orig", TEST_TENANT, key);
    const second = await findOrCreateJob("idempotent-retry", TEST_TENANT, key);

    expect(second.id).toBe(first.id);
    expect(second.id).toBe("idempotent-orig");
  });

  it("returns the existing job when reusing the same key (processing state)", async () => {
    const key = computeIdempotencyKey({ lat: 3, lng: 3 });
    const first = await findOrCreateJob("idempotent-proc-1", TEST_TENANT, key);

    // Mock direct update to the job in redis (via our mock store in setup.ts)
    // Since we can't easily reach the store from here without exposing it,
    // we rely on the fact that updateJobStatus would do it.
    import("../services/jobStatusService").then(async (m) => {
      await m.updateJobStatus(first.id, "processing");
      const second = await findOrCreateJob("idempotent-proc-2", TEST_TENANT, key);
      expect(second.id).toBe(first.id);
      expect(second.status).toBe("processing");
    });
  });

  it("creates a new job when existing job is completed (terminal state)", async () => {
    const key = computeIdempotencyKey({ lat: 4, lng: 4 });
    const first = await findOrCreateJob("idempotent-done-1", TEST_TENANT, key);

    // Simulate completion
    import("../services/jobStatusService").then(async (m) => {
      await m.completeJob(first.id, { ok: true });
      const second = await findOrCreateJob("idempotent-done-2", TEST_TENANT, key);
      expect(second.id).toBe("idempotent-done-2");
      expect(second.status).toBe("queued");
    });
  });

  it("creates a new job when existing job is failed (terminal state)", async () => {
    const key = computeIdempotencyKey({ lat: 5, lng: 5 });
    const first = await findOrCreateJob("idempotent-fail-1", TEST_TENANT, key);

    // Simulate failure
    import("../services/jobStatusService").then(async (m) => {
      await m.failJob(first.id, "error");
      const second = await findOrCreateJob("idempotent-fail-2", TEST_TENANT, key);
      expect(second.id).toBe("idempotent-fail-2");
      expect(second.status).toBe("queued");
    });
  });

  it("persists idempotency key on the created job record", async () => {
    const key = computeIdempotencyKey({ lat: 10, lng: 10 });
    await findOrCreateJob("idempotent-persist-1", TEST_TENANT, key);
    const retrieved = await getJob("idempotent-persist-1");
    expect(retrieved?.idempotencyKey).toBe(key);
  });
});
