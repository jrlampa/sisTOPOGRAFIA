import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useDxfExport } from "../../src/hooks/useDxfExport";
import type { GeoLocation, LayerConfig } from "../../src/types";

vi.mock("../../src/services/dxfService", () => ({
  generateDXF: vi.fn(),
  getDxfJobStatus: vi.fn(),
}));

import { generateDXF, getDxfJobStatus } from "../../src/services/dxfService";

const center: GeoLocation = { lat: -23.5505, lng: -46.6333, label: "SP" };
const polygon: GeoLocation[] = [
  { lat: -23.5505, lng: -46.6333 },
  { lat: -23.551, lng: -46.634 },
  { lat: -23.5515, lng: -46.633 },
];
const layers: LayerConfig = { buildings: true, roads: true };

describe("useDxfExport basic flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ btContext: { network: "ok" } }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("downloads immediately when backend returns URL", async () => {
    vi.mocked(generateDXF).mockResolvedValueOnce({
      status: "success",
      url: "http://localhost:3001/downloads/test.dxf",
      btContextUrl: "http://localhost:3001/downloads/context.json",
    });

    const onSuccess = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useDxfExport({ onSuccess, onError }),
    );

    await act(async () => {
      await result.current.downloadDxf(center, 500, "polygon", polygon, layers);
    });

    expect(onSuccess).toHaveBeenCalledWith("DXF Downloaded");
  });

  it("polls queued job until completion", async () => {
    vi.mocked(generateDXF).mockResolvedValueOnce({ status: "queued", jobId: "job-123" });
    
    vi.mocked(getDxfJobStatus).mockResolvedValueOnce({
      status: "completed",
      progress: 100,
      result: {
        url: "http://localhost:3001/downloads/job-123.dxf",
      },
    });

    const onSuccess = vi.fn();
    const onError = vi.fn();

    vi.spyOn(window, "setInterval").mockImplementation(((callback: TimerHandler) => {
      void (callback as () => Promise<void>)();
      return 1 as unknown as ReturnType<typeof setInterval>;
    }) as typeof window.setInterval);

    const { result } = renderHook(() => useDxfExport({ onSuccess, onError }));

    await act(async () => {
      await result.current.downloadDxf(center, 500, "circle", [], layers);
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("DXF Downloaded");
    });
  });
});
