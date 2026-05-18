import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import { osmRequestSchema } from '../schemas/apiSchemas.js';
import { fetchWithCircuitBreaker } from '../utils/externalApi.js';

const router = Router();

// Simple memory-based cache for OSM requests
// In production, consider Redis or persistent storage
const osmCache = new Map<string, { data: unknown; timestamp: number }>();
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
  density?: 'Baixa' | 'Média' | 'Alta';
  densityValue?: number; // buildings per km2
}

type OsmElementLike = {
  tags?: Record<string, unknown>;
};

function computeOsmStats(elements: unknown[], radiusMeters: number): OsmStats {
  let buildings = 0;
  let roads = 0;
  let nature = 0;
  let totalHeight = 0;
  let heightCount = 0;
  let maxHeight = 0;

  for (const rawElement of elements) {
    const el: OsmElementLike =
      rawElement && typeof rawElement === 'object' ? (rawElement as OsmElementLike) : {};
    const tags = el.tags ?? {};

    const isBuilding = Boolean(tags['building']);
    if (isBuilding) buildings++;
    if (tags['highway']) roads++;
    if (tags['natural'] || tags['landuse']) nature++;

    let h = 0;
    let hasExplicitHeight = false;
    const heightTag = tags['height'];
    if (typeof heightTag === 'string' || typeof heightTag === 'number') {
      h = parseFloat(String(heightTag));
      hasExplicitHeight = Number.isFinite(h) && h > 0;
    } else {
      const levelsTag = tags['building:levels'];
      if (typeof levelsTag === 'string' || typeof levelsTag === 'number') {
        h = parseFloat(String(levelsTag)) * 3.2;
        hasExplicitHeight = Number.isFinite(h) && h > 0;
      }
    }

    if (!Number.isFinite(h)) {
      h = 0;
    }

    if (!hasExplicitHeight && isBuilding) {
      // Heuristic: Assume 1 floor (3.5m) for buildings without height data
      h = 3.5;
    }

    if (h > 0) {
      totalHeight += h;
      heightCount++;
      if (h > maxHeight) maxHeight = h;
    }
  }

  // Calculate density (buildings per km2)
  const areaKm2 = (Math.PI * Math.pow(radiusMeters, 2)) / 1_000_000;
  const densityValue = buildings / areaKm2;

  let density: 'Baixa' | 'Média' | 'Alta' = 'Baixa';
  if (densityValue > 1000) density = 'Alta';
  else if (densityValue > 250) density = 'Média';

  return {
    totalBuildings: buildings,
    totalRoads: roads,
    totalNature: nature,
    avgHeight: heightCount > 0 ? totalHeight / heightCount : 0,
    maxHeight,
    density,
    densityValue,
  };
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.osm.viabit.com/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass.karlsruhe.de/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass.be/api/interpreter',
  'https://overpass.ie/api/interpreter',
];

interface ParsedCacheKey {
  lat: number;
  lng: number;
  radius: number;
}

function parseCacheKey(key: string): ParsedCacheKey | null {
  const [latStr, lngStr, radiusStr] = key.split(',');
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

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
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
  radius: number
): { data: unknown; timestamp: number; distanceMeters: number } | null {
  let best: { data: unknown; timestamp: number; distanceMeters: number } | null = null;

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

function getOverpassCircuitBreakerName(endpoint: string): string {
  try {
    const host = new URL(endpoint).hostname.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    return `OVERPASS_${host}`;
  } catch {
    return 'OVERPASS_GENERIC';
  }
}

router.post('/', async (req: Request, res: Response) => {
  const validation = osmRequestSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Invalid coordinates or radius',
      details: validation.error.issues,
    });
  }

  const { lat, lng, radius } = validation.data;

  // Check Cache
  const cacheKey = getCacheKey(lat, lng, radius);
  const cached = osmCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    logger.info('OSM Cache Hit', { lat, lng, radius });
    return res.json(cached.data);
  }

  const query = `[out:json][timeout:60];(node(around:${radius},${lat},${lng});way(around:${radius},${lat},${lng});rel(around:${radius},${lat},${lng}););out body geom qt;`;

  const body = new URLSearchParams();
  body.append('data', query);
  let lastError: unknown = null;

  // Randomize endpoints to avoid hitting the same "busy" server every time
  const shuffledEndpoints = [...OVERPASS_ENDPOINTS].sort(() => Math.random() - 0.5);

  for (const endpoint of shuffledEndpoints) {
    try {
      // Attempt 1: GET (Most compatible with public mirrors)
      let response = await fetchWithCircuitBreaker(
        getOverpassCircuitBreakerName(endpoint),
        `${endpoint}?data=${encodeURIComponent(query)}`,
        {
          method: 'GET',
          headers: {
            'User-Agent': 'curl/8.4.0',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(15000), // Timeout reduzido de 60s para 15s
        },
        { maxRetries: 0, initialDelay: 200, maxDelay: 1000 } // Retries reduzidos
      );

      // Attempt 2: Fallback to POST if GET failed with 405 (Method Not Allowed)
      if (!response.ok && response.status === 405) {
        logger.info('Retrying with POST due to 405', { endpoint });
        response = await fetchWithCircuitBreaker(
          getOverpassCircuitBreakerName(endpoint) + '_POST',
          endpoint,
          {
            method: 'POST',
            body: body,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'curl/8.4.0',
            },
            signal: AbortSignal.timeout(15000), // Timeout reduzido
          },
          { maxRetries: 0 }
        );
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const elementsCount = data.elements?.length || 0;

      // Se o servidor retornou 0 elementos, pode ser um servidor regional (ex: .ch, .ru)
      // ou um falso-positivo. Tentamos o próximo para garantir.
      if (elementsCount === 0 && endpoint !== OVERPASS_ENDPOINTS[OVERPASS_ENDPOINTS.length - 1]) {
        logger.warn('Overpass returned 0 elements, trying next endpoint...', {
          endpoint,
          lat,
          lng,
        });
        continue;
      }

      logger.info('Overpass request success', {
        endpoint,
        elementsCount,
        lat,
        lng,
        radius,
      });

      const stats = computeOsmStats(data.elements ?? [], radius);
      const result = { ...data, _stats: stats };

      // Set Cache
      osmCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return res.json(result);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Overpass endpoint failed', { endpoint, message });
    }
  }

  logger.error('All Overpass endpoints failed', {
    lat,
    lng,
    radius,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });

  const nearestStale = findNearestStaleCache(lat, lng, radius);
  if (nearestStale) {
    const staleData =
      nearestStale.data && typeof nearestStale.data === 'object'
        ? (nearestStale.data as Record<string, unknown>)
        : {};
    logger.warn('Using nearest stale OSM cache due Overpass outage', {
      lat,
      lng,
      radius,
      distanceMeters: Math.round(nearestStale.distanceMeters),
      ageMinutes: Math.round((Date.now() - nearestStale.timestamp) / 60_000),
    });

    return res.status(200).json({
      ...staleData,
      _stale: true,
      _staleReason: 'OVERPASS_UNAVAILABLE',
      _staleDistanceMeters: Math.round(nearestStale.distanceMeters),
      _staleTimestamp: new Date(nearestStale.timestamp).toISOString(),
    });
  }

  return res.status(503).json({
    error: 'OSM provider unavailable',
    message: 'Nao foi possivel obter dados do Overpass no momento. Tente novamente mais tarde.',
    code: 'OVERPASS_UNAVAILABLE',
  });
});

export default router;
