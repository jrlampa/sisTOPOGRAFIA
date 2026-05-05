import { vi } from "vitest";
import {
  createJob,
  getJob,
  updateJobStatus,
  completeJob,
  failJob,
  stopCleanupInterval,
  getJobWithPersistence,
  resetServiceState,
} from "../services/jobStatusService";

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../config.js", () => ({
  config: {
    useSupabaseJobs: true,
    DATABASE_URL: "postgres://test:test@localhost:5432/test",
    NODE_ENV: "test",
    JOB_CLEANUP_INTERVAL_MS: 60_000,
    JOB_MAX_AGE_MS: 60 * 60 * 1_000,
  },
}));

vi.mock("../repositories/jobRepository.js", () => ({
  jobRepository: {
    upsert: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findRecent: vi.fn().mockResolvedValue([]),
  },
}));

// Mock postgres driver to support both function call (template literal) and .unsafe()
const unsafeMock = vi.fn();
type MockSqlClient = ReturnType<typeof vi.fn> & {
  unsafe: typeof unsafeMock;
  end: ReturnType<typeof vi.fn>;
};
const sqlClientMock = vi.fn(() => ({
  then: (resolve: any) => resolve([]), // Support for `await sql`SELECT 1``
})) as MockSqlClient;
sqlClientMock.unsafe = unsafeMock;
sqlClientMock.end = vi.fn().mockResolvedValue(undefined);

vi.mock("postgres", () => ({
  default: vi.fn(() => sqlClientMock),
}));

const TEST_TENANT = "tenant-test";

describe("jobStatusService unit tests", () => {
  beforeEach(() => {
    resetServiceState();
    vi.clearAllMocks();
  });

  afterEach(() => {
    stopCleanupInterval();
  });

  it("should create and retrieve a job in-memory", () => {
    const job = createJob("job-1", TEST_TENANT);
    expect(job.id).toBe("job-1");
    expect(getJob("job-1")?.id).toBe("job-1");
  });

  it("getJobWithPersistence reads through to Postgres", async () => {
    // 1. Setup mock for SQL responses
    // Call 1: await sqlClient`SELECT 1` in initializePersistence
    sqlClientMock.mockResolvedValueOnce([{ one: 1 }]);
    // Call 2: loadJobsFromPostgres SELECT in initializePersistence
    unsafeMock.mockResolvedValueOnce([]);
    // Call 3: fetchJobFromPostgres SELECT in getJobWithPersistence
    unsafeMock.mockResolvedValueOnce([
      {
        id: "pg-job",
        tenant_id: TEST_TENANT,
        status: "processing",
        progress: 50,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    // 2. Execute
    const job = await getJobWithPersistence("pg-job", TEST_TENANT);

    expect(job).toBeDefined();
    expect(job?.id).toBe("pg-job");
    expect(job?.tenantId).toBe(TEST_TENANT);
    expect(unsafeMock).toHaveBeenCalled();
  });
});
