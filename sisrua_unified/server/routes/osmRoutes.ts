import { Router, Request, Response } from "express";
import { logger } from "../utils/logger.js";
import { config } from "../config.js";
import { osmRequestSchema } from "../schemas/apiSchemas.js";
import { fetchWithCircuitBreaker } from "../utils/externalApi.js";

const router = Router();
const isTestEnvironment = config.NODE_ENV === "test";

// Simple memory-based cache for OSM requests
// In production, consider Redis or persistent storage
const osmCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours as per user preference

function getCacheKey(lat: number, lng: number, radius: number): string {
  return `${lat.toFixed(6)},${lng.toFixed(6)},${radius}`;
}

// ---------------------------------------------------------------------------
// Stats computation (mirrors the former client-side calculateStats)
// ---------------------------------------------------------------------------
interface OsmStats {
  totalBuildings: number;
  totalRoads: number;
  totalNature: number;
  avgHeight: number;
  maxHeight: number;
}

function computeOsmStats(elements: any[]): OsmStats {
  let buildings = 0;
  let roads = 0;
  let nature = 0;
  let totalHeight = 0;
  let heightCount = 0;
  let maxHeight = 0;

  for (const el of elements) {
    if (el.tags?.building) buildings++;
    if (el.tags?.highway) roads++;
    if (el.tags?.natural || el.tags?.landuse) nature++;

    let h = 0;
    if (el.tags?.height) h = parseFloat(el.tags.height);
    else if (el.tags?.["building:levels"])
      h = parseFloat(el.tags["building:levels"]) * 3.2;

    if (h > 0) {
      totalHeight += h;
      heightCount++;
      if (h > maxHeight) maxHeight = h;
    }
  }

  return {
    totalBuildings: buildings,
    totalRoads: roads,
    totalNature: nature,
    avgHeight: heightCount > 0 ? totalHeight / heightCount : 0,
    maxHeight,
  };
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

interface ParsedCacheKey {
  lat: number;
  lng: number;
  radius: number;
}

function parseCacheKey(key: string): ParsedCacheKey | null {
  const [latStr, lngStr, radiusStr] = key.split(",");
  if (!latStr || !lngStr || !radiusStr) {
    return null;
  }

  const lat = Number(latStr);
  const lng = Number(lngStr);
  const radius = Number(radiusStr);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius)) {
    return null;
  }

  return { lat, lng, radius };
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findNearestStaleCache(
  lat: number,
  lng: number,
  radius: number,
): { data: any; timestamp: number; distanceMeters: number } | null {
  let best:
    | { data: any; timestamp: number; distanceMeters: number }
    | null = null;

  for (const [key, entry] of osmCache.entries()) {
    const parsed = parseCacheKey(key);
    if (!parsed) {
      continue;
    }

    // Reusar somente quando o raio for equivalente (tolerancia de 20%).
    const radiusDelta = Math.abs(parsed.radius - radius);
    if (radiusDelta > radius * 0.2) {
      continue;
    }

    const distanceMeters = haversineMeters(lat, lng, parsed.lat, parsed.lng);
    // Limite pragmatico para evitar resposta muito distante.
    if (distanceMeters > Math.max(1200, radius * 2)) {
      continue;
    }

    if (!best || distanceMeters < best.distanceMeters) {
      best = {
        data: entry.data,
        timestamp: entry.timestamp,
        distanceMeters,
      };
    }
  }

  return best;
}

const buildMockOverpassPayload = (lat: number, lng: number, radius: number) => {
  const d = Math.max(0.0005, Math.min(radius / 111_000, 0.002));
  return {
    version: 0.6,
    generator: "Mock Overpass API",
    elements: [
      {
        type: "node",
        id: 1001,
        lat,
        lon: lng,
        tags: { power: "pole" },
      },
      {
        type: "node",
        id: 1002,
        lat: lat + d,
        lon: lng + d,
        tags: { power: "transformer" },
      },
      {
        type: "way",
        id: 2001,
        nodes: [1001, 1002],
        geometry: [
          { lat, lon: lng },
          { lat: lat + d, lon: lng + d },
        ],
        tags: { power: "line", voltage: "13000" },
      },
    ],
  };
};

function getOverpassCircuitBreakerName(endpoint: string): string {
  try {
    const host = new URL(endpoint).hostname
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toUpperCase();
    return `OVERPASS_${host}`;
  } catch {
    return "OVERPASS_GENERIC";
  }
}

router.post("/", async (req: Request, res: Response) => {
  const validation = osmRequestSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: "Invalid coordinates or radius",
      details: validation.error.issues,
    });
  }

  const { lat, lng, radius } = validation.data;

  // Check Cache
  const cacheKey = getCacheKey(lat, lng, radius);
  const cached = osmCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    logger.info("OSM Cache Hit", { lat, lng, radius });
    return res.json(cached.data);
  }

  const query = `
    [out:json][timeout:60];
    (
      nwr(around:${radius},${lat},${lng});
    );
    out body geom qt;
  `;

  const requestBody = `data=${encodeURIComponent(query)}`;
  let lastError: unknown = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetchWithCircuitBreaker(
        getOverpassCircuitBreakerName(endpoint),
        endpoint,
        {
          method: "POST",
          body: requestBody,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          signal: AbortSignal.timeout(30000),
        },
        { maxRetries: 1, initialDelay: 700, maxDelay: 2000 },
      );

      const data = await response.json();
      const stats = computeOsmStats(data.elements ?? []);
      const result = { ...data, _stats: stats };

      // Set Cache
      osmCache.set(cacheKey, { data: result, timestamp: Date.now() });
      logger.info("OSM Cache Set", { lat, lng, radius });

      return res.json(result);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      logger.warn("Overpass endpoint failed", { endpoint, message });
    }
  }

  logger.error("All Overpass endpoints failed", {
    lat,
    lng,
    radius,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });

  const nearestStale = findNearestStaleCache(lat, lng, radius);
  if (nearestStale) {
    logger.warn("Using nearest stale OSM cache due Overpass outage", {
      lat,
      lng,
      radius,
      distanceMeters: Math.round(nearestStale.distanceMeters),
      ageMinutes: Math.round((Date.now() - nearestStale.timestamp) / 60_000),
    });

    return res.status(200).json({
      ...nearestStale.data,
      _stale: true,
      _staleReason: "OVERPASS_UNAVAILABLE",
      _staleDistanceMeters: Math.round(nearestStale.distanceMeters),
      _staleTimestamp: new Date(nearestStale.timestamp).toISOString(),
    });
  }

  // Strict behavior: synthetic fallback is allowed only in test environment.
  if (isTestEnvironment) {
    const mock = buildMockOverpassPayload(lat, lng, radius);
    const fallbackStats = computeOsmStats(mock.elements ?? []);
    const result = { ...mock, _fallback: true, _stats: fallbackStats };
    return res.status(200).json(result);
  }

  return res.status(503).json({
    error: "OSM provider unavailable",
    message:
      "Nao foi possivel obter dados do Overpass no momento. Tente novamente mais tarde.",
    code: "OVERPASS_UNAVAILABLE",
  });
});

router.post("/mock", async (req: Request, res: Response) => {
  if (!isTestEnvironment) {
    return res.status(404).json({ error: "Route not found" });
  }

  const validation = osmRequestSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: "Invalid coordinates or radius" });
  }

  const { lat, lng, radius } = validation.data;

  return res.json(buildMockOverpassPayload(lat, lng, radius));
});

export default router;
