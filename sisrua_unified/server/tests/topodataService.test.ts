import { vi } from "vitest";
/**
 * topodataService.test.ts
 * Tests for pure-logic methods of TopodataService (no real network/disk I/O)
 */

import fs from "fs";
import { EventEmitter } from "events";
import { spawn } from "child_process";
import * as externalApi from "../utils/externalApi";
import { TopodataService } from "../services/topodataService";

vi.mock("../utils/externalApi");
vi.mock("fs");
vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));
vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Suppress cache-dir creation in module-level code
(fs.existsSync as vi.Mock).mockReturnValue(true);
(fs.mkdirSync as vi.Mock).mockImplementation(() => {});

const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("TopodataService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fs.existsSync as vi.Mock).mockReturnValue(true);
  });

  describe("isWithinBrazil", () => {
    it("should confirm Sao Paulo is within Brazil", () => {
      expect(TopodataService.isWithinBrazil(-23.55, -46.63)).toBe(true);
    });

    it("should confirm Rio de Janeiro is within Brazil", () => {
      expect(TopodataService.isWithinBrazil(-22.9, -43.17)).toBe(true);
    });

    it("should reject coordinates in Australia", () => {
      expect(TopodataService.isWithinBrazil(-25.27, 133.77)).toBe(false);
    });

    it("should reject coordinates in Portugal", () => {
      expect(TopodataService.isWithinBrazil(38.71, -9.14)).toBe(false);
    });

    it("should reject coordinates north of Brazil (5N+)", () => {
      expect(TopodataService.isWithinBrazil(10.0, -55.0)).toBe(false);
    });
  });

  describe("clearCache", () => {
    it("should delete all cached tiles when dir exists", () => {
      (fs.readdirSync as vi.Mock).mockReturnValue(["tile1.tif", "tile2.tif"]);
      (fs.unlinkSync as vi.Mock).mockImplementation(() => {});

      TopodataService.clearCache();

      expect(fs.unlinkSync).toHaveBeenCalledTimes(2);
    });

    it("should not throw if cache dir does not exist", () => {
      (fs.existsSync as vi.Mock).mockReturnValue(false);
      expect(() => TopodataService.clearCache()).not.toThrow();
    });
  });

  describe("getCacheStats", () => {
    it("should return zero stats when cache dir is missing", () => {
      (fs.existsSync as vi.Mock).mockReturnValue(false);
      const stats = TopodataService.getCacheStats();
      expect(stats.files).toBe(0);
      expect(stats.totalSizeMB).toBe(0);
      expect(stats.tiles).toHaveLength(0);
    });

    it("should return file count and size when tiles exist", () => {
      (fs.existsSync as vi.Mock).mockReturnValue(true);
      (fs.readdirSync as vi.Mock).mockReturnValue([
        "tile1.tif",
        "readme.txt",
      ]);
      (fs.statSync as vi.Mock).mockImplementation((p: string) => ({
        size: p.endsWith(".tif") ? 1024 * 1024 * 10 : 1024,
      }));

      const stats = TopodataService.getCacheStats();

      expect(stats.files).toBe(2);
      expect(stats.totalSizeMB).toBeGreaterThan(0);
      expect(stats.tiles).toContain("tile1.tif");
      expect(stats.tiles).not.toContain("readme.txt");
    });
  });

  describe("readElevationFromTiff", () => {
    it("should parse elevation from python bridge stdout", async () => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();

      (spawn as unknown as vi.Mock).mockReturnValue(child);

      const promise = (TopodataService as any).readElevationFromTiff(
        "/tmp/tile.tif",
        -23.55,
        -46.63,
      );

      child.stdout.emit("data", Buffer.from('{"elevation":123.45}'));
      child.emit("close", 0);

      await expect(promise).resolves.toBe(123.45);
    });

    it("should reject when python process exits with non-zero code", async () => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();

      (spawn as unknown as vi.Mock).mockReturnValue(child);

      const promise = (TopodataService as any).readElevationFromTiff(
        "/tmp/tile.tif",
        -23.55,
        -46.63,
      );

      child.stderr.emit("data", Buffer.from("rasterio import error"));
      child.emit("close", 1);

      await expect(promise).rejects.toThrow("Python raster reader failed");
    });

    it("should reject when child process emits error event", async () => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();

      (spawn as unknown as vi.Mock).mockReturnValue(child);

      const promise = (TopodataService as any).readElevationFromTiff(
        "/tmp/tile.tif",
        -23.55,
        -46.63,
      );

      child.emit("error", new Error("spawn ENOENT"));

      await expect(promise).rejects.toThrow("spawn ENOENT");
    });

    it("should reject when elevation payload is not a number", async () => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();

      (spawn as unknown as vi.Mock).mockReturnValue(child);

      const promise = (TopodataService as any).readElevationFromTiff(
        "/tmp/tile.tif",
        -23.55,
        -46.63,
      );

      child.stdout.emit("data", Buffer.from('{"elevation": null}'));
      child.emit("close", 0);

      await expect(promise).rejects.toThrow("Invalid elevation payload");
    });

    it("should reject when python output is not valid JSON", async () => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();

      (spawn as unknown as vi.Mock).mockReturnValue(child);

      const promise = (TopodataService as any).readElevationFromTiff(
        "/tmp/tile.tif",
        -23.55,
        -46.63,
      );

      child.stdout.emit("data", Buffer.from("NOT_JSON"));
      child.emit("close", 0);

      await expect(promise).rejects.toThrow("Invalid raster reader output");
    });
  });

  describe("getElevation", () => {
    const mockFetch = externalApi.fetchWithCircuitBreaker as vi.Mock;

    function makeSpawnChild() {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      return child;
    }

    it("should return elevation when tile is cached and python succeeds", async () => {
      (fs.existsSync as vi.Mock).mockReturnValue(true);
      const child = makeSpawnChild();
      (spawn as unknown as vi.Mock).mockReturnValue(child);

      const promise = TopodataService.getElevation(-23.55, -46.63);
      // Allow getElevation to reach readElevationFromTiff and register listeners
      await Promise.resolve();
      child.stdout.emit("data", Buffer.from('{"elevation": 800}'));
      child.emit("close", 0);

      const result = await promise;
      expect(result).toBe(800);
    });

    it("should download tile when not cached and return elevation", async () => {
      (fs.existsSync as vi.Mock).mockReturnValue(false);
      mockFetch.mockResolvedValueOnce({
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(64)),
      });
      (fs.writeFileSync as vi.Mock).mockImplementation(() => {});

      const child = makeSpawnChild();
      (spawn as unknown as vi.Mock).mockReturnValue(child);

      const promise = TopodataService.getElevation(-23.55, -46.63);

      // Flush all microtasks so download completes and readElevationFromTiff registers listeners
      await flushPromises();

      child.stdout.emit("data", Buffer.from('{"elevation": 650}'));
      child.emit("close", 0);

      const result = await promise;
      expect(result).toBe(650);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("should return null when tile returns 404", async () => {
      (fs.existsSync as vi.Mock).mockReturnValue(false);
      mockFetch.mockRejectedValueOnce(new Error("HTTP error status: 404"));

      const result = await TopodataService.getElevation(-23.55, -46.63);
      expect(result).toBeNull();
    });

    it("should return null when download fails with network error", async () => {
      (fs.existsSync as vi.Mock).mockReturnValue(false);
      mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

      const result = await TopodataService.getElevation(-23.55, -46.63);
      expect(result).toBeNull();
    });

    it("should return null when readElevationFromTiff throws", async () => {
      (fs.existsSync as vi.Mock).mockReturnValue(true);
      const child = makeSpawnChild();
      (spawn as unknown as vi.Mock).mockReturnValue(child);

      const promise = TopodataService.getElevation(-23.55, -46.63);

      // Wait for downloadTile to complete and readElevationFromTiff to register the error listener
      await Promise.resolve();

      child.emit("error", new Error("spawn error"));

      const result = await promise;
      expect(result).toBeNull();
    });
  });

  describe("getElevationProfile", () => {
    it("should return elevation points along a path", async () => {
      vi.spyOn(TopodataService, "getElevation").mockResolvedValue(500);

      const profile = await TopodataService.getElevationProfile(
        -23.55, -46.63, -22.9, -43.2, 2,
      );

      expect(profile).toHaveLength(3);
      expect(profile[0].elevation).toBe(500);
      expect(profile[0]).toHaveProperty("lat");
      expect(profile[0]).toHaveProperty("lng");
    });

    it("should use 0 for null elevation values", async () => {
      vi.spyOn(TopodataService, "getElevation").mockResolvedValue(null);

      const profile = await TopodataService.getElevationProfile(
        -23.55, -46.63, -22.9, -43.2, 1,
      );

      expect(profile.every((p) => p.elevation === 0)).toBe(true);
    });
  });

  describe("getElevationGrid", () => {
    it("should return a grid of elevation points", async () => {
      vi.spyOn(TopodataService, "getElevation").mockResolvedValue(300);

      const result = await TopodataService.getElevationGrid(
        -22.9, -23.1, -43.1, -43.3, 10000,
      );

      expect(result).not.toBeNull();
      expect(result!.points.length).toBeGreaterThan(0);
      expect(result!).toHaveProperty("rows");
      expect(result!).toHaveProperty("cols");
    });
  });
});


