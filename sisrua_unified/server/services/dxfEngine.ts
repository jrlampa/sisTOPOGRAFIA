import { generateDxf } from "../pythonBridge.js";

export interface DxfEngineOptions {
  lat: number;
  lon: number;
  radius: number;
  outputFile: string;
  layers?: Record<string, boolean>;
  mode?: string;
  polygon?: string;
  projection?: string;
  contourRenderMode?: "spline" | "polyline";
  btContext?: Record<string, unknown> | null;
}

export interface DxfEngine {
  generate(options: DxfEngineOptions): Promise<string>;
}

const pythonBridgeDxfEngine: DxfEngine = {
  generate(options) {
    return generateDxf(options);
  },
};

let activeDxfEngine: DxfEngine = pythonBridgeDxfEngine;

export function getDxfEngine(): DxfEngine {
  return activeDxfEngine;
}

export function setDxfEngine(engine: DxfEngine): void {
  activeDxfEngine = engine;
}

export function resetDxfEngine(): void {
  activeDxfEngine = pythonBridgeDxfEngine;
}
