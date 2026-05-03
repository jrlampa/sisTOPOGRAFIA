/**
 * pythonBridge.test.ts
 *
 * Testes para pythonBridge.ts com suporte a probe assíncrono.
 */

import { vi } from "vitest";

// ─── Mock logger ─────────────────────────────────────────────────────────────
vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Mock config ─────────────────────────────────────────────────────────────
vi.mock("../config.js", () => ({
  config: {
    PYTHON_COMMAND: "",
    NODE_ENV: "test",
    isDocker: false,
    PYTHON_PROCESS_TIMEOUT_MS: 5000,
  },
}));

// ─── Mock metricsService ─────────────────────────────────────────────────────
vi.mock("../services/metricsService.js", () => ({
  metricsService: {
    recordMetricObservation: vi.fn(),
    recordDxfGenerationDuration: vi.fn(),
  },
}));

// ─── Mock child_process ──────────────────────────────────────────────────────
const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn<(...args: any[]) => any>(),
}));

vi.mock("child_process", () => ({
  spawn: spawnMock,
  spawnSync: vi.fn(),
}));

// ─── Import targets ──────────────────────────────────────────────────────────
import {
  PythonOomError,
  PYTHON_OOM_EXIT_CODE,
  generateDxf,
} from "../pythonBridge.js";

function makeFakeProcess() {
  const stdoutH: Record<string, (d: any) => void> = {};
  const stderrH: Record<string, (d: any) => void> = {};
  const eventH: Record<string, (c: number) => void> = {};

  return {
    stdout: { on: vi.fn((ev, h) => { stdoutH[ev] = h; }) },
    stderr: { on: vi.fn((ev, h) => { stderrH[ev] = h; }) },
    on: vi.fn((ev, h) => { eventH[ev] = h; }),
    kill: vi.fn(),
    _trigger: (stdoutData?: string, stderrData?: string, exitCode = 0) => {
        if (stdoutData) stdoutH["data"]?.(Buffer.from(stdoutData));
        if (stderrData) stderrH["data"]?.(Buffer.from(stderrData));
        setImmediate(() => eventH["close"]?.(exitCode));
    },
    _triggerTimeout: () => {
        // No-op, just let it time out
    }
  };
}

describe("PythonOomError", () => {
  it("has name = 'PythonOomError'", () => {
    const err = new PythonOomError(512);
    expect(err.name).toBe("PythonOomError");
  });
});

describe("generateDxf — input validation", () => {
  it("rejects on missing lat", async () => {
    await expect(generateDxf({ lat: undefined as any, lon: 0, radius: 100, outputFile: "/tmp/out.dxf" })).rejects.toThrow("Missing required parameters");
  });
});

describe("generateDxf — async flow", () => {
  beforeEach(() => {
    spawnMock.mockReset();
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 6 * 60 * 1000);
  });

  it("resolves when probe and execution both succeed", async () => {
    const probeProc = makeFakeProcess();
    const execProc = makeFakeProcess();

    spawnMock
      .mockReturnValueOnce(probeProc) // first call is probe
      .mockReturnValueOnce(execProc);  // second call is exec

    const promise = generateDxf({ lat: -23, lon: -46, radius: 100, outputFile: "/tmp/out.dxf" });

    // 1. Resolve probe
    probeProc._trigger(JSON.stringify({
      executable: "/usr/bin/python3",
      version: "3.11.0",
      missingModules: [],
      pyEnginePathPresent: true,
    }));

    // 2. Resolve exec
    setImmediate(() => {
        execProc._trigger("OUTPUT_FILE:/tmp/out.dxf\n");
    });

    const result = await promise;
    expect(result).toContain("OUTPUT_FILE");
    expect(spawnMock).toHaveBeenCalledTimes(2);
  });

  it("rejects when probe fails (exit code 1)", async () => {
    const probeProc1 = makeFakeProcess();
    const probeProc2 = makeFakeProcess();
    const probeProc3 = makeFakeProcess();
    spawnMock
      .mockReturnValueOnce(probeProc1)
      .mockReturnValueOnce(probeProc2)
      .mockReturnValueOnce(probeProc3);

    const promise = generateDxf({ lat: -23, lon: -46, radius: 100, outputFile: "/tmp/out.dxf" });

    probeProc1._trigger("", "Python not found", 1);
    setImmediate(() => {
      probeProc2._trigger("", "Py not found", 1);
      setImmediate(() => {
        probeProc3._trigger("", "Python3 not found", 1);
      });
    });

    await expect(promise).rejects.toThrow(/exited with code 1/);
  });

  it("rejects with OOM error on code 137", async () => {
    const probeProc = makeFakeProcess();
    const execProc = makeFakeProcess();
    spawnMock.mockReturnValueOnce(probeProc).mockReturnValueOnce(execProc);

    const promise = generateDxf({ lat: -23, lon: -46, radius: 100, outputFile: "/tmp/out.dxf" });

    probeProc._trigger(JSON.stringify({
        executable: "py", version: "3", missingModules: [], pyEnginePathPresent: true
    }));

    setImmediate(() => {
        execProc._trigger("", "Memory limit exceeded", 137);
    });

    await expect(promise).rejects.toBeInstanceOf(PythonOomError);
  });
});
