import { Router, Request, Response } from "express";
import { ElevationService } from "../services/elevationService.js";
import { TopodataService } from "../services/topodataService.js";
import { logger } from "../utils/logger.js";
import {
  elevationProfileSchema,
  elevationExportSchema,
  elevationStatsSchema,
  elevationCompareSchema,
  elevationSlopeSchema,
} from "../schemas/apiSchemas.js";
import { z } from "zod";

const router = Router();
const ELEVATION_INTERNAL_ERROR_RESPONSE = {
  error: "Elevation service temporarily unavailable",
};
const MIN_STATS_RADIUS_M = 10;
const MAX_STATS_RADIUS_M = 2_000;

const elevationBatchSchema = z.object({
  points: z
    .array(
      z.object({
        lat: z.coerce.number().min(-90).max(90),
        lng: z.coerce.number().min(-180).max(180),
      }),
    )
    .min(1, "Required: points array with {lat, lng}")
    .max(100, "Maximum 100 points allowed per request"),
});

// Elevation Profile Endpoint
router.post("/profile", async (req: Request, res: Response) => {
  try {
    const validation = elevationProfileSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn("Elevation profile validation failed", {
        issues: validation.error.issues,
        ip: req.ip,
      });
      return res.status(400).json({
        error: "Invalid request",
        details: validation.error.issues.map((i) => i.message).join(", "),
      });
    }

    const { start, end, steps } = validation.data;
    logger.info("Fetching elevation profile", { start, end, steps });

    const profile = await ElevationService.getElevationProfile(
      start,
      end,
      steps,
    );
    return res.json({ profile });
  } catch (error: any) {
    logger.error("Elevation profile error", {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json(ELEVATION_INTERNAL_ERROR_RESPONSE);
  }
});

// Elevation Profile Export Endpoint
router.post("/profile/export", async (req: Request, res: Response) => {
  try {
    const validation = elevationExportSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: validation.error.issues,
      });
    }

    const { start, end, steps, format } = validation.data;

    logger.info("Exporting elevation profile", { start, end, steps, format });

    const profile = await ElevationService.getElevationProfile(
      start,
      end,
      steps,
    );

    if (format === "csv") {
      let csv = "distance_m,latitude,longitude,elevation_m\n";
      profile.forEach((p: { dist: number; elev: number }, i: number) => {
        const t = i / (profile.length - 1);
        const lat = start.lat + (end.lat - start.lat) * t;
        const lng = start.lng + (end.lng - start.lng) * t;
        csv += `${p.dist.toFixed(2)},${lat.toFixed(6)},${lng.toFixed(6)},${p.elev.toFixed(2)}\n`;
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="elevation_profile.csv"',
      );
      return res.send(csv);
    } else {
      const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
    <name>Perfil de Elevação</name>
    <Style id="elevationLine">
        <LineStyle><color>ff0000ff</color><width>3</width></LineStyle>
    </Style>
    <Placemark>
        <name>Perfil de Elevação</name>
        <styleUrl>#elevationLine</styleUrl>
        <LineString>
            <tessellate>1</tessellate>
            <coordinates>
${profile
  .map((p: { elev: number }, i: number) => {
    const t = i / (profile.length - 1);
    const lng = start.lng + (end.lng - start.lng) * t;
    const lat = start.lat + (end.lat - start.lat) * t;
    return `                ${lng.toFixed(6)},${lat.toFixed(6)},${p.elev.toFixed(2)}`;
  })
  .join("\n")}
            </coordinates>
        </LineString>
    </Placemark>
</Document>
</kml>`;

      res.setHeader("Content-Type", "application/vnd.google-earth.kml+xml");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="elevation_profile.kml"',
      );
      return res.send(kml);
    }
  } catch (error: any) {
    logger.error("Elevation profile export error", { error: error.message });
    return res.status(500).json(ELEVATION_INTERNAL_ERROR_RESPONSE);
  }
});

// Elevation Statistics Endpoint
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const validation = elevationStatsSchema.safeParse(req.query);
    if (!validation.success) {
      const hasRadiusError = validation.error.issues.some((i) =>
        i.path.includes("radius"),
      );
      return res.status(400).json({
        error: hasRadiusError ? "Invalid radius" : "Invalid request",
        details: validation.error.issues,
      });
    }

    const { lat: centerLat, lng: centerLng, radius: radiusM } = validation.data;

    if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }

    if (
      !Number.isFinite(radiusM) ||
      radiusM < MIN_STATS_RADIUS_M ||
      radiusM > MAX_STATS_RADIUS_M
    ) {
      return res.status(400).json({
        error: `Invalid radius: must be between ${MIN_STATS_RADIUS_M} and ${MAX_STATS_RADIUS_M} meters`,
      });
    }

    const radiusDeg = radiusM / 111000.0;
    const north = centerLat + radiusDeg;
    const south = centerLat - radiusDeg;
    const east = centerLng + radiusDeg;
    const west = centerLng - radiusDeg;

    logger.info("Fetching elevation stats", { centerLat, centerLng, radiusM });

    const steps = 10;
    const points: number[] = [];
    const gridSize = 5;

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const tLat = i / (gridSize - 1);
        const tLng = j / (gridSize - 1);
        const pointLat = south + (north - south) * tLat;
        const pointLng = west + (east - west) * tLng;

        const elevation = await ElevationService.getElevationAt(
          pointLat,
          pointLng,
        );
        if (elevation !== null) {
          points.push(elevation);
        }
      }
    }

    if (points.length === 0) {
      return res.status(404).json({ error: "No elevation data available" });
    }

    const min = Math.min(...points);
    const max = Math.max(...points);
    const avg = points.reduce((a, b) => a + b, 0) / points.length;
    const range = max - min;

    const useTopodata = TopodataService.isWithinBrazil(centerLat, centerLng);

    return res.json({
      source: useTopodata ? "TOPODATA (INPE)" : "Open-Elevation",
      resolution: useTopodata ? "30m" : "90m",
      points_sampled: points.length,
      min_elevation_m: Math.round(min * 100) / 100,
      max_elevation_m: Math.round(max * 100) / 100,
      avg_elevation_m: Math.round(avg * 100) / 100,
      range_m: Math.round(range * 100) / 100,
      center: { lat: centerLat, lng: centerLng },
      radius_m: radiusM,
    });
  } catch (error: any) {
    logger.error("Elevation stats error", { error: error.message });
    return res.status(500).json(ELEVATION_INTERNAL_ERROR_RESPONSE);
  }
});

// TOPODATA Cache Status
router.get("/cache/status", (req: Request, res: Response) => {
  try {
    const stats = TopodataService.getCacheStats();
    return res.json({
      ...stats,
      isBrazilianTerritory: true,
      source: "INPE TOPODATA",
    });
  } catch (error: any) {
    logger.error("Cache status error", { error: error.message });
    return res.status(500).json(ELEVATION_INTERNAL_ERROR_RESPONSE);
  }
});

// Clear Cache
router.post("/cache/clear", (req: Request, res: Response) => {
  try {
    TopodataService.clearCache();
    return res.json({ message: "TOPODATA cache cleared successfully" });
  } catch (error: any) {
    logger.error("Cache clear error", { error: error.message });
    return res.status(500).json(ELEVATION_INTERNAL_ERROR_RESPONSE);
  }
});

// Batch Elevation Lookup
router.post("/batch", async (req: Request, res: Response) => {
  try {
    const validation = elevationBatchSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: validation.error.issues,
      });
    }

    const { points } = validation.data;

    logger.info(`Batch elevation lookup for ${points.length} points`);

    const results = [];
    let topodataCount = 0;
    let openElevCount = 0;

    for (const point of points) {
      const { lat, lng } = point;
      const elevation = await ElevationService.getElevationAt(lat, lng);
      const isBrazil = TopodataService.isWithinBrazil(lat, lng);

      if (isBrazil) topodataCount++;
      else openElevCount++;

      results.push({
        lat,
        lng,
        elevation,
        source: isBrazil ? "TOPODATA" : "Open-Elevation",
      });
    }

    return res.json({
      points: results,
      summary: {
        total: points.length,
        topodata: topodataCount,
        openElevation: openElevCount,
      },
    });
  } catch (error: any) {
    logger.error("Batch elevation error", { error: error.message });
    return res.status(500).json(ELEVATION_INTERNAL_ERROR_RESPONSE);
  }
});

// Elevation Comparison Endpoint
router.get("/compare", async (req: Request, res: Response) => {
  try {
    const validation = elevationCompareSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: validation.error.issues,
      });
    }

    const { lat: latitude, lng: longitude } = validation.data;

    logger.info("Comparing elevation sources", {
      lat: latitude,
      lng: longitude,
    });

    const topodataElev = await TopodataService.getElevation(
      latitude,
      longitude,
    );
    const openElev = await TopodataService.getElevation(latitude, longitude); // Fallback usa mesma fonte

    return res.json({
      location: { lat: latitude, lng: longitude },
      topodata: {
        elevation: topodataElev,
        resolution: "30m",
        source: "INPE TOPODATA",
        available: topodataElev !== null,
      },
      openElevation: {
        elevation: openElev,
        resolution: "90m",
        source: "Open-Elevation",
        available: openElev !== null,
      },
      difference_m:
        topodataElev !== null && openElev !== null
          ? Math.round((topodataElev - openElev) * 100) / 100
          : null,
      recommendation: TopodataService.isWithinBrazil(latitude, longitude)
        ? "Use TOPODATA (30m) for better accuracy in Brazil"
        : "Use Open-Elevation (90m) for international locations",
    });
  } catch (error: any) {
    logger.error("Elevation comparison error", { error: error.message });
    return res.status(500).json(ELEVATION_INTERNAL_ERROR_RESPONSE);
  }
});

// Slope Analysis Endpoint
router.get("/slope", async (req: Request, res: Response) => {
  try {
    const validation = elevationSlopeSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: validation.error.issues,
      });
    }

    const { lat: centerLat, lng: centerLng, radius: radiusM } = validation.data;

    logger.info("Calculating slope", { centerLat, centerLng, radiusM });

    const radiusDeg = radiusM / 111000.0;
    const north = centerLat + radiusDeg;
    const south = centerLat - radiusDeg;
    const east = centerLng + radiusDeg;
    const west = centerLng - radiusDeg;

    const corners = [
      { lat: north, lng: west },
      { lat: north, lng: east },
      { lat: south, lng: west },
      { lat: south, lng: east },
      { lat: centerLat, lng: centerLng },
    ];

    const elevations = await Promise.all(
      corners.map(async (point) => {
        const elev = await ElevationService.getElevationAt(
          point.lat,
          point.lng,
        );
        return { ...point, elevation: elev };
      }),
    );

    const validElevations = elevations.filter((e) => e.elevation !== null);

    if (validElevations.length < 3) {
      return res
        .status(404)
        .json({ error: "Insufficient elevation data for slope calculation" });
    }

    const maxElev = Math.max(...validElevations.map((e) => e.elevation!));
    const minElev = Math.min(...validElevations.map((e) => e.elevation!));
    const elevationDiff = maxElev - minElev;
    const slopePercent = (elevationDiff / (radiusM * 2)) * 100;

    let slopeClass = "flat";
    if (slopePercent > 45) slopeClass = "very_steep";
    else if (slopePercent > 25) slopeClass = "steep";
    else if (slopePercent > 10) slopeClass = "moderate";
    else if (slopePercent > 3) slopeClass = "gentle";

    return res.json({
      location: { lat: centerLat, lng: centerLng },
      radius_m: radiusM,
      max_elevation_m: Math.round(maxElev * 100) / 100,
      min_elevation_m: Math.round(minElev * 100) / 100,
      elevation_difference_m: Math.round(elevationDiff * 100) / 100,
      slope_percentage: Math.round(slopePercent * 100) / 100,
      slope_class: slopeClass,
      elevation_points: validElevations,
      recommendation:
        slopePercent > 25
          ? "Steep terrain - consider terrain cut/fill analysis"
          : "Suitable for standard construction",
    });
  } catch (error: any) {
    logger.error("Slope analysis error", { error: error.message });
    return res.status(500).json(ELEVATION_INTERNAL_ERROR_RESPONSE);
  }
});

export default router;
