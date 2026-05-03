import { vi } from "vitest";
/**
 * jobStatusService.test.ts
 * Tests the full in-memory job lifecycle with multi-tenancy support.
 */

import {
  createJob,
  getJob,
  updateJobStatus,
  completeJob,
  failJob,
  shouldProcessJob,
  stopCleanupInterval,
  getJobWithPersistence,
  computeIdempotencyKey,
  findOrCreateJob,
} from "../services/jobStatusService";

vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const TEST_TENANT = "tenant-test";

describe("jobStatusService (in-memory)", () => {
  afterEach(async () => {
    const { resetServiceState } = await import("../services/jobStatusService");
    resetServiceState();
  });

  it("should create a job with queued status and tenantId", () => {
    const job = createJob("test-job-1", TEST_TENANT);
    expect(job.id).toBe("test-job-1");
    expect(job.tenantId).toBe(TEST_TENANT);
    expect(job.status).toBe("queued");
    expect(job.progress).toBe(0);
  });

  it("should retrieve a created job by ID", () => {
    createJob("test-job-2", TEST_TENANT);
    const retrieved = getJob("test-job-2");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.status).toBe("queued");
    expect(retrieved?.tenantId).toBe(TEST_TENANT);
  });

  it("should return null for unknown job ID", () => {
    expect(getJob("non-existent")).toBeNull();
  });

  it("should update job status and progress", async () => {
    createJob("test-job-3", TEST_TENANT);
    await updateJobStatus("test-job-3", "processing", 50);
    const job = getJob("test-job-3");
    expect(job?.status).toBe("processing");
    expect(job?.progress).toBe(50);
  });

  it("should complete a job with result data", async () => {
    createJob("test-job-4", TEST_TENANT);
    await completeJob("test-job-4", {
      url: "/downloads/test.dxf",
      filename: "test.dxf",
      btContextUrl: "/downloads/test_bt.json",
    });
    const job = getJob("test-job-4");
    expect(job?.status).toBe("completed");
    expect(job?.progress).toBe(100);
    expect(job?.result?.filename).toBe("test.dxf");
  });

  it("should fail a job and record the error", async () => {
    createJob("test-job-5", TEST_TENANT);
    await failJob("test-job-5", "Python engine crashed");
    const job = getJob("test-job-5");
    expect(job?.status).toBe("failed");
    expect(job?.error).toBe("Python engine crashed");
    expect(job?.attempts).toBe(1);
  });

  it("shouldProcessJob: returns true for new jobs", () => {
    expect(shouldProcessJob("non-existent-2")).toBe(true);
  });

  it("shouldProcessJob: returns false for completed jobs", async () => {
    createJob("test-job-6", TEST_TENANT);
    await completeJob("test-job-6", {
      url: "/downloads/x.dxf",
      filename: "x.dxf",
    });
    expect(shouldProcessJob("test-job-6")).toBe(false);
  });

  it("shouldProcessJob: returns false for processing jobs", async () => {
    createJob("test-job-7", TEST_TENANT);
    await updateJobStatus("test-job-7", "processing");
    expect(shouldProcessJob("test-job-7")).toBe(false);
  });

  it("shouldProcessJob: returns false after 3 failed attempts", async () => {
    createJob("test-job-8", TEST_TENANT);
    await failJob("test-job-8", "Err 1");
    await failJob("test-job-8", "Err 2");
    await failJob("test-job-8", "Err 3");
    expect(shouldProcessJob("test-job-8")).toBe(false);
  });

  it("createJob stores idempotencyKey in secondary index", () => {
    const job = createJob("idem-job-1", TEST_TENANT, "my-idem-key");
    expect(job.idempotencyKey).toBe("my-idem-key");
  });

  it("getJobWithPersistence returns in-memory job directly", async () => {
    createJob("mem-job-1", TEST_TENANT);
    const job = await getJobWithPersistence("mem-job-1");
    expect(job?.id).toBe("mem-job-1");
  });

  it("getJobWithPersistence returns null for unknown job (no DB)", async () => {
    const job = await getJobWithPersistence("no-such-job-xyz");
    expect(job).toBeNull();
  });

  it("computeIdempotencyKey returns a 64-char hex string", () => {
    const key = computeIdempotencyKey({ lat: -23.55, lng: -46.63 });
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });

  it("computeIdempotencyKey is deterministic regardless of key order", () => {
    const k1 = computeIdempotencyKey({ b: 2, a: 1 });
    const k2 = computeIdempotencyKey({ a: 1, b: 2 });
    expect(k1).toBe(k2);
  });

  it("findOrCreateJob returns existing non-terminal job", () => {
    const original = createJob("find-job-1", TEST_TENANT, "unique-key-A");
    const found = findOrCreateJob("find-job-new", TEST_TENANT, "unique-key-A");
    expect(found.id).toBe("find-job-1");
  });

  it("findOrCreateJob creates new job when existing key is in terminal state", async () => {
    createJob("terminal-job-A", TEST_TENANT, "terminal-key-A");
    await completeJob("terminal-job-A", { url: "/x.dxf", filename: "x.dxf" });
    const newJob = findOrCreateJob("new-terminal-job-A", TEST_TENANT, "terminal-key-A");
    expect(newJob.id).toBe("new-terminal-job-A");
  });

  it("findOrCreateJob creates new job when idempotency key not found", () => {
    const job = findOrCreateJob("brand-new-job", TEST_TENANT, "brand-new-key");
    expect(job.id).toBe("brand-new-job");
  });
});

describe("jobStatusService: Postgres persistence", () => {
  const flushPromises = () =>
    new Promise<void>((resolve) => setImmediate(resolve));
  const originalEnv = process.env;

  let sqlUnsafeMock: vi.Mock;
  let sqlEndMock: vi.Mock;
  let postgresFactoryMock: vi.Mock;

  beforeEach(() => {
    vi.resetModules();

    sqlUnsafeMock = vi.fn();
    sqlEndMock = vi.fn().mockResolvedValue(undefined);

    const sqlClientMock = { unsafe: sqlUnsafeMock, end: sqlEndMock };
    postgresFactoryMock = vi.fn().mockReturnValue(sqlClientMock);

    vi.doMock("postgres", () => ({
      __esModule: true,
      default: postgresFactoryMock,
    }));
    vi.doMock("../repositories/jobRepository.js", () => ({
      jobRepository: {
        upsert: vi.fn().mockResolvedValue(undefined),
        complete: vi.fn().mockResolvedValue(undefined),
        fail: vi.fn().mockResolvedValue(undefined),
      },
    }));
    vi.doMock("../utils/logger", () => ({
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    }));
    vi.doMock("../config", () => ({
      config: {
        useSupabaseJobs: true,
        DATABASE_URL: "postgres://localhost/testdb",
        NODE_ENV: "development",
        JOB_CLEANUP_INTERVAL_MS: 3_600_000,
        JOB_MAX_AGE_MS: 3_600_000,
      },
    }));
    process.env = { ...originalEnv, NODE_ENV: "development" };
  });

  afterEach(async () => {
    process.env = originalEnv;
    vi.clearAllMocks();
    const { resetServiceState } = await import("../services/jobStatusService");
    resetServiceState();
  });

  it("initializes Postgres and loads existing jobs from DB", async () => {
    sqlUnsafeMock
      .mockResolvedValueOnce([
        {
          id: "loaded-job",
          tenant_id: TEST_TENANT,
          status: "queued",
          progress: 0,
          result: null,
          error: null,
          created_at: new Date(),
          updated_at: new Date(),
          attempts: 0,
          idempotency_key: "k1",
        },
      ]) 
      .mockResolvedValue(undefined); 

    const { createJob: cj, getJob: gj, initializePersistence: ip } =
      await import("../services/jobStatusService");
    await ip();
    cj("trigger-init", TEST_TENANT);
    await flushPromises();

    expect(postgresFactoryMock).toHaveBeenCalledWith(
      "postgres://localhost/testdb",
      expect.any(Object),
    );
    expect(gj("loaded-job")).not.toBeNull();
  });

  it("falls back to in-memory when Postgres constructor throws", async () => {
    postgresFactoryMock.mockImplementationOnce(() => {
      throw new Error("ECONNREFUSED");
    });

    const { createJob: cj, getJob: gj } =
      await import("../services/jobStatusService");
    cj("fallback-job", TEST_TENANT);
    await flushPromises();

    expect(gj("fallback-job")).not.toBeNull();
  });

  it("getJobWithPersistence reads through to Postgres", async () => {
    sqlUnsafeMock
      .mockResolvedValueOnce([]) 
      .mockResolvedValueOnce(undefined) 
      .mockResolvedValueOnce([
        {
          id: "pg-job",
          tenant_id: TEST_TENANT,
          status: "processing",
          progress: 50,
          result: null,
          error: null,
          created_at: new Date(),
          updated_at: new Date(),
          attempts: 1,
          idempotency_key: null,
        },
      ]) 
      .mockResolvedValue(undefined);

    const { createJob: cj, getJobWithPersistence: gwp, initializePersistence: ip } =
      await import("../services/jobStatusService");
    await ip();
    cj("trigger", TEST_TENANT);
    await flushPromises();

    const job = await gwp("pg-job");
    expect(job?.id).toBe("pg-job");
  });

  it("persistJob is invoked when updating and completing jobs", async () => {
    sqlUnsafeMock
      .mockResolvedValueOnce([]) 
      .mockResolvedValue(undefined); 

    const {
      createJob: cj,
      updateJobStatus: ujs,
      completeJob: cmpj,
      initializePersistence: ip,
    } = await import("../services/jobStatusService");
    await ip();
    cj("trigger", TEST_TENANT);
    await flushPromises();

    cj("persist-job", TEST_TENANT);
    await ujs("persist-job", "processing", 30);
    await cmpj("persist-job", { url: "/f.dxf", filename: "f.dxf" });
    await flushPromises();

    expect(sqlUnsafeMock).toHaveBeenCalled();
  });
});
