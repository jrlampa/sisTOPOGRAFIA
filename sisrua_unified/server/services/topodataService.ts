import { logger } from "../utils/logger.js";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fetchWithCircuitBreaker } from "../utils/externalApi.js";

/**
 * INPE TOPODATA Service
 *
 * Provides high-resolution elevation data (30m) for Brazilian territory
 * from INPE's refined SRTM data.
 *
 * TOPODATA: http://www.dsr.inpe.br/topodata/index.php
 * Resolution: 30 meters (3x better than open-elevation ~90m)
 * Format: GeoTIFF tiles
 *
 * Features:
 * - Download GeoTIFF tiles on-demand
 * - Extract elevation at specific coordinates
 * - Cache tiles locally
 * - Generate elevation profiles
 */

const TOPODATA_URL = "http://www.dsr.inpe.br/topodata/data/geotiff";
const CACHE_DIR = "./cache/topodata";

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

interface TileInfo {
  lat: number;
  lng: number;
  filename: string;
  url: string;
}

interface ElevationPoint {
  lat: number;
  lng: number;
  elevation: number;
}

export class TopodataService {
  private static isHttpStatusError(error: unknown, status: number): boolean {
    return (
      error instanceof Error && error.message.includes(`status: ${status}`)
    );
  }

  /**
   * Get tile identifier for coordinates
   * TOPODATA uses 1x1 degree tiles
   */
  private static getTileInfo(lat: number, lng: number): TileInfo {
    const tileLat = Math.floor(lat);
    const tileLng = Math.floor(lng);

    // Format: srtm_<longitude>_<latitude>.tif
    // Longitude: negative = W, positive = E
    // Latitude: negative = S, positive = N
    const lonStr =
      tileLng < 0
        ? `W${String(Math.abs(tileLng)).padStart(2, "0")}`
        : `E${String(tileLng).padStart(2, "0")}`;
    const latStr =
      tileLat < 0
        ? `S${String(Math.abs(tileLat)).padStart(2, "0")}`
        : `N${String(tileLat).padStart(2, "0")}`;

    const filename = `srtm_${lonStr}_${latStr}.tif`;
    const url = `${TOPODATA_URL}/${filename}`;

    return {
      lat: tileLat,
      lng: tileLng,
      filename,
      url,
    };
  }

  /**
   * Download tile if not cached
   */
  private static async downloadTile(tile: TileInfo): Promise<string | null> {
    const cachePath = path.join(CACHE_DIR, tile.filename);

    // Check cache
    if (fs.existsSync(cachePath)) {
      logger.info("TOPODATA cache hit", { tile: tile.filename });
      return cachePath;
    }

    // Download
    try {
      logger.info("Downloading TOPODATA tile", {
        tile: tile.filename,
        url: tile.url,
      });

      const response = await fetchWithCircuitBreaker(
        "TOPODATA",
        tile.url,
        { signal: AbortSignal.timeout(30000) },
        { maxRetries: 2, initialDelay: 750, maxDelay: 5000 },
      );

      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(cachePath, buffer);

      logger.info("TOPODATA tile downloaded", {
        tile: tile.filename,
        size: buffer.length,
      });
      return cachePath;
    } catch (error) {
      if (this.isHttpStatusError(error, 404)) {
        logger.warn(
          "TOPODATA tile not found (likely ocean or outside coverage)",
          { tile: tile.filename },
        );
        return null;
      }
      logger.error("TOPODATA download failed", { error, tile: tile.filename });
      return null;
    }
  }

  /**
   * Get elevation at specific coordinates
   * Uses Python bridge to read GeoTIFF
   */
  static async getElevation(lat: number, lng: number): Promise<number | null> {
    const tile = this.getTileInfo(lat, lng);
    const tilePath = await this.downloadTile(tile);

    if (!tilePath) {
      return null;
    }

    try {
      // Use Python to read GeoTIFF elevation
      // This will be implemented via Python bridge
      const elevation = await this.readElevationFromTiff(tilePath, lat, lng);
      return elevation;
    } catch (error) {
      logger.error("TOPODATA elevation read failed", { error, lat, lng });
      return null;
    }
  }

  /**
   * Read elevation from GeoTIFF using Python bridge
   */
  private static async readElevationFromTiff(
    tiffPath: string,
    lat: number,
    lng: number,
  ): Promise<number> {
    const pythonBin = process.env.PYTHON_BIN || "python";
    const script = [
      "import json, sys",
      "import rasterio",
      "from pyproj import Transformer",
      "path = sys.argv[1]",
      "lat = float(sys.argv[2])",
      "lng = float(sys.argv[3])",
      "with rasterio.open(path) as ds:",
      "    x, y = lng, lat",
      '    if ds.crs and ds.crs.to_string().upper() not in ("EPSG:4326", "WGS84"):',
      '        transformer = Transformer.from_crs("EPSG:4326", ds.crs, always_xy=True)',
      "        x, y = transformer.transform(lng, lat)",
      "    sample = list(ds.sample([(x, y)]))[0][0]",
      "    if sample is None:",
      '        raise ValueError("NoData sample")',
      '    print(json.dumps({"elevation": float(sample)}))',
    ].join("\n");

    return await new Promise<number>((resolve, reject) => {
      const child = spawn(
        pythonBin,
        ["-c", script, tiffPath, String(lat), String(lng)],
        { stdio: ["ignore", "pipe", "pipe"] },
      );

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", (error) => {
        reject(error);
      });

      child.on("close", (code) => {
        if (code !== 0) {
          reject(
            new Error(
              `Python raster reader failed (${code}): ${stderr || stdout}`,
            ),
          );
          return;
        }

        try {
          const payload = JSON.parse(stdout.trim()) as { elevation?: number };
          const elevation = payload.elevation;
          if (typeof elevation !== "number" || !Number.isFinite(elevation)) {
            reject(new Error("Invalid elevation payload from raster reader"));
            return;
          }
          resolve(elevation);
        } catch (error) {
          reject(new Error(`Invalid raster reader output: ${String(error)}`));
        }
      });
    });
  }

  /**
   * Get elevation profile between two points
   */
  static async getElevationProfile(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    steps: number = 25,
  ): Promise<ElevationPoint[]> {
    const points: ElevationPoint[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lat = startLat + (endLat - startLat) * t;
      const lng = startLng + (endLng - startLng) * t;

      const elevation = await this.getElevation(lat, lng);
      points.push({
        lat,
        lng,
        elevation: elevation ?? 0,
      });
    }

    return points;
  }

  /**
   * Get elevation grid for terrain analysis
   */
  static async getElevationGrid(
    north: number,
    south: number,
    east: number,
    west: number,
    resolution: number = 30,
  ): Promise<{ points: ElevationPoint[]; rows: number; cols: number } | null> {
    // Calculate grid dimensions
    const latSpan = north - south;
    const lngSpan = east - west;

    // Approximate degrees to meters at this latitude
    const avgLat = (north + south) / 2;
    const metersPerDegLat =
      111132.92 - 559.82 * Math.cos((2 * avgLat * Math.PI) / 180);
    const metersPerDegLng = 111412.84 * Math.cos((avgLat * Math.PI) / 180);

    const rows = Math.min(
      100,
      Math.ceil((latSpan * metersPerDegLat) / resolution),
    );
    const cols = Math.min(
      100,
      Math.ceil((lngSpan * metersPerDegLng) / resolution),
    );

    const points: ElevationPoint[] = [];

    for (let r = 0; r < rows; r++) {
      const lat = south + (latSpan * r) / (rows - 1);
      for (let c = 0; c < cols; c++) {
        const lng = west + (lngSpan * c) / (cols - 1);
        const elevation = await this.getElevation(lat, lng);
        points.push({ lat, lng, elevation: elevation ?? 0 });
      }
    }

    return { points, rows, cols };
  }

  /**
   * Check if coordinates are within Brazilian territory (rough check)
   */
  static isWithinBrazil(lat: number, lng: number): boolean {
    // Brazil bounding box
    return lat >= -34.0 && lat <= 5.0 && lng >= -74.0 && lng <= -34.0;
  }

  /**
   * Clear tile cache
   */
  static clearCache(): void {
    if (fs.existsSync(CACHE_DIR)) {
      const files = fs.readdirSync(CACHE_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(CACHE_DIR, file));
      }
    }
    logger.info("TOPODATA cache cleared");
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): {
    files: number;
    totalSizeMB: number;
    tiles: string[];
  } {
    if (!fs.existsSync(CACHE_DIR)) {
      return { files: 0, totalSizeMB: 0, tiles: [] };
    }

    const files = fs.readdirSync(CACHE_DIR);
    let totalSize = 0;
    const tileFiles: string[] = [];

    for (const file of files) {
      const stats = fs.statSync(path.join(CACHE_DIR, file));
      totalSize += stats.size;
      if (file.endsWith(".tif")) {
        tileFiles.push(file);
      }
    }

    return {
      files: files.length,
      totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
      tiles: tileFiles,
    };
  }
}

export default TopodataService;
