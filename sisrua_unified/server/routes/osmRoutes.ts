import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger.js';

const router = Router();

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
    else if (el.tags?.['building:levels']) h = parseFloat(el.tags['building:levels']) * 3.2;

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
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter'
];

const buildMockOverpassPayload = (lat: number, lng: number, radius: number) => {
  const d = Math.max(0.0005, Math.min(radius / 111_000, 0.002));
  return {
    version: 0.6,
    generator: 'Mock Overpass API',
    elements: [
      {
        type: 'node',
        id: 1001,
        lat,
        lon: lng,
        tags: { power: 'pole' }
      },
      {
        type: 'node',
        id: 1002,
        lat: lat + d,
        lon: lng + d,
        tags: { power: 'transformer' }
      },
      {
        type: 'way',
        id: 2001,
        nodes: [1001, 1002],
        geometry: [
          { lat, lon: lng },
          { lat: lat + d, lon: lng + d }
        ],
        tags: { power: 'line', voltage: '13000' }
      }
    ]
  };
};

const fetchWithTimeout = async (url: string, body: string, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
};

router.post('/', async (req: Request, res: Response) => {
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  const radius = Number(req.body?.radius);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius) || radius <= 0) {
    return res.status(400).json({ error: 'Invalid coordinates or radius' });
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
      const response = await fetchWithTimeout(endpoint, requestBody, 30000);
      if (!response.ok) {
        throw new Error(`Overpass API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const stats = computeOsmStats(data.elements ?? []);
      return res.json({ ...data, _stats: stats });
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
    error: lastError instanceof Error ? lastError.message : String(lastError)
  });

  // Resilient fallback so "ANALISE REGIÃO" keeps working even when Overpass is down.
  const mock = buildMockOverpassPayload(lat, lng, radius);
  const fallbackStats = computeOsmStats(mock.elements ?? []);
  return res.status(200).json({ ...mock, _fallback: true, _stats: fallbackStats });
});

router.post('/mock', async (req: Request, res: Response) => {
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  const radius = Number(req.body?.radius ?? 300);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius) || radius <= 0) {
    return res.status(400).json({ error: 'Invalid coordinates or radius' });
  }

  return res.json(buildMockOverpassPayload(lat, lng, radius));
});

export default router;
