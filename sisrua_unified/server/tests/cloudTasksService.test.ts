import { vi } from "vitest";

const unsafeMock = vi.fn();
const endMock = vi.fn().mockResolvedValue(undefined);

vi.mock("crypto", () => ({
  randomUUID: () => "test-uuid",
}));

vi.mock("../pythonBridge", () => ({
  generateDxf: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/jobStatusService", () => ({
  createJob: vi.fn(),
  completeJob: vi.fn().mockResolvedValue(undefined),
  failJob: vi.fn().mockResolvedValue(undefined),
  updateJobStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/dxfCleanupService", () => ({
  scheduleDxfDeletion: vi.fn(),
}));

vi.mock("postgres", () => ({
  __esModule: true,
  default: vi.fn(() => ({
    unsafe: unsafeMock,
    end: endMock,
  })),
}));

describe("cloudTasksService (Postgres queue)", () => {
  const originalEnv = process.env;
  const testDatabaseUrl =
    process.env.TEST_DATABASE_URL ||
    "postgresql://user:password@localhost:5432/testdb?sslmode=require";

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl,
      USE_SUPABASE_JOBS: "true",
    };

    unsafeMock.mockReset();
    endMock.mockClear();

    // 1) idempotency check — no existing task
    unsafeMock
      .mockResolvedValueOnce([])
      // 2) insert queued row
      .mockResolvedValueOnce([]);

    vi.resetModules();
  });

  afterEach(async () => {
    process.env = originalEnv;
    const mod = await import("../services/cloudTasksService");
    mod.stopTaskWorker();
    vi.clearAllMocks();
  });

  it("queues DXF task into Postgres and returns task id", async () => {
    const { createDxfTask } = await import("../services/cloudTasksService");

    const result = await createDxfTask({
      lat: 1,
      lon: 2,
      radius: 300,
      mode: "circle",
      polygon: "[]",
      layers: {},
      projection: "local",
      contourRenderMode: "spline",
      outputFile: "/tmp/file.dxf",
      filename: "file.dxf",
      cacheKey: "cache-key",
      downloadUrl: "https://example.com/downloads/file.dxf",
    });

    expect(result.taskId).toBe("test-uuid");
    expect(result.taskName).toBe("pg-task-test-uuid");
    expect(result.alreadyCompleted).toBe(false);
    expect(unsafeMock).toHaveBeenCalledTimes(2);
  });

  it("uses injected DXF engine in local fallback mode", async () => {
    vi.useFakeTimers();
    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
      USE_SUPABASE_JOBS: "false",
    };

    const fakeGenerate = vi.fn().mockResolvedValue("DXF_OK");
    const { createDxfTask, configureCloudTasksDependencies } =
      await import("../services/cloudTasksService");
    const jobStatusService = await import("../services/jobStatusService");

    configureCloudTasksDependencies({
      dxfEngine: {
        generate: fakeGenerate,
      },
    });

    await createDxfTask({
      lat: 1,
      lon: 2,
      radius: 300,
      mode: "circle",
      polygon: "[]",
      layers: {},
      projection: "local",
      contourRenderMode: "spline",
      outputFile: "/tmp/file.dxf",
      filename: "file.dxf",
      cacheKey: "fallback-cache-key",
      downloadUrl: "https://example.com/downloads/file.dxf",
    });

    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(fakeGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        lat: 1,
        lon: 2,
        radius: 300,
        outputFile: "/tmp/file.dxf",
      }),
    );
    expect(jobStatusService.completeJob).toHaveBeenCalledWith(
      "test-uuid",
      expect.objectContaining({
        url: "https://example.com/downloads/file.dxf",
        filename: "file.dxf",
      }),
    );
  });

  it("hard-fails before queue when lat/lon/radius are invalid", async () => {
    const { createDxfTask } = await import("../services/cloudTasksService");

    await expect(
      createDxfTask({
        lat: Number.NaN,
        lon: 2,
        radius: 300,
        mode: "circle",
        polygon: "[]",
        layers: {},
        projection: "local",
        contourRenderMode: "spline",
        outputFile: "/tmp/file.dxf",
        filename: "file.dxf",
        cacheKey: "cache-key-invalid",
        downloadUrl: "https://example.com/downloads/file.dxf",
      }),
    ).rejects.toThrow("Invalid DXF input fields");
  });
});
