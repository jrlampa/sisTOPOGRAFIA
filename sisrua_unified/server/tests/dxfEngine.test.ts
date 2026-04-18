/**
 * dxfEngine.test.ts
 *
 * Testes para getDxfEngine, setDxfEngine, resetDxfEngine e pythonBridgeDxfEngine.generate
 */

jest.mock("../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockGenerateDxf = jest.fn();
jest.mock("../pythonBridge.js", () => ({
  generateDxf: (...args: unknown[]) => mockGenerateDxf(...args),
}));

import {
  getDxfEngine,
  setDxfEngine,
  resetDxfEngine,
  DxfEngine,
  DxfEngineOptions,
} from "../services/dxfEngine.js";

const baseOptions: DxfEngineOptions = {
  lat: -23.5,
  lon: -46.6,
  radius: 500,
  outputFile: "/tmp/out.dxf",
};

describe("dxfEngine", () => {
  afterEach(() => {
    resetDxfEngine();
    jest.clearAllMocks();
  });

  it("getDxfEngine retorna o engine padrão (pythonBridge)", () => {
    const engine = getDxfEngine();
    expect(engine).toBeDefined();
    expect(typeof engine.generate).toBe("function");
  });

  it("pythonBridgeDxfEngine.generate chama generateDxf com as opções", async () => {
    mockGenerateDxf.mockResolvedValue("/tmp/out.dxf");
    const result = await getDxfEngine().generate(baseOptions);
    expect(mockGenerateDxf).toHaveBeenCalledWith(baseOptions);
    expect(result).toBe("/tmp/out.dxf");
  });

  it("setDxfEngine substitui o engine ativo", async () => {
    const fakeEngine: DxfEngine = {
      generate: jest.fn().mockResolvedValue("/tmp/fake.dxf"),
    };
    setDxfEngine(fakeEngine);
    const result = await getDxfEngine().generate(baseOptions);
    expect(result).toBe("/tmp/fake.dxf");
    expect(fakeEngine.generate).toHaveBeenCalledWith(baseOptions);
  });

  it("resetDxfEngine restaura o engine padrão após setDxfEngine", async () => {
    const fakeEngine: DxfEngine = {
      generate: jest.fn().mockResolvedValue("/tmp/fake.dxf"),
    };
    setDxfEngine(fakeEngine);
    resetDxfEngine();
    mockGenerateDxf.mockResolvedValue("/tmp/restored.dxf");
    const result = await getDxfEngine().generate(baseOptions);
    expect(mockGenerateDxf).toHaveBeenCalled();
    expect(result).toBe("/tmp/restored.dxf");
  });
});
