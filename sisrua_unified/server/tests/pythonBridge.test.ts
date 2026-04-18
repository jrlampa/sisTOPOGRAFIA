/**
 * pythonBridge.test.ts
 *
 * Testes para pythonBridge.ts: PythonOomError, constantes e validação de inputs.
 */

import { jest } from "@jest/globals";

// ─── Mock logger ─────────────────────────────────────────────────────────────
jest.mock("../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ─── Mock config ─────────────────────────────────────────────────────────────
jest.mock("../config", () => ({
  config: {
    PYTHON_COMMAND: "",
    NODE_ENV: "test",
    isDocker: false,
    PYTHON_PROCESS_TIMEOUT_MS: 5000,
  },
}));

// ─── Mock metricsService ─────────────────────────────────────────────────────
jest.mock("../services/metricsService", () => ({
  metricsService: {
    recordMetricObservation: jest.fn(),
    recordDxfGenerationDuration: jest.fn(),
  },
}));

// ─── Mock child_process ──────────────────────────────────────────────────────
const spawnSyncMock = jest.fn<(...args: any[]) => any>();
const spawnMock = jest.fn<(...args: any[]) => any>();

jest.mock("child_process", () => ({
  spawn: spawnMock,
  spawnSync: spawnSyncMock,
}));

// ─── Import targets ──────────────────────────────────────────────────────────
import {
  PythonOomError,
  PYTHON_OOM_EXIT_CODE,
  generateDxf,
} from "../pythonBridge.js";

// ═════════════════════════════════════════════════════════════════════════════
// PythonOomError
// ═════════════════════════════════════════════════════════════════════════════

describe("PythonOomError", () => {
  it("has name = 'PythonOomError'", () => {
    const err = new PythonOomError(512);
    expect(err.name).toBe("PythonOomError");
  });

  it("is instance of Error", () => {
    const err = new PythonOomError(512);
    expect(err).toBeInstanceOf(Error);
  });

  it("has isOom = true", () => {
    const err = new PythonOomError(512);
    expect(err.isOom).toBe(true);
  });

  it("includes memoryLimitMb in message", () => {
    const err = new PythonOomError(1024);
    expect(err.message).toContain("1024");
    expect(err.message).toContain("MB");
  });

  it("mentions retry in message", () => {
    const err = new PythonOomError(256);
    expect(err.message.toLowerCase()).toContain("re-tent");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PYTHON_OOM_EXIT_CODE
// ═════════════════════════════════════════════════════════════════════════════

describe("PYTHON_OOM_EXIT_CODE", () => {
  it("equals 137", () => {
    expect(PYTHON_OOM_EXIT_CODE).toBe(137);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// generateDxf — input validation (no actual Python needed)
// ═════════════════════════════════════════════════════════════════════════════

describe("generateDxf — input validation", () => {
  it("rejects on missing lat", async () => {
    await expect(
      generateDxf({
        lat: undefined as any,
        lon: 0,
        radius: 100,
        outputFile: "/tmp/out.dxf",
      }),
    ).rejects.toThrow("Missing required parameters");
  });

  it("rejects on missing lon", async () => {
    await expect(
      generateDxf({
        lat: 0,
        lon: undefined as any,
        radius: 100,
        outputFile: "/tmp/out.dxf",
      }),
    ).rejects.toThrow("Missing required parameters");
  });

  it("rejects on missing radius", async () => {
    await expect(
      generateDxf({
        lat: 0,
        lon: 0,
        radius: undefined as any,
        outputFile: "/tmp/out.dxf",
      }),
    ).rejects.toThrow("Missing required parameters");
  });

  it("rejects on lat < -90", async () => {
    await expect(
      generateDxf({
        lat: -91,
        lon: 0,
        radius: 100,
        outputFile: "/tmp/out.dxf",
      }),
    ).rejects.toThrow("Invalid latitude");
  });

  it("rejects on lat > 90", async () => {
    await expect(
      generateDxf({ lat: 91, lon: 0, radius: 100, outputFile: "/tmp/out.dxf" }),
    ).rejects.toThrow("Invalid latitude");
  });

  it("rejects on lon < -180", async () => {
    await expect(
      generateDxf({
        lat: 0,
        lon: -181,
        radius: 100,
        outputFile: "/tmp/out.dxf",
      }),
    ).rejects.toThrow("Invalid longitude");
  });

  it("rejects on lon > 180", async () => {
    await expect(
      generateDxf({
        lat: 0,
        lon: 181,
        radius: 100,
        outputFile: "/tmp/out.dxf",
      }),
    ).rejects.toThrow("Invalid longitude");
  });

  it("rejects on radius < 1", async () => {
    await expect(
      generateDxf({ lat: 0, lon: 0, radius: 0, outputFile: "/tmp/out.dxf" }),
    ).rejects.toThrow("Invalid radius");
  });

  it("rejects on radius > 10000", async () => {
    await expect(
      generateDxf({
        lat: 0,
        lon: 0,
        radius: 10001,
        outputFile: "/tmp/out.dxf",
      }),
    ).rejects.toThrow("Invalid radius");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// generateDxf — spawnSync probe failure paths
// ═════════════════════════════════════════════════════════════════════════════

describe("generateDxf — python env probe failure", () => {
  beforeEach(() => {
    spawnSyncMock.mockReset();
    spawnMock.mockReset();
  });

  it("rejects when spawnSync returns an error", async () => {
    spawnSyncMock.mockReturnValue({
      error: new Error("python not found"),
      status: null,
      stdout: "",
      stderr: "",
    });

    await expect(
      generateDxf({
        lat: -23,
        lon: -46,
        radius: 100,
        outputFile: "/tmp/out.dxf",
      }),
    ).rejects.toThrow("Python env probe failed");
  });

  it("rejects when spawnSync returns non-zero exit code", async () => {
    spawnSyncMock.mockReturnValue({
      error: null,
      status: 1,
      stdout: "",
      stderr: "ModuleNotFoundError",
    });

    await expect(
      generateDxf({
        lat: -23,
        lon: -46,
        radius: 100,
        outputFile: "/tmp/out.dxf",
      }),
    ).rejects.toThrow(/exited with code/);
  });

  it("rejects when spawnSync returns invalid JSON", async () => {
    spawnSyncMock.mockReturnValue({
      error: null,
      status: 0,
      stdout: "not-json",
      stderr: "",
    });

    await expect(
      generateDxf({
        lat: -23,
        lon: -46,
        radius: 100,
        outputFile: "/tmp/out.dxf",
      }),
    ).rejects.toThrow(/invalid JSON/);
  });

  it("rejects when missingModules is non-empty", async () => {
    spawnSyncMock.mockReturnValue({
      error: null,
      status: 0,
      stdout: JSON.stringify({
        executable: "/usr/bin/python3",
        version: "3.11.0",
        missingModules: ["ezdxf", "geopandas"],
        pyEnginePathPresent: true,
      }),
      stderr: "",
    });

    await expect(
      generateDxf({
        lat: -23,
        lon: -46,
        radius: 100,
        outputFile: "/tmp/out.dxf",
      }),
    ).rejects.toThrow(/missingModules/);
  });

  it("rejects when pyEnginePathPresent is false", async () => {
    spawnSyncMock.mockReturnValue({
      error: null,
      status: 0,
      stdout: JSON.stringify({
        executable: "/usr/bin/python3",
        version: "3.11.0",
        missingModules: [],
        pyEnginePathPresent: false,
      }),
      stderr: "",
    });

    await expect(
      generateDxf({
        lat: -23,
        lon: -46,
        radius: 100,
        outputFile: "/tmp/out.dxf",
      }),
    ).rejects.toThrow(/pyEnginePathPresent/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// generateDxf — successful spawn → OOM exit
// ═════════════════════════════════════════════════════════════════════════════

describe("generateDxf — OOM exit code", () => {
  beforeEach(() => {
    spawnSyncMock.mockReset();
    spawnMock.mockReset();
    // Advance Date.now past the 5-minute probe TTL to invalidate any cached entries
    jest.spyOn(Date, "now").mockReturnValue(Date.now() + 6 * 60 * 1000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("rejects with PythonOomError when process exits with code 137", async () => {
    // Setup valid probe
    spawnSyncMock.mockReturnValue({
      error: null,
      status: 0,
      stdout: JSON.stringify({
        executable: "/usr/bin/python3",
        version: "3.11.0",
        missingModules: [],
        pyEnginePathPresent: true,
      }),
      stderr: "",
    });

    // Setup spawn mock that immediately emits exit 137
    const eventHandlers: Record<string, (...args: any[]) => void> = {};
    const fakePythonProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event: string, handler: (...args: any[]) => void) => {
        eventHandlers[event] = handler;
      }),
      kill: jest.fn(),
    };

    spawnMock.mockReturnValue(fakePythonProcess);

    const promise = generateDxf({
      lat: -23.5,
      lon: -46.6,
      radius: 100,
      outputFile: "/tmp/out.dxf",
    });

    // Trigger exit with code 137
    setImmediate(() => {
      eventHandlers["close"]?.(137, null);
    });

    await expect(promise).rejects.toBeInstanceOf(PythonOomError);
  });

  it("resolves on exit code 0 with valid stdout path", async () => {
    spawnSyncMock.mockReturnValue({
      error: null,
      status: 0,
      stdout: JSON.stringify({
        executable: "/usr/bin/python3",
        version: "3.11.0",
        missingModules: [],
        pyEnginePathPresent: true,
      }),
      stderr: "",
    });

    const eventHandlers: Record<string, (...args: any[]) => void> = {};
    const stdoutHandlers: Record<string, (...args: any[]) => void> = {};
    const fakePythonProcess = {
      stdout: {
        on: jest.fn((event: string, handler: (...args: any[]) => void) => {
          stdoutHandlers[event] = handler;
        }),
      },
      stderr: { on: jest.fn() },
      on: jest.fn((event: string, handler: (...args: any[]) => void) => {
        eventHandlers[event] = handler;
      }),
      kill: jest.fn(),
    };

    spawnMock.mockReturnValue(fakePythonProcess);

    const promise = generateDxf({
      lat: -23.5,
      lon: -46.6,
      radius: 100,
      outputFile: "/tmp/out.dxf",
    });

    setImmediate(() => {
      // Simulate stdout data with output path
      stdoutHandlers["data"]?.(Buffer.from("OUTPUT_FILE:/tmp/out.dxf\n"));
      eventHandlers["close"]?.(0, null);
    });

    const result = await promise;
    expect(result).toBe("OUTPUT_FILE:/tmp/out.dxf\n");
  });
});

  // ═════════════════════════════════════════════════════════════════════════════
  // generateDxf — optional parameters (layers, btContext, mtContext, memoryLimit)
  // ═════════════════════════════════════════════════════════════════════════════

  describe("generateDxf — optional parameters", () => {
    const validProbe = {
      error: null,
      status: 0,
      stdout: JSON.stringify({
        executable: "/usr/bin/python3",
        version: "3.11.0",
        missingModules: [],
        pyEnginePathPresent: true,
      }),
      stderr: "",
    };

    function makeSuccessProcess(
      stdoutHandlers: Record<string, (...args: any[]) => void>,
      stderrHandlers: Record<string, (...args: any[]) => void>,
      eventHandlers: Record<string, (...args: any[]) => void>,
    ) {
      return {
        stdout: {
          on: jest.fn((event: string, h: (...args: any[]) => void) => { stdoutHandlers[event] = h; }),
        },
        stderr: {
          on: jest.fn((event: string, h: (...args: any[]) => void) => { stderrHandlers[event] = h; }),
        },
        on: jest.fn((event: string, h: (...args: any[]) => void) => { eventHandlers[event] = h; }),
        kill: jest.fn(),
      };
    }

    beforeEach(() => {
      spawnSyncMock.mockReset();
      spawnMock.mockReset();
      jest.spyOn(Date, "now").mockReturnValue(Date.now() + 6 * 60 * 1000);
    });

    afterEach(() => {
      jest.restoreAllMocks();
      delete process.env.PYTHON_MEMORY_LIMIT_MB;
    });

    it("inclui --layers, --bt_context, --mt_context e --memory-limit-mb nos args", async () => {
      spawnSyncMock.mockReturnValue(validProbe);

      const stdoutH: Record<string, (...args: any[]) => void> = {};
      const stderrH: Record<string, (...args: any[]) => void> = {};
      const eventH: Record<string, (...args: any[]) => void> = {};
      spawnMock.mockReturnValue(makeSuccessProcess(stdoutH, stderrH, eventH));

      process.env.PYTHON_MEMORY_LIMIT_MB = "512";

      const promise = generateDxf({
        lat: -23.5,
        lon: -46.6,
        radius: 100,
        outputFile: "/tmp/out.dxf",
        layers: { buildings: true },
        btContext: { version: 1 },
        mtContext: { version: 2 },
      });

      setImmediate(() => {
        stdoutH["data"]?.(Buffer.from("OUTPUT_FILE:/tmp/out.dxf\n"));
        stderrH["data"]?.(Buffer.from("some stderr\n"));
        eventH["close"]?.(0, null);
      });

      const result = await promise;
      expect(result).toContain("OUTPUT_FILE");

      // Verify spawn was called with the optional flags
      const spawnArgs = spawnMock.mock.calls[0];
      const argsArray: string[] = spawnArgs[1] as string[];
      expect(argsArray).toContain("--layers");
      expect(argsArray).toContain("--bt_context");
      expect(argsArray).toContain("--mt_context");
      expect(argsArray).toContain("--memory-limit-mb");
    });
  });

// ═════════════════════════════════════════════════════════════════════════════
// requestContext (trivial coverage)
// ═════════════════════════════════════════════════════════════════════════════

describe("requestContext module", () => {
  it("exports an object with run and getStore methods", async () => {
    const { requestContext } = await import("../utils/requestContext.js");
    expect(typeof requestContext.run).toBe("function");
    expect(typeof requestContext.getStore).toBe("function");
  });

  it("can store and retrieve a value via run()", async () => {
    const { requestContext } = await import("../utils/requestContext.js");
    const result = await new Promise<string | undefined>((resolve) => {
      const store = new Map<string, string>();
      store.set("requestId", "abc-123");
      requestContext.run(store, () => {
        resolve(requestContext.getStore()?.get("requestId"));
      });
    });
    expect(result).toBe("abc-123");
  });
});
