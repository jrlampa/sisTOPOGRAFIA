import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger.js';

const router = Router();

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
      return res.json(data);
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
  return res.status(200).json({ ...mock, _fallback: true });
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
